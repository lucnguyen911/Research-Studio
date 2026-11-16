from __future__ import annotations

from collections.abc import Callable, Sequence
from email.utils import parsedate_to_datetime
import hashlib
import html
from html.parser import HTMLParser
import ipaddress
import re
import socket
from typing import Any
from urllib.parse import urljoin, urlsplit
import xml.etree.ElementTree as stdlib_ET

from defusedxml import ElementTree as DefusedET
from defusedxml.common import DefusedXmlException
import anyio
import httpcore
import httpx

from app.core.config import (
    HTTP_CONNECT_TIMEOUT_SEC,
    HTTP_READ_TIMEOUT_SEC,
    RSS_MAX_PAYLOAD_BYTES,
)
from app.core.errors import AppError

MAX_RSS_REDIRECT_HOPS = 3
_IGNORED_HTML_SUBTREE_TAGS = frozenset({"script", "style", "noscript", "iframe", "svg", "object"})
_BLOCK_HTML_TAGS = frozenset({"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "blockquote"})

DnsResolver = Callable[[str, int], Sequence[tuple[Any, ...]]]


class _SafePlainTextHtmlParser(HTMLParser):
    """Strip HTML tags cleanly while discarding all text inside dangerous embedded subtrees."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        lowered = tag.lower()
        if lowered in _IGNORED_HTML_SUBTREE_TAGS:
            self._skip_depth += 1
        elif self._skip_depth == 0 and lowered in _BLOCK_HTML_TAGS:
            self._chunks.append(" ")

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in _IGNORED_HTML_SUBTREE_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif self._skip_depth == 0 and lowered in _BLOCK_HTML_TAGS:
            self._chunks.append(" ")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data:
            self._chunks.append(data)

    def get_plain_text(self) -> str:
        joined = html.unescape("".join(self._chunks))
        return re.sub(r"\s+", " ", joined).strip()


def sanitize_html_to_text(raw_html: str | None, *, max_chars: int = 2000) -> str:
    """Convert untrusted RSS HTML fragments into safe plain text without <script>/<style> leakage."""
    if not raw_html:
        return ""
    extractor = _SafePlainTextHtmlParser()
    extractor.feed(raw_html)
    extractor.close()
    cleaned = extractor.get_plain_text()
    if len(cleaned) > max_chars:
        return cleaned[: max_chars - 1].rstrip() + "…"
    return cleaned


def sanitize_http_url(raw_url: str | None) -> str:
    """Allow strictly http:// or https:// URLs without embedded credentials."""
    if not raw_url:
        return ""
    cleaned = raw_url.strip()
    if not cleaned:
        return ""
    parts = urlsplit(cleaned)
    if parts.scheme.lower() not in ("http", "https"):
        return ""
    if not parts.hostname or parts.username or parts.password:
        return ""
    return cleaned


def _default_dns_resolver(host: str, port: int) -> list[tuple[Any, ...]]:
    return socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)


def _ensure_ip_globally_routable(raw_ip: str) -> None:
    stripped = raw_ip.split("%")[0].strip()
    try:
        ip = ipaddress.ip_address(stripped)
    except ValueError as exc:
        raise AppError("RSS_SSRF_BLOCKED", "Địa chỉ IP đích của nguồn RSS không hợp lệ.", status_code=400) from exc

    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        _ensure_ip_globally_routable(str(mapped))

    if (
        not ip.is_global
        or ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        raise AppError(
            code="RSS_SSRF_BLOCKED",
            message="Bị chặn vì lý do bảo mật SSRF: URL trỏ vào localhost, mạng nội bộ LAN hoặc metadata.",
            status_code=400,
            details={"blockedIp": str(ip)},
        )


def validate_public_feed_url(raw_url: str, *, resolver: DnsResolver | None = None) -> str:
    """Validate RSS URL protocol, hostname, and ensure every resolved DNS IP is globally routable."""
    cleaned = raw_url.strip()
    parts = urlsplit(cleaned)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise AppError(
            code="RSS_INVALID_URL",
            message="URL RSS chỉ hỗ trợ giao thức http:// hoặc https://.",
            status_code=400,
        )
    if parts.username or parts.password:
        raise AppError(
            code="RSS_INVALID_URL",
            message="URL RSS không được chứa thông tin đăng nhập.",
            status_code=400,
        )
    hostname = (parts.hostname or "").strip().lower()
    if not hostname:
        raise AppError("RSS_INVALID_URL", "URL RSS thiếu tên miền hợp lệ.", status_code=400)

    if (
        hostname == "localhost"
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
        or hostname.endswith(".internal")
        or hostname.endswith(".arpa")
    ):
        raise AppError(
            code="RSS_SSRF_BLOCKED",
            message="Bị chặn vì lý do bảo mật SSRF: không cho phép truy cập localhost hoặc tên miền nội bộ.",
            status_code=400,
        )

    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        _ensure_ip_globally_routable(hostname)
        return cleaned

    port = parts.port or (443 if scheme == "https" else 80)
    resolve_fn = resolver or _default_dns_resolver
    try:
        addr_infos = resolve_fn(hostname, port)
    except OSError as exc:
        raise AppError(
            code="RSS_DNS_FAILED",
            message=f"Không phân giải được tên miền nguồn RSS ({hostname}).",
            status_code=400,
        ) from exc

    if not addr_infos:
        raise AppError("RSS_DNS_FAILED", f"Tên miền {hostname} không trả về địa chỉ IP nào.", status_code=400)

    for info in addr_infos:
        sockaddr = info[4]
        if isinstance(sockaddr, tuple) and sockaddr:
            _ensure_ip_globally_routable(str(sockaddr[0]))

    return cleaned


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1].lower()
    return tag.lower()


def _child_text(element: stdlib_ET.Element, *names: str) -> str:
    wanted = {name.lower() for name in names}
    for child in element:
        if _local_tag(child.tag) in wanted and child.text:
            return child.text.strip()
    return ""


def _parse_pub_date_iso(raw_date: str | None) -> str | None:
    if not raw_date:
        return None
    cleaned = raw_date.strip()
    if not cleaned:
        return None
    iso_candidate = cleaned[:-1] + "+00:00" if cleaned.endswith("Z") else cleaned
    try:
        from datetime import datetime, timezone

        parsed_iso = datetime.fromisoformat(iso_candidate)
        if parsed_iso.tzinfo is None:
            parsed_iso = parsed_iso.replace(tzinfo=timezone.utc)
        return parsed_iso.astimezone(timezone.utc).isoformat()
    except ValueError:
        pass
    try:
        from datetime import timezone

        parsed_rfc = parsedate_to_datetime(cleaned)
        if parsed_rfc.tzinfo is None:
            parsed_rfc = parsed_rfc.replace(tzinfo=timezone.utc)
        return parsed_rfc.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, IndexError):
        return None


