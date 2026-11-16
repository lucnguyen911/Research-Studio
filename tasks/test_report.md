# BÁO CÁO KIỂM THỬ PHASE 8 — RESEARCH STUDIO

**Ngày kiểm thử:** 2026-11-16  
**Branch / Baseline trước Phase 8:** `main` (`ea411f1`)  
**Trạng thái API Key thật trên máy hiện tại:** Chưa cấu hình (`no_db` tại `%LOCALAPPDATA%\ResearchStudio`)  

## PHASE 8 VERDICT: PASS WITH LIMITATIONS

- **Lý do kết luận `PASS WITH LIMITATIONS`:** Toàn bộ kiến trúc cục bộ (FastAPI, SQLite WAL, Foreign Keys, Migrations/Backup, Windows DPAPI, Dual-Bucket Quota Ledger, TTL 30 ngày, phân loại 3 lớp định dạng, bảo mật RSS SSRF/DNS rebinding/XXE/XSS/CSRF/Redaction, giao diện React + Vite + Chrome DevTools MCP E2E, hiệu năng quy mô 600–800 video & 250–300 bài RSS) **đạt 100%** sau khi phát hiện và sửa triệt để **7 lỗi thực tế**.
- **Giới hạn đã xác minh rõ ràng (`NOT TESTED`):** Các lệnh gọi trực tiếp tới máy chủ Google `https://www.googleapis.com/youtube/v3/*` bằng API Key thật được đánh dấu **`NOT TESTED`** (vì chưa có khóa API người dùng trên máy; không hỏi khóa và không dùng dữ liệu mock để đánh dấu đạt cho upstream thật). Nguồn RSS công khai thật qua HTTPS (`https://hnrss.org/newest?count=3`) đã kiểm thử thành công trực tiếp bằng `_PinnedPublicHTTPTransport`.

---

## 1. TEST EVIDENCE (BẰNG CHỨNG KIỂM THỬ TRỰC TIẾP)

### A. Kiểm thử tự động Backend & Frontend (Sau sửa lỗi cuối cùng)
- `pip check`: `No broken requirements found.` (exit code `0`)
- `python -m compileall -q app tests`: exit code `0`
- `python -m unittest discover -s tests -p "test_*.py"`: **`44/44` tests PASS** trong `4.729s` (gồm `37` test hiện có + `7` test/bộ kịch bản mới trong `backend/tests/test_phase8_verification_matrix.py`)
- `npm run typecheck` (`tsc -b`): **`0` lỗi**
- `npm run lint` (`oxlint`): **`0` cảnh báo, `0` lỗi** trên `22` tệp (`116` rules)
- `npm run build` (`tsc -b && vite build`): **`built in 120ms`** (`dist/assets/index-77WvWkQF.css`, `dist/assets/index-B-imfdSj.js`)
- `npm audit --audit-level=high`: **`found 0 vulnerabilities`**
- Kiểm tra quy chuẩn mã nguồn (`CONSTRAINTS.md`): `0` `@ts-ignore`, `0` `@ts-expect-error`, `0` `oxlint-disable`, `0` `eslint-disable`, `0` `# noqa`, `0` `# type: ignore`, `0` `.skip`/`.todo`/`@unittest.skip`, `0` bí mật/đường dẫn cá nhân bị lọt vào repo.

