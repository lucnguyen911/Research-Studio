# BÁO CÁO CODE REVIEW PHASE 9 — RESEARCH STUDIO

**Ngày review:** 2026-11-16  
**Baseline Git trước Phase 9:** `ca2a372` (`main`)  
**Trạng thái API Key thật trên máy hiện tại:** Chưa cấu hình (`%LOCALAPPDATA%\ResearchStudio\data\research_studio.db` chưa tồn tại)  

## 1. PHASE 9 VERDICT: PASS

- **Kết luận tổng quát:** Sau khi rà soát độc lập toàn bộ mã nguồn Backend (`backend/app/**`), Frontend (`frontend/src/**`) và toàn bộ 16 tệp kiểm thử (`backend/tests/test_*.py`) của 20 tasks trên baseline `ca2a372`, hệ thống đạt trạng thái **PASS** đối với phạm vi cục bộ sau khi tái hiện, sửa triệt để nguyên nhân gốc và bổ sung kiểm thử hồi quy cho **7 phát hiện (`CR-01`..`CR-07`: `0 CRITICAL`, `3 HIGH`, `3 MEDIUM`, `1 LOW`)**.
- **Giới hạn kiểm thử thật bắt buộc giữ nguyên:** **`YouTube API live = NOT TESTED`** — máy phát triển chưa cấu hình API Key thật của người dùng và báo cáo này không tự tạo, không yêu cầu tiết lộ, không ghi khóa vào mã nguồn/log và không dùng kết quả `httpx.MockTransport` để thay cho kiểm thử live trên máy chủ Google.
- **Bảo toàn kiến trúc & giao diện đã duyệt:** Giao diện VOXLAB Light/Dark, Sidebar Global/Project, 1 dropdown Project duy nhất, điều hướng Back/Forward + khôi phục `scrollTop`, phạm vi 11/16 màn hình MVP + 5 màn hình Giai đoạn 2, schema `backend/app/db/migrations/001_initial_schema.sql` (`0` thay đổi) và danh sách dependency (`0` gói mới) được giữ nguyên vẹn.

---

## 2. TỔNG HỢP PHÁT HIỆN VÀ PHÂN LOẠI MỨC ĐỘ (`0 CRITICAL` · `3 HIGH` · `3 MEDIUM` · `1 LOW`)

| Mã phát hiện | Mức độ | Khu vực | Tóm tắt vấn đề | Trạng thái |
| :--- | :---: | :--- | :--- | :---: |
| **CR-01** | **HIGH** | Bảo mật / Logging | `httpx`/`httpcore` ghi log `INFO` chứa `?key=...` truyền qua root logger trước khi formatter của handler lọc | **Đã sửa + Test hồi quy** |
| **CR-02** | **HIGH** | RSS / SSRF / `httpx` | Lọt dải IPv6 chuyển tiếp (`6to4`, `Teredo`, `NAT64`); bám private `_pool` của `httpx`; fallback dual-stack bỏ sót `ConnectTimeout`; load PEM `certifi` chặn event loop; DNS sync trên event loop | **Đã sửa + Test hồi quy** |
| **CR-03** | **HIGH** | Scheduler / Quota / TTL | Video hết hạn đã bị xóa/ẩn upstream (`items: []`) và kênh `404 CHANNEL_NOT_FOUND_ON_YOUTUBE` không cập nhật dấu mốc nên scheduler lặp lại vô hạn mỗi 15 phút gây đốt quota; bundle `skippedInFlight` cộng nhầm 11 units; thiếu `_tick_lock`; `purge_all=True` sót xóa snapshot khi `linked_video_id IS NULL` | **Đã sửa + Test hồi quy** |
| **CR-04** | **MEDIUM** | Toàn vẹn dữ liệu | Bỏ tick `inGlobalVault` (`in_global_vault = 0`) trên Ý tưởng chưa gắn Project nào làm bản ghi mồ côi khỏi cả `G5` lẫn `P5` | **Đã sửa + Test hồi quy** |
| **CR-05** | **MEDIUM** | `G2`/`G3` & Quota | `G3` `"Tải trang kế tiếp"` tạo phiên `search_sessions` rời rạc từng trang; `G2` tích tụ bản ghi `__TREND__` trùng lặp; `publishedAfter` sai định dạng vẫn tốn `1 Search Queries` trước khi lỗi | **Đã sửa + Test hồi quy** |
| **CR-06** | **MEDIUM** | Frontend State & Toast | Chuyển Project trên cùng màn hình `P1`–`P5` giữ lại nháp/lựa chọn cục bộ; `refreshProjectWorkspace` không trả `rssOkCount`/`rssErrorCount` gây toast xanh giả khi RSS/đối thủ lỗi một phần; lỗi gọi YouTube không đồng bộ lại quota; xóa nhãn thủ công còn sót `'none'` trong `manualFormatMap` | **Đã sửa + Test hồi quy** |
| **CR-07** | **LOW** | Migration / Repo / Test | `split_sql_statements` tách theo `;` thô dễ gãy `TRIGGER` hoặc chuỗi có `;`; `keyword_repo` không báo `404` khi thiếu Project; xóa Project cần dọn tệp recovery khi TX lỗi; test còn dùng `assert` trần | **Đã sửa + Test hồi quy** |