def parse_feed_xml(raw_bytes: bytes) -> list[dict[str, Any]]:
    """Parse RSS 2.0 or Atom XML securely using defusedxml and return sanitized plain-text items."""
    try:
        root = DefusedET.fromstring(raw_bytes)
    except (DefusedXmlException, stdlib_ET.ParseError) as exc:
        raise AppError(
            code="RSS_INVALID_XML",
            message="Nội dung nguồn RSS/Atom không phải XML hợp lệ hoặc bị từ chối bởi bộ lọc XXE.",
            status_code=422,
        ) from exc

    root_name = _local_tag(root.tag)
    articles: list[dict[str, Any]] = []

    if root_name == "rss" or root_name == "rdf":
        item_elements = [el for el in root.iter() if _local_tag(el.tag) == "item"]
        for item in item_elements:
            raw_title = _child_text(item, "title")
            raw_link = _child_text(item, "link")
            raw_guid = _child_text(item, "guid")
            raw_desc = _child_text(item, "encoded", "description")
            raw_pub = _child_text(item, "pubdate", "date", "published", "updated")
            title = sanitize_html_to_text(raw_title, max_chars=400) or "Bài viết không tiêu đề"
            summary = sanitize_html_to_text(raw_desc, max_chars=2500)
            canonical_url = sanitize_http_url(raw_link) or sanitize_http_url(raw_guid)
            published_at = _parse_pub_date_iso(raw_pub)
            dedup_seed = raw_guid or canonical_url or hashlib.sha256(f"{title}|{published_at or ''}".encode("utf-8")).hexdigest()
            articles.append(
                {
                    "dedup_key": dedup_seed[:512],
                    "canonical_url": canonical_url,
                    "title": title,
                    "summary_text": summary,
                    "published_at": published_at,
                }
            )
    elif root_name == "feed":
        entry_elements = [el for el in root if _local_tag(el.tag) == "entry"]
        for entry in entry_elements:
            raw_title = _child_text(entry, "title")
            raw_id = _child_text(entry, "id")
            raw_summary = _child_text(entry, "summary", "content")
            raw_pub = _child_text(entry, "published", "updated")
            link_href = ""
            for child in entry:
                if _local_tag(child.tag) == "link":
                    rel = (child.attrib.get("rel") or "alternate").lower()
                    href = child.attrib.get("href") or (child.text or "")
                    candidate = sanitize_http_url(href)
                    if candidate and (rel == "alternate" or not link_href):
                        link_href = candidate
            title = sanitize_html_to_text(raw_title, max_chars=400) or "Bài viết không tiêu đề"
            summary = sanitize_html_to_text(raw_summary, max_chars=2500)
            published_at = _parse_pub_date_iso(raw_pub)
            dedup_seed = raw_id or link_href or hashlib.sha256(f"{title}|{published_at or ''}".encode("utf-8")).hexdigest()
            articles.append(
                {
                    "dedup_key": dedup_seed[:512],
                    "canonical_url": link_href,
                    "title": title,
                    "summary_text": summary,
                    "published_at": published_at,
                }
            )
    else:
        raise AppError(
            code="RSS_UNSUPPORTED_FORMAT",
            message="Tệp XML không đúng định dạng RSS 2.0 hoặc Atom.",
            status_code=422,
        )

    return articles


