# CONSTRAINTS — Research Studio

- **Project:** Research Studio
- **Phase Established:** Phase 0 — Project Constraints
- **Last Reviewed:** 2026-11-16
- **Governing Workflow:** `AGENT_WORKFLOW.txt` + `CONSTRAINTS.md`

> **Rule of Authority:** Mọi agent và phiên làm việc phải đọc `AGENT_WORKFLOW.txt` và `CONSTRAINTS.md` trước khi thiết kế hoặc viết mã. Không được nới lỏng ngưỡng kiểm tra, xóa quy tắc hoặc tắt cảnh báo trong file này chỉ để làm bản build/test vượt qua.

---

## 1. Floor Rules — Ngưỡng Sàn Bất Biến (Always Enforced)

Áp dụng cho **mọi lần chỉnh sửa** mà không cần cài thêm công cụ:

1. **Không thêm comment tắt kiểm tra (No Silenced Checkers):** Cấm thêm `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`, `oxlint-disable`, `# noqa`, `# type: ignore` nếu không có mục ngoại lệ hợp lệ trong bảng `Exceptions`.
2. **Không để mã dở dang trong nhánh hoàn thành (No Unimplemented Stubs):** Cấm để lại `NotImplementedError`, `throw new Error("Not implemented")`, `TODO` thay cho logic bắt buộc, hoặc khối bắt lỗi rỗng (`catch {}`, `except Exception: pass`).
3. **Không làm yếu kiểm thử (No Weakened Tests):** Cấm thêm `.skip`/`.todo`/`@unittest.skip`, xóa file test hoặc rút bỏ `assert`/`expect` chỉ để test xanh.
4. **Không lộ bí mật & đường dẫn máy cá nhân (No Secrets or Machine Paths):** Cấm hard-code API key, token, mật khẩu hoặc đường dẫn tuyệt đối của máy phát triển (`f:\...`, `C:\Users\...`) trong mã nguồn, bundle frontend, test hoặc log.
5. **Bảo toàn thanh chất lượng (Immutable Bar During Feature Work):** Cấm hạ thấp ngưỡng số liệu hoặc xóa quy tắc trong `CONSTRAINTS.md` cùng lúc với thay đổi tính năng đang bị lỗi kiểm tra.

---

## 2. Enforced Quality Gates — Cổng Chất Lượng Chạy Ngay Hôm Nay

Mọi dòng dưới đây đều gắn với công cụ đã có sẵn trong bộ khung dự án và bắt buộc trả về kết quả đạt (`exit code 0`):

| Hạng mục (Dimension) | Quy tắc & Ngưỡng (Rule) | Lệnh kiểm tra thực thi (Checked By) | Thời điểm chạy (Runs At) |
|---|---|---|---|
| **Frontend Types** | `0` lỗi kiểu TypeScript | `npm --prefix frontend run typecheck` | Mỗi lần sửa mã frontend (`< 5s`) |
| **Frontend Lint** | `0` error và `0` warning | `npm --prefix frontend run lint` | Mỗi lần sửa mã frontend (`< 2s`) |
| **Frontend Build** | Build production thành công (`dist/` sạch) | `npm --prefix frontend run build` | Cuối mỗi task frontend / trước review |
| **Frontend Deps Security** *(External)* | `0` lỗ hổng mức `high` hoặc `critical` | `npm --prefix frontend audit --audit-level=high` | Khi thêm/cập nhật gói npm, Phase 9–10 |
| **Backend Bytecode / Syntax** | Biên dịch sạch toàn bộ `app` và `tests` | `.\backend\.venv\Scripts\python.exe -m compileall -q backend/app backend/tests` | Mỗi lần sửa mã backend (`< 2s`) |
| **Backend Automated Tests** | `100%` test pass, `0` skipped | `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p "test_*.py" -v` | Cuối mỗi task backend (`< 10s`) |
| **Backend Deps Integrity** | `0` xung đột hoặc thiếu dependency | `.\backend\.venv\Scripts\python.exe -m pip check` | Khi thêm/cập nhật gói pip, Phase 9–10 |
| **Browser Runtime Cleanliness** *(External)* | `0` console error, `0` console warning, `/api/*` đúng mã HTTP | Chrome DevTools MCP (`list_console_messages`, `list_network_requests`, `take_snapshot`) | Khi thay đổi UI, routing hoặc kết nối API |

---

## 3. Measured Baselines & Phase-Gated Targets

### 3.1. Chỉ số cơ sở đã đo (Baseline ngày 2026-11-15)

| Chỉ số (Metric) | Giá trị hiện tại (Today) | Nguyên tắc kiểm soát (Direction) |
|---|---|---|
| Frontend JS bundle (`dist/assets/*.js`) | `221.17 kB` (`69.25 kB` gzip) | Không tăng đột biến nếu không có tính năng/thư viện đã duyệt |
| Frontend CSS bundle (`dist/assets/*.css`) | `0.72 kB` (`0.42 kB` gzip) | Giữ gọn nhẹ, ưu tiên CSS biến chuẩn (custom properties) |
| Backend unit tests | `2` tests pass (`~0.01s`) | Số lượng và độ phủ chỉ tăng, không giảm |
| Dependency vulnerabilities (`high+`) | `0` | Phải giữ ở mức `0` |

### 3.2. Ngưỡng kích hoạt theo Phase tiếp theo