---

## 3. CHI TIẾT CÁC LỖI ĐÃ SỬA CÙNG NGUYÊN NHÂN GỐC (`ROOT CAUSE`)

### `CR-01` (`HIGH` — Lộ API Key qua log `INFO` của `httpx` / `httpcore`)
- **Nguyên nhân gốc (`Root Cause`):** `backend/app/core/logging_setup.py` trước đây chỉ nâng mức root/app handler mà chưa siết mức log của `httpx` và `httpcore` (mặc định phát sự kiện `INFO` `HTTP Request: GET ...?key=...` trước khi chạm handler của caller hoặc pytest/uvicorn). Đồng thời khi `configure_logging()` chạy lại, các handler có sẵn trên `root`, `uvicorn` và `uvicorn.error` chưa chắc được gắn `LogRedactionFilter`.
- **Cách sửa:** Đặt `logging.getLogger("httpx").setLevel(logging.WARNING)` và `logging.getLogger("httpcore").setLevel(logging.WARNING)`, gắn `LogRedactionFilter` idempotent (`_attach_logger_filter_once`, `_attach_filter_once`) trực tiếp cho `httpx`, `httpcore` và các handler hiện có của `root`, `uvicorn`, `uvicorn.error`.
- **Tệp sửa:** `backend/app/core/logging_setup.py`.

### `CR-02` (`HIGH` — Lỗ hổng IPv6 chuyển tiếp trong RSS SSRF, phụ thuộc private `_pool` của `httpx`, dual-stack timeout & nghẽn event loop)
- **Nguyên nhân gốc (`Root Cause`):**
  1. `_ensure_ip_globally_routable` kiểm tra IPv4-mapped IPv6 nhưng bỏ qua các cơ chế chuyển tiếp IPv6-to-IPv4 (`ip.sixtofour` `2002::/16`, `ip.teredo` `2001::/32`, `NAT64` `64:ff9b::/96` nhúng IPv4 nội bộ và `64:ff9b:1::/48` local-use).
  2. `_PinnedPublicHTTPTransport` kế thừa `httpx.AsyncHTTPTransport` và thay trực tiếp thuộc tính nội bộ `self._pool`, dễ gãy khi nâng cấp `httpx`.
  3. `_SafePublicNetworkBackend.connect_tcp` chỉ bắt `(OSError, httpcore.ConnectError)` mà bỏ qua `httpcore.ConnectTimeout`, khiến host dual-stack có `AAAA` timeout ngừng kết nối thay vì fallback sang IPv4 `A` hợp lệ.
  4. Mỗi lượt lấy RSS tạo mới `ssl.create_default_context(cafile=certifi.where())` đồng bộ trên event loop và gọi đồng bộ `validate_public_feed_url()` (chứa DNS lookup) ngay trong coroutine async.