### B. Kiểm thử End-to-End Trình duyệt thật (Chrome DevTools MCP)
- **Kịch bản A (0 Project & Theme & Stage-2):** Xác minh `G1–G5` hoạt động độc lập khi `projects = 0`, `P1–P6` hiện `NoProjectEmpty`, 5 màn hình Giai đoạn 2 giải thích trung thực không số liệu giả (`AC-01`), chuyển đổi mượt mà Light/Dark Mode VOXLAB (`AC-18`), `0` badge DEMO trộn lẫn.
- **Kịch bản B (Vòng lặp đầy đủ & SQLite Persistence):** Xác nhận Pháp lý → Lưu khóa qua Windows DPAPI (`AIza...ey01`, phản hồi `PUT /api/v1/system/youtube-api-key` không chứa khóa thô) → Tạo `Project Alpha` & `Project Beta` → `G4` chặn SSRF `http://127.0.0.1:8000/feed.xml`, cô lập `Broken Feed` (`RSS_INVALID_XML`) khi `Engineering Feed` giữ `2 bài`, làm sạch `<script>`, `<img onerror>`, `javascript:alert(1)` → `P6` gắn RSS & tải `research-studio-project-alpha.json` (`0` API key) → `G3` tìm Video có `publishedAfter` + `Tải trang kế tiếp` (`nextPageToken`), tìm Kênh, mở lại phiên `0 quota` → `VideoDetail` gắn nhãn thủ công `Shorts` (giữ nguyên `Chưa xác định <= 180s`), gắn cờ Bứt phá + ghi chú → Lưu 1 Ý tưởng gắn vào cả `Project Alpha` & `Project Beta`, đổi Alpha sang `Chốt làm` mà Beta giữ nguyên `Mới lưu` (`P5`) → `P2` từ chối `/c/` cũ tại `0` Search quota & gắn `@creatorlab` từ cache dùng chung (`0` Search quota) → `P4` tạo từ khóa `"SQLite"`, đối chiếu khớp `2 bài` từ RSS của Alpha & quét → Reload `F5` kiểm chứng giữ nguyên 100% trạng thái SQLite.
- **Kịch bản C (Quy mô 602 Video + 252 RSS & Back/Forward State Restore):** Mở `P3` với `602` video (`451 Video dài · 0 Shorts · 151 Chưa xác định`) & `G4` với `252` bài RSS; lọc `Video dài`, sắp xếp `viewCount tăng dần`, chuyển `Trang 2 / 56`, cuộn `#rs-main-scroll` xuống `scrollTop = 320` → Mở `VideoDetail` → Bấm `Back` trên TopBar: khôi phục chính xác route `#/project/breakout?pid=...`, bộ lọc `Video dài`, sắp xếp `viewCount tăng dần`, `Trang 2 / 56` và **`scrollTop = 320`** (`scrollHeight = 1600`, `clientHeight = 1170`); bấm `Forward` quay lại đúng `VideoDetail`.
- **Kịch bản D (Cảnh báo 80%, Hết Quota Bucket, Cancel, Mất Backend & Xóa Cache):** Thiết lập `80/100` Search & `8.100/10.000` General Data: hiển thị đủ banner `rs-banner-warn` kèm mốc reset PT địa phương & cảnh báo sổ kế toán cục bộ; thiết lập `100/100` Search: `G3` khóa nút Tìm trong khi `G2` Trends (`general_data`) vẫn nạp thành công `100 → 101` units; bấm `Hủy (Cancel)` trên truy vấn chậm `"slow-cancel"` → hiện thông báo `Đã hủy lệnh tìm kiếm.` (`AbortController`); tắt hẳn tiến trình Backend `127.0.0.1:8000` → hiện banner `Không kết nối được Backend cục bộ (127.0.0.1:8000)`, không toast thành công giả; khởi động lại Backend (không reset DB) → bấm `Thử lại kết nối` khôi phục toàn bộ dữ liệu; bấm `Xóa toàn bộ cache YouTube API Data ngay lập tức` → xóa sạch `604` video cache YouTube nhưng giữ nguyên `100%` `2` Project, Ý tưởng, Từ khóa, Nhãn thủ công, DPAPI Key và `252` bài RSS.
- **Console Check (`list_console_messages`):** `0` lỗi JavaScript/React, `0` cảnh báo console ngoài lỗi HTTP `502` phát sinh có chủ đích ở bước tắt tiến trình Backend để kiểm thử ngoại tuyến.

---

## 2. PASSED SCENARIOS VS FAILED / NOT VERIFIED

