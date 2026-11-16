# BÁO CÁO SECURITY REVIEW PHASE 10 — RESEARCH STUDIO

**Ngày review:** 2026-11-16  
**Baseline Git trước Phase 10:** `0f6bc38` (`main`)  
**Trạng thái API Key thật trên máy hiện tại:** Chưa cấu hình (`%LOCALAPPDATA%\ResearchStudio\data\research_studio.db` chưa tồn tại)  

---

## 1. PHASE 10 VERDICT: PASS WITH LIMITATIONS

- **Kết luận tổng quát:** **`PASS WITH LIMITATIONS`** — Hệ thống hoàn tất rà soát bảo mật chuyên sâu theo mô hình rủi ro Windows 11 local-first, tái hiện và sửa triệt để **5 phát hiện bảo mật mới (`SEC-01`..`SEC-05`: `0 CRITICAL`, `2 HIGH`, `2 MEDIUM`, `1 LOW`)** cùng **6 test hồi quy tấn công chủ động** trong `backend/tests/test_phase10_security_review.py` (**`57/57` backend tests PASS**), xác minh live RSS HTTPS (`hnrss.org`) qua transport ghim IP công khai + giải nén có giới hạn, xác minh header phản hồi thực tế qua Chrome DevTools MCP, và `npm audit = 0 vulnerabilities`.
- **Giới hạn bắt buộc giữ nguyên (`NOT TESTED`):** **`YouTube API live = NOT TESTED`** — Máy hiện tại chưa có YouTube Data API v3 Key thật nên phần gọi trực tiếp tới `https://www.googleapis.com/youtube/v3/*` chưa kiểm chứng live. Không tạo khóa, không yêu cầu gửi khóa và không lấy kết quả `httpx.MockTransport` thay cho live verification.

---

## 2. MÔ HÌNH RỦI RO ĐÃ KIỂM TRA