- **Cách sửa:** Kiểm tra đệ quy `sixtofour`, `teredo`, `_NAT64_WELL_KNOWN_NET` (`64:ff9b::/96`), `_NAT64_LOCAL_USE_NET` (`64:ff9b:1::/48`); viết lại `_PinnedPublicHTTPTransport` kế thừa chuẩn `httpx.AsyncBaseTransport` với `_PinnedResponseStream` và `_map_pinned_httpcore_exceptions` giữ nguyên hostname trong `httpcore.URL` để bảo toàn TLS SNI & xác thực chứng chỉ; mở rộng fallback sang `(httpcore.ConnectError, httpcore.ConnectTimeout, OSError)`; cache `_get_verified_ssl_context()` bằng `@functools.lru_cache(maxsize=1)`; đẩy `validate_public_feed_url()` qua `anyio.to_thread.run_sync(...)` trong `rss_client.py` và `rss_service.py`.
- **Tệp sửa:** `backend/app/clients/rss_client.py`, `backend/app/services/rss_service.py`.

### `CR-03` (`HIGH` — Scheduler đốt quota lặp vô hạn trên video/kênh chết, cộng nhầm in-flight & xóa snapshot TTL)
- **Nguyên nhân gốc (`Root Cause`):**
  1. Ở Priority 1 (video gắn Ý tưởng sắp hết hạn `<= 3 ngày`), khi YouTube trả `200 {"items": []}` (video đã xóa hoặc chuyển riêng tư), backend chỉ lặp trên `fetched` nên `api_expires_at` của video mất tích không đổi → mỗi tick 15 phút lại tiêu thêm quota hỏi lại cùng `video_id`. Tương tự, kênh lỗi `404` (`CHANNEL_NOT_FOUND_ON_YOUTUBE`) không cập nhật `last_refreshed_at` hoặc tách trạng thái `error` trên `project_channels`.
  2. Khi kênh đang bận (`skippedInFlight = True`), `scheduler_service` vẫn cộng cứng `+3` units cho batch đối thủ và `+1` cho `channelsRefreshed`.
  3. Thiếu `asyncio.Lock` chống 2 tick `run_auto_refresh_tick` chồng lên nhau khi kích hoạt đồng thời.
  4. `purge_all=True` trong `retention_service` mới dọn `ideas.source_title_snapshot` khi `linked_video_id IS NOT NULL`, bỏ sót Ý tưởng `youtube_video` đã mất `linked_video_id`.
- **Cách sửa:** Thêm `tombstone_unavailable_videos_in_tx` (dùng chung `_VIDEO_UNREFERENCED_GUARD_SQL` và `_VIDEO_TOMBSTONE_SET_SQL`) để tombstone `api_purged_at` mà **giữ 100% Ý tưởng, ghi chú và `manual_format`**; thêm `mark_channel_error_globally(channel_id)` để cô lập kênh 404 (đồng thời tính đúng `1` unit cho lượt kiểm tra); trả về `unitsSpent` thực tế từ `_fetch_and_persist_channel_bundle` và bỏ qua cộng quota nếu `skippedInFlight`; thêm `self._tick_lock = asyncio.Lock()` cho `LifespanScheduler`; dọn `source_title_snapshot` cho mọi Ý tưởng `youtube_video` khi `purge_all=True`.
- **Tệp sửa:** `backend/app/services/scheduler_service.py`, `backend/app/services/competitor_service.py`, `backend/app/services/retention_service.py`.

### `CR-04` (`MEDIUM` — Ý tưởng mất hiển thị khỏi cả `G5` và `P5`)
- **Nguyên nhân gốc (`Root Cause`):** `idea_repo.update_idea_core` cho phép đặt `inGlobalVault = False` ngay cả khi bảng `project_ideas` có `0` liên kết Project, khiến Ý tưởng không xuất hiện ở `G5` lẫn bất kỳ Project `P5` nào.
- **Cách sửa:** Backend `idea_repo.update_idea_core` kiểm tra đếm `project_ideas`; nếu bằng `0` và `inGlobalVault=False` thì từ chối với `400 IDEA_MUST_HAVE_LOCATION`. Frontend `IdeaCoreEditor` khóa checkbox `"Hiển thị trong Kho ý tưởng chung (G5)"` ở trạng thái `checked` + `disabled` kèm `title` giải thích khi chưa gắn Project nào.
- **Tệp sửa:** `backend/app/repositories/idea_repo.py`, `frontend/src/screens/DetailAndSystemScreens.tsx`.