- **PASSED SCENARIOS:** Toàn bộ `44` test tự động Backend, build/lint/typecheck/audit Frontend, kiểm thử E2E Kịch bản A–D qua Chrome DevTools MCP, kiểm thử bảo mật (DPAPI, CSRF, Origin, Log Redaction trong Traceback, RSS SSRF + DNS Rebinding TOCTOU + XXE + XSS + SQLi + Windows Path Traversal/Device Name), kiểm thử Dual-Bucket Quota PT/DST + Retry + Refund, kiểm thử TTL 30 ngày + dọn `.db` backup, kiểm thử tải RSS công khai thật (`https://hnrss.org/newest?count=3`), và đo hiệu năng cơ sở quy mô lớn.
- **FAILED SCENARIOS:** `0` kịch bản thất bại sau vòng sửa lỗi cuối cùng. (Ghi nhận 1 tình huống nhỏ ở dữ liệu giả lập E2E ban đầu: nút `+ Đối thủ` ở thẻ kết quả G3 dùng `channelId` giả lập 12 ký tự `UC_E2E_CH_02` nên không khớp regex ID YouTube thật 24 ký tự `^UC[A-Za-z0-9_-]{20,40}$`; kênh YouTube thật luôn có đúng 24 ký tự và thêm qua `@handle` trên `P2` hoạt động bình thường.)
- **NOT VERIFIED (`NOT TESTED`):** Các lời gọi HTTP trực tiếp tới YouTube Data API v3 (`googleapis.com/youtube/v3/*`) với API Key thật vì chưa có khóa API được cấu hình trên máy.

---

## 3. BẢNG ĐỐI CHIẾU TIÊU CHÍ NGHIỆM THU (`AC-01` ĐẾN `AC-18`)

| Mã AC | Tên tiêu chí | Kết quả | Bằng chứng kiểm chứng |
| :--- | :--- | :---: | :--- |
| **AC-01** | Khung app & Điều hướng 11/16 màn hình | **PASS** | Sidebar 6 Global + 10 Project; 11 màn MVP chạy SQLite thật; 5 màn Giai đoạn 2 giải thích trung thực, `0` console error |
| **AC-02** | Hoạt động Global khi chưa có Project | **PASS** | Browser E2E `0` Project: G1–G5 hoạt động bình thường; P1–P6 hiện `NoProjectEmpty`; `test_zero_project_global...` |
| **AC-03** | Tách thực thể gốc & Cô lập `project_id` | **PASS** | `test_ideas_multiproject.py`, `test_competitors.py`, `test_defect02_project_videos_id_collision_across_projects` |
| **AC-04** | Dropdown Project duy nhất & AbortController | **PASS** | Browser E2E đổi `Project Alpha`/`Project Beta`, P5 giữ trạng thái độc lập, `AbortController` hủy mượt |
| **AC-05** | Dual-Bucket Quota Ledger | **PASS** | `search.list` trừ `1` vào `100/ngày`, không trừ `100` vào `General Data`; DST PT `00:00`, `80%` warning banner, `403` khóa bucket |
| **AC-06** | Phân loại 3 lớp định dạng & Nhãn thủ công | **PASS** | `>180s` → `long_form`, `<=180s` → `unknown`, gợi ý `#shorts` kèm độ tin cậy/căn cứ, nhãn thủ công tách biệt ở bảng & chi tiết |
| **AC-07** | Khám phá xu hướng & Nghiên cứu tự do (`G2`, `G3`) | **PASS (Mock YT)** | `G2` (`1 unit` `mostPopular`), `G3` tìm Video + Kênh + `publishedAfter` + `nextPageToken` + mở lại session `0 quota`; Live YT API `NOT TESTED` |
| **AC-08** | Theo dõi đối thủ (`P2`) | **PASS (Mock YT)** | Chặn `/c/` & `/user/` (`0 Search`), phân giải `@handle` + cache dùng chung, `11`/`40` upload playlist; gỡ kênh giữ nguyên Project B |
| **AC-09** | `Video bứt phá` Standard Mode (`P3`) | **PASS** | Lọc ngày/ngưỡng view/3 định dạng không gộp `unknown`, mốc `viewCount <= 30d` có timestamp, công bố rõ Standard Mode, `0` Outlier giả |
| **AC-10** | `Nghiên cứu từ khóa` Standard Mode (`P4`) | **PASS (Mock YT)** | CRUD từ khóa, áp dụng `regionCode`/`relevanceLanguage`, `tags` gốc + đối chiếu `Nguồn: RSS` chỉ từ feed đã gắn của Project |
| **AC-11** | Thu thập & Cô lập lỗi RSS (`G4`, `P4`) | **PASS** | RSS 2.0 + Atom 1.0, khử trùng lặp, chặn SSRF/DNS rebinding/XXE, lọc XSS `<script>`/`javascript:`, cô lập từng feed lỗi, live RSS HTTPS OK |
| **AC-12** | Làm mới tự động có kiểm soát & Hết hạn 30 ngày | **PASS** | `test_scheduler_and_ttl.py`: `0 search.list` trong auto-refresh, đọc cache < 1s khi mở app, xóa metadata >30d giữ `100%` User-Created Data |
| **AC-13** | Quản lý Ý tưởng & 5 trạng thái đa Project (`G5`, `P5`) | **PASS** | Browser E2E + `test_ideas_multiproject.py`: 1 Ý tưởng gốc gắn đa Project, đủ 5 trạng thái độc lập & lọc/tìm kiếm |
| **AC-14** | Điều hướng Back/Forward & Khôi phục trạng thái | **PASS** | Browser E2E trên 602 video: giữ nguyên `projectId`, filter `Video dài`, sort tăng dần, `Trang 2 / 56`, `scrollTop = 320` & Forward |
| **AC-15** | Trạng thái lỗi (Thiếu Key / Mất mạng / Hết quota / Cancel) | **PASS** | Browser E2E: thiếu Key chỉ dẫn cài Key trong khi RSS/Ý tưởng vẫn chạy; tắt Backend hiện banner đúng; `Cancel` ngắt sạch; `Retry` phục hồi |
| **AC-16** | Bảo mật API Key, Loopback & Log Redaction | **PASS** | DPAPI mã hóa DB + che khóa API response, redact secret cả trong traceback (`DEFECT-01`), CSRF header, Origin allowlist, bind `127.0.0.1` |
| **AC-17** | Công bố pháp lý & Nhận diện nguồn YouTube | **PASS** | Bắt buộc Legal Consent (ToS + Privacy Policy links), nút Xóa toàn bộ cache YouTube API ngay lập tức + dọn `.db` backup |
| **AC-18** | Giao diện VOXLAB & Light/Dark Mode | **PASS** | Chuyển Light Mode & Dark Mode VOXLAB mượt mà, nút bấm/bảng dữ liệu/bộ lọc không vỡ bố cục ở viewport desktop tiêu chuẩn |