- **Phase 6 (UI/UX Gate — Gate D):** Độ tương phản chữ đạt tối thiểu **WCAG 2.1 AA (`>= 4.5:1` cho văn bản thường, `>= 3:1` cho văn bản lớn/thành phần UI)** ở cả Light Mode và Dark Mode; đầy đủ trạng thái `loading`, `empty`, `error`, `disabled`, `cancel/retry`.
- **Phase 7–8 (Build & Test):**
  - Mọi module nghiệp vụ, repository SQLite, bộ lọc/tính điểm Python và endpoint API mới phải có test tự động kèm theo (mục tiêu bao phủ dòng mã thay đổi ở tầng domain/service/repository `>= 80%` — lý do: đủ cao để bắt buộc test cả nhánh lỗi, đủ thực tế để không ép test boilerplate cấu hình).
  - Bắt buộc có **integration test kiểm chứng cô lập `project_id`** (Project A không đọc/sửa/xóa nhầm dữ liệu Project B và không làm bẩn Global Research).
  - Bắt buộc có **migration & backup test** trên database tạm trước khi duyệt thay đổi schema.
- **Phase 11 (Performance & Tuning):** Đo thực tế trước khi tối ưu (`MEASURE FIRST`). Mọi tham số phụ thuộc tải phải gắn nhãn `TUNING REQUIRED` cho tới khi có benchmark thực nghiệm.

---

## 4. Platform, Stack & Runtime Constraints

- **Hệ điều hành mục tiêu:** Windows 11 (`64-bit / x64`), ứng dụng chạy **local-first** cho người dùng đơn lẻ trên máy cá nhân.
- **Stack cố định (không thay đổi nếu chưa qua `GATE E`):**
  - **Frontend:** `React 19` + `TypeScript` + `Vite 8`, quản lý gói duy nhất bằng `npm` (`frontend/package-lock.json`). Không dùng song song `pnpm` hoặc `yarn`.
  - **Backend:** `Python 3.11.x` (`64-bit`) + `FastAPI` + `Uvicorn`, cô lập trong `backend/.venv`, quản lý gói bằng `pip` (`backend/requirements.txt`).
  - **Database:** `SQLite 3` sử dụng thư viện chuẩn `sqlite3` của Python (ưu tiên truy vấn SQL tường minh qua lớp repository mỏng, tránh ORM nặng nề nếu không thực sự cần thiết).
  - **Desktop Packaging (giai đoạn sau):** `Tauri` chỉ triển khai sau khi bản chạy local đã ổn định, vượt qua kiểm thử và được người dùng phê duyệt. Không cài hoặc cấu hình Tauri/Rust vào dự án trước thời điểm đó.
- **Giới hạn cổng lắng nghe (Loopback-Only Binding):** Backend (`127.0.0.1:8000` mặc định) và Frontend dev/preview server chỉ được bind vào `127.0.0.1` (`localhost`). **Cấm** mặc định bind `0.0.0.0` để tránh phơi lộ API cục bộ ra mạng LAN/Wi-Fi.

---

## 5. Product Scope & Domain Isolation Constraints

- **Hai phân khu độc lập bắt buộc:**
  1. **Global Research (`scope = global`):** Tổng quan, Khám phá xu hướng, Nghiên cứu tự do, Video nổi bật, Tin tức & thảo luận, Kho ý tưởng chung. Phải hoạt động đầy đủ ngay cả khi chưa tạo Project nào.
  2. **Project Research (`scope = project`):** Tổng quan dự án, Chủ đề nóng, Nghiên cứu từ khóa, Video bứt phá, Theo dõi đối thủ, Chủ đề dài hạn, Cơ hội nội dung, Nghiên cứu AI, Quản lý ý tưởng, Cài đặt dự án.
- **Cơ chế chọn Project duy nhất:** Toàn ứng dụng chỉ dùng **một dropdown duy nhất** để chọn Project đang hoạt động hoặc tạo Project mới; toàn bộ 10 màn hình Project Research dùng chung bộ chức năng và tự động áp dụng theo `project_id` đang chọn.
- **Phân tách dữ liệu dùng chung và cô lập dữ liệu riêng của Project:**
  - **Thực thể dùng chung / toàn cục (KHÔNG bắt buộc `project_id`):** Các dữ liệu gốc dùng chung như metadata video, kênh YouTube, bài báo/tin tức RSS, nguồn tin chung, chủ đề toàn cục và ý tưởng trong Kho ý tưởng chung được lưu **một bản chuẩn duy nhất** (chuẩn hóa theo khóa định danh tự nhiên), không bắt buộc thuộc một Project (`project_id` không bắt buộc hoặc không đặt trên bảng thực thể gốc).
  - **Liên kết nhiều-nhiều với Project (Không lưu trùng dữ liệu gốc):** Một video, kênh, bài báo hoặc chủ đề có thể được liên kết với nhiều Project thông qua các bảng liên kết trung gian (ví dụ `project_videos`, `project_channels`, `project_topics`... gồm `project_id NOT NULL` + khóa ngoại tới bản ghi gốc kèm `UNIQUE(project_id, <entity_id>)`), cho phép mỗi Project lưu trạng thái, ghi chú hoặc đánh giá riêng mà không nhân bản dữ liệu gốc.
  - **Dữ liệu thuộc riêng một Project (`project_id NOT NULL` bắt buộc):** Quy định `project_id NOT NULL` tham chiếu khóa ngoại tới `projects(id)` chỉ bắt buộc đối với những dữ liệu thuộc riêng một Project (cấu hình Project, từ khóa riêng, ý tưởng/ghi chú riêng của Project, phiên phân tích AI theo Project và các bảng liên kết `project_*` nêu trên).
  - Mọi API thuộc Project Research phải truyền tường minh `project_id` trên đường dẫn (ví dụ `/api/v1/projects/{project_id}/...`), **không** lưu "Project đang chọn" như biến toàn cục ngầm trên backend để tránh ghi đè chéo khi đổi Project nhanh hoặc điều hướng Back/Forward.
  - Khi người dùng chuyển Project trên Frontend, các request đang chờ của Project cũ phải bị hủy (`AbortController`) hoặc bỏ qua kết quả cũ bằng khóa cache gắn `project_id`.
