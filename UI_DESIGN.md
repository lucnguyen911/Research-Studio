# UI_DESIGN — Research Studio (Phase 6 — Gate D)

- **Dự án:** Research Studio (Windows 11 Local-First Desktop Web Application)
- **Giai đoạn:** Phase 6 — UI / UX Design + Prototype Gate (`GATE D`)
- **Ngày lập:** 2026-11-16
- **Tài liệu nền:** [CONSTRAINTS.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/CONSTRAINTS.md) · [SPEC.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/SPEC.md) · [tasks/plan.md](file:///f:/Source%20Code%20Tool/Reserch%20Studio/tasks/plan.md)

---

## 1. Nguồn Tham chiếu Thiết kế & Tinh chỉnh từ VOXLAB / Stitch

### 1.1. Kế thừa từ VOXLAB (`Tactile Luxury Studio`)
Đã kiểm tra trực tiếp mã nguồn thiết kế của repo [VOXLAB](https://github.com/lucnguyen911/VOXLAB.git) tại `index.html`, `src/App.css`, `src/components/layout/Sidebar.tsx`, và `src/components/layout/TopBar.tsx`:
- **Hệ màu 2 chế độ (Light Mode làm mặc định):** Giữ trọn dải màu đá Travertine / ngà Satin / sứ trắng (`#EFE9DF` / `#F7F3EC` / `#FFFFFF` / `#D4C5B0` / `#D97706`) ở Light Mode và đá đen Obsidian / nâu đá / vàng hổ phách (`#0C0A08` / `#130F0C` / `#1C1611` / `#413226` / `#F59E0B`) ở Dark Mode.
- **Vật lý bề mặt & điều khiển tactile:** Nút chính vàng hổ phách 3D nhẹ, nút keycap satin có đường highlight cạnh trên (`inset 0 1px 0`), ô nhập liệu đặt lõm nhẹ (`recessed well`), select có mũi tên đồng ấm đồng bộ theme, đường bo mềm (`12px` card, `8px` control), dải đánh dấu Sidebar đang chọn có thanh dọc amber `3px` bên trái.

### 1.2. Điều chỉnh chuyên biệt cho Research Studio (Nghiên cứu nhiều dữ liệu, dùng lâu dài)
- **Ưu tiên độ rõ bảng biểu & làm việc lâu dài:** Bỏ toàn bộ hiệu ứng trang trí nặng, bỏ avatar người dùng cloud, giảm độ gắt ánh sáng ở card để tập trung đọc hàng chục dòng tiêu đề/số liệu liên tục.
- **Cho phép bôi đen & sao chép nội dung nghiên cứu:** Khác với VOXLAB (`user-select: none` toàn cục), Research Studio **bật `user-select: text`** trên toàn bộ vùng nội dung chính, bảng video, từ khóa, RSS và ghi chú để người sáng tạo dễ dàng bôi đen/sao chép tiêu đề, ID kênh và thẻ tag; chỉ giữ `user-select: none` cho nút và thanh Sidebar.
- **Vòng focus bàn phím WCAG 2.1 AA:** Giữ `:focus-visible` bằng vòng amber `2px` (`outline-offset: 2px`) trên mọi nút, link, input và `<select>` thay cho `outline: none` toàn cục.
- **Tương phản nút chính CTA (WCAG AA+):** Dùng chữ nâu đen Espresso `#18110B` (`font-weight: 600`) trên nền gradient vàng hổ phách `#FCD34D → #F59E0B` (`> 9.5:1` ở cả Light & Dark Mode thay vì chữ trắng trên nền amber vốn chỉ đạt ~3.2:1).

### 1.3. Tham chiếu Stitch MCP đã thực hiện
- **Trạng thái Stitch:** `YES` — Đã khởi tạo Project `12033378647203935974` (*Research Studio — YouTube Research Desktop V1*), Design System `assets/2342450035589842392` (*VOXLAB Tactile Luxury Studio Light Research Edition*), và sinh 2 màn hình desktop tham chiếu:
  1. `projects/12033378647203935974/screens/68083f75d91c4db78c142d32506f96e0` (*Video bứt phá — Standard Mode*)
  2. `projects/12033378647203935974/screens/a1f5d54c21e24cd49bcbe9252ae90fc8` (*Chi tiết Video nhiều cấp*)
- **Kiểm duyệt & loại bỏ lỗi từ bản sinh thô của Stitch (không copy nguyên mã Stitch):**
  - Hình sinh từ AI của Stitch tự chèn nhãn `Tỷ lệ Thích (%)`, `views / 24h qua` và gán `Shorts (Xác minh)` cho video `<= 60s`. Prototype React tự viết bằng TypeScript loại bỏ hoàn toàn các phần vi phạm này để tuân thủ tuyệt đối `SPEC.md` Mục 6.2 & 10.
  - Sửa bố cục TopBar của Stitch từ dạng hay xuống dòng thành thanh điều hướng 1 hàng ổn định (`52px`), tối ưu co giãn chiều rộng và bỏ avatar đám mây giả.
  - Áp dụng cấu trúc từ Stitch: khối công bố Standard Mode 2 cột cân bằng, bố cục bảng nghiên cứu 5 cột rõ ràng, và trang *Chi tiết Video* 2 cột (`65%` metadata & mốc thô + `35%` Đánh dấu Project & Liên kết Ý tưởng đa Project) cùng thẻ *Phân loại định dạng 3 lớp* dạng 3 ô tách biệt.

---

## 2. Bảng màu & Quy tắc Light / Dark Mode (WCAG 2.1 AA Verified)

### 2.1. Light Mode (Mặc định khi mở app lần đầu)
| Vai trò Token | CSS Variable | Mã Hex | Tỷ lệ tương phản mục tiêu |
|---|---|---|---|
| Nền khung ngoài / Canvas | `--rs-bg-app` | `#EFE9DF` | Nền ấm giảm chói mắt |
| Nền Sidebar / TopBar | `--rs-bg-panel` | `#F7F3EC` | Nền ngà Satin tách khu vực điều hướng |
| Nền Card / Bảng dữ liệu | `--rs-bg-card` | `#FFFFFF` | `#18110B` trên trắng đạt `18.3:1` |
| Nền phụ / Hàng hover / Slot | `--rs-bg-subtle` | `#EFE8DD` | Dùng cho control phụ & segmented track |
| Rãnh nhập liệu (Input Well) | `--rs-bg-input` | `#EDE6DA` | Rãnh lõm rõ biên nhập |
| Viền chuẩn / Viền đậm | `--rs-border` / `--rs-border-strong` | `#D4C5B0` / `#B69F83` | Phân lớp mềm không gắt |
| Màu nhấn chính (Accent) | `--rs-accent` / `--rs-accent-hover` | `#D97706` / `#B45309` | CTA / Active indicator |
| Chữ Accent đọc trên nền sáng | `--rs-accent-text` | `#92400E` | Đạt `~7.0:1` trên `#FFFFFF` |
| Chữ chính / Phụ / Muted | `--rs-text-primary` / `--rs-text-secondary` / `--rs-text-muted` | `#18110B` / `#433528` / `#635242` | `18.3:1` / `10.8:1` / `6.1:1` (vượt `>= 4.5:1`) |
| Trạng thái ngữ nghĩa | `--rs-success` / `--rs-warning` / `--rs-danger` | `#047857` / `#C2410C` / `#BE123C` | Đạt chuẩn AA khi dùng làm chữ trên nền sáng |

### 2.2. Dark Mode (Hỗ trợ đầy đủ & chuyển đổi tức thì)
| Vai trò Token | CSS Variable | Mã Hex | Ghi chú |
|---|---|---|---|
| Nền khung ngoài / Canvas | `--rs-bg-app` | `#0C0A08` | Obsidian ấm |
| Nền Sidebar / TopBar | `--rs-bg-panel` | `#130F0C` | Nâu đen Satin |
| Nền Card / Bảng dữ liệu | `--rs-bg-card` | `#1C1611` | Nổi khối nhẹ bằng viền top-highlight `rgba(255,244,224,0.08)` |
| Nền phụ / Slot | `--rs-bg-subtle` | `#261E17` | Trạng thái hover bảng & nút keycap tối |
| Rãnh nhập liệu | `--rs-bg-input` | `#14100C` | Ô tìm kiếm/nhập liệu lõm |
| Viền chuẩn / Viền đậm | `--rs-border` / `--rs-border-strong` | `#413226` / `#664F3C` | Viền đồng trầm |
| Màu nhấn chính (Accent) | `--rs-accent` / `--rs-accent-hover` | `#F59E0B` / `#FBBF24` | Hoàng kim hổ phách |
| Chữ Accent đọc trên nền tối | `--rs-accent-text` | `#FBBF24` | Đạt `~10.5:1` trên `#1C1611` |
| Chữ chính / Phụ / Muted | `--rs-text-primary` / `--rs-text-secondary` / `--rs-text-muted` | `#FDF9F3` / `#DBCFC0` / `#AE9C88` | `17.4:1` / `11.6:1` / `6.6:1` |
| Trạng thái ngữ nghĩa | `--rs-success` / `--rs-warning` / `--rs-danger` | `#34D399` / `#FB923C` / `#FB7185` | Sáng rõ trên nền `#1C1611` |

- **Khởi tạo chống nháy màn hình (No FOUC):** `index.html` mặc định `class="light" data-theme="light"`, đọc đồng bộ `localStorage.getItem("rs_theme")` trước khi mount React.

---

## 3. Typography & Mật độ Bố cục Desktop

- **Font chính:** `"Inter Variable", "Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif`.
- **Font số / mã kỹ thuật:** `"JetBrains Mono Variable", "Cascadia Mono", "Consolas", ui-monospace, monospace` đi kèm **`font-variant-numeric: tabular-nums`** trên toàn bộ cột số liệu (`viewCount`, `likeCount`, `commentCount`, thời lượng, ngày giờ, quota `Search`/`API`) để các hàng số thẳng cột khi quét mắt.
- **Thang chữ chuẩn Tiếng Việt (Legibility Floor):**
  - Tiêu đề trang (`h1`): `22px` (`1.375rem`), `font-weight: 700`, `line-height: 1.25`.
  - Tiêu đề khối/card (`h2`): `15.5px` (`0.97rem`), `font-weight: 650`.
  - Văn bản thân & ô bảng: `13.5px–14px`, `line-height: 1.45`.
  - Nhãn phụ / badge / timestamp: tối thiểu **`12px`**, `line-height: 1.35` (cấm dùng chữ `9px–10px` làm dính dấu tiếng Việt).

---

## 4. Kiến trúc Khung Ứng dụng (`App Shell`) & Điều hướng (`AppNavigationProvider`)

### 4.1. Bố cục Khung Desktop-First (`100vh`)
1. **Sidebar Bên Trái (`268px` mở rộng / `64px` thu gọn):**
   - **Thương hiệu:** `Research Studio` + badge `LOCAL · DEMO`.
   - **GLOBAL RESEARCH (`6` mục đúng thứ tự đã phê duyệt):**
     1. `Tổng quan` (`G1`)
     2. `Khám phá xu hướng` (`G2`)
     3. `Nghiên cứu tự do` (`G3`)
     4. `Video nổi bật` (`Giai đoạn 2`)
     5. `Tin tức & thảo luận` (`G4`)
     6. `Kho ý tưởng chung` (`G5`)
   - **PROJECT RESEARCH:**
     - **Một Dropdown duy nhất** chọn Project đang hoạt động + nút `+ Tạo Project`.
     - **`10` mục dùng chung đúng thứ tự cho Project đang chọn:**
       1. `Tổng quan dự án` (`P1`)
       2. `Chủ đề nóng` (`Giai đoạn 2`)
       3. `Nghiên cứu từ khóa` (`P4`)
       4. `Video bứt phá` (`P3`)
       5. `Theo dõi đối thủ` (`P2`)
       6. `Chủ đề dài hạn` (`Giai đoạn 2`)
       7. `Cơ hội nội dung` (`Giai đoạn 2`)
       8. `Nghiên cứu AI` (`Giai đoạn 2`)
       9. `Quản lý ý tưởng` (`P5`)
       10. `Cài đặt dự án` (`P6`)
   - **Chân Sidebar:** Nút truy cập `Cài đặt hệ thống & Pháp lý` và nút thu gọn/mở rộng Sidebar cho cửa sổ nhỏ (`1024px–1279px`).
2. **Thanh Điều hướng Trên Cùng (Sticky TopBar `52px`):**
   - Trái: Nút `← Quay lại (Back)`, `→ Tiến tới (Forward)` (kiểu nút keycap có trạng thái `disabled` rõ ràng), **Breadcrumb phân cấp** có thể bấm quay lại cấp trung gian, nhãn **`DEMO`**.
   - Phải: Trạng thái kết nối/nguồn (`Online` / `Ngoại tuyến (Local)` / `Thiếu API Key`), đồng hồ **Quota 2 Bucket** (`Search: x/100 · API: y/10.000`), công cụ `Mô phỏng Trạng thái UI (DEMO)` phục vụ kiểm duyệt Prototype, nút chuyển `Light / Dark Mode` và nút mở `Cài đặt hệ thống`.
3. **Vùng Nội dung Chính (`#rs-main-scroll`):**
   - Tối đa chiều rộng thoáng (`max-width: 1480px`), thanh công cụ tìm kiếm/lọc gộp gọn phía trên bảng, hỗ trợ **Inspector Panel bên phải tùy chọn** (không ép mở sẵn làm hẹp bảng) khi xem nhanh video/bài báo ngay trong màn hình danh sách.

### 4.2. Hợp đồng `AppNavigationProvider` (`ARCH-05`)
- **Trạng thái nguyên tử (`useSyncExternalStore`):** Hợp nhất `(entryId, screenId, scope, projectId, params, viewState)` vào 1 store đồng bộ cùng lúc để không có 1 khung hình nào bị trộn dữ liệu Project cũ sang Project mới.
- **Bền vững qua `F5`, `Back`, `Forward`:**
  - `window.history.scrollRestoration = "manual"`.
  - Đồng bộ route lên URL hash (`#/global/...`, `#/projects/{projectId}/...`) và lưu lịch sử stack metadata nhẹ (`filters`, `sort`, `tab`, `page`, `scrollTop` — tuyệt đối không lưu mảng API data) vào `sessionStorage`.
  - Hỗ trợ luồng 4 cấp: **`Theo dõi đối thủ → Chi tiết Kênh → Danh sách video của kênh → Chi tiết Video`**.
  - Khi đổi filter/sort/page hoặc cuộn vùng `#rs-main-scroll`, cập nhật entry hiện tại qua `history.replaceState` + `sessionStorage`. Khi quay lại (`Back`) hoặc `Forward`, khôi phục filter/sort/page trước rồi đặt `el.scrollTop` trong `requestAnimationFrame`.
  - Nếu một Project đã bị xóa khi người dùng bấm `Back` vào lịch sử cũ, điều hướng tự fallback an toàn sang Project khả dụng hoặc `Tổng quan` kèm thông báo nhẹ.

---

## 5. Quy tắc Bảng, Sparkline, Phân loại 3 Lớp & Standard Mode

1. **Tương tác bảng chuẩn desktop:** Mọi bảng chính có tìm kiếm chuỗi, lọc nhiều tiêu chí, sắp xếp trực tiếp theo cột gốc, phân trang rõ ràng, thao tác bấm mở trang Chi tiết, thao tác nhanh **Lưu Ý tưởng** (`+ Ý tưởng`) và **Mở Inspector nhanh** (tùy chọn).
2. **Huy hiệu Phân loại Định dạng 3 Lớp (`FormatBadgeGroup`):**
   - **Lớp 1 — Xác minh nguồn (`API`):** `Video dài (> 180s)`, `Shorts (Xác minh)`, hoặc `Chưa xác định (<= 180s)` — **không dùng quy tắc `<= 60s`**, **không gộp `Chưa xác định` vào `Video dài`/`Shorts`**.
   - **Lớp 2 — Gợi ý suy đoán (kèm Độ tin cậy + Căn cứ):** Ví dụ `#shorts + <= 180s (Thấp–Trung bình)` hoặc `Đăng trước 15/10/2024 + 61–180s (Trung bình–Cao)` hiển thị trong tooltip/khung chi tiết.
   - **Lớp 3 — Nhãn thủ công của bạn:** Tách biệt rõ ký hiệu **`Thủ công`** cho người dùng tự gắn/sửa, không ghi đè trường nguồn.
3. **Sparkline & Giới hạn Standard Mode (`SparklineCell`):**
   - Với **Tin tức RSS (`Nguồn: RSS — Ngoài YouTube`)**: Hiển thị sparkline SVG tần suất từ khóa trên các bài RSS 7 ngày gần nhất kèm mũi tên và tooltip.
   - Với **Video bứt phá / Chi tiết Video (`Standard Mode`)**: Chỉ vẽ sparkline SVG từ **các mốc `viewCount` thô đã lưu trong `<= 30 ngày`** kèm đúng timestamp từng mốc nếu đã có `>= 2` lần thu thập; nếu mới lấy `1` lần → hiển thị trung thực **`Chưa đủ mốc (1 lần lấy)`** cùng tooltip hướng dẫn, **tuyệt đối không hiển thị `Outlier Multiplier`, `Views/ngày`, `Engagement Rate`, hay `Channel Median`**.
4. **Phân biệt Nguồn Dữ liệu:** Gắn nhãn tách biệt **YouTube API (Standard Mode)** (kèm liên kết mở trực tiếp về YouTube theo *Branding Guidelines*), **Nguồn: RSS (Dữ liệu ngoài YouTube)**, và **Dữ liệu Người dùng tự tạo (Giữ vĩnh viễn)**.

---

## 6. Danh mục 14 Trạng thái UI & Bộ Màn hình Trong Prototype

1. **Trạng thái bắt buộc có thể kiểm chứng ngay trên Prototype:**
   `Loading` · `Empty state` · `Không có API Key` · `Mất kết nối Internet` · `Hết quota YouTube API` (tách `Search Queries` vs `General Data API`) · `RSS lỗi (cô lập từng nguồn)` · `Không đủ dữ liệu` · `Chưa xác định Video dài/Shorts` · `Đang làm mới dữ liệu (có Hủy)` · `Chức năng thuộc Giai đoạn 2` · `Thao tác thành công/thất bại (Toast)` · `Xác nhận thao tác xóa (bắt buộc nhập đúng tên)` · `Button disabled` · `Light / Dark Mode`.
2. **Độ phủ Màn hình:** Toàn bộ `11/16` màn hình MVP đang hoạt động (`G1`–`G5`, `P1`–`P6`), `4` trang Chi tiết (*Kênh*, *Video*, *Bài báo RSS*, *Ý tưởng*), `5` màn hình `Giai đoạn 2` trung thực, và *Cài đặt hệ thống & Pháp lý* (*ToS YouTube*, *Google Privacy Policy*, xóa cache YouTube API).