---

## 4. CÁC LỖI ĐÃ PHÁT HIỆN, NGUYÊN NHÂN GỐC & CÁCH SỬA TRONG PHASE 8

| Mã lỗi | Mức độ | Nguyên nhân gốc | Cách sửa đã áp dụng & Kiểm tra hồi quy |
| :--- | :---: | :--- | :--- |
| **DEFECT-01** | **CRITICAL (Security)** | `LogRedactionFilter.filter()` trong `backend/app/core/logging_setup.py` chạy trước khi `Formatter.format()` sinh `record.exc_text`, khiến handler đầu tiên (`RotatingFileHandler` → `research_studio.log`) ghi nguyên văn API key/Bearer token nếu nằm trong traceback exception. | Bổ sung `RedactingFormatter` bọc `redact_sensitive_text(super().format(record))` cho cả file & stream handler. Regression: `test_defect01_secret_redaction_in_exception_traceback`. |
| **DEFECT-02** | **HIGH (Data Integrity)** | `youtube_repo.py` tạo khóa chính `project_videos.id` bằng `f"pv-{project_id[:6]}-{video_id[:16]}"`, chỉ giữ 1 ký tự hex của `proj-xxxxxxxxxx`, gây `sqlite3.IntegrityError` khi 2 Project cùng bắt đầu bằng `proj-a...` đánh dấu chung 1 video. | Đổi sang `f"pv-{uuid.uuid4().hex[:12]}"` dựa vào `UNIQUE(project_id, video_id)`. Regression: `test_defect02_project_videos_id_collision_across_projects`. |
| **DEFECT-03** | **HIGH (Security SSRF TOCTOU)** | `rss_client.py` kiểm tra DNS ở `validate_public_feed_url()`, nhưng `httpx.AsyncClient` phân giải DNS lại lần 2 khi mở socket (kèm `trust_env=True` mặc định), hở khe DNS Rebinding TTL=0. | Tạo `_SafePublicNetworkBackend` & `_PinnedPublicHTTPTransport` (`trust_env=False`): phân giải 1 lần, kiểm tra toàn bộ IP hợp lệ công khai rồi kết nối trực tiếp tới IP đã ghim mà vẫn giữ TLS SNI/cert theo hostname gốc. Regression: `test_defect03_rss_dns_rebinding_toctou_blocked`. |
| **DEFECT-04** | **MEDIUM (Error UX)** | `parseErrorResponse` trong `frontend/src/api/client.ts` kiểm tra `status === 502 \|\| 504` trước khi đọc `response.json()`, làm lỗi JSON có cấu trúc từ FastAPI (`YOUTUBE_TIMEOUT`, `YOUTUBE_UPSTREAM_ERROR`, `RSS_HTTP_ERROR`) bị ghi đè sai thành `"Không kết nối được Backend cục bộ"`. | Đọc `response.json()` trước; chỉ chuyển về `NETWORK_UNREACHABLE` khi `502/504` không phải JSON (proxy Vite báo Backend sập). Xác minh qua E2E tắt Backend & unit test API. |
| **DEFECT-05** | **MEDIUM (Quota UX)** | `GlobalModeBanners` & `TopBar` chỉ hiện banner/trạng thái khi bucket `.exhausted`, thiếu cảnh báo trực quan ở ngưỡng `>= 80%` (`.warning`). | Bổ sung `rs-banner-warn` cho cả 2 bucket khi `.warning && !.exhausted` (kèm mốc reset PT địa phương & ghi chú ước tính cục bộ) và màu `rs-badge-warning`/`rs-badge-danger` ở `TopBar`. Xác minh trực tiếp trên trình duyệt tại `80/100` & `8.100/10.000`. |
| **DEFECT-06** | **MEDIUM (Spec / Scroll Sync)** | (6A) `G3` trên UI khóa cứng `objectType: 'video'`, thiếu lọc `publishedAfter` và thiếu phân trang `nextPageToken`; (6B) `useScrollContainerSync` chỉ thử `14` khung hình (`~97ms`), dễ trượt `scrollTop` khi bảng dữ liệu lớn mount bất đồng bộ. | (6A) Mở rộng `search_youtube_page`, `discovery_service`, `/global/search` và UI `G3` hỗ trợ `Video / Kênh`, `Mọi thời điểm / 24h / 7d / 30d`, thẻ Kênh + `Tải trang kế tiếp`; (6B) Nâng cấp `useScrollContainerSync` dùng `MutationObserver` + hạn `1500ms` + hủy ngay khi người dùng cuộn tay. Xác minh E2E (`Trang 2`, `scrollTop = 320` khôi phục 100%). |
| **DEFECT-07** | **LOW (Hygiene & Edge)** | `projects.py` dùng `except Exception: continue`; `competitor_service` & `scheduler_service` thiếu `YOUTUBE_API_KEY_UNREADABLE` trong danh sách lỗi nghiêm trọng và ghi đè `status_code=400`; `youtube_client` không retry `TimeoutException` cho `general_data`; giao diện snapshot delta âm hiển thị `↗ +-50`. | Bắt `AppError` ghi warning log ở `projects.py`; giữ nguyên status code khi lỗi nghiêm trọng ở `competitor_service`; thêm timeout retry cho `general_data` (vẫn giữ `0` retry cho `search_queries`); chuẩn hóa `formatSnapshotDeltaLabel` (`↗ +N` / `↘ -N` / `→ 0`). |