class _SafePublicNetworkBackend(httpcore.AsyncNetworkBackend):
    """Resolve hostname once per TCP connection, enforce global-IP validation, and connect by pinned IP."""

    def __init__(self, *, resolver: DnsResolver | None = None) -> None:
        self._inner = httpcore.AnyIOBackend()
        self._resolver = resolver or _default_dns_resolver

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Any = None,
    ) -> httpcore.AsyncNetworkStream:
        clean_host = host.strip("[]")
        lowered = clean_host.lower()
        if (
            lowered == "localhost"
            or lowered.endswith(".localhost")
            or lowered.endswith(".local")
            or lowered.endswith(".internal")
            or lowered.endswith(".arpa")
        ):
            raise AppError(
                code="RSS_SSRF_BLOCKED",
                message="Bị chặn vì lý do bảo mật SSRF: không cho phép truy cập localhost hoặc tên miền nội bộ.",
                status_code=400,
            )

        try:
            ipaddress.ip_address(clean_host)
        except ValueError:
            try:
                addr_infos = await anyio.to_thread.run_sync(lambda: self._resolver(clean_host, port))
            except OSError as exc:
                raise AppError(
                    code="RSS_DNS_FAILED",
                    message=f"Không phân giải được tên miền nguồn RSS ({clean_host}).",
                    status_code=400,
                ) from exc
            if not addr_infos:
                raise AppError("RSS_DNS_FAILED", f"Tên miền {clean_host} không trả về địa chỉ IP nào.", status_code=400)

            validated_ips: list[str] = []
            seen: set[str] = set()
            for info in addr_infos:
                sockaddr = info[4]
                if isinstance(sockaddr, tuple) and sockaddr:
                    ip_str = str(sockaddr[0]).split("%")[0].strip()
                    _ensure_ip_globally_routable(ip_str)
                    if ip_str not in seen:
                        seen.add(ip_str)
                        validated_ips.append(ip_str)
            if not validated_ips:
                raise AppError("RSS_DNS_FAILED", f"Tên miền {clean_host} không trả về địa chỉ IP hợp lệ.", status_code=400)

            last_connect_err: httpcore.ConnectError | None = None
            for target_ip in validated_ips:
                try:
                    return await self._inner.connect_tcp(
                        target_ip,
                        port,
                        timeout=timeout,
                        local_address=local_address,
                        socket_options=socket_options,
                    )
                except httpcore.ConnectError as exc:
                    last_connect_err = exc
            assert last_connect_err is not None
            raise last_connect_err

        _ensure_ip_globally_routable(clean_host)
        return await self._inner.connect_tcp(
            clean_host,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )

    async def connect_unix_socket(
        self,
        path: str,
        timeout: float | None = None,
        socket_options: Any = None,
    ) -> httpcore.AsyncNetworkStream:
        raise AppError("RSS_SSRF_BLOCKED", "Không cho phép kết nối UNIX socket từ nguồn RSS.", status_code=400)

    async def sleep(self, seconds: float) -> None:
        await self._inner.sleep(seconds)