Phù hợp kiến trúc Windows 11 local-first (React 19 + Vite tại `127.0.0.1:5173`, FastAPI + Uvicorn tại `127.0.0.1:8000`, SQLite WAL tại `%LOCALAPPDATA%\ResearchStudio\`, Windows DPAPI):

1. **Ranh giới Localhost HTTP (`Browser <-> 127.0.0.1:5173/8000`):** Tấn công DNS Rebinding tới `127.0.0.1:8000`, drive-by cross-site `GET` / `<img>` / `<script>` từ website độc hại bên ngoài, CORS preflight, tiêu hao quota qua endpoint `GET`, lộ Swagger `/api/docs`, và tương thích sau này với Tauri WebView2 (`http://tauri.localhost` / `https://tauri.localhost` / `tauri://localhost`).
2. **Bảo vệ Bí mật (YouTube API Key):** Windows DPAPI (`CryptProtectData`/`CryptUnprotectData` + `LocalFree`), blob hỏng/chuyển máy, HTTP `422 ValidationError` phản chiếu input, log redaction (`key=...`, `key%3D...`, `Bearer`, `AIza...`, `rawApiKey`, exception traceback, `uvicorn.access`), export JSON và bản recovery xóa Project.
3. **Nguồn RSS & Kết nối Internet ra ngoài (`CR-02` + Mở rộng Phase 10):** IPv4/IPv6, IPv4-mapped IPv6, NAT64, 6to4, Teredo, ISATAP (`RFC 5214`), SIIT IPv4-translated (`::ffff:0:0/96`), IPv6 zone ID `%`, IP số/octal/hex, tên miền nội bộ có dấu chấm cuối (`localhost.`, `metadata.google.internal.`), DNS rebinding TTL=0 qua keep-alive, redirect nội bộ, bom giải nén `gzip`/`deflate` qua `aiter_bytes()`, XML bomb/XXE (`defusedxml`), XSS HTML/URL trong feed.
4. **Toàn vẹn SQLite, Retention 30 ngày & Giao diện React:** `PRAGMA WAL`/`foreign_keys`/`secure_delete`, freelist + WAL sau khi xóa cache YouTube, cô lập `project_id`, liên kết đa Project, SQL `LIKE` wildcard & query bounds, Path Traversal & tên thiết bị Windows, link/thumbnail `file://` SMB/NTLM hoặc `javascript:` XSS, tách biệt dữ liệu thật khỏi prototype/mock.
5. **Scheduler, Quota Abuse & Supply Chain:** Chống gọi `search.list` ngầm, cô lập nguồn chết, lock tick & in-flight, cấp phép và lỗ hổng dependency Python/npm.

*(Lưu ý ranh giới: Không giả định ứng dụng chống lại phần mềm độc hại đã chiếm quyền thực thi trong cùng tài khoản người dùng Windows hoặc quyền Administrator.)*

---

## 3. DANH SÁCH LỖ HỔNG PHÁT HIỆN THEO MỨC ĐỘ (`0 CRITICAL` · `2 HIGH` · `2 MEDIUM` · `1 LOW`)

| Mã lỗi | Mức độ | Tên vấn đề | Trạng thái |
| :--- | :---: | :--- | :---: |
| **SEC-01** | **HIGH** | Lỗ hổng DNS Rebinding `Host`, thiếu chặn cross-site `GET` & drive-by tiêu hao quota `GET /global/categories?refresh=true` | **Đã sửa & Kiểm chứng** |
| **SEC-02** | **HIGH** | Bom giải nén RSS `gzip`/`deflate` qua `aiter_bytes()`, lọt ISATAP/SIIT IPv6 chuyển tiếp, trailing-dot `localhost.`/`internal.`, zone ID `%` & IPv4 obfuscation | **Đã sửa & Kiểm chứng** |
| **SEC-03** | **MEDIUM** | Phản hồi `422 VALIDATION_ERROR` phản chiếu `apiKey`, log redaction sót `key%3D`/`rawApiKey`/`uvicorn.access`, và tàn dư freelist/WAL SQLite sau xóa cache API | **Đã sửa & Kiểm chứng** |
| **SEC-04** | **MEDIUM** | Chưa khóa giao thức `https://` công khai cho `thumbnailUrl` (`file://` SMB/NTLM leak) và thiếu `encodeURIComponent`/`noopener` ở một số link ngoài | **Đã sửa & Kiểm chứng** |
| **SEC-05** | **LOW** | Chưa escape ký tự wildcard SQL `LIKE` (`%`, `_`) trong tìm kiếm RSS/Ý tưởng và thiếu giới hạn biên trên một số query parameter | **Đã sửa & Kiểm chứng** |

---

## 4. ROOT CAUSE VÀ CÁC BẢN SỬA CHI TIẾT

### `SEC-01` — Bảo vệ Localhost trước DNS Rebinding, Cross-Site GET & Drive-By Quota Exhaustion
- **Mã lỗi:** `SEC-01` · **Mức độ:** `HIGH`
- **Vị trí & Nguyên nhân:** `backend/app/core/security.py` (`verify_local_csrf_and_origin`), `backend/app/core/config.py`, `backend/app/main.py`, `frontend/src/api/client.ts`, `frontend/vite.config.ts`. Middleware chỉ kiểm tra `Origin` & `X-Research-Studio-Client` khi phương thức nằm trong `MUTATING_METHODS`, bỏ qua header `Host`, bỏ qua `Sec-Fetch-Site`, và endpoint `GET /api/v1/global/categories?refresh=true` gọi thẳng `youtube_client.fetch_video_categories` (tốn `1 unit` `General Data API`).
- **Điều kiện khai thác:** Người dùng mở một website độc hại dùng tên miền DNS rebinding (`attacker.example` trỏ `127.0.0.1`) để đọc toàn bộ Project/Ideas/Export qua `fetch()` cùng-origin, hoặc nhúng `<img src="http://127.0.0.1:8000/api/v1/global/categories?refresh=true">` lặp lại để đốt sạch `10.000 units` quota ngày.
- **Tác động thực tế:** Lộ toàn bộ dữ liệu nghiên cứu cá nhân trên máy cục bộ qua DNS rebinding; đốt cạn bucket `General Data API` từ website bất kỳ.
- **Bằng chứng tái hiện:** `TestClient` gửi `Host: evil-rebind.example:8000` tới `/api/v1/projects` và `GET /api/v1/global/categories?refresh=true` không kèm `X-Research-Studio-Client` trước đây đều vượt qua middleware.
- **Cách sửa:**
  - `security.py`: Kiểm tra `_verify_loopback_host(request)` trên **mọi** request (`127.0.0.1`, `localhost`, `[::1]`, riêng `testserver` chỉ khi `client.host == "testclient"`); từ chối mọi `/api/v1/*` kể cả `GET` nếu `Origin` lạ hoặc `Sec-Fetch-Site: cross-site` không nằm trong `allowed_origins`; bắt buộc header `X-Research-Studio-Client: local-web` cho cả `GET /api/v1/global/categories?refresh=true`.
  - `config.py` & `main.py`: Thêm origin Tauri v2 (`tauri.localhost`, `tauri://localhost`) vào `DEFAULT_ALLOWED_ORIGINS`; thêm `validate_loopback_bind_host` chặn bind `0.0.0.0`/`::`; gắn security response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`).
  - `frontend/src/api/client.ts` & `vite.config.ts`: Gửi `X-Research-Studio-Client: local-web` trên mọi API request (`GET` lẫn mutating); khóa `allowedHosts: ['127.0.0.1', 'localhost']` trên Vite dev/preview.
- **Regression test:** `test_sec01_dns_rebinding_host_cross_site_fetch_and_tauri_origin_compatibility` trong `backend/tests/test_phase10_security_review.py`.
- **Trạng thái sau sửa:** **Đã sửa & Kiểm chứng (PASS)** — Đã xác nhận `403 HOST_NOT_ALLOWED`, `403 CSRF_ORIGIN_FORBIDDEN`, `403 CSRF_CROSS_SITE_BLOCKED`, `403 CSRF_HEADER_MISSING`, tương thích `tauri.localhost`, và đầy đủ security headers qua Chrome DevTools MCP Network.

### `SEC-02` — Bom giải nén `gzip`/`deflate` và Bypass IPv6 ISATAP/SIIT/Hostname trong RSS Client
- **Mã lỗi:** `SEC-02` · **Mức độ:** `HIGH`
- **Vị trí & Nguyên nhân:** `backend/app/clients/rss_client.py` (`fetch_and_parse_feed`, `_ensure_ip_globally_routable`, `validate_public_feed_url`, `_SafePublicNetworkBackend.connect_tcp`).
  1. `response.aiter_bytes()` của `httpx` giải nén `Content-Encoding: gzip/deflate` bên trong decoder trước khi `fetch_and_parse_feed` đếm byte — 1 chunk nén `~15 KB` chứa `15 MB` dữ liệu giải nén xong hoàn toàn trong RAM (`15.728.640 bytes`) trước lần kiểm tra `total_bytes > 5 MB` đầu tiên.
  2. Địa chỉ IPv6 chuyển tiếp ISATAP (`2606:4700::5efe:127.0.0.1`) trả về `ip.is_global == True` trong Python 3.11; `_ensure_ip_globally_routable` tách bỏ `%` zone index trước kiểm tra; kiểm tra `.localhost`/`.internal` chưa bỏ dấu `.` cuối FQDN (`sub.localhost.`, `metadata.google.internal.`); và chưa chặn IPv4 dạng thập phân/bát phân/thập lục phân trước DNS.
- **Điều kiện khai thác:** Kẻ tấn công gắn URL feed trỏ về server độc hại trả HTTP `200` `Content-Encoding: gzip` chứa zip bomb hoặc redirect sang `[2606:4700::5efe:127.0.0.1]` / `http://0x7f000001/`.
- **Tác động thực tế:** Ngốn RAM/OOM tiến trình Backend (`DoS`), hoặc lọt kiểm tra SSRF vào địa chỉ loopback/link-local qua kênh IPv6 chuyển tiếp.
- **Bằng chứng tái hiện:** Thử nghiệm thực tế trên `httpx.Client` với `15 MB` gzip payload chứng minh `aiter_bytes()` cấp phát đủ `15.728.640` bytes ngay lượt yield đầu tiên; `ipaddress.ip_address("2606:4700::5efe:127.0.0.1").is_global` trả về `True`.
- **Cách sửa:**
  - Viết `_read_bounded_feed_bytes(response)`: hỗ trợ `identity`/`gzip`/`deflate` qua `response.aiter_raw()` kết hợp `zlib.decompressobj(...).decompress(raw_chunk, max_length=budget)` ngắt ngay khi `raw_total > 5 MB` hoặc `decompressed_total > 5 MB` hoặc `unconsumed_tail` không rỗng (`413 RSS_PAYLOAD_TOO_LARGE`); từ chối mã hóa lồng/lạ (`422 RSS_UNSUPPORTED_ENCODING`); giữ nhánh `hasattr(response, "_content")` có kiểm trần `5 MB` để tương thích mock non-streaming trong test.
  - Bổ sung kiểm tra ISATAP (`((int(ip) >> 32) & 0xFDFFFFFF) == 0x00005EFE`), SIIT IPv4-translated (`(int(ip) >> 32) == 0xFFFF`), cấm tuyệt đối zone index `%`, viết `_normalize_and_validate_rss_host` chuẩn hóa dấu `.` cuối (`.rstrip(".")`) và chặn nhãn IPv4 số/hex/octal không chuẩn trước DNS.
- **Regression test:** `test_sec02_rss_gzip_decompression_bomb_and_valid_gzip_deflate_feeds` và `test_sec02_rss_isatap_siit_zone_id_trailing_dot_and_obfuscated_ip_blocked`.
- **Trạng thái sau sửa:** **Đã sửa & Kiểm chứng (PASS)** + Đã kiểm chứng live HTTPS (`https://hnrss.org/newest?count=2`).

### `SEC-03` — Lộ Input trong Lỗi 422, Mở rộng Log Redaction & Xóa Tàn dư SQLite Freelist/WAL
- **Mã lỗi:** `SEC-03` · **Mức độ:** `MEDIUM`
- **Vị trí & Nguyên nhân:** `backend/app/core/errors.py` (`handle_validation_error`), `backend/app/routers/system.py` (`SaveApiKeyRequest`), `backend/app/core/logging_setup.py`, `backend/app/db/connection.py`, `backend/app/services/retention_service.py`.
  1. `handle_validation_error` trả nguyên `exc.errors()` chứa trường `"input"` — khi gửi `{"apiKey": ["AIzaSy..."]}` bị lỗi kiểu, chuỗi bí mật bị phản hồi lại nguyên văn trong JSON HTTP `422`. `SaveApiKeyRequest.apiKey` chưa có `max_length`.
  2. `_SENSITIVE_PATTERNS` chưa lọc `key%3D...`, tên khóa `rawApiKey`/`youtube_api_key`, và `configure_logging` bỏ sót `uvicorn.access`.
  3. Khi xóa/tombstone cache YouTube API trên SQLite, `DELETE`/`UPDATE NULL` chỉ đánh dấu trang rảnh nếu thiếu `PRAGMA secure_delete = ON` và không chạy `VACUUM` + `wal_checkpoint(TRUNCATE)`.
- **Điều kiện khai thác:** Gửi payload `apiKey` sai định dạng tới endpoint lưu khóa hoặc đọc trực tiếp byte nhị phân tệp `research_studio.db` sau khi bấm "Xóa toàn bộ cache YouTube API Data".
- **Tác động thực tế:** Phản chiếu khóa API trong response `422`; tàn dư tiêu đề/mô tả cache YouTube còn đọc được trong các trang freelist của tệp `.db` dù đã xóa logic.
- **Bằng chứng tái hiện:** Kiểm nghiệm trực tiếp trên `TestClient` trước sửa trả về `"input":["AIzaSySuperSecretEchoedIn422Error999"]` (`422`); kiểm tra nhị phân `.db` sau `DELETE` thuần vẫn còn chuỗi `CACHED_YOUTUBE_MARKER_10_SECRET_API_TEXT`.
- **Cách sửa:**
  - `errors.py`: Thêm `_sanitize_validation_errors` chỉ trả `loc`, `type`, `msg` đã qua `redact_sensitive_text`; `system.py`: giới hạn `Field(min_length=1, max_length=256)`.
  - `logging_setup.py`: Thêm regex `key%3D`, `rawApiKey`, `youtube_api_key` và gắn filter lên `uvicorn.access`.
  - `connection.py` & `retention_service.py`: Bật `PRAGMA secure_delete = ON;` trên mọi kết nối; sau khi người dùng bấm xóa toàn bộ cache YouTube API, chạy `PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);`.
- **Regression test:** `test_sec03_validation_422_never_echoes_api_key_and_urlencoded_log_redaction` và `test_sec03_sqlite_purge_all_wipes_residual_api_bytes_from_db_file_while_preserving_user_data`.
- **Trạng thái sau sửa:** **Đã sửa & Kiểm chứng (PASS)**.

### `SEC-04` — Khóa giao thức Thumbnail `https://` Công khai & Hardening Link Ngoài Frontend
- **Mã lỗi:** `SEC-04` · **Mức độ:** `MEDIUM`
- **Vị trí & Nguyên nhân:** `backend/app/clients/youtube_client.py` (`_pick_thumbnail_url`), `frontend/src/components/VideoResearchTable.tsx`, `DetailAndSystemScreens.tsx`, `GlobalScreens.tsx`, `ProjectScreens.tsx`, `Modals.tsx`.
  - `_pick_thumbnail_url` trước đây chấp nhận bất kỳ URL nào từ JSON `thumbnails.*.url`; Frontend render trực tiếp `<img src={v.thumbnailUrl}>` không kiểm giao thức (`https://`), và ghép thẳng `video.id` / `channel.handle` / `channel.channelId` vào chuỗi URL không qua `encodeURIComponent`, các thẻ `<a target="_blank">` chỉ dùng `rel="noreferrer"` chưa kèm `noopener`.
- **Điều kiện khai thác:** Dữ liệu API/cache chứa `thumbnailUrl` trỏ `file:////attacker-host/share/img.png` (trên Windows có thể gây rò NTLM hash hoặc probe mạng LAN) hoặc `http://127.0.0.1:PORT/...`.
- **Tác động thực tế:** Kết nối ngầm ra host lạ/LAN từ trình duyệt hoặc thiếu tách `window.opener` trên link ngoài.
- **Bằng chứng tái hiện:** Gọi `parse_youtube_video_item` với `file:////attacker-smb/share/thumb.png` và `http://127.0.0.1:8000/thumb.png` trước sửa giữ nguyên chuỗi URL đó vào `thumbnail_url`.
- **Cách sửa:** Thêm `_sanitize_https_thumbnail_url` trong `youtube_client.py` bắt buộc `https://`, không credential, không host nội bộ/IP non-global; Frontend kiểm tra `v.thumbnailUrl.startsWith('https://')` + `referrerPolicy="no-referrer"`, dùng `encodeURIComponent` cho ID/handle YouTube và chuẩn hóa `rel="noopener noreferrer"`.
- **Regression test:** `test_sec04_and_sec05_unsafe_thumbnail_schemes_sql_like_wildcards_and_query_bounds`.
- **Trạng thái sau sửa:** **Đã sửa & Kiểm chứng (PASS)**.

### `SEC-05` — Escape Wildcard SQL `LIKE` & Ràng buộc Biên Query Parameters
- **Mã lỗi:** `SEC-05` · **Mức độ:** `LOW`
- **Vị trí & Nguyên nhân:** `backend/app/repositories/rss_repo.py` (`list_articles`), `backend/app/repositories/idea_repo.py` (`list_ideas`), `backend/app/routers/rss.py`, `ideas.py`, `global_research.py`, `project_competitors.py`.
  - Tìm kiếm chuỗi đưa trực tiếp `%` và `_` của người dùng vào `LIKE ?`, khiến tìm `"100%"` khớp cả `"1000"` và chuỗi quá dài không có giới hạn độ dài `Query(max_length=...)` ở router `GET`.
- **Điều kiện khai thác:** Người dùng hoặc script cục bộ gửi chuỗi chứa nhiều ký tự `%`/`_` hoặc query parameter `limit=99999999` / `search` hàng chục KB.
- **Tác động thực tế:** Khớp sai kết quả tìm kiếm hoặc tốn chi phí scan toàn bảng SQLite.
- **Bằng chứng tái hiện:** `rss_repo.list_articles(search="100%")` trước đây trả về bài `"Gain 1000 SQLite Speed"`; `GET /api/v1/rss/articles?limit=5000` vẫn trả HTTP `200`.
- **Cách sửa:** Thêm `_escape_like()` kèm `ESCAPE '\'` cho `LIKE ?` ở `rss_repo.py` & `idea_repo.py`; thêm ràng buộc `Query(...)` (`max_length`, `ge`, `le`) trên `rss.py`, `ideas.py`, `global_research.py`, `project_competitors.py`.
- **Regression test:** `test_sec04_and_sec05_unsafe_thumbnail_schemes_sql_like_wildcards_and_query_bounds`.
- **Trạng thái sau sửa:** **Đã sửa & Kiểm chứng (PASS)**.

---

## 5. REGRESSION TESTS ĐÃ BỔ SUNG

- Tệp mới: `backend/tests/test_phase10_security_review.py` (`6` bài test chủ động chạy hoàn toàn trong `tempfile.TemporaryDirectory()` cô lập bằng `RESEARCH_STUDIO_DATA_DIR`):
  1. `test_sec01_dns_rebinding_host_cross_site_fetch_and_tauri_origin_compatibility`
  2. `test_sec02_rss_gzip_decompression_bomb_and_valid_gzip_deflate_feeds`
  3. `test_sec02_rss_isatap_siit_zone_id_trailing_dot_and_obfuscated_ip_blocked`
  4. `test_sec03_validation_422_never_echoes_api_key_and_urlencoded_log_redaction`
  5. `test_sec03_sqlite_purge_all_wipes_residual_api_bytes_from_db_file_while_preserving_user_data`
  6. `test_sec04_and_sec05_unsafe_thumbnail_schemes_sql_like_wildcards_and_query_bounds`

---

## 6. KẾT QUẢ KIỂM THỬ BACKEND / FRONTEND & RUNTIME

| Hạng mục kiểm tra | Kết quả thực tế (sau sửa lỗi cuối cùng) |
| :--- | :--- |
| `compileall -q backend/app backend/tests` | **PASS** (`exit code 0`) |
| `unittest discover -s backend/tests -p "test_*.py" -v` | **PASS — `Ran 57 tests in 5.066s — OK`** (`0` skipped, gồm `6` test bảo mật mới) |
| `pip check` | **PASS — `No broken requirements found.`** |
| Live HTTPS RSS (`https://hnrss.org/newest?count=2`) | **PASS — `2` bài** qua `_PinnedPublicHTTPTransport` + `_read_bounded_feed_bytes` (`gzip`) |
| `npm --prefix frontend run typecheck` | **PASS — `0` lỗi** |
| `npm --prefix frontend run lint` (`oxlint`) | **PASS — `0` warning, `0` error** trên `22` tệp (`26ms`) |
| `npm --prefix frontend run build` | **PASS — `built in 174ms`** (`dist/assets/index-DZJW0XNC.js` `434.92 kB`, `index-77WvWkQF.css` `18.16 kB`) |
| Chrome DevTools MCP (`http://127.0.0.1:5173`, `G1` / `G4` / `G2` / `SystemSettings`) | **PASS — `0` console error, `0` console warn**, xác nhận header phản hồi thực (`X-Research-Studio-Client`, `no-store`, `nosniff`, `DENY`, `no-referrer`, `same-site`, `CSP`) và giữ nguyên Light/Dark VOXLAB |
| **YouTube Data API v3 Live** | **`NOT TESTED`** (Chưa có API Key thật trên máy) |

---

## 7. KẾT QUẢ RÀ SOÁT TỪNG MIỀN BẢO MẬT

- **SSRF / DNS Rebinding / XXE (`rss_client.py`):** Đạt — Phân giải 1 lần & ghim IP TCP trong `_SafePublicNetworkBackend` + `_PinnedPublicHTTPTransport` (`AsyncBaseTransport`, giữ SNI/hostname verification), `trust_env=False`, chặn loopback/LAN/metadata/NAT64/6to4/Teredo/ISATAP/SIIT/zone `%`/IP số/octal/hex/trailing dot, kiểm tra lại qua tối đa `3` redirect, giới hạn `5 MB` cả compressed & decompressed (`zlib.decompress(max_length=...)`), `defusedxml` chặn XXE/entity expansion.
- **XSS & Nội dung ngoài (`frontend/src/`, `rss_client.py`):** Đạt — `_SafePlainTextHtmlParser` bỏ trọn subtree `<script>`/`<style>`/`<iframe>`/`<svg>`/`<object>`; React auto-escape, `0` `dangerouslySetInnerHTML`/`innerHTML`/`eval`; `sanitize_http_url` & Frontend check chỉ cho `https://`/`http://`, `thumbnailUrl` khóa chặt `https://` public, toàn bộ link ngoài `rel="noopener noreferrer"`.
- **CSRF / Host / Bind (`main.py`, `security.py`, `config.py`, `vite.config.ts`):** Đạt — Chỉ bind `127.0.0.1` (`validate_loopback_bind_host` chặn `0.0.0.0`), `allowedHosts` Vite chỉ `127.0.0.1`/`localhost`, kiểm `Host` loopback toàn app, chặn `Origin` lạ & `Sec-Fetch-Site: cross-site`, bắt buộc `X-Research-Studio-Client` cho mutation & `GET /global/categories?refresh=true`.
- **API Key, DPAPI, Redaction & Quyền thư mục Windows (`security.py`, `settings_repo.py`, `logging_setup.py`, `errors.py`, `project_repo.py`):** Đạt — Mã hóa DPAPI user-scoped + `LocalFree` trong `finally`, blob hỏng trả `apiKeyStatus = "unreadable"` không HTTP 500, export JSON & project recovery backup **không** chứa API Key, `422` không phản chiếu `input`, log redact `key=`/`key%3D`/`Bearer`/`AIza`/`rawApiKey` trên cả traceback & `uvicorn.access`. Đánh giá quyền NTFS cục bộ: thư mục gốc `%LOCALAPPDATA%` kế thừa DACL mặc định theo tài khoản Windows hiện tại (cùng user + `SYSTEM`/`Administrators`), tách biệt ngoài thư mục Git và không cho người dùng standard khác đọc nội dung profile người dùng cá nhân.
- **SQLite, Data Integrity, Retention 30 ngày & Scheduler (`connection.py`, `migrator.py`, `retention_service.py`, `scheduler_service.py`, `quota_service.py`):** Đạt — Toàn bộ truy vấn dùng tham số hóa (`?` / `:param`) + `ESCAPE '\'` cho `LIKE`, `PRAGMA foreign_keys = ON`, `PRAGMA secure_delete = ON`, `WAL`, `BEGIN IMMEDIATE`, backup SQLite `Connection.backup()` trước migration, slug + `resolve_safe_child_path` chặn `../` và tên thiết bị Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1–9`, `LPT1–9`), xóa cache YouTube dọn DB + `VACUUM` + xóa `.db` backup cũ mà bảo toàn `100%` dữ liệu người dùng và snapshot khôi phục Project, scheduler dùng `_tick_lock` + `in_flight_registry` + tombstone kênh/video chết + `0` `search.list`.

---

## 8. DEPENDENCY AUDIT & SUPPLY CHAIN

### Backend (`backend/requirements.txt` & môi trường cài đặt thực tế)
- `fastapi 0.163.1` (`MIT`), `starlette 1.10.0` (`BSD-3-Clause`), `uvicorn 0.54.0` (`BSD-3-Clause`), `pydantic 2.14.3` (`MIT`), `httpx 0.28.1` (`BSD-3-Clause`), `httpcore 1.0.9` (`BSD-3-Clause`), `h11 0.16.0` (`MIT`), `anyio 4.16.0` (`MIT`), `defusedxml 0.7.1` (`PSFL`), `tzdata 2026.6` (`Apache-2.0`), `certifi 2026.10.23` (`MPL-2.0`), `idna 3.20` (`BSD-3-Clause`), `click 8.5.1` (`BSD-3-Clause`).
- `pip check`: **0 xung đột** (`No broken requirements found.`). Không phát hiện dependency mới hay giấy phép copyleft (`GPL`/`AGPL`); `certifi` (`MPL-2.0`) là phụ thuộc gián tiếp hợp chuẩn TLS của `httpx` được sử dụng chỉ để nạp kho CA gốc chuẩn. *(Lưu ý: `pip` trong `.venv` là bản `24.0` nên kiểm tra advisory offline qua phiên bản hiện đại 2026 của các gói và hành vi `TestClient`/transport thực tế; không cần nâng version hàng loạt.)*

### Frontend (`frontend/package.json` & `package-lock.json`)
- Runtime dependencies tối giản chỉ gồm `react@^19.3.1` (`^19.3.1`) và `react-dom@^19.3.1`. Dev/build tools: `vite@^8.3.6`, `@vitejs/plugin-react@^6.1.2`, `typescript@~7.0.2`, `oxlint@^1.90.0`.
- `npm --prefix frontend audit` (toàn bộ mức độ `low` → `critical`): **`found 0 vulnerabilities`**.

---

## 9. CÁC RỦI RO CÒN TỒN TẠI VÀ MỨC ĐỘ

1. **`YouTube API live = NOT TESTED` (`MEDIUM`):** Chưa có YouTube API Key thật trên máy nên hành vi xác thực, giới hạn response, và lỗi thực tế (`quotaExceeded`, `keyInvalid`, hidden statistics, empty uploads) từ máy chủ `googleapis.com` chưa kiểm chứng live. Khi người dùng cấu hình API Key thật trong giao diện cục bộ, đề xuất chạy live smoke test tối thiểu (`1` unit `G2` `mostPopular` + `1 Search Queries` & `1 General Data` `G3`) và kiểm tra log không lộ khóa.
2. **Mối đe dọa cùng phiên tài khoản OS (`LOW` — Ngoài ranh giới trình duyệt):** Tiến trình hoặc phần mềm độc hại khác chạy dưới *cùng tài khoản người dùng Windows* có thể gửi HTTP tới `127.0.0.1:8000` kèm header `Host` & `X-Research-Studio-Client` giả lập (ứng dụng desktop cá nhân local-first không triển khai tài khoản đăng nhập riêng trong MVP).
3. **`allow_origins` mặc định cho Vite dev (`5173`) & preview (`4173`) + Tauri (`LOW`):** Chỉ cho phép các origin loopback/Tauri cục bộ định danh rõ; khi chuyển sang đóng gói Tauri production sau này, nên bỏ các port dev `:5173` khỏi `DEFAULT_ALLOWED_ORIGINS` nếu tắt chế độ dev.

---

## 10. GIT CHECKPOINT & WORKING TREE STATUS

- **Baseline trước sửa Phase 10:** `0f6bc38` trên nhánh `main`.
- Báo cáo này được lưu trước bước `git commit` chốt checkpoint Phase 10; mã commit và trạng thái `git status --short` sạch sau commit được ghi nhận trực tiếp trong kết quả báo cáo bàn giao Phase 10.

---

## 11. BƯỚC TIẾP THEO THEO `AGENT_WORKFLOW.txt`

- Giai đoạn tiếp theo là **PHASE 11 — PERFORMANCE / WEBPERF / TUNING** (đo đạc hiệu năng thực nghiệm `MEASURE FIRST`, kiểm định các tham số `TUNING REQUIRED` trong `SPEC.md` §18.3 như `table_page_size = 50` vs `6`, `sqlite_busy_timeout_ms`, kích thước batch/RSS và độ trễ UI Chrome DevTools trước Phase 12 Code Simplify).
- **Dừng tại kết thúc PHASE 10** chờ người dùng kiểm tra và phê duyệt trước khi chuyển tiếp.
