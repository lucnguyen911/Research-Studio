# Task Breakdown — Research Studio (MVP V1 — Standard Mode)

- **Tài liệu thiết kế & ràng buộc:** [AGENT_WORKFLOW.txt](file:///f:/Source%20Code%20Tool/Reserch%20Studio/AGENT_WORKFLOW.txt) · [CONSTRAINTS.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/CONSTRAINTS.md) · [SPEC.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/SPEC.md) · [tasks/plan.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/tasks/plan.md)
- **Tổng số task sau Phase 5 Plan Review:** `20` (`T01`–`T20`) chia theo `6` Milestone (`M1`–`M6`).
- **Quy ước thực thi theo [AGENT_WORKFLOW.txt](file:///f:/Source%20Code%20Tool/Reserch%20Studio/AGENT_WORKFLOW.txt):** Hoàn thành **Phase 6 (`UI/UX Design + Prototype Gate — GATE D`)** và nhận phê duyệt giao diện trước khi bước vào **Phase 7 (`T01`–`T20`)**. Cấu trúc file UI dưới đây là ranh giới màn hình/module hợp lý và có thể điều chỉnh theo bố cục đã chốt tại `GATE D`.

---

## Milestone 1 — Core Foundation

### [x] T01 — Cấu hình Runtime, Logging Che Khóa, Chuẩn hóa Lỗi & Chống Localhost CSRF/Origin
- **ID:** T01
- **TITLE:** Cấu hình Runtime, Logging Che Khóa (`Log Redaction`), Chuẩn hóa Lỗi & Chống Localhost CSRF/Origin
- **GOAL:** Thiết lập nền tảng cấu hình thư mục dữ liệu Windows (`RESEARCH_STUDIO_DATA_DIR` / `%LOCALAPPDATA%\ResearchStudio\`), bộ lọc log tự động che bí mật, tầng JSON lỗi thống nhất và hàng rào bảo vệ chống Localhost Drive-By CSRF (`X-Research-Studio-Client` + kiểm tra `Origin`), cùng cài đặt 3 gói Python tối thiểu (`tzdata`, `httpx`, `defusedxml`) khi bắt đầu Phase 7.
- **DEPENDENCIES:** Không có (kế thừa bộ khung Phase -1).
- **EXPECTED FILES/MODULES:**
  - `backend/requirements.txt` *(chỉ cập nhật khi bước vào Phase 7)*
  - `backend/app/core/__init__.py`
  - `backend/app/core/config.py`
  - `backend/app/core/logging_setup.py`
  - `backend/app/core/errors.py`
  - `backend/app/core/security.py`
  - `backend/app/main.py`
  - `backend/tests/test_core_config_security.py`
- **ACCEPTANCE CRITERIA:**
  - Khi `RESEARCH_STUDIO_DATA_DIR` trỏ tới thư mục tạm, Backend tự tạo đủ `data/`, `backups/`, `logs/`, `config/` tách khỏi Git.
  - `LogRedactionFilter` che sạch `key=...` và `Bearer ...` trên cả log console và `RotatingFileHandler`; mọi lỗi trả JSON chuẩn `{"error": {"code", "message", "details"}}` không lộ stack trace.
  - Mọi request `POST`/`PUT`/`PATCH`/`DELETE` tới `/api/v1/*` thiếu header `X-Research-Studio-Client: local-web` hoặc có `Origin` ngoài `127.0.0.1`/`localhost` bị từ chối với mã HTTP `403`.
- **VERIFICATION:**
  - `.\backend\.venv\Scripts\python.exe -m compileall -q backend/app backend/tests`
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_core_config_security.py -v`
  - `.\backend\.venv\Scripts\python.exe -m pip check`
- **RISK:** LOW
- **USER APPROVAL REQUIRED:** NO *(Phụ thuộc việc User đã duyệt `GATE C` cho `tzdata`, `httpx`, `defusedxml`; chỉ cài khi vào Phase 7).*

### [x] T02 — Nền tảng SQLite (`WAL` + `BEGIN IMMEDIATE` + `to_thread`), Migration Backup & Schema 3 Tầng Nullable Tombstone
- **ID:** T02
- **TITLE:** Nền tảng SQLite (`WAL` + `BEGIN IMMEDIATE` + `to_thread`), Migration Backup & Schema 3 Tầng Nullable Tombstone
- **GOAL:** Xây dựng helper kết nối SQLite an toàn đồng thời cho Python 3.11 (`connection-per-operation` đóng trong `finally`, `WAL`, `NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`, `isolation_level = None` + `BEGIN IMMEDIATE`, helper `anyio.to_thread.run_sync`), trình migration forward-only bắt buộc `Connection.backup()` (giới hạn 3 bản `.db`), và schema 3 tầng có toàn bộ cột `YouTube API Data` cho phép `NULL` kèm `ON DELETE RESTRICT` trên liên kết `video_id`/`channel_id`.
- **DEPENDENCIES:** T01
- **EXPECTED FILES/MODULES:**
  - `backend/app/db/__init__.py`
  - `backend/app/db/connection.py`
  - `backend/app/db/migrator.py`
  - `backend/app/db/migrations/001_initial_schema.sql`
  - `backend/tests/test_db_migrations_concurrency.py`
- **ACCEPTANCE CRITERIA:**
  - Kiểm thử ghi đồng thời nhiều thread qua `BEGIN IMMEDIATE` không gặp `OperationalError: database is locked` tức thì hay `WinError 32` khi xóa thư mục tạm trên Windows.
  - Khi DB tồn tại và có migration mới, tạo bản backup trong `backups/` bằng `Connection.backup()`; nếu migration lỗi thì rollback nguyên vẹn giữ DB cũ sạch.
  - Tất cả cột `API Data` trên `youtube_channels` / `youtube_videos` (trừ PK) cho phép `NULL`; khóa ngoại `video_id` / `channel_id` dùng `ON DELETE RESTRICT`, còn `project_id -> projects(id)` dùng `ON DELETE CASCADE`; hỗ trợ lưu thực thể dùng chung khi có `0` Project.
- **VERIFICATION:**
  - `.\backend\.venv\Scripts\python.exe -m compileall -q backend/app backend/tests`
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_db_migrations_concurrency.py -v`
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [x] T03 — Bảo vệ YouTube API Key bằng Windows DPAPI (`LocalFree` + Phục hồi Lỗi Giải mã), Cài đặt Hệ thống & Pháp lý
- **ID:** T03
- **TITLE:** Bảo vệ YouTube API Key bằng Windows DPAPI (`LocalFree` + Phục hồi Lỗi Giải mã), Cài đặt Hệ thống & Pháp lý
- **GOAL:** Hoàn thiện mã hóa/giải mã API Key bằng Windows DPAPI (`CryptProtectData`/`CryptUnprotectData` kèm giải phóng `kernel32.LocalFree` trong `finally` và xử lý blob hỏng/chuyển máy trả `api_key_status = "unreadable"`), repository đọc/ghi cài đặt hệ thống + ngưỡng quota 2 bucket + trạng thái chấp thuận Chính sách Quyền riêng tư YouTube, và router `/api/v1/system` gọi trực tiếp `settings_repo.py` (không thêm service pass-through thừa).
- **DEPENDENCIES:** T01, T02
- **EXPECTED FILES/MODULES:**
  - `backend/app/core/security.py`
  - `backend/app/repositories/__init__.py`
  - `backend/app/repositories/settings_repo.py`
  - `backend/app/routers/__init__.py`
  - `backend/app/routers/system.py`
  - `backend/app/main.py`
  - `backend/tests/test_dpapi_and_settings.py`
- **ACCEPTANCE CRITERIA:**
  - Test giải mã DPAPI thành công, giải phóng buffer `LocalFree` sạch sẽ; khi blob bị hỏng hoặc không giải mã được, `GET /api/v1/system/settings` vẫn trả `200 OK` với `api_key_status = "unreadable"` (cấm trả HTTP `500` khóa UI) và endpoint không bao giờ trả khóa thô.
  - Khi chưa đồng ý Chính sách Quyền riêng tư hoặc chưa có Key, endpoint kiểm tra trạng thái trả mã chuẩn `LEGAL_CONSENT_REQUIRED` / `YOUTUBE_API_KEY_MISSING`.
  - Lưu được cài đặt tham số `TUNING REQUIRED` với giá trị mặc định an toàn.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_dpapi_and_settings.py -v`
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [x] T04 — Backend API Quản lý Project, Xuất JSON Tên File An toàn & Xóa Project Kèm Snapshot Khôi phục
- **ID:** T04
- **TITLE:** Backend API Quản lý Project, Xuất JSON Tên File An toàn & Xóa Project Kèm Snapshot Khôi phục
- **GOAL:** Xây dựng `project_repo.py` và router `/api/v1/projects` (CRUD Project với `{project_id}` tường minh trên URL, không biến toàn cục ngầm; tải xuống 1 file JSON đơn giản chứa dữ liệu riêng của Project với tên file slug an toàn chống Windows device name & Path Traversal, tuyệt đối không kèm API Key; xóa Project bắt buộc khớp tên xác nhận, tự động lưu Project Recovery JSON chỉ gồm dữ liệu người dùng vào `backups/` và bảo toàn 100% thực thể dùng chung).
- **DEPENDENCIES:** T01, T02
- **EXPECTED FILES/MODULES:**
  - `backend/app/repositories/project_repo.py`
  - `backend/app/routers/projects.py`
  - `backend/app/main.py`
  - `backend/tests/test_projects_api.py`
- **ACCEPTANCE CRITERIA:**
  - Truy vấn Project A không đọc/sửa/xóa được dữ liệu Project B; Export JSON đặt tên file slug an toàn (chặn `../`, `CON`, `NUL`, `AUX`) và không chứa bất kỳ API Key hoặc `API Data` thừa của Project khác.
  - Xóa Project sai tên xác nhận trả `400 DELETE_CONFIRM_MISMATCH`; xóa đúng tên tạo file Recovery JSON trong `backups/`, xóa sạch dữ liệu riêng Project trong SQLite nhưng giữ nguyên 100% kênh/video/ý tưởng dùng chung còn gắn nơi khác hoặc trong Kho chung.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p "test_*.py" -v`
  - Smoke check Swagger UI (`http://127.0.0.1:8000/api/docs`) với các request tạo/đọc/export/xóa Project trên DB dev.
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### Checkpoint M1 — Core Foundation
- [x] Toàn bộ test `T01`–`T04` pass 100% (`0` skipped), `pip check` `0` xung đột.
- [x] Swagger UI `http://127.0.0.1:8000/api/docs` chạy thật: lưu & che API Key DPAPI, tạo/export/xóa Project có backup bảo toàn thực thể dùng chung.

---

## Milestone 2 — UI Foundation *(Thích ứng theo thiết kế đã duyệt tại `Phase 6 — GATE D`)*

### [x] T05 — Frontend API Client (`AbortController` + CSRF Header), Theme VOXLAB, App Shell 16 Mục & Khung `G1`/`P1` Cơ bản
- **ID:** T05
- **TITLE:** Frontend API Client (`AbortController` + CSRF Header), Theme VOXLAB, App Shell 16 Mục, Khung `G1`/`P1` Cơ bản & 5 Màn hình Giai đoạn 2
- **GOAL:** Cài đặt API client dùng chung (tự gắn header `X-Research-Studio-Client: local-web`, chuẩn hóa lỗi & hỗ trợ `AbortController`), đưa hệ thống CSS Tokens Light/Dark VOXLAB + bố cục App Shell đã duyệt ở `GATE D` vào ứng dụng chính (Sidebar 6 mục Global + 10 mục Project, 5 màn hình Giai đoạn 2 hiển thị giải thích trung thực, kèm khung hiển thị sống ban đầu cho màn hình mặc định `G1. Tổng quan` & `P1. Tổng quan dự án` thay vì màn hình trống/stub).
- **DEPENDENCIES:** T03, T04, và **hoàn tất phê duyệt `Phase 6 — GATE D` trước khi bắt đầu Phase 7**.
- **EXPECTED FILES/MODULES:** *(Ranh giới module, tinh chỉnh tên component theo `UI_DESIGN.md` nếu cần tại Gate D)*
  - `frontend/src/api/client.ts`
  - `frontend/src/api/types.ts`
  - `frontend/src/styles/tokens.css`
  - `frontend/src/styles/app.css`
  - `frontend/src/components/Sidebar.tsx`
  - `frontend/src/components/StageTwoPlaceholder.tsx`
  - `frontend/src/screens/OverviewPlaceholders.tsx` *(tạm hiển thị thông tin cấu hình thật & lối tắt cho `G1`/`P1` trước khi `T19` làm giàu dữ liệu)*
  - `frontend/src/App.tsx`
- **ACCEPTANCE CRITERIA:**
  - Sidebar đủ 16 mục đúng 2 phân khu; 5 màn hình Giai đoạn 2 gắn nhãn `Giai đoạn 2`, hiển thị giải thích trung thực và nút chuyển tới màn hình MVP liên quan; `G1` và `P1` hoạt động ngay (không để màn hình trang chủ mặc định bị gãy hoặc TODO).
  - Mọi lệnh gọi ghi đều gửi `X-Research-Studio-Client: local-web`; chuyển đổi mượt mà Light/Dark VOXLAB đạt chuẩn tương phản WCAG 2.1 AA (`>= 4.5:1`).
- **VERIFICATION:**
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
  - Chrome DevTools MCP: kiểm tra Light/Dark Mode, 16 mục điều hướng, `0` console error/warning.
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO *(Do `GATE D` đã được duyệt trước khi mở Phase 7 Build).*

### [x] T06 — Bộ Điều hướng Hợp nhất (`AppNavigationProvider` Bền vững qua `F5`), Project Selector Duy nhất & Khôi phục `Scroll` Bất đồng bộ
- **ID:** T06
- **TITLE:** Bộ Điều hướng Hợp nhất (`AppNavigationProvider` Bền vững qua `F5`), Project Selector Duy nhất & Khôi phục `Filters / Sort / Scroll` Bất đồng bộ
- **GOAL:** Triển khai `AppNavigationProvider` hợp nhất nguyên tử `(route, detailParams, activeProjectId)` trong một reducer + Dropdown Project duy nhất, đồng bộ URL hash + metadata nhẹ (`filters`, `sort`, `tab`, `loadedPage`, `scrollTop` — không lưu danh sách API data) qua `sessionStorage` + `window.history` (`scrollRestoration = 'manual'`), tự động khôi phục số trang đã nạp trước khi đặt `scrollTop` trong `requestAnimationFrame` sau tải bất đồng bộ, hủy request cũ bằng `AbortController` và tự điều hướng an toàn khi Back vào Project đã xóa.
- **DEPENDENCIES:** T05
- **EXPECTED FILES/MODULES:**
  - `frontend/src/state/AppNavigationContext.tsx`
  - `frontend/src/components/ProjectDropdown.tsx`
  - `frontend/src/components/HeaderNavBar.tsx`
  - `frontend/src/App.tsx`
- **ACCEPTANCE CRITERIA:**
  - Đổi Project hủy ngay request Project cũ qua `AbortController` và không phát sinh dù chỉ `1` frame gọi nhầm API của `activeProjectId` cũ.
  - Kiểm thử cả tải lại trang (`F5`) lẫn danh sách tải bất đồng bộ nhiều trang (`page > 1`): bấm Back/Forward khôi phục đúng màn hình, `project_id`, bộ lọc, sắp xếp, số bản ghi đã nạp và đúng vị trí cuộn `scrollTop`.
  - Nếu Back về một Project đã bị xóa, UI tự chuyển an toàn về Project khả dụng hoặc `G1` mà không kẹt lỗi `404`.
- **VERIFICATION:**
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
  - Chrome DevTools MCP: kịch bản đổi Project nhanh, mở list cuộn qua trang 2 → mở Chi tiết → bấm Back/Forward và bấm `F5` kiểm tra khôi phục trạng thái + `scrollTop`.
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [x] T07 — Giao diện Cài đặt Hệ thống, Công bố Pháp lý YouTube (`ToS & Privacy` + Xóa Cache) & `P6. Cài đặt dự án` Cơ bản
- **ID:** T07
- **TITLE:** Giao diện Cài đặt Hệ thống, Công bố Pháp lý YouTube (`ToS & Privacy` + Xóa Cache) & `P6. Cài đặt dự án` Cơ bản
- **GOAL:** Hoàn thiện màn hình *Cài đặt hệ thống chung & Pháp lý* (lưu/kiểm tra/xóa API Key dạng che, xử lý thông báo nếu khóa cũ không giải mã được, hộp thoại xác nhận Chính sách Quyền riêng tư lần đầu, liên kết YouTube ToS `https://www.youtube.com/t/terms` & Google Privacy Policy, nút Xóa toàn bộ cache YouTube API ngay lập tức, công tắc Làm mới tự động, ngưỡng quota 2 bucket) và phần cấu hình cơ bản của `P6. Cài đặt dự án` (thông số vùng/ngôn ngữ/định dạng, tải JSON Project đọc-chỉ, xóa Project có gõ đúng tên xác nhận). *(Phần gắn/gỡ nguồn RSS cho Project trên `P6` được nối bổ sung ngay trong `T11`).*
- **DEPENDENCIES:** T03, T04, T06
- **EXPECTED FILES/MODULES:**
  - `frontend/src/screens/SystemSettingsScreen.tsx`
  - `frontend/src/screens/ProjectSettingsScreen.tsx`
  - `frontend/src/components/LegalConsentModal.tsx`
- **ACCEPTANCE CRITERIA:**
  - Nhập/lưu API Key chỉ hiển thị chuỗi che trên UI; hiển thị đầy đủ liên kết YouTube Terms of Service & Google Privacy Policy và chặn thao tác YouTube tới khi xác nhận đồng ý Chính sách Quyền riêng tư.
  - `P6` sửa được thông số Project, tải được JSON Project sạch không chứa API Key, và xóa Project có hộp thoại nhập đúng tên xác nhận.
- **VERIFICATION:**
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
  - Chrome DevTools MCP: tạo Project qua Dropdown → sửa ở `P6` → reload (`F5`) kiểm tra bền vững → test modal Pháp lý & tải JSON Project.
- **RISK:** LOW
- **USER APPROVAL REQUIRED:** NO

### Checkpoint M2 — UI Foundation (Runnable Desktop Shell)
- [x] `typecheck`, `lint`, `vite build` đạt `0` lỗi/cảnh báo; Backend test pass 100%.
- [x] Mở `http://127.0.0.1:5173` qua Chrome DevTools MCP xác nhận vỏ app VOXLAB (Light/Dark), 16 mục Sidebar, 1 Dropdown Project, Back/Forward/`F5`, Cài đặt hệ thống & Pháp lý và `P6` chạy thật với SQLite.

---

## Milestone 3 — Research Data

### [x] T08 — Sổ cái Quota 2 Bucket Nguyên tử (`America/Los_Angeles`), Phân loại 3 Lớp Định dạng & Bộ Quản lý Hạn 30 Ngày
- **ID:** T08
- **TITLE:** Sổ cái Quota 2 Bucket Nguyên tử (`America/Los_Angeles`), Phân loại 3 Lớp Định dạng & Bộ Quản lý Hạn Lưu trữ 30 Ngày
- **GOAL:** Xây dựng 3 engine chuẩn của Research Studio: (1) `quota_repo.py` + `quota_service.py` dùng `ZoneInfo("America/Los_Angeles")` (tính mốc reset `00:00 PT` chính xác qua DST) với cơ chế đặt trước nguyên tử trong `BEGIN IMMEDIATE`; (2) `format_classifier.py` thuần Python phân tách 3 lớp (`source_format_status`: `long_form`/`shorts`/`unknown` cấm ngưỡng `60s`, + `format_hint` kèm độ tin cậy & căn cứ, + tách biệt nhãn thủ công); (3) `youtube_repo.py` + `retention_service.py` dọn `YouTube API Data` quá 30 ngày lịch (tombstone toàn bộ cột API cho bản ghi còn liên kết người dùng, chỉ xóa dòng kênh nếu không còn `youtube_videos` hay liên kết nào) và xóa backup `.db` chứa API Data khi người dùng yêu cầu xóa.
- **DEPENDENCIES:** T03
- **EXPECTED FILES/MODULES:**
  - `backend/app/repositories/quota_repo.py`
  - `backend/app/repositories/youtube_repo.py`
  - `backend/app/services/__init__.py`
  - `backend/app/services/quota_service.py`
  - `backend/app/services/format_classifier.py`
  - `backend/app/services/retention_service.py`
  - `backend/tests/test_quota_format_retention.py`
- **ACCEPTANCE CRITERIA:**
  - Đặt trước quota nguyên tử chống vượt trần đồng thời cho cả `search_queries` (`100`) và `general_data` (`10.000`); tính đúng giờ reset UTC ngay trong ngày chuyển đổi DST.
  - Video `> 180s` (không phải live đang phát) → `long_form`; mọi video `<= 180s` thiếu xác nhận API (kể cả `45s`) → `unknown` (`Chưa xác định`); gợi ý `#shorts` / mốc `< 15/10/2024` hiển thị rõ độ tin cậy và căn cứ; nhãn thủ công giữ nguyên trong `user_video_format_labels`.
  - Test `purge_expired_api_data` và `purge_all_youtube_api_data_by_user_request`: xóa sạch mọi cột API (`title`, `published_at`, `tags_json`, `duration_seconds`, `format_hint*`, snapshot, search cache, `.db` backup chứa API Data) mà giữ nguyên 100% `projects`, `ideas`, từ khóa, ghi chú và nhãn thủ công không lỗi `FOREIGN KEY`.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_quota_format_retention.py -v`
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [x] T09 — YouTube Data API v3 Client (`0` Auto-Retry trên `search.list`), Cache Thực thể Gốc & API Global Xu hướng / Tự do
- **ID:** T09
- **TITLE:** YouTube Data API v3 Client (`0` Auto-Retry trên `search.list`), Cache Thực thể Gốc & API Global Xu hướng / Nghiên cứu Tự do
- **GOAL:** Xây dựng `youtube_client.py` (`httpx`, đặt trước `1` unit cho từng wire attempt và chỉ hoàn trả khi `ConnectError` trước kết nối, **tắt hoàn toàn auto-retry trên `search.list`**, parse `ISO 8601 duration`, map lỗi `403 quotaExceeded`/timeout/hủy) cùng `discovery_service.py` và router `global_research.py` phục vụ `G2. Xu hướng`, `G3. Nghiên cứu tự do`, *Chi tiết Video/Kênh* (luôn lọc `api_expires_at > now AND api_purged_at IS NULL` khi đọc `API Data`) và gán Nhãn định dạng thủ công.
- **DEPENDENCIES:** T08
- **EXPECTED FILES/MODULES:**
  - `backend/app/clients/__init__.py`
  - `backend/app/clients/youtube_client.py`
  - `backend/app/services/discovery_service.py`
  - `backend/app/routers/global_research.py`
  - `backend/app/main.py`
  - `backend/tests/test_youtube_client_and_global.py`
- **ACCEPTANCE CRITERIA:**
  - `search.list` lỗi tạm thời trả lỗi ngay (không tự retry đốt bucket `100/ngày`); `videos.list` retry tối đa `2` lần và trừ đúng số unit mỗi lượt chạm mạng; `ConnectError` cục bộ hoàn trả `1` unit đã giữ.
  - Mở lại phiên `search_sessions` còn hạn tốn `0` quota; mọi truy vấn đọc tự động loại trừ bản ghi `API Data` đã quá hạn 30 ngày ngay cả trước khi purge chạy.
  - Không tính hoặc trả về bất kỳ chỉ số dẫn xuất bị cấm hay Search Volume giả; hỗ trợ đặt/xóa nhãn định dạng thủ công cho video.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_youtube_client_and_global.py -v`
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [x] T10 — Bộ Thu thập RSS/Atom Chống SSRF/Redirect/XXE (`defusedxml` + `HTMLParser`), Khử trùng lặp, Cô lập Lỗi & Liên kết RSS Project
- **ID:** T10
- **TITLE:** Bộ Thu thập RSS/Atom Chống SSRF/Redirect/XXE (`defusedxml` + `HTMLParser`), Khử trùng lặp, Cô lập Nguồn Lỗi & Liên kết RSS Project
- **GOAL:** Cài đặt `rss_client.py` (xác thực DNS/IP `.is_global` chặn `127.0.0.1`/LAN/`169.254.169.254`/`::1`, `follow_redirects=False` kiểm tra lại IP ở mỗi redirect `<= 3` bước, streaming `aiter_bytes` cắt ngang vượt `5 MB`, parse XML bằng `defusedxml`, làm sạch HTML qua lớp con `html.parser.HTMLParser` loại bỏ trọn cây `<script>`/`<style>` + `html.unescape`) cùng `rss_repo.py`, `rss_service.py` và router `rss.py` (kèm endpoint gắn/gỡ nguồn RSS cho Project tại `project_rss_feeds` và thống kê cụm từ RSS bằng Python).
- **DEPENDENCIES:** T01, T02
- **EXPECTED FILES/MODULES:**
  - `backend/app/clients/rss_client.py`
  - `backend/app/repositories/rss_repo.py`
  - `backend/app/services/rss_service.py`
  - `backend/app/routers/rss.py`
  - `backend/app/main.py`
  - `backend/tests/test_rss_security_and_ingestion.py`
- **ACCEPTANCE CRITERIA:**
  - Chặn `http://127.0.0.1:8000/...`, IPv6 `::1`, mạng LAN `192.168.x`/`10.x`, `169.254.169.254` và URL redirect từ host công khai sang địa chỉ nội bộ; ngắt payload vượt `5 MB`; chặn XXE và không để sót nội dung text bên trong `<script>...</script>` sau khi làm sạch HTML.
  - Làm mới lặp lại không nhân bản bài viết; lỗi `404`/XML hỏng của 1 feed chỉ đánh dấu lỗi trên đúng feed đó; cung cấp API gắn/gỡ nguồn RSS cho `project_id` và thống kê cụm từ RSS offline với nhãn tách biệt khỏi YouTube.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_rss_security_and_ingestion.py -v`
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [x] T11 — Giao diện `G4. Tin tức & thảo luận`, *Chi tiết Bài báo RSS* & Liên kết Nguồn RSS cho Project tại `P6`
- **ID:** T11
- **TITLE:** Giao diện `G4. Tin tức & thảo luận`, *Chi tiết Bài báo RSS* & Liên kết Nguồn RSS cho Project tại `P6`
- **GOAL:** Hoàn thiện hoàn chỉnh luồng RSS trên Frontend (`G4. Tin tức & thảo luận`, quản lý/bật-tắt/làm mới nguồn RSS có Cancel/Retry, hiển thị lỗi cô lập từng nguồn, xem *Chi tiết Bài báo RSS* an toàn thuần văn bản + bảng cụm từ nổi bật gắn nhãn `Nguồn: RSS (Dữ liệu ngoài YouTube)`) và bổ sung khu vực chọn liên kết các nguồn RSS cho Project đang chọn trong `P6. Cài đặt dự án`.
- **DEPENDENCIES:** T07, T10
- **EXPECTED FILES/MODULES:**
  - `frontend/src/screens/RssNewsScreen.tsx`
  - `frontend/src/screens/RssArticleDetailScreen.tsx`
  - `frontend/src/screens/ProjectSettingsScreen.tsx`
- **ACCEPTANCE CRITERIA:**
  - Người dùng thêm/bật/làm mới nguồn RSS thật với `0` quota YouTube, đọc bài báo và cụm từ RSS khi offline, thấy rõ trạng thái cô lập khi một feed lỗi, và mở/đóng bài gốc chỉ với link `https://`/`http://`.
  - Tại `P6. Cài đặt dự án`, người dùng chọn/bỏ chọn được các nguồn RSS toàn cục để gắn vào Project đang hoạt động (`project_rss_feeds`).
- **VERIFICATION:**
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
  - Chrome DevTools MCP: chạy `G4` với feed RSS hợp lệ + feed giả lập lỗi + gắn RSS vào Project ở `P6`, thử Back/Forward và đọc lại khi offline.
- **RISK:** LOW
- **USER APPROVAL REQUIRED:** NO

### [x] T12 — Giao diện `G2. Khám phá xu hướng`, `G3. Nghiên cứu tự do`, *Chi tiết Video/Kênh* & Huy hiệu Định dạng 3 Lớp
- **ID:** T12
- **TITLE:** Giao diện `G2. Khám phá xu hướng`, `G3. Nghiên cứu tự do`, *Chi tiết Video/Kênh* & Huy hiệu Định dạng 3 Lớp
- **GOAL:** Xây dựng giao diện cho `G2. Khám phá xu hướng`, `G3. Nghiên cứu tự do` (hiển thị dự báo chi phí `1 lượt Search Queries` trước khi tìm, lịch sử phiên tìm còn hạn mở lại `0 quota`), trang *Chi tiết Video* (bảng mốc thô `<= 30 ngày` + tags + tách biệt rõ Định dạng xác minh nguồn / Gợi ý kèm độ tin cậy & căn cứ / Nhãn thủ công của người dùng), trang *Chi tiết Kênh*, và nhận diện YouTube theo Branding Guidelines.
- **DEPENDENCIES:** T07, T09
- **EXPECTED FILES/MODULES:**
  - `frontend/src/components/FormatBadgeGroup.tsx`
  - `frontend/src/screens/TrendsScreen.tsx`
  - `frontend/src/screens/FreeSearchScreen.tsx`
  - `frontend/src/screens/YoutubeDetailScreens.tsx`
- **ACCEPTANCE CRITERIA:**
  - `G2` và `G3` lọc được riêng 3 trạng thái định dạng nguồn + tùy chọn nhãn thủ công, sắp xếp trên trường gốc, hiển thị đúng attribution YouTube (không dùng chỉ số dẫn xuất hay Search Volume giả) và khôi phục filter/sort/`loadedPage`/`scrollTop` khi Back từ *Chi tiết Video/Kênh*.
  - Nếu chưa có API Key hoặc chưa đồng ý Pháp lý, hiển thị empty/error state có nút chuyển thẳng tới Cài đặt API Key / Modal Pháp lý ở `T07`.
- **VERIFICATION:**
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
  - Chrome DevTools MCP: kiểm tra render `G2`, `G3`, *Chi tiết Video/Kênh*, chuyển đổi nhãn thủ công và Back/Forward state restore.
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### Checkpoint M3 — Research Data (Runnable Global Discovery & RSS)
- [x] Toàn bộ test `T08`–`T12` pass 100%; frontend `typecheck`/`lint`/`build` sạch.
- [x] Chạy thử Global Research trên trình duyệt cục bộ: đọc RSS thật (`G4`), gắn nguồn RSS cho Project ở `P6`, xem Xu hướng (`G2`), Tìm tự do (`G3`), xem Chi tiết Video/Kênh, gán Nhãn định dạng thủ công và kiểm tra đồng hồ Quota 2 bucket (`PT`).

---

## Milestone 4 — Idea Workspace *(Đưa lên sớm để chốt luồng nghiên cứu → lưu → quản lý đa Project)*

### [x] T13 — Backend Kho Ý tưởng Chung (`G5`), Liên kết Đa Project & 5 Trạng thái Sản xuất Độc lập (`P5`)
- **ID:** T13
- **TITLE:** Backend Kho Ý tưởng Chung (`G5`), Liên kết Đa Project & 5 Trạng thái Sản xuất Độc lập (`P5`)
- **GOAL:** Triển khai `idea_repo.py`, `idea_service.py` và router `ideas.py` cho Kho Ý tưởng chung (`G5`) và Quản lý ý tưởng theo Project (`P5`): tạo ý tưởng viết tay hoặc từ Video/RSS/Từ khóa, gắn 1 bản ý tưởng gốc vào 1 hoặc nhiều Project với góc khai thác, ghi chú, ưu tiên, `published_video_url` và 5 trạng thái (`new`, `researching`, `approved`, `produced`, `skipped`) hoàn toàn độc lập; dùng `LEFT JOIN` nullable bảo đảm ý tưởng vẫn đọc bình thường ngay cả khi `API Data` của video nguồn đã quá 30 ngày và bị xóa phần API.
- **DEPENDENCIES:** T04, T08, T10
- **EXPECTED FILES/MODULES:**
  - `backend/app/repositories/idea_repo.py`
  - `backend/app/services/idea_service.py`
  - `backend/app/routers/ideas.py`
  - `backend/app/main.py`
  - `backend/tests/test_ideas_multiproject.py`
- **ACCEPTANCE CRITERIA:**
  - 1 bản ý tưởng gắn vào Project A và Project B chỉ tạo **1** dòng trong `ideas` và **2** dòng trong `project_ideas`; đổi trạng thái/góc khai thác ở Project A không ảnh hưởng Project B.
  - Khi video YouTube gắn vào Ý tưởng bị xóa hết `API Data` (`api_purged_at IS NOT NULL`), truy vấn `G5` và `P5` vẫn trả đủ thông tin Ý tưởng + `source_url`/`video_id` kèm cờ báo metadata API đã hết hạn 30 ngày.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_ideas_multiproject.py -v`
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### [x] T14 — Giao diện `G5. Kho ý tưởng chung`, `P5. Quản lý ý tưởng`, *Chi tiết Ý tưởng* & `<SaveIdeaModal />` trên `G2`/`G3`/`G4`
- **ID:** T14
- **TITLE:** Giao diện `G5. Kho ý tưởng chung`, `P5. Quản lý ý tưởng` (Bảng/Danh sách Gọn nhẹ), *Chi tiết Ý tưởng* & `<SaveIdeaModal />` trên `G2`, `G3`, `G4`
- **GOAL:** Xây dựng màn hình `G5. Kho ý tưởng chung`, `P5. Quản lý ý tưởng` (giao diện Danh sách / Bảng gọn nhẹ kèm lọc 5 trạng thái, ưu tiên, nguồn gốc và đổi trạng thái trực tiếp — không Kanban kéo thả), trang *Chi tiết Ý tưởng*, và hộp thoại dùng chung `<SaveIdeaModal />` tích hợp ngay vào `G2. Xu hướng`, `G3. Tự do`, `G4. RSS` cùng các trang Chi tiết hiện có.
- **DEPENDENCIES:** T11, T12, T13
- **EXPECTED FILES/MODULES:**
  - `frontend/src/components/SaveIdeaModal.tsx`
  - `frontend/src/screens/GlobalIdeasScreen.tsx`
  - `frontend/src/screens/ProjectIdeasScreen.tsx`
  - `frontend/src/screens/IdeaDetailScreen.tsx`
  - *(Gắn nút Lưu Ý tưởng vào `TrendsScreen.tsx`, `FreeSearchScreen.tsx`, `RssNewsScreen.tsx`, `RssArticleDetailScreen.tsx`, `YoutubeDetailScreens.tsx`)*
- **ACCEPTANCE CRITERIA:**
  - Từ kết quả tìm kiếm/xu hướng/RSS/Chi tiết bất kỳ, bấm **Lưu thành Ý tưởng** lưu được ngay vào Kho chung hoặc gắn sang 1–nhiều Project.
  - Trên `P5`, lọc/tìm kiếm/chuyển qua lại cả 5 trạng thái trên bảng/danh sách gọn nhẹ và sửa góc khai thác, ghi chú, `published_video_url` thành công xuống SQLite.
  - Trên `G5`, xem được mọi ý tưởng gốc, gắn nhanh sang nhiều Project và xem lại đầy đủ ngay cả khi ngắt mạng.
- **VERIFICATION:**
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
  - Chrome DevTools MCP: tạo Project → tìm/lọc ở `G4`/`G3` → bấm Lưu Ý tưởng → gắn đa Project ở `G5` → đổi trạng thái khác nhau ở `P5` → bật offline/reload kiểm chứng.
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### Checkpoint M4 — Idea Workspace (Complete Core End-to-End Product Loop)
- [x] Toàn bộ test `T13`–`T14` pass 100%; frontend `typecheck`/`lint`/`build` sạch.
- [x] **Kiểm chứng luồng cốt lõi hoàn chỉnh sớm:** Tạo Project → Khám phá YouTube/RSS → Lưu Ý tưởng → Quản lý 5 trạng thái đa Project → Ngắt mạng đọc lại dữ liệu đã lưu.

---

## Milestone 5 — Competitor, Breakout & Keyword Research

### [x] T15 — Backend & UI `P2. Theo dõi đối thủ` (Phân giải Kênh Tiết kiệm Quota, Mốc Thô `<= 30 Ngày` & Thêm Nhanh từ `G2`/`G3`)
- **ID:** T15
- **TITLE:** Backend & UI `P2. Theo dõi đối thủ` (Phân giải Kênh Tiết kiệm Quota, Mốc Thô `<= 30 Ngày` & Thêm Nhanh Kênh từ `G2`/`G3`)
- **GOAL:** Triển khai `competitor_service.py` + `project_competitors.py` (phân giải URL/`@handle`/`channel_id` bằng `channels.list` `1 unit`, lấy `30–50` video gần nhất từ playlist `uploads` + `videos.list` lô `50` ID, ghi mốc snapshot thô `<= 30 ngày`, cô lập theo Project) cùng màn hình `P2. Theo dõi đối thủ` tích hợp sẵn `<SaveIdeaModal />` và gắn nút **Thêm kênh vào đối thủ Project** ngay trên `G2`, `G3` và *Chi tiết Kênh*.
- **DEPENDENCIES:** T09, T14
- **EXPECTED FILES/MODULES:**
  - `backend/app/services/competitor_service.py`
  - `backend/app/routers/project_competitors.py`
  - `backend/app/main.py`
  - `backend/tests/test_competitors.py`
  - `frontend/src/screens/CompetitorsScreen.tsx` *(kèm gắn nút thêm đối thủ nhanh vào `TrendsScreen.tsx`, `FreeSearchScreen.tsx`, `YoutubeDetailScreens.tsx`)*
- **ACCEPTANCE CRITERIA:**
  - Thêm đối thủ bằng `@handle`/`channel_id`/URL không gọi `search.list`; cùng 1 kênh theo dõi bởi 2 Project chỉ lưu `1` bản gốc trong `youtube_channels` và cập nhật `1` lần; gỡ đối thủ ở Project A giữ nguyên ở Project B.
  - UI `P2` hiển thị danh sách kênh & video đối thủ tách 3 trạng thái định dạng, cho mở *Chi tiết Video* xem các mốc số liệu thô theo timestamp (`<= 30 ngày`) và lưu ngay thành Ý tưởng.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_competitors.py -v`
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### [x] T16 — API Lọc Gọn & Giao diện `P3. Video bứt phá` ở Standard Mode (Dữ liệu Gốc, Đánh dấu Thủ công & Lưu Ý tưởng)
- **ID:** T16
- **TITLE:** API Lọc Gọn & Giao diện `P3. Video bứt phá` ở Standard Mode (Dữ liệu Gốc, Đánh dấu Thủ công & Tích hợp Lưu Ý tưởng)
- **GOAL:** Bổ sung truy vấn sàng lọc + endpoint bật/tắt cờ `Đánh dấu Bứt phá thủ công` (`project_videos`) trực tiếp vào `youtube_repo.py` và `project_competitors.py` (không tách `breakout_standard_service.py` dư thừa), và xây dựng màn hình `P3. Video bứt phá (Standard Mode)`: lọc cửa sổ ngày (`3/7/14/30 ngày`), tách 3 trạng thái định dạng nguồn + nhãn thủ công, lọc ngưỡng `viewCount`/`likeCount`/`commentCount` gốc, sắp xếp trường gốc, hiển thị khung công bố minh bạch những gì hiện có vs. chưa khả dụng, và tích hợp `<SaveIdeaModal />`.
- **DEPENDENCIES:** T15
- **EXPECTED FILES/MODULES:**
  - `backend/app/repositories/youtube_repo.py`
  - `backend/app/routers/project_competitors.py`
  - `backend/tests/test_breakout_standard.py`
  - `frontend/src/screens/BreakoutVideosScreen.tsx`
- **ACCEPTANCE CRITERIA:**
  - Không tính hoặc hiển thị `Outlier Multiplier`, `Views/ngày`, `Engagement Rate`, `Channel Median` hay snapshot `> 30 ngày`; không chứa module/công tắc mở khóa ẩn.
  - Video `Chưa xác định` tuyệt đối không tự động gộp vào bộ đếm `Video dài` hoặc `Shorts`; cờ `is_user_breakout` và ghi chú bứt phá cô lập theo `project_id` và lưu vĩnh viễn.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_breakout_standard.py -v`
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### [x] T17 — Backend & UI `P4. Nghiên cứu từ khóa` ở Standard Mode, Đối chiếu RSS Project & Lưu Nhanh Từ khóa từ `G3`
- **ID:** T17
- **TITLE:** Backend & UI `P4. Nghiên cứu từ khóa` ở Standard Mode, Đối chiếu RSS Project & Lưu Nhanh Từ khóa từ `G3`
- **GOAL:** Tập trung toàn bộ CRUD từ khóa Project (`project_keywords`), quét YouTube theo yêu cầu áp dụng `regionCode`/`relevanceLanguage` của Project (xác nhận tổng lượt `Search Queries` khi quét nhiều từ khóa, nút Cancel), đối chiếu bài báo/cụm từ từ các nguồn RSS đã gắn với Project (`project_rss_feeds`), xây dựng màn hình `P4. Nghiên cứu từ khóa (Standard Mode)` tích hợp `<SaveIdeaModal />`, và gắn nút **Lưu từ khóa `q` vào Project** ngay trên `G3. Nghiên cứu tự do`.
- **DEPENDENCIES:** T09, T10, T14
- **EXPECTED FILES/MODULES:**
  - `backend/app/repositories/keyword_repo.py`
  - `backend/app/services/keyword_service.py`
  - `backend/app/routers/project_keywords.py`
  - `backend/app/main.py`
  - `backend/tests/test_keywords_and_rss_crossref.py`
  - `frontend/src/screens/KeywordResearchScreen.tsx` *(kèm gắn nút Lưu từ khóa vào `FreeSearchScreen.tsx`)*
- **ACCEPTANCE CRITERIA:**
  - Từ khóa của Project A tách biệt hoàn toàn Project B; mở lại kết quả đã quét còn hạn `<= 30 ngày` tiêu tốn `0` quota; không hiển thị Search Volume giả hay chỉ số dẫn xuất/trung vị gộp chéo từ `API Data`.
  - Khung **Tín hiệu RSS của Project (`Nguồn: RSS — Dữ liệu ngoài YouTube`)** chỉ truy vấn trên các `feed_id` được gắn vào Project tại `P6` (`T11`), đếm số bài khớp và cụm từ liên quan bằng Python.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_keywords_and_rss_crossref.py -v`
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### Checkpoint M5 — Competitor, Breakout & Keyword Research (Full Project Research)
- [x] Toàn bộ test `T15`–`T17` pass 100%; frontend `typecheck`/`lint`/`build` sạch.
- [x] Chạy thử trên trình duyệt qua Chrome DevTools MCP toàn bộ nghiệp vụ Project: thêm đối thủ (`P2`) → sàng lọc `Video bứt phá` (`P3`) → quản lý & quét Từ khóa đối chiếu RSS (`P4`) → đẩy thẳng sang Ý tưởng (`P5`).

---

## Milestone 6 — Integration, Controlled Auto-Refresh & Stability

### [ ] T18 — Tác vụ Dọn TTL 30 Ngày Vô điều kiện & Bộ Lập lịch Tự động Làm mới Có Kiểm soát (`Lifespan Scheduler`)
- **ID:** T18
- **TITLE:** Tác vụ Dọn TTL 30 Ngày Vô điều kiện & Bộ Lập lịch Tự động Làm mới Có Kiểm soát (`Lifespan Scheduler`)
- **GOAL:** Xây dựng `scheduler_service.py` chạy gọn trong `FastAPI lifespan` với hai luồng trách nhiệm tách biệt: (1) Tác vụ dọn TTL `30 ngày lịch` tại local **luôn chạy khi khởi động và theo nhịp timer nội bộ bất kể `auto_refresh_enabled` Bật hay Tắt** (`0` network calls); (2) Tác vụ làm mới mạng tự động chỉ chạy khi app mở và `auto_refresh_enabled = True`, chờ trễ `30s` sau khởi động, giới hạn unit/đợt & trần quota tự động ngày, `0` lượt `search.list`, ưu tiên Video gắn Ý tưởng sắp chạm hạn 30 ngày → Kênh đối thủ → RSS, khóa `in-flight` chống trùng lặp, và tất cả truy vấn SQL chạy qua `anyio.to_thread.run_sync`.
- **DEPENDENCIES:** T08, T10, T13, T15
- **EXPECTED FILES/MODULES:**
  - `backend/app/services/scheduler_service.py`
  - `backend/app/routers/system.py`
  - `backend/app/main.py`
  - `backend/tests/test_scheduler_and_ttl.py`
- **ACCEPTANCE CRITERIA:**
  - Khi tắt `auto_refresh_enabled`, bộ lập lịch gửi `0` request mạng nhưng **vẫn** tự động chạy `purge_expired_api_data` dọn sạch `API Data` quá 30 ngày và giữ nguyên `100%` Ý tưởng, ghi chú, từ khóa, nhãn thủ công.
  - Khi bật `auto_refresh_enabled`, không bắn request ồ ạt lúc khởi động; tôn trọng thứ tự ưu tiên, `batch cap`, `daily auto cap`, dừng khi quota ngày chạm `80%`, và hủy sạch tác vụ nền khi shutdown FastAPI.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_scheduler_and_ttl.py -v`
- **RISK:** HIGH
- **USER APPROVAL REQUIRED:** NO

### [ ] T19 — Hoàn thiện Số liệu Tổng hợp Thực tế cho `G1. Tổng quan` & `P1. Tổng quan dự án`
- **ID:** T19
- **TITLE:** Hoàn thiện Số liệu Tổng hợp Thực tế cho `G1. Tổng quan` & `P1. Tổng quan dự án`
- **GOAL:** Nâng cấp endpoint `summary` (Router đọc thẳng query tổng hợp từ Repository, không thêm `overview_service.py`) và giao diện đầy đủ cho `G1. Tổng quan` (2 bucket Quota `PT`, trạng thái làm mới & bản ghi sắp chạm hạn `30 ngày`, tóm tắt Kho ý tưởng, bài RSS mới nhất) và `P1. Tổng quan dự án` (đếm video đối thủ tách bạch 3 trạng thái định dạng + số từ khóa + tin RSS liên kết + phễu 5 trạng thái Ý tưởng + nút làm mới Project có Cancel/Retry), đồng bộ thanh trạng thái Quota & Auto-refresh trên Header.
- **DEPENDENCIES:** T16, T17, T18
- **EXPECTED FILES/MODULES:**
  - `backend/app/routers/global_research.py`
  - `backend/app/routers/projects.py`
  - `backend/tests/test_overviews.py`
  - `frontend/src/screens/GlobalOverviewScreen.tsx`
  - `frontend/src/screens/ProjectOverviewScreen.tsx`
- **ACCEPTANCE CRITERIA:**
  - Mọi số liệu trên `G1` và `P1` lấy trực tiếp từ SQLite thật (`api_expires_at > now`), bộ đếm video trên `P1` tách bạch 3 nhóm `Video dài`, `Shorts`, `Chưa xác định`.
  - Lối tắt từ các thẻ tổng quan điều hướng chuẩn xác và đồng bộ lịch sử Back/Forward.
- **VERIFICATION:**
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest backend/tests/test_overviews.py -v`
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build`
- **RISK:** LOW
- **USER APPROVAL REQUIRED:** NO

### [ ] T20 — Kiểm thử Tích hợp Đầu–Cuối, Chế độ Offline, Quota, Bảo mật (SSRF/CSRF/DPAPI/XSS) & Nghiệm thu `AC-01`..`AC-18`
- **ID:** T20
- **TITLE:** Kiểm thử Tích hợp Đầu–Cuối, Chế độ Offline, Quota, Bảo mật (SSRF/CSRF/DPAPI/XSS) & Nghiệm thu `AC-01`..`AC-18`
- **GOAL:** Triển khai bộ kiểm thử tích hợp E2E tổng hợp (`Offline`, hết `Search Queries` vs hết `General Data API`, `Cancel`/`Retry`, SSRF redirect nội bộ, Localhost CSRF thiếu header/Origin lạ, DPAPI `unreadable`, XXE/XSS RSS, mô phỏng hết hạn 30 ngày, xóa cache YouTube API ngay lập tức, cô lập `project_id`), đo thông số cơ sở cho các tham số `TUNING REQUIRED` và kiểm tra trực tiếp trên trình duyệt bằng Chrome DevTools MCP để đối chiếu toàn bộ `AC-01`..`AC-18` trước khi sang Phase 8–13.
- **DEPENDENCIES:** T19
- **EXPECTED FILES/MODULES:**
  - `backend/tests/test_e2e_resilience_security.py`
  - *(Sửa lỗi cục bộ nếu phát hiện trong quá trình kiểm thử tích hợp)*
- **ACCEPTANCE CRITERIA:**
  - 100% Backend test pass (`0` skipped), `compileall` & `pip check` sạch; Frontend `tsc -b`, `oxlint` (`0` errors/warnings), `vite build` và `npm audit --audit-level=high` (`0` high+) đạt chuẩn.
  - Chrome DevTools MCP xác nhận toàn bộ các màn hình MVP + 5 màn hình Giai đoạn 2 hoạt động mượt ở cả Light Mode & Dark Mode (`0` console error/warning, đầy đủ Back/Forward/`F5`).
  - Có số liệu đo cơ sở ban đầu (>= 500 video / 200 bài RSS) làm đầu vào cho Phase 11 (`Performance & Tuning`).
- **VERIFICATION:**
  - `.\backend\.venv\Scripts\python.exe -m compileall -q backend/app backend/tests`
  - `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p "test_*.py" -v`
  - `.\backend\.venv\Scripts\python.exe -m pip check`
  - `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend run build && npm --prefix frontend audit --audit-level=high`
  - Chrome DevTools MCP full walkthrough (`list_console_messages`, `list_network_requests`, `take_snapshot`).
- **RISK:** MEDIUM
- **USER APPROVAL REQUIRED:** NO

### Checkpoint M6 — Integration & Stability (MVP V1 Complete Candidate)
- [ ] Tất cả `20` tasks hoàn tất; toàn bộ `AC-01`..`AC-18` trong `SPEC.md` có bằng chứng kiểm thử chạy thật.
- [ ] Chuyển sang **Phase 8–13** (`Test`, `Code Review`, `Security Review`, `Performance/Tuning`, `Code Simplify`, `Final Review`) trước **Phase 14 (`GATE F`)**.
