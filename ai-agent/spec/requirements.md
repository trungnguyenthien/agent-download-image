## General
- Đây là Chrome extension v3.
- Cung cấp chức năng tự search ảnh và download ảnh về máy.
- Các nguồn ảnh gồm (search engine): Bing, DuckDuckGo, Baidu, Yandex
- Không sử dụng webpack hay công cụ đóng gói.
- Sử dụng `icon.png` làm icon cho extension
- Thư mục root của extension là thư mục chứa `icon.png`

## Class & Function
- Ưu tiên viết pure function (hạn chế biến toàn cục tham gia vào logic hàm, mỗi hàm nên giữ một trách nhiệm duy nhất).
- Nên chia làm nhiều class, mỗi class thực hiện một nhóm nhiệm vụ cụ thể.

## Comment & Log
- Comment bằng tiếng Anh, không comment từng line, nhưng cần comment mô tả cho mỗi class và function.
- Sử dụng tiếng Anh Log: step chính (🎯), success (✅), error (‼️), warning (⚠️).

## UI
- Khi user click vô action icon sẽ mở ra trang web như thiết kế ai-agent/spec/homepage.png


## Trình tự xử lý

### CLICK SEARCH BUTTON
**Step 1 — Validation:**
- User cần input đầy đủ các field: `saveFolder`, `keywords`.
- `keywords`: danh sách keyword, mỗi keyword 1 dòng. Ví dụ: `"rắn lục"`, `"rắn đuôi chuông"`, `"rắn hổ mang"`.
- `saveFolder`: tên thư mục con trong thư mục Downloads để lưu ảnh.

**Step 2 — Search:**
- Tự động mở tab ứng với từng `keyword` + `search engine`. (giải pháp để tránh vấn đề CORS)
- Mỗi tab search (`keyword` + `search engine`) sẽ lấy 5 page kết qủa
- Mỗi ảnh có `title` hoặc `alt` chứa keyword → hợp lệ.

**Step 3 — Lấy ảnh gốc & kích thước:**
- Trước khi load page tiếp theo hãy parse lấy link ảnh gốc của kết quả search (link ảnh chất lượng, không phải ảnh thubmnail)
- Server đọc 512 bytes đầu của ảnh (JPEG/PNG/GIF header) để lấy kích thước thật mà không cần tải full ảnh.
- Ảnh có cả width VÀ height ≥ 300px → **selected** sẽ được hiển thị trên Image Result Grid, ảnh không hợp lệ thì không được add vào grid.

**Step 4 — Hiển thị grid:**
- Images result hiển thị trong grid 4 cột, N dòng.
- Mỗi card hiển thị: thumbnail, badge search engine (bing, duckduckgo, baidu, yandex) , kích thước, title hoặc alt của ảnh.
- User có thể click card để toggle selected ↔ unselected .

### CLICK DOWNLOAD BUTTON
- Click Download button → download các ảnh đã selected.
- File name format: `{source}-{timestamp}-{keyword}.{extension}`
  - `source`: `"bing"`
  - `keyword`: ví dụ `"rắn lục"`
  - `extension`: `"jpg"`, `"png"`, `"gif"`, `"webp"`
- Ảnh được download qua `fetch()` → blob URL → `<a download>`.