### `CR-05` (`MEDIUM` — Phân trang phiên `G3`, khử trùng lặp phiên `G2` & kiểm tra `publishedAfter` trước khi gọi Search)
- **Nguyên nhân gốc (`Root Cause`):** Bấm `"Tải trang kế tiếp"` trên `G3` tạo một `search_sessions` mới chỉ chứa trang mới (khi mở lại ở `0 quota` bị mất các trang trước); mỗi lần làm mới `G2` tạo thêm hàng `__TREND__:{region}:{category}` mới tích tụ dần; tham số `publishedAfter` sai định dạng ISO-8601 vẫn vượt qua service làm tốn `1 Search Queries` rồi mới bị từ chối.
- **Cách sửa:** Bổ sung `_validate_published_after` (trả `400 INVALID_PUBLISHED_AFTER` trước khi đụng quota); hỗ trợ `append_session_id` / `appendSessionId` trên `discovery_service`, `/api/v1/global/search`, `client.ts` và `GlobalScreens.tsx` để gộp không trùng video/kênh vào cùng phiên `G3`; dọn các hàng `__TREND__` cũ trùng khóa khu vực/chuyên mục khi làm mới `G2`.
- **Tệp sửa:** `backend/app/services/discovery_service.py`, `backend/app/routers/global_research.py`, `frontend/src/api/client.ts`, `frontend/src/screens/GlobalScreens.tsx`.

### `CR-06` (`MEDIUM` — Cô lập state khi đổi Project trên `P1`–`P5`, toast làm mới Project trung thực & đồng bộ quota khi lỗi)
- **Nguyên nhân gốc (`Root Cause`):** Đổi Project trên dropdown khi đang đứng ở `P1`–`P5` giữ nguyên instance React component khiến nháp form/lựa chọn của Project cũ tồn lại sang Project mới; `POST /api/v1/projects/{id}/refresh` không trả chi tiết `rssOkCount`/`rssErrorCount` nên `ProjectOverviewScreen` báo toast thành công ngay cả khi một số nguồn RSS/đối thủ gặp lỗi; nhánh `.catch()` khi gọi YouTube thất bại chưa luôn gọi `syncQuotaStatus()` (dù thất bại sau reservation vẫn có thể tiêu/khóa quota); đặt lại nhãn thủ công về `'none'` để nguyên khóa `'none'` trong `manualFormatMap`.
- **Cách sửa:** Gắn `key={currentEntry.projectId ?? 'no-project'}` trong `App.tsx` cho `P1`, `P2`, `P3`, `P4`, `P5` (`P6` đã có `key` riêng theo `project.id`); trả thêm `rssOkCount`/`rssErrorCount` từ `projects.py` và hiển thị toast `error` trung thực khi có lỗi một phần trên `ProjectOverviewScreen`; gọi `void syncQuotaStatus()` trong `.catch()` của các màn hình/action YouTube và tải lại tiến độ từ khóa đã quét một phần; xóa khóa `'none'` khỏi `manualFormatMap` trong `registerVideosInMemory`.
- **Tệp sửa:** `backend/app/routers/projects.py`, `frontend/src/App.tsx`, `frontend/src/api/types.ts`, `frontend/src/screens/ProjectScreens.tsx`, `frontend/src/screens/GlobalScreens.tsx`, `frontend/src/state/PrototypeWorkspaceContext.tsx`.

