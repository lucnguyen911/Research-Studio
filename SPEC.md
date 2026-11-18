# SPEC — Research Studio (MVP V1 — Standard Mode)

- **Dự án:** Research Studio
- **Giai đoạn:** Phase 3 — Specification (`GATE B` — Đã phê duyệt)
- **Ngày lập / Cập nhật:** 2026-11-16
- **Tài liệu ràng buộc:** [AGENT_WORKFLOW.txt](file:///f:/Source%20Code%20Tool/Reserch%20Studio/AGENT_WORKFLOW.txt) · [CONSTRAINTS.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/CONSTRAINTS.md)
- **Trạng thái cổng duyệt:** **Đã phê duyệt tại `GATE B` (2026-11-16)** — Kèm làm rõ phạm vi gọn nhẹ cho danh sách/bảng Quản lý ý tưởng và cơ chế Xuất JSON / Xóa Project an toàn.

---

## Thông tin kỹ thuật nền & Ranh giới hệ thống (Engineering Reference)

- **Môi trường & Stack cố định (từ Phase -1 & Phase 0):**
  - **Hệ điều hành:** Windows 11 (`64-bit / x64`), vận hành **local-first** (chưa đóng gói Tauri ở MVP V1).
  - **Frontend (`frontend/`):** `React 19.3.x` + `TypeScript` + `Vite 8` (`npm`), chỉ bind `127.0.0.1:5173` (dev) / `127.0.0.1:4173` (preview), proxy `/api` tới Backend.
  - **Backend (`backend/`):** `Python 3.11.x` + `FastAPI` + `Uvicorn` (`backend/.venv`, chỉ bind `127.0.0.1:8000`). Mọi kết nối ra Internet (YouTube Data API v3, RSS/Atom) đi qua Backend.
  - **Database:** Một file `SQLite 3` (`sqlite3` chuẩn Python) tại `%LOCALAPPDATA%\ResearchStudio\data\research_studio.db` (ghi đè qua biến môi trường `RESEARCH_STUDIO_DATA_DIR` khi dev/test). Bản sao lưu lưu tại `backups/`, log xoay vòng tại `logs/`, cấu hình tại `config/`.
- **Lệnh kiểm chứng bộ khung hiện hành:**
  - Frontend typecheck / lint / build / dev: `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend run dev`
  - Backend syntax / unit tests / integrity: `.\backend\.venv\Scripts\python.exe -m compileall -q backend/app backend/tests`, `$env:PYTHONPATH="backend"; .\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p "test_*.py" -v`, `.\backend\.venv\Scripts\python.exe -m pip check`
- **Cấu trúc phân tầng dự kiến (`src` / `app`):**
  - `frontend/src/` — Giao diện SPA, điều hướng lịch sử Back/Forward + khôi phục trạng thái, bộ lọc/bảng/chi tiết, gọi API `/api/v1/*` và `/api/health`.
  - `backend/app/` — API FastAPI (`/api/v1/...`), lớp repository SQLite + migration có backup, client YouTube Data API v3, bộ đọc RSS/Atom, Quota Ledger 2 bucket, bộ lập lịch làm mới có kiểm soát và mã hóa DPAPI.
  - `backend/tests/` — Unit test & integration test (SQLite tạm, cô lập `project_id`, hết hạn 30 ngày, phân loại định dạng, quota, XSS/XXE/DPAPI).
- **Ranh giới thực thi (Boundaries):**
  - **Luôn thực hiện (`Always`):** Giữ nguyên dữ liệu người dùng tự tạo khi làm mới/xóa cache API; truyền tường minh `project_id` trên mọi endpoint Project; dùng `AbortController` khi chuyển Project; che `key=...` trong log; chạy đủ test & kiểm tra trình duyệt (Chrome DevTools MCP) theo `CONSTRAINTS.md`.
  - **Hỏi trước / `GATE E` (`Ask First`):** Thay đổi schema mang tính phá hủy dữ liệu người dùng; cài thêm gói ngoài có chi phí/copyleft/runtime lớn; bật tính năng Derived Metrics hoặc lưu dữ liệu YouTube API quá 30 ngày khi có chứng nhận phê duyệt của YouTube.
  - **Cấm thực hiện (`Never`):** Gọi trực tiếp YouTube API/RSS từ Frontend; hard-code API Key; scraping trái điều khoản; giả lập Search Volume/doanh thu; tự ý tính chỉ số dẫn xuất từ `API Data`; tạo telemetry; tự động gộp video `Chưa xác định` vào nhóm thống kê `Video dài` hoặc `Shorts`.

---

## 1. Mục tiêu sản phẩm và phạm vi MVP

### 1.1. Mục tiêu cốt lõi & Người dùng mục tiêu
- **True Goal:** Giúp người sáng tạo nội dung YouTube cá nhân (với cấu trúc điều hướng 3 cấp sẵn sàng mở rộng đa nền tảng trong tương lai) quản lý đồng thời nhiều kênh/chủ đề (Project) theo quy trình **Khám phá tín hiệu thực tế (YouTube + RSS) → Theo dõi kênh đối thủ & từ khóa → Đánh giá, lưu và theo dõi tiến độ sản xuất Ý tưởng theo từng kênh** ngay trên máy Windows 11 cá nhân, chi phí API mặc định `0 USD` và tuân thủ đầy đủ chính sách của YouTube.
- **Target User:** Nhà sáng tạo nội dung YouTube cá nhân vận hành 1 hoặc nhiều kênh có thị trường (`regionCode`), ngôn ngữ (`relevanceLanguage`) và nhóm đối thủ khác nhau.

### 1.2. Trong phạm vi MVP V1 (`In Scope` — Standard Mode)
- **11/16 màn hình hoạt động thật bằng dữ liệu thực:**
  - **Tổng quan / Global Research (5 màn hình):** `G1. Tổng quan`, `G2. Khám phá xu hướng`, `G3. Nghiên cứu tự do`, `G4. Tin tức & thảo luận`, `G5. Kho ý tưởng chung`.
  - **Dự án / Project Research (6 màn hình):** `P1. Tổng quan dự án`, `P2. Theo dõi đối thủ`, `P3. Video bứt phá` (**Standard Mode**), `P4. Nghiên cứu từ khóa` (**Standard Mode**), `P5. Quản lý ý tưởng`, `P6. Cài đặt dự án`.
- **Khung hệ thống bắt buộc đi kèm:**
  - *Cài đặt hệ thống chung & Pháp lý* (API Key DPAPI, cảnh báo quota 2 bucket, tùy chọn làm mới tự động, giao diện Light/Dark, chọn ngôn ngữ `Tiếng Việt`/`English`, quản lý xóa cache `API Data`, Điều khoản sử dụng & Chính sách Quyền riêng tư).
  - *Màn hình Chi tiết nhiều cấp* (*Chi tiết Video*, *Chi tiết Kênh*, *Chi tiết Bài báo RSS*, *Chi tiết Ý tưởng*) hỗ trợ điều hướng Back/Forward kiểu trình duyệt.
- **Chế độ dữ liệu & xử lý:** `100%` thuật toán Python tất định (không AI), nguồn dữ liệu hợp lệ gồm **YouTube Data API v3 (Standard Mode — API Key người dùng)** và **RSS/Atom công khai hợp lệ**.

### 1.3. Ngoài phạm vi MVP V1 (`Out of Scope`)
- **5 màn hình Giai đoạn 2:** *Video nổi bật* (`Tổng quan`), *Chủ đề nóng*, *Chủ đề dài hạn*, *Cơ hội nội dung*, *Nghiên cứu AI* (`Dự án`) — hiển thị trong danh sách chức năng của khu vực tương ứng kèm nhãn `Giai đoạn 2` (`GĐ 2`) và màn hình giới thiệu trung thực, không chức năng giả.
- **Chỉ số dẫn xuất từ `YouTube API Data` & lưu dài hạn `> 30 ngày`:** Không tính và không hiển thị `Outlier Multiplier`, `Views/ngày`, `Engagement Rate`, `Channel Median`, điểm cơ hội tổng hợp từ `API Data`, không tổng hợp thống kê `API Data` chéo nhiều kênh độc lập, và không lưu snapshot thống kê quá `30 ngày lịch`. **Không xây trước module ẩn hay công tắc mở khóa nâng cao trong MVP V1.**
- **AI Local / Cloud:** Không kết nối LM Studio, Ollama hay Cloud AI trong MVP V1.
- **Nền tảng mạng xã hội khác (V1):** Trên dropdown chọn nền tảng ở đầu Sidebar, chỉ **`YouTube`** hoạt động thực tế trong MVP V1; **`TikTok`, `Facebook`, `Instagram`, `X`** hiển thị ở trạng thái vô hiệu hóa (`Sắp ra mắt`). Không tạo dữ liệu giả, chức năng giả, API adapter hay hệ thống plugin đa nền tảng sớm; không scraping; không giả lập Search Volume hoặc doanh thu; chưa đóng gói Tauri; không tài khoản cloud hay telemetry.

---

## 2. Đặc tả đầy đủ 11 màn hình hoạt động trong MVP

> Mọi màn hình đều có đầy đủ 5 trạng thái UX chuẩn: `Loading` (khung chờ/tiến trình rõ ràng), `Empty` (trạng thái trống kèm hướng dẫn hành động đầu tiên), `Error` (thông báo tiếng Việt rõ nguyên nhân + hướng dẫn khắc phục + nút `Thử lại`), `Cancel` (hủy được các tác vụ nạp/thu thập mạng đang chạy) và `Offline Read-only` (xem/lọc/sắp xếp dữ liệu còn hạn và thao tác với toàn bộ dữ liệu người dùng khi mất mạng).

### Khu vực 1 — GLOBAL RESEARCH (`scope = global`, hoạt động ngay cả khi chưa tạo Project nào)

#### `G1. Tổng quan` (Global Overview)
- **Mục đích:** Màn hình tổng hợp nhanh tình trạng dữ liệu ngoài Project, tình trạng hạn mức YouTube API 2 bucket, các bản tin RSS mới và ý tưởng mới lưu.
- **Đầu vào:** Không cần tham số lọc bắt buộc; tự đọc trạng thái từ SQLite và tiến trình làm mới (nếu người dùng bật).
- **Đầu ra hiển thị:**
  - Thẻ **Hạn mức YouTube API hôm nay (PT):** Thanh đo riêng cho `Search Queries` (`đã dùng / 100 lượt`) và `General Data API` (`đã dùng / 10.000 units`), kèm giờ reset `00:00 PT`.
  - Thẻ **Tình trạng dữ liệu đệm & Làm mới:** Trạng thái công tắc Tự động làm mới (`Bật/Tắt`), lần chạy cuối, số nguồn lỗi (nếu có), số bản ghi `API Data` sắp chạm mốc `30 ngày lịch`.
  - Thẻ **Kho ý tưởng chung:** Tổng số ý tưởng gốc, số ý tưởng chưa gắn Project, danh sách 5 ý tưởng cập nhật gần nhất.
  - Thẻ **Tin tức RSS mới nhất (`Nguồn: RSS — Dữ liệu ngoài YouTube`):** Tối đa 5–10 bài mới nhất từ nguồn toàn cục.
- **Thao tác chính:** Bấm đi nhanh tới `Khám phá xu hướng`, `Nghiên cứu tự do`, `Tin tức & thảo luận`, `Kho ý tưởng chung`, `Cài đặt hệ thống`, hoặc bấm **Làm mới nguồn đến hạn ngay** (tùy chọn thủ công).
- **Trạng thái đặc biệt:** Chưa nhập API Key vẫn hiển thị đầy đủ phần RSS, Kho ý tưởng và thẻ hướng dẫn cài đặt API Key.

#### `G2. Khám phá xu hướng` (Trend Discovery)
- **Mục đích:** Khám phá các video đang thịnh hành thực tế trên YouTube theo quốc gia và danh mục bằng endpoint ít tốn quota (`videos.list(chart="mostPopular")` — `1 unit` thuộc `General Data API`).
- **Đầu vào & Bộ lọc:**
  - Tham số gọi API: `regionCode` (mặc định từ Cài đặt chung, ví dụ `VN` hoặc `US`), `videoCategoryId` (`Tất cả` hoặc danh mục lấy từ `videoCategories.list`), số lượng hiển thị (`25` hoặc `50`).
  - Bộ lọc/sắp xếp cục bộ trên kết quả đã tải: Định dạng nguồn (`Tất cả`, `Video dài`, `Shorts`, `Chưa xác định`), Nhãn thủ công (`Tất cả`, `Video dài (Thủ công)`, `Shorts (Thủ công)`), tìm nhanh theo chuỗi trong tiêu đề/kênh, sắp xếp (`Thứ hạng xu hướng mặc định`, `viewCount`, `likeCount`, `commentCount`, `publishedAt`, `duration`).
- **Đầu ra hiển thị:**
  - Ghi chú thời điểm lấy dữ liệu cuối và hạn lưu `30 ngày lịch`, logo/attribution nhận diện nguồn YouTube kèm liên kết về YouTube.
  - Bảng/danh sách video gồm: ảnh thu nhỏ, tiêu đề, tên kênh, ngày đăng, thời lượng, **Trạng thái định dạng từ nguồn** + **Gợi ý phụ (nếu có)** + **Nhãn thủ công (nếu có)**, và các số liệu gốc `viewCount`, `likeCount`, `commentCount` (hiển thị nguyên bản hoặc `—` nếu chủ kênh ẩn số lượt thích/tắt bình luận).
- **Thao tác chính:** Bấm **Làm mới xu hướng** (`1 unit` `General Data API`); mở *Chi tiết Video*; mở *Chi tiết Kênh*; **Lưu vào Kho ý tưởng**; **Thêm kênh vào đối thủ của Project**; gắn/sửa **Nhãn định dạng thủ công**.

#### `G3. Nghiên cứu tự do` (Ad-hoc Search Research)
- **Mục đích:** Tìm kiếm tự do video hoặc kênh YouTube theo từ khóa bất kỳ ngoài phạm vi Project để khảo sát nội dung mới.
- **Đầu vào & Bộ lọc:**
  - Ô nhập từ khóa `q` (bắt buộc không rỗng khi tìm mới), loại đối tượng (`Video` / `Kênh`), `regionCode`, `relevanceLanguage`, khoảng thời gian đăng (`24h`, `7 ngày`, `30 ngày`, `Bất kỳ`), thứ tự kết quả YouTube (`relevance`, `date`, `viewCount`).
  - Bộ lọc/sắp xếp cục bộ sau khi có kết quả: lọc theo 3 trạng thái định dạng nguồn + nhãn thủ công, lọc tên kênh, sắp xếp trên trường gốc.
- **Đầu ra hiển thị:**
  - Nút **Tìm kiếm trên YouTube** luôn hiển thị rõ chi phí dự kiến (`1 lượt` `Search Queries` + `1 unit` `General Data API` để lấy chi tiết 50 ID).
  - Khu vực **Lịch sử phiên tìm kiếm gần đây (`<= 30 ngày`)**: Cho phép chọn lại bộ kết quả đã lưu mà **không gọi lại API** (`0 quota`).
  - Danh sách kết quả Video hoặc Kênh kèm thông tin gốc, nhận diện nguồn YouTube, và nút **Tải trang kế tiếp** (báo trước tốn thêm `1 lượt` `Search Queries` + `1 unit` `General Data API`).
- **Thao tác chính:** Thực hiện tìm mới / hủy khi đang gọi; tải lại phiên cũ còn hạn; lưu Video thành Ý tưởng; lưu từ khóa `q` vào một Project; thêm Kênh vào danh sách đối thủ của một hoặc nhiều Project; gán nhãn định dạng thủ công.

#### `G4. Tin tức & thảo luận` (RSS News & Discussion)
- **Mục đích:** Thu thập, đọc và tìm tín hiệu chủ đề mới từ báo chí, blog công nghệ, diễn đàn hoặc feed RSS/Atom công khai hợp lệ (`0 quota` YouTube).
- **Đầu vào & Bộ lọc:**
  - Quản lý danh sách nguồn RSS toàn cục: URL feed, tên hiển thị, nhóm/thẻ cá nhân, trạng thái Bật/Tắt.
  - Bộ lọc danh sách bài viết: từ khóa tìm kiếm, chọn theo nguồn feed, khoảng ngày xuất bản (`24h`, `7 ngày`, `30 ngày`, `Tất cả`), lọc `Chỉ bài đã đánh dấu`.
- **Đầu ra hiển thị:**
  - Thanh trạng thái **Nguồn: RSS / Atom (Dữ liệu ngoài YouTube)** phân biệt rành mạch với YouTube API Data.
  - Danh sách bài viết đã khử trùng lặp: tiêu đề, tên nguồn, ngày đăng, đoạn tóm tắt thuần văn bản (đã lọc HTML/script an toàn), trạng thái đánh dấu/ghi chú.
  - Bảng nhỏ **Cụm từ nổi bật trên tập bài RSS hiện tại** (tính bằng Python tất định trên dữ liệu RSS — hợp lệ ngay vì không dùng `YouTube API Data`).
- **Thao tác chính:** Thêm/Sửa/Xóa/Bật-Tắt nguồn RSS; bấm **Làm mới RSS** (`Cancel/Retry`, cô lập từng feed lỗi); mở *Chi tiết Bài báo RSS*; mở bài gốc ngoài trình duyệt (`https://` / `http://`); đánh dấu bài quan tâm; **Tạo Ý tưởng vào Kho chung hoặc Project**.

#### `G5. Kho ý tưởng chung` (Global Idea Vault)
- **Mục đích:** Lưu giữ vĩnh viễn mọi ý tưởng nội dung của người dùng tại một nơi trung tâm và phân phối linh hoạt tới 1 hoặc nhiều Project.
- **Đầu vào & Bộ lọc:**
  - Tìm kiếm theo tiêu đề/góc tiếp cận/ghi chú/thẻ; lọc theo nguồn gốc (`Viết tay`, `Từ Video YouTube`, `Từ Bài báo RSS`, `Từ Từ khóa`), lọc theo trạng thái liên kết Project (`Tất cả`, `Chưa gắn Project`, `Đã gắn ít nhất 1 Project`), lọc theo tên Project cụ thể.
- **Đầu ra hiển thị:**
  - Danh sách các bản ý tưởng gốc (`User-Created Data`): tiêu đề ý tưởng, nguồn tham chiếu (tiêu đề/URL gốc còn hạn hoặc URL/ID tham chiếu do người dùng lưu nếu `API Data` đã hết hạn), thẻ cá nhân, và danh sách huy hiệu **Project đang triển khai + trạng thái hiện tại ở từng Project**.
- **Thao tác chính:** Tạo ý tưởng viết tay mới; mở *Chi tiết Ý tưởng*; sửa tiêu đề/mô tả/thẻ/ghi chú gốc; **Gắn vào / Gỡ khỏi Project** (cho phép nhập `góc khai thác riêng` ngay lúc gắn); xóa ý tưởng gốc có hộp thoại xác nhận cảnh báo (nêu rõ số Project đang liên kết).

---

### Khu vực 2 — PROJECT RESEARCH (`scope = project`, dùng chung cho `project_id` đang chọn từ Dropdown duy nhất)

> Nếu người dùng chưa tạo Project nào, mọi màn hình `P1`–`P6` hiển thị trạng thái hướng dẫn tạo Project đầu tiên ngay trên màn hình hoặc mở modal tạo từ Dropdown duy nhất.

#### `P1. Tổng quan dự án` (Project Overview)
- **Mục đích:** Bảng điều phối nhanh tình hình nghiên cứu của Project đang chọn.
- **Đầu vào:** `project_id` đang chọn (không cần cấu hình lọc riêng).
- **Đầu ra hiển thị:**
  - Tóm tắt cấu hình Project (`regionCode`, `relevanceLanguage`, định dạng trọng tâm).
  - Số liệu tổng quan: số kênh đối thủ đang theo dõi, tổng số video mới đăng của đối thủ trong `7` / `30` ngày qua (đếm trên số liệu bản ghi còn hạn, tách rõ `Video dài` / `Shorts` / `Chưa xác định`), số từ khóa đang theo dõi, số bài RSS mới từ nguồn liên kết Project.
  - Phễu đếm **Ý tưởng của Project theo 5 trạng thái** (`Mới lưu`, `Đang nghiên cứu`, `Chốt làm`, `Đã sản xuất`, `Bỏ qua`).
  - Liệt kê ngắn: 5 video mới nhất của đối thủ (số liệu gốc) và cảnh báo nguồn lỗi/dữ liệu API của Project sắp quá hạn `30 ngày` (nếu có).
- **Thao tác chính:** Bấm chuyển nhanh sang các màn hình `P2`–`P6`; bấm **Làm mới kênh đối thủ & RSS của Project** (nút thủ công, có ước tính unit `General Data API` và nút Hủy).

#### `P2. Theo dõi đối thủ` (Competitor Tracking)
- **Mục đích:** Quản lý danh sách kênh YouTube đối thủ của Project và theo dõi danh sách video mới xuất bản của họ bằng chi phí API thấp.
- **Đầu vào & Bộ lọc:**
  - Thêm đối thủ mới vào Project bằng: `URL kênh` (`/channel/UC...`, `/@handle`), `@handle`, `channel_id` (`UC...`), hoặc chọn từ các kênh đã có trong SQLite; chỉ dùng `search.list` nếu người dùng chủ động bấm tìm kênh theo tên tự do.
  - Bộ lọc danh sách video: theo một/nhiều kênh đối thủ của Project, định dạng nguồn (`Video dài`, `Shorts`, `Chưa xác định`), nhãn thủ công, khoảng ngày đăng (`7 ngày`, `14 ngày`, `30 ngày`, `Trong cache còn hạn <= 30 ngày`), tìm theo tiêu đề.
  - Sắp xếp: `publishedAt`, `viewCount`, `likeCount`, `commentCount`, `duration`.
- **Đầu ra hiển thị:**
  - Tab/vùng **Danh sách kênh đối thủ**: tên kênh, avatar/link về kênh YouTube, `subscriberCount` & `videoCount` gốc (lưu trong hạn `<= 30 ngày`), ghi chú riêng của Project về đối thủ đó, thời điểm cập nhật gần nhất, trạng thái kênh (`Bình thường` / `Tạm dừng` / `Lỗi`).
  - Tab/vùng **Video từ các đối thủ**: danh sách tối đa 30–50 video gần nhất/mới thu thập của từng kênh với đầy đủ số liệu gốc, trạng thái định dạng 3 lớp, nút mở *Chi tiết Video* (xem lịch sử mốc thô `<= 30 ngày` theo timestamp).
- **Thao tác chính:** Thêm/tạm dừng/gỡ kênh khỏi Project (chỉ gỡ liên kết `project_channels`, không xóa bản ghi kênh nếu Project khác còn dùng); làm mới từng kênh hoặc toàn bộ kênh của Project; gán nhãn định dạng thủ công; gắn cờ *Đánh dấu Bứt phá*; **Lưu thành Ý tưởng của Project**.

#### `P3. Video bứt phá` (Breakout Videos — **Standard Mode**)
- **Mục đích:** Giúp người sáng tạo nhanh chóng sàng lọc, phát hiện và ghi nhận những video đáng chú ý nhất vừa đăng từ tệp đối thủ của Project trong khuôn khổ tuân thủ 100% chính sách YouTube API ở chế độ chuẩn.
- **Đầu vào & Bộ lọc:**
  - Cửa sổ ngày đăng: `3 ngày`, `7 ngày`, `14 ngày`, `30 ngày` (hoặc chọn ngày trong giới hạn dữ liệu API còn hạn `<= 30 ngày`).
  - Lọc định dạng nguồn tách bạch: `Video dài`, `Shorts`, `Chưa xác định` (mặc định KHÔNG gộp `Chưa xác định` chung thống kê với 2 nhóm xác định; cho phép lọc riêng theo **Nhãn thủ công** của người dùng).
  - Lọc theo kênh đối thủ cụ thể trong Project; ngưỡng lọc tối thiểu trên số liệu gốc (`viewCount >= N`, `likeCount >= M`, `commentCount >= K`); công tắc lọc `Chỉ video tôi đã đánh dấu Bứt phá`.
  - Sắp xếp trực tiếp trên trường gốc: `viewCount giảm dần`, `likeCount giảm dần`, `commentCount giảm dần`, `publishedAt mới nhất`.
- **Đầu ra hiển thị:**
  - **Khung công bố phạm vi Standard Mode (luôn hiển thị rõ ràng, không ẩn):**
    - *Đang hoạt động ngay:* Sàng lọc theo cửa sổ ngày đăng + lọc tách biệt 3 trạng thái định dạng (`Video dài` / `Shorts` / `Chưa xác định`) + sắp xếp theo số liệu gốc (`viewCount`, `likeCount`, `commentCount`, `publishedAt`) + xem lịch sử mốc `viewCount` thô đã lưu trong vòng `<= 30 ngày` kèm timestamp thu thập + gắn cờ **Đánh dấu Bứt phá thủ công** và ghi chú cá nhân (lưu vĩnh viễn).
    - *Chưa khả dụng ở Standard Mode (chỉ bổ sung khi đáp ứng đầy đủ điều kiện xét duyệt YouTube Derived Metrics Policy):* `Outlier Multiplier` (`x lần trung vị`), `Channel Median`, `Views/ngày`, `Engagement Rate`, và biểu đồ lịch sử tăng trưởng dài hạn `> 30 ngày`.
  - Danh sách video đã lọc với số liệu gốc YouTube, các mốc số liệu thô theo timestamp (nếu đã lấy >= 2 lần trong `<= 30 ngày`, trình bày nguyên bản đúng ngữ cảnh thời gian theo mục `III.E.4.f`), cờ đánh dấu thủ công và ghi chú phân tích của Project.
- **Thao tác chính:** Bật/tắt cờ **Đánh dấu Bứt phá (`is_user_breakout`)** + ghi chú lý do bứt phá theo nhận định cá nhân; gán/sửa **Nhãn định dạng thủ công**; mở *Chi tiết Video*; **Chuyển thành Ý tưởng trong Project** (hoặc Kho chung).

#### `P4. Nghiên cứu từ khóa` (Keyword Research — **Standard Mode**)
- **Mục đích:** Quản lý danh sách từ khóa trọng tâm của Project, chủ động khảo sát kết quả YouTube thực tế theo thị trường/ngôn ngữ của Project và đối chiếu với tin tức RSS của Project.
- **Đầu vào & Bộ lọc:**
  - Quản lý danh sách từ khóa của Project: cụm từ khóa, mức ưu tiên (`Cao / Trung bình / Thấp`), ghi chú cá nhân (toàn bộ là `User-Created Data`, lưu vĩnh viễn).
  - Tham số quét YouTube (áp dụng mặc định theo `Cài đặt dự án`): `regionCode`, `relevanceLanguage`, khoảng thời gian đăng, thứ tự kết quả API.
  - Bộ lọc/sắp xếp cục bộ trên danh sách video kết quả của từ khóa: định dạng 3 trạng thái + nhãn thủ công, lọc theo tên kênh, sắp xếp theo trường gốc (`viewCount`, `likeCount`, `commentCount`, `publishedAt`).
- **Đầu ra hiển thị:**
  - Danh sách từ khóa kèm trạng thái lần quét YouTube cuối (còn hạn hay đã hết hạn 30 ngày) và dự báo chi phí quota (`1 lượt` `Search Queries` + `1 unit` `General Data API` mỗi từ khóa quét).
  - Khung **Kết quả YouTube cho từ khóa đang chọn**: hiển thị nguyên bản danh sách video trả về (số liệu gốc YouTube, thẻ `snippet.tags` gốc của từng video, ngày đăng, định dạng), **tuyệt đối không hiển thị Search Volume giả, điểm cạnh tranh tổng hợp từ API Data hay trung vị gộp nhiều kênh**.
  - Khung tách biệt **Tín hiệu từ nguồn RSS liên kết Project (`Nguồn: RSS — Dữ liệu ngoài YouTube`)**: đếm số bài báo RSS của Project khớp từ khóa và hiển thị các cụm từ liên quan xuất hiện trong tiêu đề/tóm tắt RSS (tính bằng Python).
- **Thao tác chính:** Thêm/Sửa/Xóa từ khóa của Project; bấm **Quét YouTube cho 1 từ khóa** hoặc **Quét nhiều từ khóa đã chọn** (hiện hộp thoại xác nhận tổng số lượt `Search Queries` trước khi chạy, có nút Hủy giữa chừng); lưu Video hoặc chính Từ khóa thành Ý tưởng Project; thêm Kênh từ kết quả vào đối thủ Project.

#### `P5. Quản lý ý tưởng` (Project Idea Pipeline)
- **Mục đích:** Theo dõi và triển khai toàn bộ ý tưởng thuộc về Project đang chọn xuyên suốt 5 giai đoạn từ lúc lưu tới khi xuất bản hoặc bỏ qua.
- **Đầu vào & Bộ lọc:**
  - Chế độ hiển thị gọn nhẹ trong MVP: **Danh sách / Bảng dữ liệu (`List / Table view`)** kèm thanh lọc nhanh theo 5 trạng thái sản xuất *(không xây dựng bảng Kanban kéo thả phức tạp trong MVP)*.
  - Tìm kiếm theo tiêu đề/góc khai thác/ghi chú; lọc theo trạng thái (`Mới lưu`, `Đang nghiên cứu`, `Chốt làm`, `Đã sản xuất`, `Bỏ qua`), mức ưu tiên (`Cao / Trung bình / Thấp`), nguồn gốc (`Từ Kho chung` / `Tạo trực tiếp trong Project`); sắp xếp theo ngày cập nhật, mức ưu tiên, ngày tạo.
- **Đầu ra hiển thị:**
  - Bảng/danh sách ý tưởng hiển thị: tiêu đề ý tưởng, nguồn gốc, **Góc khai thác riêng của Project**, **Ghi chú riêng của Project**, mức ưu tiên, dropdown đổi nhanh trạng thái hiện tại, và `published_video_url` (nếu đã sản xuất).
  - Chỉ số liên kết nếu ý tưởng dùng chung từ Kho chung: cho biết ý tưởng này còn đang gắn với bao nhiêu Project khác (chỉ hiển thị thông tin tóm tắt an toàn, không sửa nhầm sang Project khác).
- **Thao tác chính:** Tạo ý tưởng trực tiếp trong Project (mặc định có tùy chọn giữ ở Project hoặc đồng thời đưa vào Kho chung); gắn thêm ý tưởng từ Kho chung; chọn đổi nhanh giữa 5 trạng thái ngay trên dòng dữ liệu hoặc trang chi tiết; chỉnh sửa góc khai thác/ghi chú/ưu tiên/URL xuất bản; gỡ liên kết khỏi Project (nếu là ý tưởng Kho chung) hoặc xóa có hộp thoại xác nhận rõ ràng.

#### `P6. Cài đặt dự án` (Project Settings)
- **Mục đích:** Cấu hình tham số nghiên cứu riêng của Project đang chọn, liên kết nguồn dữ liệu và quản trị cơ bản cho Project (giữ gọn nhẹ, **không** mở rộng thành hệ thống Import/Export/Backup phức tạp).
- **Đầu vào:** Tên Project (duy nhất, không rỗng), mô tả, `regionCode` (mặc định), `relevanceLanguage` (mặc định), định dạng trọng tâm (`Tất cả / Video dài / Shorts`), chọn nguồn RSS toàn cục nào được liên kết với Project, quản lý danh sách kênh đối thủ gắn với Project.
- **Đầu ra hiển thị:** Biểu mẫu cài đặt hiện hành của `project_id`, thống kê số lượng bản ghi liên kết của Project, thông báo kết quả lưu/lỗi validate.
- **Thao tác chính:** Lưu cấu hình Project; **Tải xuống JSON Project đơn giản** (chỉ tải 1 file JSON đọc-chỉ chứa dữ liệu nghiên cứu của Project này — không kèm API Key, không xây trình Import phức tạp); **Xóa Project an toàn có xác nhận** (bắt buộc người dùng nhập đúng tên Project và xác nhận tường minh; Backend tự động tạo bản sao lưu an toàn SQLite vào `backups/` trước khi thực thi để không mất dữ liệu không thể khôi phục ngoài ý muốn, đồng thời chỉ xóa Project cùng bảng liên kết/từ khóa riêng của Project đó, bảo vệ `100%` thực thể gốc dùng chung và Ý tưởng gốc trong Kho chung).

---

### Thành phần hệ thống bổ trợ trong MVP

1. **Màn hình / Khu vực `Cài đặt hệ thống chung & Pháp lý`:**
   - Nhập, kiểm tra kết nối, cập nhật và xóa **YouTube Data API v3 Key** (mã hóa Windows DPAPI, UI chỉ hiện dạng che như `AIza...9x2A`).
   - Cấu hình ngưỡng cảnh báo cho 2 bucket Quota (mặc định `80%` của `100` `Search Queries` và `80%` của `10.000` `General Data API`).
   - Cấu hình **Tự động làm mới khi mở app** (Công tắc Bật/Tắt, chu kỳ tối thiểu, giới hạn request mỗi đợt, trần quota tự động ngày).
   - Chọn thị trường & ngôn ngữ mặc định cho Global Research; chọn chủ đề **Light Mode / Dark Mode** (hoặc theo hệ thống).
   - Nút **Xóa toàn bộ cache YouTube API Data ngay lập tức** (tuân thủ `Developer Policies III.E.4.g`, bảo toàn `100%` dữ liệu người dùng; phần sao lưu SQLite chỉ chạy tự động nội bộ trước khi nâng cấp migration hoặc trước khi xóa Project, không làm hệ thống quản lý Backup/Restore phức tạp trên UI).
   - Mục **Điều khoản sử dụng, Chính sách Quyền riêng tư & Nguồn dữ liệu** (luôn truy cập được, gồm liên kết YouTube Terms of Service và Google Privacy Policy).
2. **Các trang `Chi tiết` nhiều cấp (hỗ trợ đầy đủ Back/Forward):**
   - *Chi tiết Video:* Toàn bộ metadata & thống kê gốc trong hạn `<= 30 ngày`, link mở video trên YouTube, danh sách `snippet.tags`, bảng mốc số liệu thô theo timestamp (`<= 30 ngày`), trạng thái định dạng 3 lớp (Nguồn / Gợi ý kèm độ tin cậy & căn cứ / Nhãn thủ công), cờ Bứt phá & ghi chú theo từng Project, các Ý tưởng đã lưu từ video này.
   - *Chi tiết Kênh:* Thông tin kênh gốc trong hạn `<= 30 ngày`, link mở kênh trên YouTube, danh sách video gần nhất đã lấy của kênh, danh sách các Project đang theo dõi kênh này.
   - *Chi tiết Bài báo RSS:* Tiêu đề, nguồn RSS, thời điểm đăng, tóm tắt/nội dung thuần văn bản từ RSS, nút mở bài gốc ngoài trình duyệt, ghi chú cá nhân và nút Tạo Ý tưởng.
   - *Chi tiết Ý tưởng:* Nội dung ý tưởng gốc, đối tượng nguồn liên kết, danh sách mọi Project đang gắn kèm góc khai thác & 5 trạng thái độc lập của từng Project.

---

## 3. Hành vi và trạng thái của 5 màn hình Giai đoạn 2

Năm màn hình thuộc Giai đoạn 2 gồm:
- **Global Research:** `Video nổi bật`.
- **Project Research:** `Chủ đề nóng`, `Chủ đề dài hạn`, `Cơ hội nội dung`, `Nghiên cứu AI`.

**Quy tắc hành vi bắt buộc trong MVP V1:**
1. **Hiển thị đúng cấu trúc Sidebar 3 cấp:** Các mục Giai đoạn 2 hiển thị trong danh sách chức năng của khu vực đang chọn (`Tổng quan`: 1 mục *Video nổi bật*; `Dự án`: 4 mục *Chủ đề nóng*, *Chủ đề dài hạn*, *Cơ hội nội dung*, *Nghiên cứu AI*), kèm huy hiệu **`GĐ 2` / `Giai đoạn 2`** rõ ràng bên cạnh tên mục.
2. **Trang giới thiệu trung thực khi bấm vào:** Hiển thị rõ 4 thông tin:
   - Tên tính năng và mục tiêu dự kiến ở Giai đoạn 2.
   - Lý do chưa kích hoạt trong MVP V1 (ví dụ: *Nghiên cứu AI* chờ giai đoạn tích hợp LM Studio/Ollama; *Cơ hội nội dung / Chủ đề nóng / Chủ đề dài hạn / Video nổi bật* cần chuỗi phân tích nâng cao/Derived Metrics và điều kiện phê duyệt chính sách API hoặc hạ tầng phân tích ở Giai đoạn 2).
   - **Không** hiển thị số liệu mẫu giả lập, biểu đồ giả, thanh tiến độ giả hay công tắc kích hoạt ngầm.
   - Nút điều hướng nhanh sang màn hình MVP đang hoạt động liên quan (ví dụ từ *Video nổi bật* → *Khám phá xu hướng*; từ *Chủ đề nóng / Cơ hội nội dung* → *Nghiên cứu từ khóa* hoặc *Video bứt phá*).
3. **Không phát sinh tác vụ nền:** 5 màn hình này không chạy truy vấn API YouTube, không gọi AI và không ghi bảng lịch sử riêng trong MVP V1.

---

## 4. Quy trình sử dụng từ khám phá chủ đề đến lưu và triển khai ý tưởng

### Luồng 1 — Khám phá Global → Kho ý tưởng chung → Triển khai sang nhiều Project
1. Người dùng mở `G2. Khám phá xu hướng`, `G3. Nghiên cứu tự do` hoặc `G4. Tin tức & thảo luận` (RSS).
2. Dùng bộ lọc/sắp xếp hợp lệ để tìm ra video hoặc bài báo giàu tiềm năng.
3. Bấm **Lưu Ý tưởng** → Chọn lưu vào `G5. Kho ý tưởng chung` (hoặc gắn thẳng vào Project ngay lúc lưu).
4. Tại `Kho ý tưởng chung`, khi thấy một chủ đề phù hợp cho 2 kênh khác nhau (ví dụ *Project Kênh A — Phân tích sâu* và *Project Kênh B — Tin nhanh*), người dùng gắn **cùng 1 bản ý tưởng gốc đó** vào cả 2 Project với **2 góc khai thác riêng** mà không nhân bản dữ liệu gốc.

### Luồng 2 — Thêm đối thủ → Theo dõi → Sàng lọc Video bứt phá (Standard Mode) → Chốt Ý tưởng
1. Tại `P2. Theo dõi đối thủ` (hoặc từ kết quả ở `G2`/`G3`), người dùng dán URL/`@handle`/`channel_id` để gắn kênh đối thủ vào Project (1 unit phân giải kênh + ~2 units lấy 30–50 video gần nhất).
2. Hệ thống cập nhật video vào bảng dùng chung và liên kết với Project; tách riêng 3 trạng thái định dạng (`Video dài` / `Shorts` / `Chưa xác định`).
3. Tại `P3. Video bứt phá (Standard Mode)`, người dùng lọc video đăng trong `7` hoặc `14` ngày gần nhất, chọn riêng nhóm `Video dài` (hoặc `Shorts` / kiểm tra nhóm `Chưa xác định`), sắp xếp theo `viewCount` hoặc `likeCount` gốc, mở *Chi tiết Video* xem các mốc lượt xem theo timestamp (`<= 30 ngày`).
4. Người dùng bấm **Đánh dấu Bứt phá**, ghi chú góc học hỏi và bấm **Chuyển thành Ý tưởng Project** ở trạng thái `Mới lưu`.

### Luồng 3 — Nghiên cứu từ khóa + Đối chiếu RSS trong Project
1. Người dùng thêm bộ từ khóa trọng tâm vào `P4. Nghiên cứu từ khóa` và cài `regionCode` / `relevanceLanguage` trong `P6. Cài đặt dự án`.
2. Chủ động bấm **Quét YouTube** cho các từ khóa muốn khảo sát (xác nhận chi phí `Search Queries` trước khi chạy).
3. Xem danh sách video kết quả thực tế (số liệu gốc + `tags` từng video), đối chiếu cùng khung **Tín hiệu RSS của Project** để kiểm tra chủ đề có đang được báo chí/cộng đồng nhắc lại hay không, rồi lưu thành Ý tưởng hoặc thêm kênh mới nổi vào tệp đối thủ.

### Luồng 4 — Quản lý vòng đời Ý tưởng cho tới khi xuất bản
1. Trên `P5. Quản lý ý tưởng`, người dùng lọc và chọn đổi trạng thái từng ý tưởng trên bảng/danh sách cho riêng Project hiện tại: `Mới lưu → Đang nghiên cứu → Chốt làm → Đã sản xuất` (hoặc `Bỏ qua`).
2. Khi chuyển sang `Đã sản xuất`, người dùng có thể gắn thêm đường dẫn video đã đăng trên kênh của mình (`published_video_url`) để lưu vết lịch sử sản xuất hoàn toàn cục bộ.

---

## 5. Quản lý Project và dữ liệu dùng chung

- **Định hướng mở rộng đa nền tảng:**
  - **Project không bị gắn cứng với một nền tảng duy nhất:** Schema bảng `projects` độc lập với nền tảng; khi các phiên bản sau tích hợp thêm nền tảng, một Project có thể liên kết nội dung nghiên cứu từ nhiều nền tảng khác nhau.
  - **Tách biệt nguồn dữ liệu & dữ liệu người dùng:** Dữ liệu thu thập từ mỗi nền tảng (như `youtube_channels`, `youtube_videos`) và nguồn ngoài (`rss_articles`) phải phân biệt nguồn rõ ràng; còn Ý tưởng và ghi chú do người dùng tạo (`ideas`, `project_ideas`) luôn dùng chung được giữa các Project.
- **Một Dropdown Project duy nhất:** Hiển thị trong khu vực **`Dự án`** ở Sidebar (ngay phía trên 9 chức năng con của dự án), cho phép chọn Project đang hoạt động hoặc bấm `+` tạo Project mới; chuyển đổi qua lại giữa khu vực `Tổng quan` và `Dự án` vẫn bảo toàn Project đang chọn (`rs_last_project_id`).
- **Tách biệt rành mạch 3 tầng dữ liệu trong cùng 1 file SQLite `research_studio.db`:**

| Nhóm dữ liệu | Thực thể / Bảng khái niệm | Quy tắc `project_id` | Chu kỳ giữ dữ liệu |
|---|---|---|---|
| **1. Thực thể gốc dùng chung (`Global Canonical`)** | `youtube_channels`, `youtube_videos`, `youtube_video_snapshots` *(mốc thô)*, `search_sessions`, `rss_feeds`, `rss_articles`, `ideas` *(bản gốc ở Kho chung)*, `user_video_format_labels` *(nhãn định dạng thủ công cấp người dùng)* | **KHÔNG bắt buộc `project_id`** (`ideas` có thể gắn `origin_project_id` tùy chọn khi tạo trong Project nhưng quản lý liên kết qua bảng nối) | - **YouTube API Data (`channels`, `videos`, `snapshots`, `search_sessions`):** Tối đa **`30 ngày lịch`**.<br>- **RSS (`rss_feeds`, `rss_articles`):** Theo cấu hình cache RSS.<br>- **Dữ liệu người dùng (`ideas`, `user_video_format_labels`, `rss_feeds` danh sách đăng ký):** **Giữ vĩnh viễn**. |
| **2. Liên kết nhiều-nhiều (`Project Link`)** | `project_channels`, `project_videos`, `project_rss_feeds`, `project_ideas` | **Bắt buộc `project_id NOT NULL`** + khóa ngoại `ON DELETE CASCADE` + `UNIQUE(project_id, entity_id)` | **Giữ vĩnh viễn** theo Project (vì là dữ liệu quan hệ/đánh dấu/góc khai thác do người dùng tạo). Nếu `API Data` của video hết hạn và bị xóa phần API, liên kết ý tưởng/ghi chú/ID tham chiếu vẫn được bảo toàn. |
| **3. Dữ liệu riêng của Project (`Project-Owned`)** | `projects`, `project_keywords`, `project_video_notes` *(hoặc trường thuộc `project_videos`: `is_user_breakout`, ghi chú riêng)* | **Bắt buộc `project_id NOT NULL`** | **Giữ vĩnh viễn** cho tới khi chính người dùng sửa/xóa Project đó. |

- **Cô lập truy vấn & Ngăn ghi đè chéo khi đổi Project nhanh:**
  - Mọi API Project đều chứa `{project_id}` tường minh trên URL (`/api/v1/projects/{project_id}/...`); Backend tuyệt đối **không** lưu biến toàn cục `active_project_id`.
  - Khi người dùng đổi Project trên Dropdown, Frontend lập tức hủy request đang chờ của Project cũ bằng `AbortController` và gắn `project_id` vào khóa state/lịch sử điều hướng.

---

## 6. Theo dõi đối thủ và Video bứt phá ở Standard Mode

### 6.1. Cơ chế thêm & cập nhật Kênh đối thủ (tiết kiệm quota)
1. **Phân giải đầu vào kênh (`1 unit` `General Data API`):**
   - Nhập `UC...` (`channel_id`) hoặc URL `/channel/UC...` → gọi `channels.list(part="snippet,contentDetails,statistics", id=...)` (`1 unit`).
   - Nhập `@handle` hoặc URL `/@handle` → gọi `channels.list(part="snippet,contentDetails,statistics", forHandle=...)` (`1 unit`).
   - *(Không tự động gọi `search.list` ngầm nếu người dùng chỉ nhập URL/ID/@handle; chỉ dùng `search.list` khi người dùng chủ động tìm kênh theo tên ở màn hình tìm kiếm).*
2. **Lấy video mới của kênh (`~2 units` `General Data API` mỗi lần):**
   - Lấy `uploads` playlist ID từ `contentDetails.relatedPlaylists.uploads`.
   - Gọi `playlistItems.list(playlistId=..., maxResults=50)` (`1 unit` cho `30–50` video gần nhất).
   - Gom danh sách tối đa `50` `video_id` để gọi một lượt `videos.list(part="snippet,contentDetails,statistics,liveStreamingDetails,status", id=...)` (`1 unit`).
3. **Gộp chung khi nhiều Project theo dõi cùng 1 đối thủ:** Kênh chỉ lưu 1 bản ghi gốc trong `youtube_channels` và cập nhật 1 lần, không gọi lặp lại API theo từng Project.

### 6.2. Hành vi `Video bứt phá` ở Standard Mode (Quyết định Gate A — Phương án 1)
- **Mục tiêu thực tế:** Hỗ trợ người dùng phát hiện nhanh video thu hút vượt trội vừa đăng của các đối thủ bằng dữ liệu gốc trung thực, đồng thời tuân thủ nghiêm ngặt `YouTube Developer Policies III.E.2` & `III.E.4.h`.
- **Bảng phân định rành mạch tính năng tại màn hình `P3. Video bứt phá`:**

| Hạng mục | Có sẵn ngay trong MVP (Standard Mode) | Chưa khả dụng (Chờ YouTube Policy / Derived Metrics Approval) |
|---|---|---|
| **Phạm vi video** | Video mới đăng (`3 / 7 / 14 / 30 ngày` hoặc tùy chỉnh `<= 30 ngày`) từ các kênh đối thủ của Project | Dữ liệu video ngoài hạn `30 ngày` không còn được làm mới |
| **Phân tách định dạng** | Lọc tách biệt 3 trạng thái nguồn (`Video dài`, `Shorts`, `Chưa xác định`) + lọc theo `Nhãn thủ công`; không gộp `Chưa xác định` vào `Video dài`/`Shorts` | Thống kê trung vị so sánh riêng từng định dạng trên toàn kênh |
| **Số liệu & Sắp xếp** | Hiển thị & sắp xếp trực tiếp trên trường API gốc: `viewCount`, `likeCount`, `commentCount`, `publishedAt`, `duration` | `Outlier Multiplier` (`x` lần trung vị kênh), `Channel Median`, `Views/ngày`, `Engagement Rate`, điểm tổng hợp `API Data` |
| **Theo dõi đà xem** | Hiển thị bảng/danh sách **các mốc `viewCount` thô đã thu thập trong vòng `<= 30 ngày`** kèm đúng timestamp thu thập (`III.E.4.f`) | Lưu chuỗi snapshot & biểu đồ tăng trưởng quá `30 ngày` (lên tới `36 tháng`) hoặc tính vận tốc tăng trưởng dẫn xuất |
| **Đánh giá của người dùng** | Gắn cờ **Đánh dấu Bứt phá thủ công** + viết nhận xét riêng cho Project (lưu vĩnh viễn) + chuyển thẳng sang Ý tưởng Project | Xếp hạng tự động đa kênh không cùng Content Owner |

- **Tuân thủ nguyên tắc không làm thừa:** Không viết module ẩn, không tạo schema cho `Outlier Multiplier` hay công tắc mở khóa nâng cao chưa dùng trong MVP V1.

---

## 7. Tìm kiếm, khám phá xu hướng và nghiên cứu từ khóa

1. **Khám phá xu hướng (`G2`):**
   - Dùng `videos.list(part="snippet,contentDetails,statistics,liveStreamingDetails", chart="mostPopular", regionCode=..., videoCategoryId=..., maxResults=50)`.
   - Chi phí: `1 unit` trong bucket `General Data API` (không tốn `Search Queries`).
   - Hỗ trợ lấy danh mục hợp lệ từ `videoCategories.list(regionCode=...)` (`1 unit`) và lưu cache danh mục ngắn hạn.
2. **Nghiên cứu tự do (`G3`) & Nghiên cứu từ khóa (`P4`):**
   - **Chỉ chạy khi người dùng chủ động kích hoạt** (tìm mới, quét từ khóa, hoặc bấm Tải thêm trang).
   - **Quy trình 2 bước mỗi lần quét Video:**
     - Bước 1: `search.list` (`maxResults` mặc định `25` hoặc `50` — `TUNING REQUIRED`) tốn **`1 lượt` `Search Queries`**.
     - Bước 2: Lấy tập `videoId` hoặc `channelId` từ kết quả để gọi một lô `videos.list` hoặc `channels.list` (`1 unit` `General Data API`) nhằm lấy đầy đủ `duration`, `viewCount`, `likeCount`, `commentCount`, `tags`, `publishedAt`, `liveStreamingDetails`.
   - **Tái sử dụng kết quả local:** Nếu từ khóa đó đã có kết quả lưu trong SQLite chưa hết hạn `30 ngày`, hệ thống mặc định mở lại từ SQLite (`0` quota) kèm nhãn thời điểm cập nhật; chỉ gọi API lại khi người dùng bấm **Làm mới / Quét lại**.
   - **Không tạo số liệu giả hoặc chỉ số dẫn xuất từ API:**
     - Không hiển thị Search Volume giả.
     - Tại `P4. Nghiên cứu từ khóa`, chỉ hiển thị kết quả thực tế với trường gốc của YouTube + danh sách `snippet.tags` gốc trên từng video (nhận diện nguồn YouTube rõ ràng), và hiển thị riêng biệt một khung **Tín hiệu từ nguồn RSS của Project** (`Nguồn: RSS — Dữ liệu ngoài YouTube`) để thống kê tần suất từ khóa trên bài báo RSS bằng Python.

---

## 8. Thu thập và quản lý nguồn RSS

- **Phạm vi nguồn:** Nguồn RSS 2.0 và Atom 1.0 công khai hợp lệ do người dùng thêm/bật trong *Cài đặt RSS toàn cục* (hoặc liên kết vào Project ở *Cài đặt dự án*). Hỗ trợ tùy chọn nạp bộ danh sách gợi ý RSS mẫu ở trạng thái tắt/cho người dùng tự chọn thêm, không tự bật ngầm khi cài đặt.
- **Thu thập & Làm sạch an toàn:**
  - Chỉ hỗ trợ giao thức `https://` hoặc `http://`; hỗ trợ chuẩn hóa URL & đọc bằng HTTP Client có `timeout` tường minh và `User-Agent` rõ ràng (tránh XXE bằng parser XML an toàn không giải quyết external entities, giới hạn kích thước XML tối đa — `TUNING REQUIRED`).
  - Lọc bỏ toàn bộ thẻ HTML nguy hiểm/script/style từ `summary`/`content` của feed để lưu và hiển thị dạng văn bản thuần an toàn trên React (cấm `dangerouslySetInnerHTML`).
- **Khử trùng lặp (`Deduplication`):** Khóa tự nhiên ưu tiên `guid` chuẩn hóa (nếu có và gắn với `feed_id`) hoặc `canonical_url` chuẩn hóa của bài viết kết hợp ràng buộc `UNIQUE` và thao tác `UPSERT`. Một bài báo toàn cục chỉ lưu 1 bản chuẩn, có thể lọc xem ở Global hoặc qua danh sách nguồn liên kết của nhiều Project.
- **Cô lập nguồn lỗi:** Lỗi timeout, HTTP `4xx/5xx` hoặc XML hỏng của 1 feed chỉ ghi lỗi (`last_error_code`, `last_error_message`, `last_error_at`) trên đúng feed đó, tuyệt đối không làm dừng các feed hợp lệ khác.
- **Gắn nhãn tách biệt:** Mọi bài viết và bảng thống kê cụm từ RSS phải gắn rõ nhãn **`Nguồn: RSS (Dữ liệu ngoài YouTube)`** để tuân thủ `Developer Policies III.E.4.h` và `III.F.2`.

---

## 9. Cơ chế 2 bucket quota của YouTube API

Dựa trên tài liệu chính thức [YouTube Data API Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost) (cập nhật `2026-11-12 UTC`):

| Bucket | Các endpoint áp dụng trong Research Studio V1 | Hạn mức ngày mặc định | Chi phí mỗi lượt gọi | Múi giờ reset | Chế độ kích hoạt cho phép |
|---|---|---|---|---|---|
| **`Search Queries`** | `search.list` | **`100` lượt/ngày** | **`1 unit / lượt`** (kể cả trang kế tiếp qua `pageToken` và gọi lỗi) | `00:00` Pacific Time (`America/Los_Angeles`) | **100% Thủ công theo yêu cầu người dùng** (cấm chạy nền tự động) |
| **`General Data API`** | `videos.list`, `channels.list`, `playlistItems.list`, `videoCategories.list`, `i18nRegions.list`, `i18nLanguages.list` | **`10.000` units/ngày** | **`1 unit / lượt`** (ưu tiên gộp lô tối đa 50 ID/lượt; gọi lỗi vẫn tốn `>= 1` unit) | `00:00` Pacific Time (`America/Los_Angeles`) | Thủ công + Tác vụ làm mới tự động có kiểm soát (nếu người dùng bật) |

- **Quy tắc Quota Ledger trên Backend:**
  - Mọi request gửi sang YouTube Data API (bao gồm cả request trả HTTP lỗi `4xx`/`5xx` sau khi chạm máy chủ Google) phải ghi 1 dòng nhật ký vào sổ cái theo **ngày PT hiện hành (`YYYY-MM-DD` theo `America/Los_Angeles`)** và đúng cột bucket (`search_queries` hoặc `general_data`).
  - **Ngưỡng cảnh báo & Chặn an toàn (`TUNING REQUIRED`):**
    - Mặc định cảnh báo vàng trên UI khi bucket chạm **`80%`** (`80/100` `Search Queries` hoặc `8.000/10.000` `General Data API`).
    - Tác vụ tự động (nếu bật) bắt buộc dừng trước khi vượt **trần quota tự động ngày** (ví dụ mặc định không dùng quá `30%` bucket `General Data API` cho tự động và dùng `0` lượt `Search Queries`) và dừng ngay nếu `General Data API` chạm ngưỡng an toàn cấu hình.
  - **Đồng bộ thực tế khi gặp `403 quotaExceeded`:** Nếu Google API trả mã `quotaExceeded` / `dailyLimitExceeded`, Backend phải đánh dấu bucket tương ứng đang ở trạng thái **cạn hạn mức tới mốc reset `00:00 PT`**, dừng ngay các lệnh gọi tiếp theo thuộc bucket đó và hiển thị rõ thời gian ước tính đặt lại theo giờ Việt Nam (`UTC+7`).
  - **Minh bạch sổ cái cục bộ:** Hiển thị ghi chú rõ trên UI rằng con số hiển thị là **ước tính theo các lệnh gọi từ máy này** (vì nếu người dùng dùng chung một API Key trên ứng dụng khác, tổng tiêu thụ thực tế trên Google Cloud Console có thể cao hơn).

---

## 10. Phân loại Video dài / Shorts / Chưa xác định

Dựa trên tài liệu chính thức [Understand three-minute YouTube Shorts](https://support.google.com/youtube/answer/15424877) và giới hạn thực tế của YouTube Data API v3 (`videos.list` không cung cấp thuộc tính boolean `isShort` chuẩn cho mọi video):

### 10.1. Phân tách 3 lớp dữ liệu định dạng bắt buộc
Mỗi video trong cơ sở dữ liệu và trên UI phải tách biệt rõ 3 lớp thông tin (tuyệt đối không trộn thành 1 trường mơ hồ):

1. **Lớp 1 — Định dạng xác minh từ nguồn (`source_format_status`):**
   - **`long_form` (`Video dài — Xác minh`):** Áp dụng khi thỏa ít nhất một điều kiện xác định:
     - `duration_seconds > 180` (và không phải live broadcast chưa kết thúc/không xác định thời lượng). Theo tài liệu YouTube, độ dài tối đa của Shorts hiện nay là 3 phút (`180 giây`), nên video `> 180 giây` chắc chắn không phải Shorts.
     - *(Ghi chú trường hợp lịch sử)* Theo tài liệu YouTube (`answer/15424877`), đối với kênh YouTube tiêu chuẩn (`Standard YouTube channels`), các video `> 60 giây` đăng **trước `15/10/2024`** được xếp là video dài; tuy nhiên vì `videos.list` không có cờ khẳng định một kênh là *Standard Channel* hay *Official Artist Channel* (mốc `08/12/2025`), quy tắc mốc thời gian `61–180s` trước `15/10/2024` chỉ được xem là **Gợi ý có điều kiện (Lớp 2)** trừ khi không có ngoại lệ kênh nghệ sĩ, **không** gán mù quáng thành xác định tuyệt đối nếu chưa đủ căn cứ kênh.
   - **`shorts` (`Shorts — Xác minh`):** Chỉ gán khi có thuộc tính/nguồn xác minh trực tiếp đáng tin cậy từ API chính thức (nếu API không cung cấp cho video đó thì **không tự gán `shorts`** chỉ bằng thời lượng).
   - **`unknown` (`Chưa xác định`):** Mặc định cho mọi video có `duration_seconds <= 180` (hoặc thiếu thời lượng như livestream đang phát) khi chưa có xác minh tỷ lệ khung hình/định dạng từ API.

2. **Lớp 2 — Gợi ý suy đoán phụ trợ (`format_hint`, `format_hint_confidence`, `format_hint_basis`):** *(Quyết định Gate A — Phương án 1)*
   - Hệ thống **có thể** tính thêm gợi ý tham khảo cho video thuộc nhóm `Chưa xác định`, bắt buộc hiển thị đồng thời **3 thành phần**: nhãn gợi ý + **mức độ tin cậy** + **nguồn căn cứ cụ thể**:
     - Ví dụ 1 (`duration <= 180s` và chứa `#shorts` / `#short` trong tiêu đề, mô tả hoặc `tags`): Gợi ý `Có thể là Shorts` · Độ tin cậy: `Thấp–Trung bình` · Căn cứ: *Từ khóa `#shorts` do người đăng tự gắn trong metadata + thời lượng `<= 180s` (lưu ý metadata không đảm bảo tỷ lệ khung hình dọc/vuông)*.
     - Ví dụ 2 (`61s <= duration <= 180s` và `publishedAt < 2024-10-15T00:00:00Z`): Gợi ý `Nhiều khả năng là Video dài` · Độ tin cậy: `Trung bình–Cao` · Căn cứ: *Đăng trước mốc 15/10/2024 khi YouTube hỗ trợ Shorts 3 phút cho kênh thường ([YouTube Help #15424877](https://support.google.com/youtube/answer/15424877); ngoại lệ nếu là Official Artist Channel trước 08/12/2025)*.
   - **Tuyệt đối không dùng HTTP scraping trang YouTube/Shorts (`youtube.com/shorts/{id}`) trong background** để đoán định dạng vì vi phạm quy định cấm scraping (`Developer Policies III.E.5`).

3. **Lớp 3 — Nhãn xác nhận thủ công của người dùng (`user_format_label`):** *(Quyết định Gate A — Phương án 1)*
   - Cho phép người dùng tự gắn hoặc chỉnh nhãn thủ công cho bất kỳ video nào (`Video dài (Thủ công)`, `Shorts (Thủ công)`, hoặc `Xóa nhãn thủ công`), lưu vĩnh viễn như `User-Created Data`.
   - **Quy tắc hiển thị phân biệt:** Giao diện phải hiển thị khác biệt rõ ràng giữa biểu tượng/huy hiệu **`Xác minh từ nguồn`** với huy hiệu **`Nhãn thủ công của bạn`**; nhãn thủ công **không** được ghi đè lên trường `source_format_status`.

### 10.2. Quy tắc bảo toàn thống kê
- Video ở trạng thái `source_format_status = unknown` **tuyệt đối không** được tự động cộng vào nhóm thống kê/đếm số lượng của `Video dài` hay `Shorts` (kể cả trên `P1. Tổng quan dự án`, `P2. Theo dõi đối thủ` hay `P3. Video bứt phá`). Nhóm `Chưa xác định` luôn có mục đếm và bộ lọc độc lập; nếu người dùng muốn lọc gộp *Nhãn thủ công*, phải bật rõ tùy chọn bộ lọc *"Bao gồm nhãn thủ công của tôi"* chứ không gộp ngầm.

---

## 11. Làm mới dữ liệu, cache, giới hạn lưu trữ và xử lý dữ liệu quá hạn theo chính sách

### 11.1. Cơ chế Tự động Làm mới có kiểm soát khi app đang mở (Quyết định Gate A — Phương án 1)
- **Điều kiện hoạt động:** Chỉ chạy trong tiến trình FastAPI (`lifespan` + `asyncio`) **khi người dùng đang mở ứng dụng** và đã bật công tắc **Tự động làm mới (`auto_refresh_enabled`)** (tùy chọn bật/tắt rõ ràng ngay trong *Cài đặt hệ thống chung* và nút tạm dừng nhanh trên thanh trạng thái). Không tạo Windows Service chạy ngầm sau khi tắt app.
- **Chống làm mới ồ ạt khi khởi động:**
  - Khi mở ứng dụng, UI tải ngay lập tức dữ liệu đang có từ SQLite local (`< 1s`), **không** đồng loạt bắn request cho toàn bộ kênh/video/RSS.
  - Bộ lập lịch chờ hết khoảng trễ khởi động an toàn (`TUNING REQUIRED`, mặc định `30 giây`) rồi mới kiểm tra các nguồn thực sự đến hạn theo chu kỳ tối thiểu (`refresh_interval_hours`, mặc định dự kiến `12 giờ` cho kênh đối thủ và `4–6 giờ` cho RSS — `TUNING REQUIRED`).
- **Giới hạn & Hàng rào bảo vệ theo từng đợt:**
  - **Mỗi đợt làm mới (`batch cap` — `TUNING REQUIRED`):** Giới hạn số lượt gọi API YouTube tối đa mỗi đợt (ví dụ mặc định `<= 15 units/đợt` và tối đa `1` lượt chạy tự động trong một khoảng giãn cách ngắn) + tách nhỏ RSS song song có giới hạn concurrency (ví dụ `<= 3` nguồn đồng thời).
  - **Trần quota tự động hàng ngày (`auto_refresh_daily_quota_cap` — `TUNING REQUIRED`):** Mặc định không tiêu thụ quá `3.000 units/ngày` (`30%` của `10.000` `General Data API`), tự động dừng hoàn toàn tác vụ nền nếu tổng quota ngày của `General Data API` chạm ngưỡng cảnh báo cấu hình (mặc định `80%`). **Tác vụ tự động tiêu thụ `0` lượt `Search Queries` (`search.list`).**
- **Thứ tự ưu tiên khi làm mới tự động dữ liệu YouTube API:**
  1. **Ưu tiên 1 — Video có liên kết Ý tưởng (hoặc được đánh dấu quan tâm) sắp hết hạn 30 ngày** (ví dụ tuổi cache `>= 25 ngày`): gom thành từng lô tối đa **50 `video_id`** gọi qua `videos.list` (`1 unit / 50 video`) để gia hạn hợp lệ 30 ngày tiếp theo.
  2. **Ưu tiên 2 — Kênh đối thủ đang bật theo dõi** (có ngày kiểm tra cũ nhất hoặc sắp chạm hạn `30 ngày`): mỗi kênh gọi cập nhật `channels.list` + `playlistItems.list` + `videos.list` (gộp chung 1 lần cho mọi Project cùng theo dõi kênh đó).
  3. **Ưu tiên 3 — Video xu hướng / phiên tìm kiếm đã lưu sắp quá hạn 30 ngày:** **Không** tự động làm mới lại `search.list`; chỉ để tự hết hạn và xóa phần `API Data` quá 30 ngày theo chính sách (trừ video nào đã được người dùng lưu vào Ý tưởng/đối thủ thuộc Ưu tiên 1 & 2).
- **Khử trùng lặp lời gọi (No Duplicate Calls):**
  - Mọi cập nhật thực hiện trên bản ghi thực thể gốc (`youtube_channels`, `youtube_videos`, `rss_feeds`) trước khi phân chiếu sang các Project.
  - Có khóa chống chạy chồng chéo (`in-flight lock`) giữa làm mới tự động và làm mới thủ công cho cùng 1 kênh/feed/lô video.

### 11.2. Chính sách Lưu trữ `30 ngày lịch` & Xử lý dữ liệu quá hạn (`Developer Policies III.E.4`)
- **Mốc hết hạn chuẩn (`TTL = 30 calendar days`):** Mọi bản ghi `YouTube API Data` (`youtube_channels`, `youtube_videos`, `youtube_video_snapshots`, `search_sessions`) bắt buộc lưu trường `api_fetched_at` (UTC) và `api_expires_at = api_fetched_at + 30 days`.
- **Dọn dẹp & xử lý khi `API Data` quá 30 ngày không thể làm mới:**
  - Bộ dọn dẹp chạy định kỳ khi mở app và trước khi truy vấn dữ liệu hiển thị:
    - Nếu video/kênh quá 30 ngày không thể làm mới (do người dùng tắt tự động làm mới, mất mạng lâu ngày, hết quota, hoặc video/kênh trả về `404` / đã xóa / chuyển riêng tư trên YouTube):
    - **Xóa sạch phần `YouTube API Data` hết hạn:** xóa `title`, `description`, `thumbnails`, `tags`, `viewCount`, `likeCount`, `commentCount`, `subscriberCount`, `duration` của bản ghi YouTube hết hạn và xóa mọi dòng `youtube_video_snapshots` có `captured_at` quá `30 ngày lịch`, **hoặc** xóa hẳn dòng cache trong `search_sessions`/`youtube_videos` nếu không còn thực thể người dùng nào tham chiếu.
- **Bảo toàn 100% Dữ liệu do người dùng tự tạo (User-Created Data):**
  - **Không bao giờ xóa** `projects`, `ideas` (tiêu đề/nội dung ý tưởng tự viết, liên kết tới `youtube_video_id` hoặc URL tham chiếu ngoài, thẻ cá nhân), `project_ideas` (góc khai thác, ghi chú, 5 trạng thái), `project_keywords`, `project_channels` ghi chú đối thủ, `user_format_labels`, `is_user_breakout`, hay cài đặt nguồn RSS.
  - Khi phần `API Data` của một video gắn với Ý tưởng đã quá hạn và bị xóa theo quy tắc 30 ngày (hoặc người dùng bấm "Xóa cache YouTube API"), Ý tưởng đó vẫn tồn tại nguyên vẹn với tiêu đề/ghi chú của người dùng, `video_id`/URL tham chiếu ngoài và trạng thái hiển thị rõ: *"Dữ liệu chi tiết từ YouTube API đã hết hạn lưu trữ 30 ngày — bấm Làm mới để tải lại thông tin hiện tại từ YouTube (1 unit)"*.

---

## 12. Quản lý ý tưởng và 5 trạng thái theo từng Project

- **Cấu trúc ý tưởng gốc + liên kết đa Project:**
  - Mỗi ý tưởng chuẩn lưu tại `ideas` (`title`, `summary/notes`, `source_type`: `manual | youtube_video | rss_article | keyword`, `source_ref_id`, `source_url`, `tags`, `created_at`, `updated_at`).
  - Có thể tạo từ Global (nằm trong *Kho ý tưởng chung* với `in_global_vault = 1`) hoặc tạo trực tiếp trong 1 Project (chọn đồng thời có đưa vào *Kho chung* hay chỉ giữ riêng trong Project đó).
  - Bảng `project_ideas` lưu liên kết tới từng Project (`project_id`, `idea_id`, `status`, `priority`, `project_angle`, `project_notes`, `published_video_url`, `status_updated_at`).
- **5 trạng thái độc lập cho mỗi `(project_id, idea_id)`:**
  1. **`new` (`Mới lưu`):** Vừa lưu từ khám phá hoặc vừa viết nháp, chưa đánh giá sâu.
  2. **`researching` (`Đang nghiên cứu`):** Đang thu thập thêm đối thủ, từ khóa, bài báo hoặc phác thảo dàn ý.
  3. **`approved` (`Chốt làm`):** Đã duyệt chủ đề & góc khai thác, sẵn sàng đưa vào lịch quay/sản xuất cho kênh của Project.
  4. **`produced` (`Đã sản xuất`):** Đã hoàn thành hoặc xuất bản video cho Project (cho phép đính kèm `published_video_url`).
  5. **`skipped` (`Bỏ qua`):** Không phù hợp với Project này tại thời điểm hiện tại (vẫn giữ lịch sử để tránh lặp lại hoặc có thể mở lại sau; hoàn toàn không ảnh hưởng trạng thái của cùng ý tưởng đó ở Project khác).
- **Quy tắc chuyển trạng thái:** Cho phép chuyển linh hoạt qua lại giữa cả 5 trạng thái (ví dụ từ `Bỏ qua` khôi phục về `Đang nghiên cứu`) ngay trên giao diện Danh sách / Bảng dữ liệu hoặc trang Chi tiết Ý tưởng, ghi nhận `status_updated_at` ngay lập tức xuống SQLite.

---

## 13. Các trường hợp thiếu API Key, mất Internet, hết quota, dữ liệu rỗng và nguồn RSS lỗi

| Tình huống | Hành vi hệ thống & Khả năng sử dụng tiếp | Thông điệp trên UI & Hành động khắc phục |
|---|---|---|
| **1. Thiếu hoặc sai YouTube API Key** | - Toàn bộ phân khu **RSS (`G4`)**, **Kho ý tưởng (`G5`)**, **Quản lý ý tưởng (`P5`)**, **Cài đặt (`P6`)**, và dữ liệu local đã lưu còn trong hạn `<= 30 ngày` hoạt động **100% bình thường**.<br>- Chặn gọi YouTube API để không tốn thử sai; trả lỗi mã chuẩn `YOUTUBE_API_KEY_MISSING` hoặc `YOUTUBE_API_KEY_INVALID`. | Hiển thị banner/empty-state rõ ràng: chưa có hoặc sai API Key, kèm nút **Mở Cài đặt API Key** để dán và kiểm tra khóa mới. |
| **2. Mất Internet / Timeout mạng** | - Mở app tức thì bằng dữ liệu SQLite local còn hạn; xem, lọc, sắp xếp, gắn nhãn thủ công, quản lý Project/Ý tưởng/Từ khóa hoạt động bình thường.<br>- Request ra ngoài bị timeout (`10s` kết nối / `20s` đọc — `TUNING REQUIRED`), chỉ retry giới hạn các lỗi tạm thời trên lượt gọi đọc idempotent. | Hiển thị huy hiệu **Ngoại tuyến / Mất kết nối mạng**; không xóa hay làm hỏng dữ liệu local đang có; cung cấp nút **Thử lại** khi có mạng lại và nút **Hủy** trong lúc đang chờ request. |
| **3. Hết Quota YouTube API** | - Phân biệt rõ **Bucket nào hết** (`Search Queries` hết `100/100` vs. `General Data API` hết `10.000/10.000`).<br>- Nếu hết `Search Queries` (`G3`, `P4`), các chức năng thuộc `General Data API` (`G2. Xu hướng`, `P2. Cập nhật kênh đối thủ` đã có ID) vẫn chạy bình thường.<br>- Tự động dừng tác vụ làm mới nền. | Thông báo chính xác bucket đã chạm hạn mức hoặc nhận `403 quotaExceeded`, hiển thị giờ ước tính reset (`00:00 PT` quy đổi sang giờ địa phương), và cho phép tiếp tục làm việc trên dữ liệu local đã lưu. |
| **4. Dữ liệu rỗng (Empty State)** | - Chưa có Project nào: màn hình `P1–P6` hiện nút tạo Project đầu tiên.<br>- Project mới chưa có đối thủ/từ khóa/ý tưởng, hoặc video mới không khớp bộ lọc, hoặc dữ liệu API cũ đã quá 30 ngày bị dọn sạch: không báo lỗi giả, không hiện bảng trống trơn khó hiểu. | Hiển thị hướng dẫn cụ thể theo ngữ cảnh (ví dụ *"Thêm kênh đối thủ đầu tiên"* hoặc *"Nới lỏng bộ lọc / Bấm Quét YouTube"*), kèm nút **Xóa bộ lọc** khi do filter quá chặt. |
| **5. Nguồn RSS lỗi / XML hỏng** | - Cô lập hoàn toàn từng `feed_id`: chỉ feed lỗi bị đánh dấu trạng thái lỗi, các feed RSS còn lại vẫn nạp và hiển thị bài viết mới bình thường; giữ nguyên bài cũ đã lưu của feed đó. | Hiển thị biểu tượng cảnh báo kèm mã lỗi/lý do (VD: HTTP `404`, `Timeout`, `XML không hợp lệ`) và thời điểm lỗi cuối ngay cạnh nguồn RSS đó, kèm nút **Thử lại nguồn này** hoặc **Sửa URL / Tạm tắt**. |

---

## 14. Yêu cầu điều hướng Back/Forward và khôi phục trạng thái

- **Hỗ trợ điều hướng kiểu trình duyệt desktop:**
  - Thanh công cụ đầu ứng dụng có 2 nút **`← Quay lại (Back)`** và **`→ Tiến tới (Forward)`** (đồng bộ với `history.pushState`/`popstate` hoặc history stack chuẩn của SPA để phím tắt trình duyệt `Alt+←` / `Alt+→` và nút hông chuột Back/Forward hoạt động đồng bộ).
- **Phạm vi ghi nhớ theo từng mục lịch sử (History Entry):**
  1. Đường dẫn màn hình hiện tại (Global hay Project, màn hình danh sách hay trang chi tiết cấp 2/3) và `project_id` tương ứng của mục lịch sử đó (khi Back về màn hình Project A từ Project B, Dropdown tự chuyển đồng bộ về Project A trước khi tải dữ liệu).
  2. Toàn bộ bộ lọc đang chọn (`searchQuery`, `regionCode`, `formatFilter`, `includeManualLabels`, `dateRange`, `channelIds`, `statusFilter`, `tagFilter`...).
  3. Tiêu chí & chiều sắp xếp (`sortBy`, `sortOrder`).
  4. Tab đang mở (nếu màn hình có tab), trang/số lượng bản ghi đã nạp và **vị trí cuộn (`scrollTop`)** của vùng nội dung chính.
- **Điều kiện khôi phục chính xác:** Khi nhấn Back/Forward, khôi phục bộ lọc/sắp xếp trước khi render dữ liệu từ cache/SQLite, và chỉ khôi phục `scrollTop` sau khi danh sách thực tế đã render xong chiều cao DOM (không nhảy cuộn về đầu trang `0`).

---

## 15. Yêu cầu giao diện cơ bản theo phong cách VOXLAB, Light/Dark Mode

> Mô tả khung hành vi và định hướng giao diện đủ rõ cho bước thiết kế chi tiết tại **Phase 6 (`GATE D`)** mà không viết trước CSS/mã giao diện trong SPEC.

- **Tham chiếu thiết kế:** Dựa theo phong cách trực quan của repo [VOXLAB](https://github.com/lucnguyen911/VOXLAB.git) (chỉ làm tham chiếu; tuyệt đối không chỉnh sửa repo VOXLAB).
- **Bố cục tổng thể Desktop-First (chuẩn VOXLAB):**
  - **Thanh tiêu đề trên cùng (`TopBar` toàn chiều rộng, `46px`):** Góc trái là biểu tượng + chữ `RESEARCH STUDIO` (bấm về trang Tổng quan); góc phải là viên trạng thái Hạn mức/Kết nối, nút chọn ngôn ngữ (`Tiếng Việt` / `English`), và nút chuyển nhanh `Light / Dark Mode`.
  - **Sidebar bên trái (`240px` mở rộng / `64px` thu gọn) theo 3 cấp (`Nền tảng → Khu vực → Chức năng`):**
    1. **Dropdown Nền tảng:** `YouTube` (mặc định · hoạt động); `TikTok`, `Facebook`, `Instagram`, `X` ở trạng thái vô hiệu hóa (`Sắp ra mắt`).
    2. **Thanh chuyển Khu vực (`Tổng quan` | `Dự án`):** Nhấn `Tổng quan` mở thẳng `G1. Tổng quan`; nhấn `Dự án` mở thẳng `P1. Tổng quan dự án` — chỉ hiển thị danh sách chức năng của khu vực đang chọn (không lặp lại mục con Tổng quan / Tổng quan dự án). Khi chọn `Tổng quan`: hiển thị `5` chức năng con (`Khám phá xu hướng`, `Nghiên cứu tự do`, `Video nổi bật [GĐ 2]`, `Tin tức & thảo luận`, `Kho ý tưởng chung`). Khi chọn `Dự án`: hiển thị **1 dropdown chọn/tạo Project duy nhất** và `9` chức năng con (`Chủ đề nóng [GĐ 2]`, `Nghiên cứu từ khóa`, `Video bứt phá`, `Theo dõi đối thủ`, `Chủ đề dài hạn [GĐ 2]`, `Cơ hội nội dung [GĐ 2]`, `Nghiên cứu AI [GĐ 2]`, `Quản lý ý tưởng`, `Cài đặt dự án`).
    3. **Khu vực tiện ích & thu gọn:** Nút truy cập **`Cài đặt`** bên dưới đường phân cách và nút thu gọn/mở rộng Sidebar ở đáy cột.
  - **Khung làm việc bo góc nổi trên nền chassis (`Workspace Frame`):** Phần đầu khung có thanh ngữ cảnh gọn gồm nút `Back` / `Forward` và **Breadcrumb 3 cấp**; bên dưới là vùng nội dung chính với chữ `Inter`, bảng dữ liệu và thẻ thông tin thống nhất hành vi, rõ ràng giữa **Dữ liệu YouTube API**, **Dữ liệu RSS ngoài YouTube**, và **Dữ liệu / Nhãn thủ công của người dùng**.
- **Chủ đề & Tương phản bắt buộc:**
  - **Light Mode:** Tông Kem (Cream), Nâu cát (Sand Brown) và Vàng hổ phách (Amber Gold).
  - **Dark Mode:** Tông Đen Obsidian, Nâu tối và Vàng kim (Metallic Gold).
  - Độ tương phản chữ ở cả hai chế độ đạt tối thiểu **WCAG 2.1 AA (`>= 4.5:1` chữ thường, `>= 3:1` chữ lớn/viền nút/biểu tượng tương tác)**.
- **Bàn giao sang Phase 6 (`GATE D`):** Chi tiết token màu, spacing, component mockup và chạy Stitch (khi khả dụng) cùng prototype kiểm duyệt sẽ được thực hiện và phê duyệt tại `GATE D`.

---

## 16. Chính sách bảo mật API Key, quyền riêng tư và công bố nguồn dữ liệu

### 16.1. Bảo mật & Xử lý cục bộ
- **Bảo vệ API Key:** YouTube Data API Key do người dùng tự nhập được Backend mã hóa at-rest bằng **Windows DPAPI** (`CryptProtectData` / `CryptUnprotectData` qua `ctypes` chuẩn), lưu cục bộ trong thư mục dữ liệu người dùng; không lưu plaintext trong repo, SQLite export hay `VITE_*`; endpoint đọc cấu hình chỉ trả chuỗi đã che (`masked`).
- **Tách biệt mạng & An toàn đầu ra:** Frontend chỉ gọi tới Backend (`127.0.0.1`). Backend lọc sạch tham số `key=...` khỏi mọi dòng log (`Log Redaction`), làm sạch văn bản RSS/YouTube tránh XSS, kiểm tra giao thức `https://`/`http://` khi mở liên kết ngoài và chống XXE khi parse XML RSS, chống Path Traversal khi xuất file Project.
- **0% Telemetry / Local-First:** Không gửi thông tin người dùng, lịch sử tìm kiếm, từ khóa, đối thủ hay ý tưởng ra bất kỳ máy chủ nào ngoài các truy vấn trực tiếp tới Google/YouTube API và các URL nguồn RSS mà chính người dùng đã chọn/cấu hình. Không chèn quảng cáo bên thứ ba.

### 16.2. Tuân thủ Điều khoản sử dụng, Quyền riêng tư & Nhận diện thương hiệu YouTube
Theo tài liệu chính thức [YouTube API Services Developer Policies (III.A.1–2, III.E.4.g–h, III.F.2)](https://developers.google.com/youtube/terms/developer-policies) và [YouTube Branding Guidelines](https://developers.google.com/youtube/terms/branding-guidelines):

1. **Điều khoản sử dụng (`Developer Policies III.A.1`):**
   - Trong ứng dụng (mục *Điều khoản sử dụng & Pháp lý* và thông báo kích hoạt YouTube API lần đầu), hiển thị rõ liên kết tới **YouTube Terms of Service** (`https://www.youtube.com/t/terms`) và tuyên bố rõ trong Điều khoản sử dụng của Research Studio rằng khi sử dụng các tính năng kết nối YouTube, người dùng đồng ý chịu sự ràng buộc của YouTube Terms of Service.
2. **Chính sách Quyền riêng tư (`Developer Policies III.A.2` & `III.E.4.g`):**
   - Trước khi người dùng sử dụng các tính năng truy cập YouTube API lần đầu (màn hình/hộp thoại đồng ý lần đầu khi nhập API Key), yêu cầu người dùng đọc và xác nhận **Chính sách Quyền riêng tư** của Research Studio; chính sách này luôn hiển thị nổi bật và mở được từ mọi lúc ở menu Pháp lý/Cài đặt.
   - Nội dung Chính sách Quyền riêng tư công bố minh bạch:
     - Thông báo rõ ứng dụng sử dụng **YouTube API Services**.
     - Dẫn liên kết tới **Google Privacy Policy** (`https://policies.google.com/privacy` — tham chiếu chính thức từ `http://www.google.com/policies/privacy`).
     - Giải thích rõ phạm vi dữ liệu cục bộ: Research Studio chỉ truy cập `Non-Authorized Data` công khai qua YouTube Data API v3 theo yêu cầu của người dùng, lưu cục bộ trên máy tính người dùng (tối đa `30 ngày lịch` cho `API Data`), không chia sẻ ra bên thứ ba, không dùng quảng cáo hay cookie theo dõi bên thứ ba.
     - Cung cấp nút **Xóa toàn bộ dữ liệu YouTube API đã lưu** (thực thi ngay lập tức trong vòng tối đa `7 ngày lịch`, thực tế là xóa ngay trên SQLite) và giải thích rõ việc xóa dữ liệu trong Research Studio không xóa bất kỳ dữ liệu nào trên máy chủ YouTube.
     - Cung cấp thông tin liên hệ/hỗ trợ cục bộ của nhà phát triển theo chuẩn `III.A.2`.
3. **Nhận diện nguồn & Công bố dữ liệu ngoài YouTube (`Developer Policies III.E.4.h`, `III.F.2` & `Branding Guidelines`):**
   - Không dùng tên "YouTube" hoặc biến thể như "YT" làm tên ứng dụng chính (*Research Studio* tách bạch hoàn toàn).
   - Mọi màn hình hoặc vùng danh sách hiển thị dữ liệu từ YouTube API (kết quả video, kênh, xu hướng, tìm kiếm) phải hiển thị đúng nhận diện nguồn YouTube theo [Branding Guidelines](https://developers.google.com/youtube/terms/branding-guidelines) (ví dụ logo/biểu tượng YouTube có thể bấm mở về trang YouTube hoặc nội dung gốc tương ứng).
   - Khi hiển thị dữ liệu ngoài YouTube (tin tức RSS, cụm từ tính từ RSS, cờ Đánh dấu Bứt phá thủ công, Nhãn định dạng thủ công, Ghi chú/Ý tưởng cá nhân) cạnh dữ liệu YouTube, giao diện phải gắn nhãn rõ ràng rằng đó là **Dữ liệu ngoài YouTube / Tự ghi nhận của Research Studio**.

---

## 17. Acceptance Criteria có thể kiểm tra được cho từng chức năng

| Mã AC | Chức năng / Yêu cầu | Điều kiện nghiệm thu kiểm chứng được (Pass Condition) |
|---|---|---|
| **AC-01** | **Khung app VOXLAB & Điều hướng 3 cấp (11/16 màn hình)** | Thanh `TopBar` toàn chiều rộng trên cùng; Sidebar 3 cấp (`Nền tảng` với `YouTube` hoạt động + 4 nền tảng `Sắp ra mắt` disabled → Khu vực `Tổng quan` / `Dự án` mở thẳng `G1` / `P1` → `5` mục con Tổng quan hoặc dropdown Project duy nhất + `9` mục con Dự án, kèm `Cài đặt` & nút thu gọn); khung làm việc nổi bo góc có `Back/Forward + Breadcrumb`; 11 màn hình MVP hoạt động dữ liệu thật và 5 màn hình `Giai đoạn 2` trung thực, `0` console error/warning qua Chrome DevTools. |
| **AC-02** | **Hoạt động Global khi chưa có Project** | Khi bảng `projects` có `0` bản ghi, cả 5 màn hình Global (`G1–G5`) vẫn mở, đọc RSS, lưu Ý tưởng vào Kho chung và tìm YouTube bình thường; các màn hình Project (`P1–P6`) hiển thị Empty State hướng dẫn tạo Project đầu tiên. |
| **AC-03** | **Tách thực thể gốc dùng chung & Cô lập `project_id`** | Thêm cùng 1 kênh (`UC...`), 1 video và 1 ý tưởng vào cả Project A và Project B: bảng gốc chỉ chứa **1** bản ghi duy nhất cho kênh/video/ý tưởng đó; cập nhật góc khai thác/trạng thái/từ khóa ở Project A không làm thay đổi Project B (kiểm chứng bằng integration test SQLite & API). |
| **AC-04** | **Dropdown Project duy nhất & AbortController** | Chuyển nhanh từ Project A sang Project B khi request Project A đang chờ: request cũ bị hủy (`AbortError`) hoặc bị bỏ qua, dữ liệu hiển thị trên màn hình khớp 100% `project_id = B`. |
| **AC-05** | **Dual-Bucket Quota Ledger** | Gọi `search.list` trừ `1` vào bucket `Search Queries` (`0/100 → 1/100`) và **không** trừ nhầm `100` vào bucket `General Data API`; gọi `videos.list`/`channels.list`/`playlistItems.list` trừ `1/lượt` vào `General Data API` (`10.000/ngày`); chạm ngưỡng `80%` hiện cảnh báo và tự động chặn làm mới nền; nhận `403 quotaExceeded` khóa bucket tới mốc reset `00:00 PT`. |
| **AC-06** | **Phân loại 3 trạng thái định dạng & Nhãn thủ công** | Video `> 180s` được xếp `long_form` (`Video dài — Xác minh`); video `<= 180s` không có xác nhận tỷ lệ API được xếp `unknown` (`Chưa xác định`) — kể cả video `45s` cũng không tự gán chắc chắn `Shorts`. Video `unknown` không bị cộng vào bộ đếm `Video dài` hoặc `Shorts`. Gợi ý `#shorts` hiển thị kèm độ tin cậy + căn cứ; gán nhãn thủ công hiển thị huy hiệu tách biệt với xác minh nguồn. |
| **AC-07** | **Khám phá xu hướng & Nghiên cứu tự do (`G2`, `G3`)** | `G2` nạp dữ liệu thật qua `videos.list(mostPopular)` (`1 unit`), lọc & sắp xếp được trên trường gốc. `G3` chỉ gọi `search.list` khi bấm Tìm, mở lại phiên tìm cũ còn hạn `<= 30 ngày` tiêu tốn `0 quota`, và thêm được Kênh sang Project hoặc lưu Ý tưởng. |
| **AC-08** | **Theo dõi đối thủ (`P2`)** | Thêm kênh qua URL/`@handle`/`channel_id` tốn `1 unit` phân giải + lấy video qua `uploads` (`playlistItems.list` + `videos.list` tối đa 50 ID), không tự động gọi `search.list`. Hiển thị số liệu gốc kênh & video, gỡ kênh khỏi Project A không xóa dữ liệu kênh nếu Project B vẫn đang theo dõi. |
| **AC-09** | **`Video bứt phá` ở Standard Mode (`P3`)** | Sàng lọc được video mới đăng theo cửa sổ `3/7/14/30 ngày`, lọc tách biệt `Video dài`/`Shorts`/`Chưa xác định`, sắp xếp theo `viewCount`/`likeCount`/`commentCount`/`publishedAt` gốc, xem mốc `viewCount` lịch sử trong `<= 30 ngày` kèm timestamp, bật/tắt cờ `Đánh dấu Bứt phá` + ghi chú lưu bền vững, và hiển thị khung giải thích rõ các chỉ số Derived Metrics chưa khả dụng ở Standard Mode (không có logic/công tắc ẩn). |
| **AC-10** | **`Nghiên cứu từ khóa` ở Standard Mode (`P4`)** | CRUD danh sách từ khóa của Project (lưu vĩnh viễn); bấm Quét YouTube áp dụng đúng `regionCode` & `relevanceLanguage` của Project sau khi báo dự báo `Search Queries`; hiển thị kết quả thật + `tags` gốc từng video (không Search Volume giả) và khung `Nguồn: RSS` tách biệt. |
| **AC-11** | **Thu thập & Cô lập lỗi RSS (`G4`, `P4`)** | Nạp RSS/Atom tốn `0` quota YouTube, khử trùng lặp khi làm mới nhiều lần cùng URL/GUID, loại bỏ HTML script nguy hiểm (chống XSS & XXE). Khi 1 feed trả lỗi `404`/XML hỏng, chỉ feed đó hiện trạng thái lỗi, các feed khác và dữ liệu bài cũ vẫn hiển thị bình thường. |
| **AC-12** | **Làm mới tự động có kiểm soát & Hết hạn 30 ngày** | Mở app hiển thị dữ liệu SQLite ngay (`< 1s`), không bắn hàng loạt request khi mở app; tôn trọng công tắc Bật/Tắt, giới hạn unit/đợt, trần quota ngày và ưu tiên Video gắn Ý tưởng + Kênh đối thủ trước. Test mô phỏng `api_expires_at < now`: hệ thống xóa sạch metadata/thống kê `YouTube API Data` quá hạn nhưng bảo toàn `100%` `Projects`, `Ideas`, ghi chú, từ khóa và nhãn thủ công. |
| **AC-13** | **Quản lý Ý tưởng & 5 trạng thái đa Project (`G5`, `P5`)** | Lưu được ý tưởng từ Video/RSS/Từ khóa/Viết tay; gắn 1 ý tưởng gốc sang Project A và Project B; đổi trạng thái sang `Chốt làm` ở Project A không đổi trạng thái `Mới lưu` ở Project B; chuyển đủ 5 trạng thái và lọc/tìm kiếm thành công trên giao diện Danh sách / Bảng dữ liệu. |
| **AC-14** | **Điều hướng Back/Forward & Khôi phục trạng thái** | Ở màn hình danh sách, chọn filter + sort + cuộn xuống giữa danh sách → mở trang Chi tiết → bấm Back: quay về đúng màn hình trước đó (đúng `project_id`), khôi phục chính xác filter, sort và vị trí cuộn (`scrollTop`); bấm Forward quay lại đúng trang Chi tiết. |
| **AC-15** | **Trạng thái lỗi (Thiếu Key / Mất mạng / Hết quota / Cancel)** | Khi thiếu API Key: RSS & Ý tưởng vẫn chạy, màn hình YouTube hiện hướng dẫn cài Key. Khi ngắt mạng/giả lập lỗi mạng: ứng dụng không crash, dữ liệu cũ còn hạn đọc bình thường, thao tác làm mới đang chạy bấm `Cancel` dừng sạch và nút `Retry` hoạt động. |
| **AC-16** | **Bảo mật API Key, Loopback & Log Redaction** | Key lưu trong file cấu hình/DB không ở dạng plaintext (được mã hóa bằng Windows DPAPI và giải mã đúng theo user hiện tại); API cấu hình chỉ trả khóa đã che; log file không chứa chuỗi API Key thô (`key=...`); Backend & Frontend chỉ bind `127.0.0.1`. |
| **AC-17** | **Công bố pháp lý & Nhận diện nguồn YouTube** | Lần đầu kích hoạt API Key yêu cầu xác nhận Chính sách Quyền riêng tư; mục Pháp lý hiển thị đủ liên kết `https://www.youtube.com/t/terms` và Google Privacy Policy (`policies/privacy`), nút **Xóa toàn bộ dữ liệu YouTube API đã lưu** xóa sạch cache YouTube trong SQLite ngay lập tức (vẫn giữ Ý tưởng người dùng), và mọi trang YouTube/RSS đều gắn nhãn tách biệt nguồn theo [Branding Guidelines](https://developers.google.com/youtube/terms/branding-guidelines). |
| **AC-18** | **Giao diện VOXLAB & Chuẩn tương phản Light/Dark Mode** | Chuyển đổi mượt mà giữa Light Mode (kem/nâu cát/vàng hổ phách) và Dark Mode (Obsidian/nâu tối/vàng kim), chữ `Inter`, đạt kiểm tra tương phản tối thiểu WCAG 2.1 AA ở cả 2 chủ đề và không vỡ bố cục ở kích thước cửa sổ desktop tiêu chuẩn (`>= 1280x720`). |

---

## 18. Các giả định, giới hạn và tham số TUNING REQUIRED

### 18.1. Giả định (`Assumptions`)
1. Người dùng tự đăng ký và nhập **YouTube Data API v3 Key** miễn phí cá nhân trên Google Cloud Console; Research Studio không cung cấp khóa dùng chung.
2. Toàn bộ dữ liệu từ kênh đối thủ công khai và tìm kiếm từ khóa truy cập qua API Key đều là `Non-Authorized Data` và tuân theo quy định tương ứng của YouTube.
3. Nguồn tin tức trên `Tin tức & thảo luận` xuất phát từ các đường dẫn RSS/Atom công khai hợp lệ do người dùng tự chọn thêm/bật.
4. Ngôn ngữ giao diện ứng dụng V1 là **Tiếng Việt**; dữ liệu nội dung tìm kiếm hỗ trợ đa ngôn ngữ Unicode đầy đủ.
5. Máy tính chạy ứng dụng là Windows 11 64-bit đơn người dùng cục bộ với tài khoản Windows hỗ trợ DPAPI.

### 18.2. Giới hạn kỹ thuật & Chính sách đã xác nhận (`Known Limitations`)
1. **Standard Mode chưa có Derived Metrics:** Các chỉ số `Outlier Multiplier`, `Views/ngày`, `Engagement Rate`, `Channel Median`, thống kê gộp nhiều kênh từ `API Data` và biểu đồ tăng trưởng `> 30 ngày` không có trong MVP V1 cho tới khi API Project đáp ứng quy trình thẩm định/phê duyệt *Analytics & Reporting + Derived Metrics Policy* của YouTube.
2. **Giới hạn nhận dạng Shorts từ API:** YouTube Data API v3 không cung cấp cờ `isShort` chính thức cho mọi video, nên các video `<= 180 giây` chưa xác minh được tỷ lệ khung hình sẽ ở trạng thái `Chưa xác định` (kèm gợi ý có ghi độ tin cậy và tùy chọn nhãn thủ công).
3. **Giới hạn Search Volume:** YouTube Data API v3 không trả về lượng tìm kiếm hàng tháng tuyệt đối; màn hình từ khóa phản ánh kết quả video thực tế và tín hiệu RSS.
4. **Giới hạn 30 ngày cho `API Data`:** Metadata và thống kê lấy từ YouTube API không được làm mới trong vòng `30 ngày lịch` bắt buộc phải xóa phần dữ liệu API quá hạn.

### 18.3. Bảng tham số phụ thuộc tải (`TUNING REQUIRED`)

| Tham số | Giá trị mặc định an toàn ban đầu | Lý do cần đo đạc / hiệu chỉnh (`Phase 11`) |
|---|---|---|
| `competitor_videos_per_refresh` | `40` video gần nhất/kênh *(tối đa `50` trong 1 lô API)* | Cân bằng tốc độ ghi SQLite và độ rộng mẫu video theo dõi kênh đối thủ |
| `search_max_results_per_call` | `25` kết quả/trang *(tối đa `50`)* | Cân bằng mật độ thông tin khi `1` trang tiêu thụ `1` lượt `Search Queries` + `1 unit` `videos.list` |
| `quota_warning_ratio` | `80%` mỗi bucket (`80/100` `Search Queries`; `8.000/10.000` `General Data API`) | Cảnh báo sớm cho người dùng cá nhân trước khi chạm trần ngày `PT` |
| `auto_refresh_startup_delay_sec` | `30` giây | Tránh nghẽn I/O & mạng lúc vừa mở ứng dụng |
| `auto_refresh_channel_interval_hours` | `12` giờ | Giữ dữ liệu đối thủ cập nhật trong ngày mà không lãng phí `General Data API` |
| `auto_refresh_rss_interval_hours` | `4` giờ | Cập nhật tin RSS kịp thời với chi phí `0` quota YouTube |
| `auto_refresh_max_api_units_per_batch` | `15` units/đợt *(và trần ngày tự động `3.000` units)* | Tránh làm mới ồ ạt một lúc khi người dùng theo dõi hàng chục đối thủ |
| `http_connect_timeout_sec` / `http_read_timeout_sec` | `10s` kết nối / `20s` đọc | Chống treo worker khi server RSS chậm hoặc mạng chập chờn |
| `http_retry_max_attempts` & backoff | `2` lần thử lại (`1s → 3s`) chỉ cho lỗi tạm thời (`429/5xx/timeout`) | Không kéo dài trạng thái chờ hay đốt quota trên lỗi cố định (`400/403/404`) |
| `rss_max_payload_bytes` / concurrency | `5 MB` / feed; tối đa `3` feed song song | Chống ngốn RAM/CPU nếu gặp feed RSS kích thước bất thường |
| `rss_cache_retention_days` | `60` ngày *(chỉ áp dụng bài RSS chưa gắn với Ý tưởng)* | Kiểm soát dung lượng file SQLite lâu dài |
| `sqlite_busy_timeout_ms` | `5000` ms | Tránh `database is locked` khi tác vụ nền chạy song song với thao tác ghi của người dùng |
| `table_page_size` | `50` dòng/trang | Đảm bảo thời gian phản hồi UI mượt và hỗ trợ khôi phục `scrollTop` chính xác |