- **Giới hạn nền tảng V1 (YAGNI):**
  - V1 **chỉ triển khai nghiên cứu YouTube** (kèm nguồn RSS/tin tức hợp lệ phục vụ mục Tin tức & thảo luận).
  - **Không** triển khai Facebook, TikTok, X ở V1.
  - **Không** xây dựng plugin engine đa nền tảng trừu tượng hoặc schema đa hình phức tạp phục vụ trước cho tương lai chưa được duyệt (chỉ giữ trường định danh đơn giản như `platform = 'youtube'` ở nơi tự nhiên).

---

## 6. Architecture & Frontend / Backend Boundary

- **Kiến trúc tổng thể:** Modular Monolith chạy local gồm 2 tiến trình rõ ranh giới (`frontend` SPA + `backend` FastAPI) giao tiếp qua HTTP JSON cục bộ (`/api/v1/...`, giữ `/api/health` cho kiểm tra hạ tầng). Không dùng microservices, Docker, Redis, Celery hay GraphQL.
- **Trách nhiệm của Frontend (`frontend/`):**
  - Hiển thị giao diện, quản lý điều hướng Back/Forward kiểu trình duyệt, lưu và khôi phục trạng thái màn hình (bộ lọc, cột/chiều sắp xếp, vị trí danh sách/cuộn) theo lịch sử điều hướng.
  - Kiểm tra dữ liệu nhập mức giao diện, hiển thị rõ trạng thái đang tải / trống / lỗi / hủy / thử lại.
  - **Cấm gọi trực tiếp dịch vụ ngoài từ Frontend:** Frontend không được gọi thẳng YouTube Data API, nguồn RSS, LM Studio/Ollama hay Cloud AI từ trình duyệt. Mọi kết nối ra ngoài phải đi qua Backend.
- **Trách nhiệm của Backend (`backend/`):**
  - Nguồn sự thật duy nhất (Single Source of Truth) cho dữ liệu SQLite, migration, sao lưu, quản lý khóa API, kiểm soát hạn mức (quota), thu thập dữ liệu Internet, khử trùng lặp, tính toán chỉ số bằng Python, tích hợp AI tùy chọn và tác vụ nền.
  - Chuẩn hóa phản hồi lỗi JSON an toàn (`{"error": {"code": "...", "message": "...", "details": ...}}`), không trả raw Python stack trace ra HTTP response.

---

## 7. Database, Storage & File-System Policy