---

## 5. KẾT QUẢ BẢO MẬT, NGOẠI TUYẾN, QUOTA, TTL & LIVE VS MOCK

- **Bảo mật:** Khóa API mã hóa Win32 DPAPI + `LocalFree`; `0` bí mật trong JSON export/HTTP response/log (kể cả traceback exception); CSRF header `X-Research-Studio-Client: local-web` & `Origin` allowlist chặn request giả mạo (`403`); bind chặt `127.0.0.1`; chặn RSS SSRF (`127.0.0.1`, `::1`, LAN, `169.254.169.254`, HTTP redirect nội bộ, DNS rebinding); từ chối XXE/XML entity expansion; làm sạch HTML XSS & `javascript:` URLs; truy vấn SQLite tham số hóa chống SQLi; chặn Path Traversal & tên thiết bị Windows (`CON`, `NUL`, `COM1`, ...); xóa cache YouTube dọn luôn bản sao lưu `.db` trong `backups/` nhưng bảo toàn `project_recovery_*.json`.
- **Ngoại tuyến & Phục hồi:** Chạy đầy đủ với `0` kết nối mạng trên RSS cache, Quản lý Ý tưởng, Từ khóa, Ghi chú, Nhãn thủ công; tắt Backend hiện cảnh báo ngoại tuyến trung thực và phục hồi ngay khi Backend chạy lại.
- **Live vs Mock:**