### `CR-07` (`LOW` — Chia câu lệnh Migration bằng `sqlite3.complete_statement`, 404 thiếu Project ở Keyword, dọn tệp Recovery & chuẩn hóa assertion)
- **Nguyên nhân gốc (`Root Cause`):** `split_sql_statements` tách script SQL bằng `.split(";")` nên có thể cắt nhầm bên trong `TRIGGER ... BEGIN ... END;` hoặc chuỗi literal; `create_project_keyword` / `update_project_keyword` thiếu kiểm tra tồn tại `projects(id)` dẫn tới `IntegrityError` nếu gọi trực tiếp với ID giả; tên tệp `project_recovery_*.json` chỉ lấy độ phân giải giây và chưa xóa tệp vừa tạo nếu transaction xóa Project rollback; `test_e2e_resilience_security.py` còn 1 câu `assert` trần thay vì `self.assertEqual`.
- **Cách sửa:** Dùng `sqlite3.complete_statement` trong `migrator.py` (kèm gọi lười `ensure_runtime_dirs()` chỉ khi `backups_dir is None`); kiểm tra `PROJECT_NOT_FOUND` (`404`) trong `keyword_repo.py`; dùng timestamp microsecond `%Y%m%dT%H%M%S_%fZ` + `recovery_path.unlink(missing_ok=True)` trong `project_repo.py`; thay `assert` thành `self.assertEqual` trong `test_e2e_resilience_security.py`.
- **Tệp sửa:** `backend/app/db/migrator.py`, `backend/app/repositories/keyword_repo.py`, `backend/app/repositories/project_repo.py`, `backend/tests/test_e2e_resilience_security.py`.

---

## 4. CÁC MODULE ĐƯỢC ĐÁNH GIÁ ĐẠT YÊU CẦU (SAU REVIEW 6 KHU VỰC)

- **A. SQLite & Kết nối (`backend/app/db/connection.py`):** Cài đặt đúng chuẩn `WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`, `BEGIN IMMEDIATE` gọn nhẹ, `run_db_sync` qua `anyio.to_thread.run_sync`, tuyệt đối không giữ transaction SQLite khi chờ HTTP ngoài.
- **B. Bảo mật khóa & Localhost (`backend/app/core/security.py`, `backend/app/core/errors.py`):** Win32 DPAPI (`CryptProtectData` / `CryptUnprotectData`) kèm giải phóng bộ nhớ `LocalFree`, `verify_local_csrf_and_origin` bắt buộc header `X-Research-Studio-Client: local-web` và `Origin` loopback `127.0.0.1` / `localhost`, phản hồi lỗi JSON chuẩn `AppError` không rò stack trace hay khóa bí mật.
- **C. Dual-Bucket Quota & Tuân thủ YouTube (`backend/app/services/quota_service.py`, `backend/app/repositories/quota_repo.py`, `backend/app/services/format_classifier.py`):** Tách bạch `Search Queries` (`100/ngày`, `1 unit/lượt`, `0` retry) và `General Data API` (`10.000/ngày`, `1 unit/lượt`), reset theo nửa đêm `America/Los_Angeles` đúng DST, reserve trước khi gọi và refund có kiểm soát khi `ConnectError`/`RequestError` chưa chạm server, phân loại 3 lớp `long_form` / `shorts` / `unknown` trung thực không gộp `unknown` và không sinh Derived Metrics ngoài Standard Mode.
- **D. Điều hướng & Giao diện VOXLAB (`frontend/src/state/navigationStore.ts`, `frontend/src/state/AppNavigationProvider.tsx`, `frontend/src/styles/tokens.css`, `frontend/src/styles/app.css`):** Hàng đợi lịch sử Back/Forward đồng bộ `#hash`, `sessionStorage`, `popstate`, khôi phục filter/sort/trang/`scrollTop`, bảng màu VOXLAB Light/Dark đúng cam kết.
- **E. Độ phủ & Tính cô lập của Test (`backend/tests/test_*.py`):** Mỗi test dùng `tempfile.TemporaryDirectory()` + `RESEARCH_STUDIO_DATA_DIR` cô lập hoàn toàn DB thật theo từng ca, `0` skipped test, phân tách rạch ròi bài test mock YouTube vs bài test chạy thật SQLite/DPAPI/RSS.