- **Thư mục dữ liệu tách khỏi mã nguồn:**
  - Dữ liệu người dùng khi vận hành mặc định đặt tại `%LOCALAPPDATA%\ResearchStudio\` (cho phép ghi đè qua biến môi trường `RESEARCH_STUDIO_DATA_DIR` để môi trường dev và automated test dùng thư mục cô lập hoàn toàn):
    - `data/research_studio.db` — cơ sở dữ liệu SQLite chính.
    - `backups/` — bản sao lưu tự động trước migration và bản sao lưu theo yêu cầu.
    - `logs/` — file log xoay vòng.
    - `config/` — cấu hình cục bộ của người dùng.
  - Không lưu database nghiệp vụ, file backup hay log vào thư mục Git hoặc `Program Files`.
- **An toàn dữ liệu & chống hỏng file SQLite (Crash Safety):**
  - Thiết lập bắt buộc cho mọi kết nối SQLite:
    - `PRAGMA journal_mode = WAL;`
    - `PRAGMA synchronous = NORMAL;`
    - `PRAGMA foreign_keys = ON;`
    - `PRAGMA busy_timeout = 5000;` *(TUNING REQUIRED khi chạy tải thực tế)*
  - Giao dịch ghi (write transaction) phải ngắn gọn; **cấm** giữ transaction mở trong lúc chờ gọi mạng (YouTube/RSS) hoặc chờ phản hồi AI.
- **Nguyên tắc Migration & Sao lưu an toàn:**
  - Quản lý phiên bản schema bằng bảng `schema_migrations` và các script SQL đánh số tăng dần, chạy theo chiều tiến (forward-only) trong transaction.
  - **Sao lưu bắt buộc trước khi nâng cấp schema:** Nếu `research_studio.db` đã tồn tại và có migration mới, ứng dụng bắt buộc tạo bản sao lưu nhất quán bằng SQLite Online Backup API (`sqlite3.Connection.backup()`) vào `backups/` trước khi chạy migration. Nếu migration lỗi, phải rollback ngay và giữ nguyên bản sao lưu để khôi phục.
  - Mọi migration mang tính phá hủy (xóa bảng/cột chứa dữ liệu người dùng) thuộc nhóm **HIGH RISK (`GATE E`)** và phải có sự chấp thuận của người dùng trước khi thực hiện.
- **Phân tách dữ liệu người dùng tự tạo và dữ liệu YouTube API (`API Data`):**
  - **Dữ liệu do người dùng tự tạo (User-Created Data — Giữ vĩnh viễn local):** Project, Ý tưởng, Ghi chú, góc khai thác, Từ khóa tự nhập, danh sách ID/tham chiếu nguồn theo dõi, nhãn/đánh giá cá nhân và Cấu hình thuộc quyền sở hữu của người dùng — **không bao giờ tự ý xóa**. Thao tác xóa của người dùng trên giao diện phải có bước xác nhận rõ ràng.
  - **Dữ liệu YouTube API (`API Data` — Tuân thủ bắt buộc quy tắc 30 ngày lịch):** Metadata và thống kê lấy từ YouTube Data API (đặc biệt là `Non-Authorized Data` của kênh/video công khai truy cập bằng API Key) chỉ được lưu đệm tạm thời tối đa **30 ngày lịch (`30 calendar days`)** theo [YouTube API Services Developer Policies (Mục III.E.4)](https://developers.google.com/youtube/terms/developer-policies). Khi chạm hạn 30 ngày lịch, ứng dụng bắt buộc phải **làm mới (`refresh`)** từ API hoặc **xóa phần `API Data` hết hạn** (và xóa trong vòng **7 ngày lịch** khi người dùng yêu cầu xóa dữ liệu liên quan), nhưng cấu trúc bảng phải tách rời để việc làm mới/xóa `API Data` **không bao giờ làm mất Ý tưởng, từ khóa hay ghi chú riêng do người dùng tự tạo**.
  - **Dữ liệu đệm kỹ thuật khác:** Raw RSS feed cache quá hạn và file log xoay vòng cũ được dọn dẹp theo giới hạn lưu trữ đã cấu hình.

---

## 8. Configuration, Secrets, Security & Privacy Baseline

- **Bảo vệ khóa bí mật (API Keys & Credentials):**
  - Không lưu API key (YouTube Data API, Cloud AI tùy chọn) trong source code, biến `VITE_*` của frontend, hoặc file cấu hình plaintext trong repo.
  - Khi lưu API key trên máy Windows, phải mã hóa lúc nghỉ (at-rest) gắn với tài khoản Windows hiện tại thông qua **Windows DPAPI** (`CryptProtectData` / `CryptUnprotectData` qua `ctypes` chuẩn của Python) hoặc cơ chế tương đương của Windows; khi trả trạng thái cấu hình về Frontend chỉ trả dạng đã che (`masked`, ví dụ `AIza...9x2A`), không trả lại toàn bộ khóa gốc qua endpoint đọc thông thường.
  - Các bản xuất dữ liệu dự án (export) mặc định **không** kèm theo API key bí mật.
- **Quyền riêng tư & Local-First (Zero Telemetry):**
  - **0% Telemetry / Analytics / Tracking:** Không tích hợp bất kỳ SDK theo dõi hành vi, thu thập lỗi đám mây hay gửi dữ liệu ngầm nào.
  - **Không tải dữ liệu nghiên cứu lên cloud:** Dữ liệu dự án, từ khóa, ý tưởng và ghi chú nằm hoàn toàn trên máy người dùng (trừ phần văn bản cụ thể được người dùng chủ động gửi tới Cloud AI nếu chính người dùng bật tính năng tùy chọn đó).
- **Xử lý dữ liệu ngoài không tin cậy (Untrusted External Content):**
  - Tiêu đề, mô tả, bình luận YouTube và nội dung RSS là dữ liệu không tin cậy: phải lọc bỏ mã thực thi, hiển thị dạng văn bản an toàn trên React (cấm dùng `dangerouslySetInnerHTML` với dữ liệu ngoài chưa qua kiểm duyệt), chỉ cho phép mở liên kết ngoài có giao thức `https://` hoặc `http://`, và chuẩn hóa đường dẫn (`Path.resolve()`) khi nhập/xuất file để chống Path Traversal.

---

## 9. Internet / External Data Integration Policy