| Nhóm kiểm thử | Nguồn thực thi | Kết quả |
| :--- | :--- | :---: |
| FastAPI + SQLite WAL + FK + Migrations + Backup | **LIVE** (thực thi thật cục bộ) | **PASS** |
| Windows DPAPI (`CryptProtectData`/`CryptUnprotectData`) | **LIVE** (Win32 API thật) | **PASS** |
| Trình duyệt React/Vite qua Chrome DevTools MCP | **LIVE** (Chromium + DOM + Network thật) | **PASS** |
| RSS công khai qua HTTPS (`https://hnrss.org/newest?count=3`) | **LIVE** (Internet HTTPS thật + DNS pin) | **PASS** |
| RSS lỗi / XSS / DNS Rebinding / XXE / Timeout | **MOCK / UNIT** (tình huống đối kháng tất định) | **PASS** |
| YouTube Data API v3 (`search`, `videos`, `channels`, `playlistItems`) | **MOCK (`httpx.MockTransport`)** | **PASS (Logic/Client)** |
| YouTube Data API v3 gọi thẳng máy chủ Google bằng API Key thật | **LIVE YOUTUBE API** | **`NOT TESTED`** (Chưa có API Key thật) |

---

## 6. THỐNG KÊ HIỆU NĂNG CƠ SỞ (SCALE BASELINE)

### A. Backend SQLite Latency (Môi trường test `test_backend_scale_latency_800_videos_300_rss_60_ideas`)
Dữ liệu kiểm thử: **800** video (1.600 snapshots), **300** bài báo RSS trên 6 nguồn, **3** Project dùng chung kênh/video/feed, **60** ý tưởng đa Project trải đủ 5 trạng thái:
- `get_global_overview_summary`: **`1.42 ms`**
- `get_project_overview_summary`: **`1.66 ms`**
- `list_project_competitors` (800 video): **`10.43 ms`**
- `list_project_breakout_videos` (800 video): **`9.01 ms`**
- `rss_repo.list_articles` (`search="SQLite"`, `limit=200`): **`2.03 ms`**
- `rss_service.compute_rss_phrases` (`300` bài 7 ngày): **`3.80 ms`**
- `idea_repo.list_ideas` (`project_id`, `status="approved"`): **`1.40 ms`**

### B. UI Browser Latency & Scrolling (Môi trường E2E `602` video, `252` bài RSS)
- Render bảng `P3 Video bứt phá` (`602` video, phân trang `6` dòng/trang): đáp ứng tức thì, không giật khung hình khi lọc/sắp xếp/đổi trang.
- Khôi phục `Back` từ `VideoDetail` về `P3 Trang 2`: khôi phục chính xác `projectId`, filter, sort, phân trang và `scrollTop = 320` trong `1–2` khung hình (`< 1500 ms` deadline).
- Tải `G4` với `252` bài RSS: hiển thị và lọc mượt mà ngay từ SQLite cục bộ.

---

## 7. RỦI RO CÒN LẠI ĐỂ XEM XÉT Ở CÁC PHASE SAU

1. **Chưa kiểm thử trực tiếp với YouTube Data API v3 thật (`MEDIUM`):** Khi người dùng dán API Key thật lần đầu, cần theo dõi thực tế các trường hợp edge từ Google (ví dụ kênh không có `uploads` playlist, video bị ẩn số liệu `statistics`, hoặc tốc độ phản hồi mạng thực).
2. **Định danh kênh ngắn ở công cụ test cục bộ (`LOW`):** Regex `^UC[A-Za-z0-9_-]{20,40}$` trong `competitor_service.py` khớp chuẩn ID 24 ký tự của YouTube thật; chỉ các mock ID nhân tạo ngắn hơn 22 ký tự mới không khớp khi bấm `+ Đối thủ` trực tiếp theo ID.
3. **Cần rà soát tối ưu phân trang/render RSS khi bài viết vượt > 1.000 bài (`LOW` — phạm vi Phase 11):** Hiện tại `G4` giới hạn `limit=100` mặc định ở backend API cho mỗi lần truy vấn, nhưng nếu mở rộng quy mô hiển thị dài hạn cần giữ phân trang hoặc virtualization hợp lý.