class _PinnedPublicHTTPTransport(httpx.AsyncHTTPTransport):
    """HTTP transport pinning outbound connections to DNS-validated public IPs against TOCTOU rebinding."""

    def __init__(self, *, resolver: DnsResolver | None = None) -> None:
        super().__init__(verify=True, trust_env=False, retries=0)
        ssl_context = httpx.create_ssl_context(verify=True, trust_env=False)
        self._pool = httpcore.AsyncConnectionPool(
            ssl_context=ssl_context,
            max_connections=10,
            max_keepalive_connections=5,
            retries=0,
            network_backend=_SafePublicNetworkBackend(resolver=resolver),
        )


async def fetch_and_parse_feed(
    url: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    resolver: DnsResolver | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch an RSS/Atom feed safely:
    - Re-validates DNS/IP on the initial URL and EVERY HTTP redirect hop (<= 3 hops).
    - Pins TCP connections via _SafePublicNetworkBackend to defend against DNS rebinding TOCTOU.
    - Aborts streaming payloads larger than 5 MB.
    - Parses via defusedxml and strips unsafe HTML subtrees via HTMLParser.
    """
    current_url = validate_public_feed_url(url, resolver=resolver)
    timeout = httpx.Timeout(timeout=HTTP_READ_TIMEOUT_SEC, connect=HTTP_CONNECT_TIMEOUT_SEC)
    active_transport: httpx.AsyncBaseTransport = (
        transport if transport is not None else _PinnedPublicHTTPTransport(resolver=resolver)
    )

    async with httpx.AsyncClient(
        timeout=timeout,
        transport=active_transport,
        follow_redirects=False,
        trust_env=False,
    ) as client:
        for hop in range(MAX_RSS_REDIRECT_HOPS + 1):
            try:
                async with client.stream(
                    "GET",
                    current_url,
                    headers={"User-Agent": "ResearchStudio-RSS/1.0 (+local-first)"},
                ) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location", "").strip()
                        if not location:
                            raise AppError("RSS_INVALID_REDIRECT", "Redirect thiếu header Location.", status_code=502)
                        if hop >= MAX_RSS_REDIRECT_HOPS:
                            raise AppError("RSS_TOO_MANY_REDIRECTS", "Nguồn RSS chuyển hướng quá 3 lần.", status_code=502)
                        next_url = urljoin(current_url, location)
                        current_url = validate_public_feed_url(next_url, resolver=resolver)
                        continue

                    if response.status_code >= 400:
                        raise AppError(
                            code="RSS_HTTP_ERROR",
                            message=f"Nguồn RSS trả về mã lỗi HTTP {response.status_code}.",
                            status_code=502,
                            details={"httpStatus": response.status_code},
                        )

                    chunks: list[bytes] = []
                    total_bytes = 0
                    async for chunk in response.aiter_bytes():
                        total_bytes += len(chunk)
                        if total_bytes > RSS_MAX_PAYLOAD_BYTES:
                            raise AppError(
                                code="RSS_PAYLOAD_TOO_LARGE",
                                message="Kích thước nguồn RSS vượt quá giới hạn an toàn 5 MB.",
                                status_code=413,
                            )
                        chunks.append(chunk)
                    return parse_feed_xml(b"".join(chunks))
            except httpx.ConnectError as exc:
                raise AppError("RSS_CONNECT_FAILED", "Không thể kết nối tới máy chủ RSS.", status_code=503) from exc
            except httpx.TimeoutException as exc:
                raise AppError("RSS_TIMEOUT", "Kết nối tới nguồn RSS bị quá thời gian chờ.", status_code=504) from exc
            except httpx.HTTPError as exc:
                raise AppError("RSS_TRANSPORT_ERROR", "Lỗi truyền tải khi đọc nguồn RSS.", status_code=502) from exc

    raise AppError("RSS_TOO_MANY_REDIRECTS", "Nguồn RSS chuyển hướng quá giới hạn cho phép.", status_code=502)