- **Nguồn dữ liệu hợp lệ cho V1:**
  1. **YouTube Data API v3 chính thức** sử dụng API key của người dùng, tuân thủ cơ chế phân bổ hạn mức mặc định theo [Quota Calculator chính thức](https://developers.google.com/youtube/data/determine_quota_cost) (đặt lại vào nửa đêm giờ Thái Bình Dương — `midnight PT`):
     - **Bucket `Search Queries` riêng cho `search.list`:** Hạn mức mặc định **100 lượt gọi/ngày**, chi phí **1 unit/lượt** (mỗi trang kết quả kế tiếp qua `pageToken` và cả lệnh gọi không hợp lệ đều tính phí hạn mức).
     - **Bucket mặc định chung cho các endpoint đọc khác (`videos.list`, `channels.list`, `playlistItems.list`, `videoCategories.list`, `i18nRegions.list`, `i18nLanguages.list`, ...):** Hạn mức mặc định **10.000 units/ngày**, chi phí **1 unit/lượt**. *(Bucket `videos.insert` 100 lượt/ngày riêng không sử dụng trong Research Studio V1).*
  2. **RSS / Atom feeds công khai hợp lệ** (bao gồm các nguồn tin tức/thảo luận cho phép đọc feed và RSS công khai hợp lệ) cùng các nguồn miễn phí hợp lệ được phê duyệt trong `SPEC.md`.
- **Nguyên tắc trung thực dữ liệu, phân loại định dạng & tuân thủ chính sách YouTube:**
  - **Cấm mặc định dùng scraping trái điều khoản** dịch vụ của YouTube (`Developer Policies III.E.5`) hoặc nền tảng bên ngoài.
  - **Cấm bịa đặt hoặc giả lập số liệu:** Không hiển thị các con số không có thật (như "YouTube Search Volume tuyệt đối chính xác" hay doanh thu ẩn khi nguồn API không cung cấp).
  - **Tuân thủ chính sách `Derived Metrics`, `Data Aggregation` & `Branding` của YouTube** ([Developer Policies III.E.2, III.E.4.h, III.F.2](https://developers.google.com/youtube/terms/developer-policies) và [Derived Metrics Policy](https://developers.google.com/youtube/terms/derived-metrics-policy)):
    - Không mặc định rằng phép tính chạy local bằng Python thì tự động được phép tạo chỉ số dẫn xuất từ `YouTube API Data`.
    - Ở chế độ API Key tiêu chuẩn chưa có phê duyệt *Analytics & Reporting / Derived Metrics Amendment* từ YouTube: **cấm** thay thế số liệu gốc của YouTube API, **cấm** dùng `API Data` để tự tính/hiển thị chỉ số dẫn xuất mới (`Outlier Multiplier`, `Views/ngày`, `Engagement Rate`, `Median` hiệu suất kênh, điểm tổng hợp từ `API Data`) và **cấm** gộp thống kê `API Data` chéo nhiều kênh độc lập không cùng chủ sở hữu (`Content Owner`). Chỉ hiển thị nguyên bản các số liệu chính thức từ YouTube API (kèm lọc/sắp xếp trực tiếp trên trường gốc và nhận diện nguồn YouTube đúng quy chuẩn), đồng thời công bố rõ ràng mọi dữ liệu ngoài YouTube (RSS, ghi chú/nhãn/đánh dấu của người dùng) không phải dữ liệu từ YouTube.
    - Các chỉ số dẫn xuất từ `API Data` và việc lưu trữ dữ liệu thống kê công khai dài hạn (`> 30 ngày`, tối đa `36 tháng lịch`) thuộc nhóm **tính năng phụ thuộc phê duyệt chính sách YouTube** (*API Compliance Audit — Analytics & Reporting*); khi đủ điều kiện kích hoạt phải gắn nhãn nổi bật là chỉ số phân tích độc lập của Research Studio, không phải số liệu chính thức của YouTube.
  - **Phân loại trung thực `Video dài` / `Shorts` / `Chưa xác định`** ([YouTube Help — Three-minute Shorts](https://support.google.com/youtube/answer/15424877)):
    - **Cấm** sử dụng quy tắc mặc định `Shorts <= 60 giây` hoặc kết luận chắc chắn định dạng chỉ dựa trên thời lượng đối với video `<= 180 giây` (YouTube hỗ trợ Shorts tối đa `3 phút` theo điều kiện ngày đăng và tỷ lệ khung hình vuông/dọc `<= 1:1`, trong khi YouTube Data API v3 không cung cấp thuộc tính xác nhận Shorts cho mọi video).
    - Bắt buộc phân biệt rõ định dạng xác định được (`Video dài`, `Shorts`) và `Chưa xác định` (`unknown`).
    - Những video `Chưa xác định` **không được** tự động đưa vào nhóm thống kê của `Video dài` hoặc `Shorts`; nếu hiển thị quy tắc suy đoán phụ trợ thì phải ghi rõ mức độ tin cậy và nguồn căn cứ.
- **6 cơ chế kiểm soát bắt buộc khi lấy dữ liệu Internet:**
  1. **Kiểm soát hạn mức API 2 Bucket (Dual-Bucket Quota Ledger):** Theo dõi tách biệt hạn mức ngày cho **(a) Bucket `Search Queries`** (`search.list`: mặc định `100 lượt/ngày`, `1 unit/lượt` — chỉ gọi khi người dùng chủ động kích hoạt, cấm chạy ngầm tự động) và **(b) Bucket `General Data API`** (`videos.list`, `channels.list`, `playlistItems.list`...: mặc định `10.000 units/ngày`, `1 unit/lượt`, ưu tiên gộp lô tối đa 50 ID mỗi lượt); cảnh báo sớm và chặn gọi tự động khi bất kỳ bucket nào chạm ngưỡng an toàn do người dùng cấu hình (`TUNING REQUIRED`, mặc định cảnh báo ở `80%` mỗi bucket).
  2. **Kiểm soát tần suất cập nhật (Refresh Cadence):** Mặc định ưu tiên người dùng chủ động làm mới hoặc lịch cập nhật định kỳ thưa cho kênh theo dõi & RSS, có khoảng cách tối thiểu giữa hai lần làm mới cùng một nguồn (`TUNING REQUIRED`).
  3. **Chịu lỗi mất mạng (Offline & Network Fault Resilience):** Mọi request ra ngoài phải có timeout tường minh (`TUNING REQUIRED`, mặc định đề xuất `10s` kết nối / `20s` đọc), chỉ retry có giới hạn với lỗi tạm thời (`429`, `502`, `503`, `504`, timeout) kèm backoff; khi mất Internet, toàn bộ dữ liệu người dùng và dữ liệu đệm còn trong hạn hợp lệ vẫn xem, lọc, sắp xếp và quản lý ý tưởng bình thường.
  4. **Cô lập nguồn lỗi (Dead-Source Isolation):** Một RSS feed hoặc kênh bị lỗi/ngừng hoạt động chỉ được đánh dấu trạng thái lỗi riêng cho nguồn đó (kèm thông báo rõ lý do và thời điểm lỗi cuối), không được làm gãy tiến trình cập nhật của các nguồn khác.
  5. **Khử trùng lặp dữ liệu (Deduplication):** Chuẩn hóa khóa định danh tự nhiên (`video_id`, `channel_id`, URL/GUID chuẩn hóa của bài tin) kết hợp ràng buộc `UNIQUE` và thao tác `UPSERT` idempotent.
  6. **Giới hạn thời gian lưu trữ & làm mới 30 ngày (Retention & 30-Day Refresh Control):** Áp dụng cứng giới hạn **tối đa `30 ngày lịch` (`30 calendar days`)** cho mọi `YouTube API Data` chưa có quyền mở rộng (và luôn áp dụng hạn `30 ngày lịch` cho metadata phi thống kê như tiêu đề, tên kênh, mô tả, văn bản bình luận ngay cả khi đã được duyệt mở rộng thống kê): đến hạn phải làm mới từ API hoặc xóa phần `API Data` quá hạn; không tích lũy snapshot lịch sử `Non-Authorized Data` quá 30 ngày nếu chưa được phê duyệt *Derived Metrics & Data Storage Amendment* (tối đa `36 tháng lịch` cho dữ liệu thống kê/chỉ số dẫn xuất được duyệt); tách biệt hoàn toàn với dữ liệu do người dùng tự tạo (giữ vĩnh viễn) và bộ đệm RSS (`TUNING REQUIRED`).

---

## 10. AI & Cost Policy

- **Hoạt động độc lập không cần AI:** Toàn bộ luồng cốt lõi của Research Studio (thu thập dữ liệu hợp lệ, khám phá, lọc, sắp xếp, theo dõi đối thủ, sàng lọc cơ hội nội dung trong phạm vi chính sách API cho phép, quản lý Project và Ý tưởng) **bắt buộc chạy đầy đủ khi không bật bất kỳ mô hình AI nào**.
- **Thứ tự ưu tiên xử lý 3 tầng:**
  1. **Tầng 1 — Thuật toán Python tất định (Mặc định):** Lọc, sắp xếp trên trường gốc, khử trùng lặp, phân loại trạng thái định dạng, phân tích từ khóa/tần suất trên nguồn RSS & ghi chú người dùng, và (chỉ khi có phê duyệt chính sách YouTube tương ứng ở Mục 9) tính toán các chỉ số phân tích dẫn xuất trên `YouTube API Data`.
  2. **Tầng 2 — AI Local miễn phí (LM Studio hoặc Ollama):** Kết nối qua giao thức HTTP cục bộ tương thích OpenAI (`127.0.0.1`) cho các tác vụ đọc hiểu/tóm tắt/gợi ý góc tiếp cận nội dung khi người dùng bật và chạy model trên máy. Phải kiểm tra kết nối nhanh và báo trạng thái rõ ràng nếu LM Studio/Ollama chưa bật, không làm treo giao diện.
  3. **Tầng 3 — Cloud AI (Tùy chọn nâng cấp, mặc định TẮT):** Chỉ hoạt động khi người dùng chủ động bật trong cài đặt, tự nhập API key và kích hoạt thao tác phân tích.
- **Kiểm soát chi phí bằng 0 mặc định (0 USD Default Cost):**
  - Cấm tự ý tích hợp API AI trả phí, dịch vụ dữ liệu trả phí, hạ tầng cloud trả phí, dịch vụ thu phí định kỳ hoặc **AI Agent chạy vòng lặp tự chủ tiêu tốn token/quota ngầm**.
  - Mọi tích hợp mới có khả năng phát sinh chi phí đều thuộc nhóm **HIGH RISK (`GATE E`)** và phải được người dùng phê duyệt trước.

---

## 11. Background Jobs, Logging & Error Handling Policy

- **Quy trình chạy nền (Background Jobs):**
  - Chạy gọn trong tiến trình FastAPI thông qua vòng đời `lifespan` và `asyncio` (kết hợp worker thread cho tác vụ đồng bộ ngắn nếu cần); **không** tạo Windows Service chạy ngầm sau khi đóng ứng dụng và **không** dùng hàng đợi ngoài nặng nề.
  - Mọi tác vụ thu thập/phân tích nền phải có trạng thái quan sát được (`idle`, `running`, `succeeded`, `failed`, `cancelled`), có khóa chống chạy chồng chéo cùng một nguồn/Project, có khả năng hủy (`cancel`) và dừng sạch khi tắt ứng dụng.
- **Chính sách Logging:**
  - Dùng module `logging` chuẩn của Python với định dạng có cấu trúc (thời gian, cấp độ, module, mã sự kiện), ghi file xoay vòng (`RotatingFileHandler`, giới hạn dung lượng an toàn ví dụ `5 MB x 3 files` tại `%LOCALAPPDATA%\ResearchStudio\logs\`).
  - **Che giấu thông tin nhạy cảm bắt buộc (Log Redaction):** Bộ lọc log bắt buộc che toàn bộ tham số `key=...` trên URL gọi YouTube Data API, header `Authorization`, token và nội dung bí mật trước khi ghi ra console hoặc file.
- **Xử lý lỗi (Error Handling):**
  - Phân loại rõ lỗi người dùng cần biết (hết quota, sai API key, mất mạng, nguồn RSS hỏng, AI local chưa chạy) kèm hướng dẫn khắc phục ngắn gọn trên UI; không nuốt lỗi âm thầm.

---

## 12. UI / UX Direction Constraints (Dành cho Phase 6 — Gate D)

> **Lưu ý giai đoạn:** Chỉ ghi nhận làm ràng buộc sản phẩm tại Phase 0. Tuyệt đối chưa thiết kế chi tiết hay viết giao diện sản phẩm trước **Phase 6 (`GATE D`)**.

- **Tham chiếu phong cách thiết kế:** Dự án [VOXLAB](https://github.com/lucnguyen911/VOXLAB.git) — chỉ dùng làm tài liệu tham chiếu thị giác/bố cục; **không** sửa đổi repo VOXLAB và **không** sao chép mã nguồn không cần thiết.
- **Bảng màu & Chủ đề:**
  - **Light Mode:** Kem (Cream), Nâu cát (Sand Brown) và Vàng hổ phách (Amber Gold).
  - **Dark Mode:** Đen Obsidian, Nâu tối và Vàng kim (Metallic Gold).
- **Typography & Bố cục Desktop:**
  - Font chữ `Inter`, mật độ thông tin tối ưu cho màn hình máy tính để bàn (Windows 11 desktop), ưu tiên rõ ràng, dễ đọc khi làm việc lâu dài, không lạm dụng hiệu ứng trang trí rối mắt.
  - Bố cục khung chính: **Sidebar bên trái** (chia rõ 2 nhóm *Global Research* và *Project Research*) + **Nội dung chính bên phải**.
  - **Một dropdown duy nhất** để chọn Project hiện tại hoặc tạo Project mới.
  - **Thanh điều hướng Back / Forward** hoạt động giống trình duyệt.
  - **Ghi nhớ trạng thái màn hình:** Khi quay lại/tiến tới bằng Back/Forward, phải giữ nguyên bộ lọc (filters), cách sắp xếp (sort) và vị trí danh sách/cuộn (scroll position) của màn hình đó.
  - Bảng dữ liệu, biểu đồ và các màn hình nghiên cứu phải thống nhất phong cách và quy ước tương tác.
- **Quy trình duyệt UI (Phase 6):** Sử dụng công cụ Stitch (khi khả dụng) kết hợp prototype nhẹ trên ứng dụng để duyệt tại `GATE D` trước khi ghép sâu logic nghiệp vụ ở Phase 7.

---

## 13. Performance, Packaging & Dependency / License Policy

- **Hiệu năng & Tham số `TUNING REQUIRED`:**
  - Không tối ưu sớm cảm tính; chỉ tối ưu sau khi đo đạc (`MEASURE FIRST`).
  - Với danh sách dữ liệu lớn (video, từ khóa, lịch sử kênh), thiết kế API có phân trang/giới hạn (`limit`/`offset` hoặc cursor) và cân nhắc ảo hóa danh sách trên UI khi số dòng lớn.
  - Các tham số bắt buộc gắn nhãn `TUNING REQUIRED` (dùng giá trị mặc định an toàn ban đầu và hiệu chỉnh bằng đo đạc thực tế): kích thước lô gọi API (`batch size`), `timeout` mạng/AI, chính sách `retry/backoff`, chu kỳ làm mới định kỳ (`polling interval`), ngưỡng cảnh báo quota, `SQLite busy_timeout`, kích thước trang bảng dữ liệu và thời gian lưu cache tạm.
- **Chính sách Thư viện & Bản quyền (Dependency & License Policy):**
  - Ưu tiên thư viện chuẩn của Python và Web API chuẩn trước khi cài thêm gói ngoài.
  - Agent chỉ được tự thêm thư viện nhỏ, phổ biến, đang được bảo trì tốt khi: không phát sinh dịch vụ ngoài, chi phí = 0 USD, không ảnh hưởng bảo mật/quyền riêng tư và dùng giấy phép nguồn mở thông thoáng (**`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `PSF`**).
  - **Cấm** tự ý thêm thư viện mang giấy phép copyleft lây nhiễm (**`GPL`, `AGPL`**) hoặc runtime cỡ lớn (PyTorch, Chromium rời, framework UI nặng...) nếu chưa được người dùng duyệt qua `GATE E`.
- **Cập nhật & Đóng gói (Update & Packaging Strategy):**
  - Giai đoạn phát triển và kiểm chứng V1 chạy trực tiếp trên môi trường local Windows 11 qua bộ khung `frontend` + `backend` hiện tại.
  - Khi đóng gói Desktop bằng `Tauri` ở giai đoạn sau: đóng gói Frontend tĩnh vào WebView2 và quản lý Backend Python như sidecar cục bộ giao tiếp qua `127.0.0.1`, giữ nguyên cấu trúc thư mục dữ liệu `%LOCALAPPDATA%\ResearchStudio\` để không mất dữ liệu khi nâng cấp.
  - Không tự động tích hợp cơ chế tự cập nhật ngầm (auto-updater) nếu chưa được phê duyệt tại `GATE E`.

---

## 14. Material Technical Decisions (Quyết Định Kỹ Thuật Nền Tảng)

### DEC-001 — Một file SQLite hợp nhất: thực thể gốc dùng chung + cô lập `project_id` cho dữ liệu riêng Project
- **CONTEXT:** Cần cô lập dữ liệu riêng của từng Project nhưng vẫn có phân khu Global Research, đồng thời cho phép một video, kênh, bài báo hoặc chủ đề được liên kết với nhiều Project mà không lưu trùng metadata.
- **OPTIONS:** (A) Một file SQLite `research_studio.db` duy nhất tách rõ bảng thực thể gốc dùng chung (metadata video, kênh, bài báo, chủ đề toàn cục — không bắt buộc `project_id`), bảng liên kết nhiều-nhiều (`project_*`) và bảng dữ liệu riêng của Project (`project_id NOT NULL`); (B) Tách mỗi Project thành một file `.db` riêng biệt kèm `global.db`.
- **CHOSEN:** Phương án (A) — Một file `research_studio.db` duy nhất đặt tại `%LOCALAPPDATA%\ResearchStudio\data\`, kết hợp hỗ trợ xuất/sao lưu từng Project khi cần.
- **WHY:** Đảm bảo nâng cấp schema (migration) và sao lưu diễn ra nguyên tử trên một file duy nhất, lưu một bản chuẩn duy nhất cho metadata video/kênh/bài báo/chủ đề toàn cục (tránh trùng lặp khi gắn vào nhiều Project), dùng chung bộ đếm hạn mức YouTube API và liên kết mượt giữa Global Research với Project Research.
- **TRADE-OFF:** Đòi hỏi phân biệt rõ bảng thực thể gốc dùng chung với bảng dữ liệu riêng / bảng liên kết của Project và bắt buộc lọc theo `project_id` ở mọi truy vấn Project Research — được kiểm soát bằng khóa ngoại SQLite, cấu trúc URL `/api/v1/projects/{project_id}/...` và integration test cô lập dữ liệu.

### DEC-002 — Toàn bộ kết nối mạng ngoài và AI đi qua Backend FastAPI (`127.0.0.1`)
- **CONTEXT:** Ứng dụng chạy trên trình duyệt local ở giai đoạn đầu và sẽ đóng gói Tauri WebView2 ở giai đoạn sau, đồng thời cần gọi YouTube Data API, RSS feeds và AI local/cloud.
- **OPTIONS:** (A) Frontend chỉ gọi Backend cục bộ, Backend thực hiện mọi kết nối ra ngoài; (B) Frontend gọi trực tiếp YouTube API / RSS / Ollama từ trình duyệt.
- **CHOSEN:** Phương án (A).
- **WHY:** Không bao giờ lộ API key xuống trình duyệt, loại bỏ hoàn toàn lỗi CORS khi đọc RSS feed hoặc gọi LM Studio/Ollama, tập trung kiểm soát quota/retry/deduplication tại một nơi duy nhất và giữ nguyên hành vi khi chuyển lên Tauri.
- **TRADE-OFF:** Mọi luồng dữ liệu đều cần endpoint Backend mỏng, đổi lại kiến trúc nhất quán, an toàn và rất dễ viết test tự động.

### DEC-003 — Bảo vệ API Key trên Windows bằng DPAPI chuẩn (`ctypes`)
- **CONTEXT:** Người dùng sẽ nhập YouTube Data API key (và tùy chọn Cloud AI key) trên máy Windows 11; không được lưu khóa lộ liễu trong source code hay plaintext dễ rò rỉ.
- **OPTIONS:** (A) Mã hóa bằng Windows Data Protection API (`CryptProtectData` qua thư viện chuẩn `ctypes` của Python) gắn với tài khoản Windows hiện tại; (B) Lưu plaintext trong SQLite/JSON; (C) Cài thêm thư viện mã hóa native bên thứ ba ngay từ đầu.
- **CHOSEN:** Phương án (A).
- **WHY:** Có sẵn 100% trên mọi bản Windows 11 mà không cần cài thêm thư viện ngoài hay quyền Administrator, khóa mã hóa do chính hệ điều hành quản lý theo user Windows hiện hành.
- **TRADE-OFF:** Bản mã gắn với tài khoản Windows trên máy đó (khi đổi máy người dùng chỉ cần nhập lại API key của mình — hoàn toàn phù hợp và an toàn cho ứng dụng desktop cá nhân).

### DEC-004 — Tác vụ định kỳ chạy nội bộ trong vòng đời FastAPI (`asyncio` Lifespan)
- **CONTEXT:** Ứng dụng cần làm mới dữ liệu kênh/RSS theo lịch có kiểm soát trên máy cá nhân Windows mà vẫn dễ khởi chạy, tắt sạch và đóng gói.
- **OPTIONS:** (A) Bộ lập lịch nhẹ chạy trong tiến trình FastAPI (`lifespan` + `asyncio`) chỉ hoạt động khi ứng dụng đang mở; (B) Cài Celery/Redis hoặc đăng ký Windows Service chạy ngầm liên tục.
- **CHOSEN:** Phương án (A).
- **WHY:** Đơn giản tối đa, không phát sinh tiến trình ngầm chiếm tài nguyên khi người dùng đã đóng Research Studio, không cần cài dịch vụ phụ trợ và dễ đóng gói cùng Tauri sidecar.
- **TRADE-OFF:** Lịch thu thập chỉ chạy khi ứng dụng đang mở (nếu một kỳ cập nhật bị quá hạn trong lúc tắt máy, ứng dụng có thể kiểm tra và chạy bù có kiểm soát hạn mức khi mở lại nếu được đặc tả trong `SPEC.md`).

---

## 15. Exceptions & Diff Guard Policy

### 15.1. Danh sách ngoại lệ hiện hành (Tracked Exceptions)

*Hiện không có ngoại lệ nào. Mọi ngoại lệ mới phải ghi rõ người chịu trách nhiệm (`Owner`) và ngày hết hạn (`Expires` tối đa 90 ngày).*

| ID | Rule | Path | Reason | Owner | Expires |
|---|---|---|---|---|---|
| *(Trống)* | — | — | — | — | — |

### 15.2. Kiểm tra chống hạ chuẩn khi Review (`Phase 9` & `Phase 13`)

Khi thực hiện `/review` hoặc trước khi hoàn tất bất kỳ tính năng nào, bắt buộc đối chiếu `git diff` để chặn 5 hành vi hạ chuẩn:
1. Hạ ngưỡng số liệu hoặc xóa dòng kiểm tra trong `CONSTRAINTS.md`.
2. Thêm `.skip`/`.todo`, xóa file test hoặc xóa câu lệnh `assert`/`expect` trong test hiện có.
3. Chèn comment tắt cảnh báo (`@ts-ignore`, `oxlint-disable`, `# noqa`, `# type: ignore`).
4. Để lại mã giả/stub chưa hoàn thiện hoặc khối `catch`/`except` rỗng nuốt lỗi.
5. Tự ý thêm dòng vào bảng `Exceptions` mà chưa được thảo luận và phê duyệt.