---

## 5. VẤN ĐỀ CẦN REFACTOR VÀ MỨC ĐỘ ƯU TIÊN (ĐỀ XUẤT CHO PHASE 11–12)

*(Không tự viết lại trong Phase 9 để giữ nguyên phạm vi và ranh giới phase trong `AGENT_WORKFLOW.txt`.)*

| Hạng mục đề xuất | Tệp liên quan | Mức độ ưu tiên | Phase thực hiện |
| :--- | :--- | :---: | :---: |
| **Chia nhỏ các tệp màn hình quá lớn (~1.370–1.870 dòng)** thành từng tệp màn hình độc lập theo thư mục `screens/global/`, `screens/project/`, `screens/detail/` | `frontend/src/screens/ProjectScreens.tsx` (`1.866` dòng), `frontend/src/screens/GlobalScreens.tsx` (`1.710` dòng), `frontend/src/screens/DetailAndSystemScreens.tsx` (`1.370` dòng) | **MEDIUM** | **Phase 12** (`/code-simplify`) |
| **Dọn mã tương thích prototype Phase 6 không còn dùng** (`incrementQuotaDemo` no-op, `uiMode`/`setUiMode`, `apiCachePurged`, `quotaSearchUsed`/`quotaGeneralUsed` thừa, type cũ `ChannelItem`, `KeywordItem`, `RssArticleItem`, `RssTopicFrequency`) | `frontend/src/state/workspaceContext.ts` (`189` dòng), `frontend/src/state/PrototypeWorkspaceContext.tsx` (`1.083` dòng), `frontend/src/prototype/types.ts` (`219` dòng) | **MEDIUM** | **Phase 12** (`/code-simplify`) |
| **Đo chuẩn và tối ưu kích thước trang `VideoResearchTable` (`pageSize = 6` vs `SPEC.md` `50`) & RSS > 1.000 bài** dựa trên số liệu thực nghiệm | `frontend/src/components/VideoResearchTable.tsx` (`476` dòng) | **LOW** | **Phase 11** (`/webperf`) |
| **Bổ sung `id`/`name` tường minh cho toàn bộ control biểu mẫu** *(Chrome DevTools kiểm tra ghi nhận 37 form field chưa có `id`/`name`, không ảnh hưởng chức năng)* | Các component form trong `frontend/src/` | **LOW** | **Phase 12** (`/code-simplify`) |

---

## 6. BẰNG CHỨNG KIỂM THỬ MỚI & HỒI QUY (SAU TẤT CẢ CÁC BƯỚC SỬA LỖI)

### A. Bộ test hồi quy mới: `backend/tests/test_phase9_code_review_regressions.py` (`7` test)
1. `test_cr01_httpx_info_logger_never_leaks_api_key_to_root_handlers` — xác nhận `httpx`/`httpcore` giữ mức `WARNING` và vẫn redact bí mật kể cả khi logger bên ngoài bật lại `INFO`.
2. `test_cr02_rss_ipv6_transition_ssrf_dual_stack_timeout_fallback_and_pinned_transport` — xác nhận chặn `6to4`/`NAT64`, giữ IPv6 công khai hợp lệ, kế thừa `AsyncBaseTransport`, và fallback từ IPv6 `ConnectTimeout` sang IPv4 công khai.
3. `test_cr03_scheduler_isolates_deleted_channels_and_tombstones_missing_expiring_videos` — xác nhận tombstone video hết hạn đã mất upstream (giữ Ý tưởng, ghi chú, `manualFormat`), không cộng quota `skippedInFlight`, cô lập kênh `404`, và tick kế tiếp tiêu `0` quota trên nguồn chết.
4. `test_cr04_unlinked_idea_cannot_be_hidden_from_global_vault` — xác nhận API trả `400 IDEA_MUST_HAVE_LOCATION` nếu chưa gắn Project nào và cho phép bỏ `inGlobalVault` khi đã gắn Project.
5. `test_cr05_free_search_append_session_pagination_and_published_after_validation` — xác nhận `INVALID_PUBLISHED_AFTER` tốn `0` quota, và `"Tải trang kế tiếp"` gộp vào cùng `search_sessions` theo `appendSessionId`.
6. `test_cr06_project_refresh_reports_rss_ok_and_error_counts_accurately` — xác nhận `POST /api/v1/projects/{id}/refresh` trả chính xác `rssRefreshedCount = 2`, `rssOkCount = 1`, `rssErrorCount = 1`.
7. `test_cr07_migrator_trigger_semicolon_and_keyword_missing_project_404` — xác nhận `split_sql_statements` tách chuẩn khối `CREATE TRIGGER ... BEGIN ... END;` chứa `;` và `keyword_repo` trả `404 PROJECT_NOT_FOUND` khi thiếu Project.

