## Chức năng chính
Download ảnh gốc (không phải ảnh thumbnail) từ công cụ tìm kiếm Bing Image. Ảnh được tìm kiếm, hiển thị, chọn lọc và download về máy.

## Kiến trúc
- **Frontend** (chạy trên browser): Giao diện web, gửi search request đến server.
- **Backend** (`server.py`, chạy trên máy local): Nhận request, dùng Playwright truy cập Bing Images, trả JSON về cho frontend.
- **Không cần Chrome Extension** — chỉ cần mở web app trên trình duyệt.

## Trình tự xử lý

### CLICK SEARCH BUTTON
**Step 1 — Validation:**
- User cần input đầy đủ các field: `saveFolder`, `keywords`.
- `keywords`: danh sách keyword, mỗi keyword 1 dòng. Ví dụ: `"rắn lục"`, `"rắn đuôi chuông"`, `"rắn hổ mang"`.
- `saveFolder`: tên thư mục con trong thư mục Downloads để lưu ảnh.

**Step 2 — Search qua server:**
- Frontend gọi `GET /search?keyword=...&engine=bing&page=N` đến `server.py`.
- `server.py` dùng Playwright mở Bing Images, render trang, extract images từ DOM.
- Mỗi keyword × mỗi engine × 10 pages = request riêng biệt.
- Mỗi ảnh có `title` hoặc `alt` chứa keyword → hợp lệ.

**Step 3 — Lấy ảnh gốc & kích thước:**
- Bing lưu thumbnail URL với query param `?w=234&h=180...`. Để lấy ảnh gốc: strip query params, thêm `?w=2000`.
- Server đọc 512 bytes đầu của ảnh (JPEG/PNG/GIF header) để lấy kích thước thật mà không cần tải full ảnh.
- Ảnh có cả width VÀ height ≥ 300px → **selected** (mặc định).
- Ảnh có width HOẶC height < 300px → **disabled** (không chọn được).

**Step 4 — Hiển thị grid:**
- Images result hiển thị trong grid 4 cột, N dòng.
- Mỗi card hiển thị: thumbnail, badge source (`bing`), kích thước, keyword.
- User có thể click card để toggle selected ↔ unselected (với ảnh không disabled).

**Step 5 — Download:**
- Click Download button → download các ảnh đã selected.
- File name format: `{source}-{timestamp}-{keyword}.{extension}`
  - `source`: `"bing"`
  - `keyword`: ví dụ `"rắn lục"`
  - `extension`: `"jpg"`, `"png"`, `"gif"`, `"webp"`
- Ảnh được download qua `fetch()` → blob URL → `<a download>`.

## UI Layout (tham khảo homepage.png)
1. **Header** — sticky, dark theme, logo + nav links (Home, Features, About).
2. **Hero section** — tiêu đề + search box với:
   - Input `Save Folder`
   - Textarea `Keywords` (mỗi dòng 1 keyword)
   - Toggle buttons: Google Images, Bing Images (mặc định cả 2 checked)
   - Buttons: Search / Stop
   - Progress bar (hiện khi đang search)
3. **Features section** — 3 cards: Multi-Source Search, Original Quality, Batch Download.
4. **Images Result** — grid 4 cột, badge count, Select All / Deselect All buttons.
5. **Download bar** — selected count + Download button.
6. **About section** — mô tả tool.
7. **Footer**.
