from __future__ import annotations

import ctypes
from ctypes import wintypes
import os
from typing import Any

from fastapi import Request

from app.core.errors import AppError

CSRF_HEADER_NAME = "X-Research-Studio-Client"
CSRF_HEADER_VALUE = "local-web"
MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_LOOPBACK_HEADER_HOSTS = frozenset({"127.0.0.1", "localhost", "[::1]"})

_CRYPTPROTECT_UI_FORBIDDEN = 0x01


class DpapiUnreadableError(Exception):
    """Raised when DPAPI cannot decrypt a stored ciphertext blob for the current Windows user."""


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def _get_win32_dpapi_funcs() -> tuple[Any, Any]:
    if os.name != "nt":
        raise RuntimeError("Windows DPAPI is only supported on Windows.")
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32

    crypt32.CryptProtectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        wintypes.LPCWSTR,
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL

    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        ctypes.POINTER(wintypes.LPWSTR),
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL

    kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
    kernel32.LocalFree.restype = wintypes.HLOCAL
    return crypt32, kernel32


def _make_input_blob(data: bytes) -> tuple[_DataBlob, ctypes.Array[ctypes.c_ubyte]]:
    buf = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    return _DataBlob(len(data), buf), buf


def dpapi_protect(plaintext: bytes) -> bytes:
    """Encrypt bytes for the current Windows user via CryptProtectData and free Win32 heap memory."""
    if not plaintext:
        return b""
    crypt32, kernel32 = _get_win32_dpapi_funcs()
    in_blob, _buf_guard = _make_input_blob(plaintext)
    out_blob = _DataBlob()
    ok = crypt32.CryptProtectData(
        ctypes.byref(in_blob),
        "ResearchStudioSecret",
        None,
        None,
        None,
        _CRYPTPROTECT_UI_FORBIDDEN,
        ctypes.byref(out_blob),
    )
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        if out_blob.pbData:
            kernel32.LocalFree(out_blob.pbData)


def dpapi_unprotect(ciphertext: bytes) -> bytes:
    """Decrypt bytes protected via DPAPI for the current Windows user, freeing Win32 buffers safely."""
    if not ciphertext:
        raise DpapiUnreadableError("Empty DPAPI payload")
    crypt32, kernel32 = _get_win32_dpapi_funcs()
    in_blob, _buf_guard = _make_input_blob(ciphertext)
    out_blob = _DataBlob()
    descr_ptr = wintypes.LPWSTR()
    ok = crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        ctypes.byref(descr_ptr),
        None,
        None,
        None,
        _CRYPTPROTECT_UI_FORBIDDEN,
        ctypes.byref(out_blob),
    )
    if descr_ptr:
        kernel32.LocalFree(descr_ptr)
    if not ok:
        raise DpapiUnreadableError("Failed to decrypt DPAPI blob for current Windows account")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        if out_blob.pbData:
            kernel32.LocalFree(out_blob.pbData)


def mask_api_key(raw_key: str) -> str:
    """Return a redacted preview of an API key (e.g., AIza...9x2A) for UI status responses."""
    cleaned = raw_key.strip()
    if len(cleaned) <= 8:
        return "***"
    return f"{cleaned[:4]}...{cleaned[-4:]}"


def _extract_host_name(raw_host: str) -> str:
    """Parse an HTTP Host header value into a lowercase hostname without port."""
    cleaned = raw_host.strip()
    if not cleaned or any(ch.isspace() or ch in ",/@" for ch in cleaned):
        return ""
    if cleaned.startswith("["):
        end_idx = cleaned.find("]")
        if end_idx <= 1:
            return ""
        host_part = cleaned[: end_idx + 1].lower()
        rest = cleaned[end_idx + 1 :]
        if rest:
            if not rest.startswith(":") or not rest[1:].isdigit():
                return ""
        return host_part
    if ":" in cleaned:
        host_part, port_part = cleaned.rsplit(":", 1)
        if not port_part.isdigit():
            return ""
        return host_part.lower()
    return cleaned.lower()


def _verify_loopback_host(request: Request) -> None:
    """Reject DNS-rebound Host headers across all endpoints (GET, docs, export, and mutations)."""
    raw_host = request.headers.get("host", "")
    host_name = _extract_host_name(raw_host)
    is_in_memory_test_client = (
        host_name == "testserver"
        and request.client is not None
        and request.client.host == "testclient"
    )
    if host_name in _LOOPBACK_HEADER_HOSTS or is_in_memory_test_client:
        return
    raise AppError(
        code="HOST_NOT_ALLOWED",
        message="Header Host không thuộc địa chỉ loopback cục bộ hợp lệ.",
        status_code=403,
        details={"host": raw_host[:120]},
    )


def verify_local_csrf_and_origin(request: Request, allowed_origins: set[str]) -> None:
    """Block DNS rebinding, cross-site reads/triggers, and drive-by localhost CSRF."""
    _verify_loopback_host(request)

    if not request.url.path.startswith("/api/v1"):
        return

    origin = request.headers.get("origin")
    if origin is not None and origin not in allowed_origins:
        raise AppError(
            code="CSRF_ORIGIN_FORBIDDEN",
            message="Nguồn gọi (Origin) không thuộc địa chỉ localhost cho phép.",
            status_code=403,
            details={"origin": origin},
        )

    sec_fetch_site = (request.headers.get("sec-fetch-site") or "").strip().lower()
    if sec_fetch_site == "cross-site" and (origin is None or origin not in allowed_origins):
        raise AppError(
            code="CSRF_CROSS_SITE_BLOCKED",
            message="Yêu cầu cross-site từ trang web bên ngoài bị chặn để bảo vệ dữ liệu cục bộ.",
            status_code=403,
            details={"secFetchSite": sec_fetch_site},
        )

    is_mutating = request.method.upper() in MUTATING_METHODS
    is_paid_refresh_get = (
        request.method.upper() == "GET"
        and request.url.path == "/api/v1/global/categories"
        and request.query_params.get("refresh", "").strip().lower() in ("1", "true", "yes", "on")
    )
    if is_mutating or is_paid_refresh_get:
        client_header = request.headers.get(CSRF_HEADER_NAME)
        if client_header != CSRF_HEADER_VALUE:
            raise AppError(
                code="CSRF_HEADER_MISSING",
                message="Thiếu header xác thực client cục bộ hợp lệ.",
                status_code=403,
                details={"requiredHeader": CSRF_HEADER_NAME},
            )