### B. Kết quả toàn bộ cổng chất lượng (`CONSTRAINTS.md`)
- `compileall -q backend/app backend/tests`: **PASS (`exit code 0`)**
- `python -W default -m unittest discover -s backend/tests -p "test_*.py" -v`: **`51/51` tests PASS trong `4.217s`** (`0` skipped, `0` slow-callback warnings)
- `pip check`: **`No broken requirements found.`**
- `npm --prefix frontend run typecheck`: **PASS (`0` lỗi)**
- `npm --prefix frontend run lint`: **PASS (`0` warnings, `0` errors trên 22 tệp)**
- `npm --prefix frontend run build`: **PASS (`built in 115ms`)**
- `npm --prefix frontend audit --audit-level=high`: **PASS (`found 0 vulnerabilities`)**
- **Chrome DevTools MCP Smoke Check (trên server Backend + Vite cô lập tạm `127.0.0.1`):**
  - Kiểm chứng `G1` ở trạng thái `0 Project`, tạo `Project Alpha P9` & `Project Beta P9`, thêm từ khóa & giữ checkbox/nháp trên `Beta P4` → đổi dropdown sang `Alpha` xác nhận cô lập state sạch (`0` từ khóa, ô nhập rỗng) (`CR-06`).
  - Tạo `"Idea Unlinked P9"` trong `G5` (không gắn Project) → mở `Chi tiết` xác nhận checkbox `"Hiển thị trong Kho ý tưởng chung (G5)"` ở trạng thái `checked` & `disabled` (`CR-04`).
  - Bật/tắt mượt Light Mode ↔ Dark Mode VOXLAB và nút TopBar `Back` ↔ `Forward` (`G5` ↔ `IdeaDetail`).
  - `list_console_messages`: **`0` console `error`, `0` console `warn`**.

---

## 7. RỦI RO CÒN LẠI & BƯỚC TIẾP THEO

1. **`YouTube API live = NOT TESTED` (`MEDIUM`):** Chưa có API Key thật nên toàn bộ gọi tới `googleapis.com/youtube/v3/*` hiện mới xác minh qua `httpx.MockTransport`. Nếu người dùng cấu hình API Key thật ngay trong giao diện cục bộ, có thể chạy một **live smoke test tối thiểu (tổng cộng `2` units `General Data` + `1` unit `Search Queries`)**:
   - Nạp `G2` `Xu hướng` (`1` unit `videos.list(mostPopular)`).
   - Thực hiện 1 truy vấn ngắn trên `G3` (`1` unit `Search Queries` + `1` unit `videos.list`), kiểm tra log không lộ `key=...` và quota trừ đúng bucket.
2. **Định danh refactor kỹ thuật ở Frontend (`MEDIUM` — Phase 12):** Chia nhỏ `GlobalScreens.tsx`, `ProjectScreens.tsx`, `DetailAndSystemScreens.tsx` và dọn trường prototype thừa sau khi qua Phase 10–11.
3. **Bước tiếp theo theo `AGENT_WORKFLOW.txt`:** **PHASE 10 — SECURITY REVIEW** (chỉ bắt đầu khi có xác nhận của người dùng).
