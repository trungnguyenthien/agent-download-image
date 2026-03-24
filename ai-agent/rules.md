## General
- Đây là standalone web app (không phải Chrome extension).
- Chạy với 2 thành phần:
  - **Frontend**: `index.html` + `css/style.css` + `js/*.js` — HTML/CSS/JS thuần, không webpack.
  - **Backend**: `server.py` — Python HTTP server (dùng Playwright) làm proxy/search engine.
- Không sử dụng webpack hay công cụ đóng gói.
- Sử dụng `icon.png` làm favicon cho web app.
- Có thể dùng third-party JS library nhưng phải tải về project.

## Architecture
- **Frontend**: ES modules, mỗi module một trách nhiệm rõ ràng.
- **Backend**: Python `server.py` với Playwright — không cần thư viện Python nào khác (JPEG header parser tự viết).

## Class & Function
- Ưu tiên viết pure function (hạn chế biến toàn cục tham gia vào logic hàm, mỗi hàm nên giữ một trách nhiệm duy nhất).
- Nên chia làm nhiều class, mỗi class thực hiện một nhóm nhiệm vụ cụ thể.

## Comment & Log
- Comment bằng tiếng Anh, không comment từng line, nhưng cần comment mô tả cho mỗi class và function.
- Sử dụng tiếng Anh Log: step chính (🎯), success (✅), error (‼️), warning (⚠️).

## Search Engine Strategy
- **Google Images**: Bị chặn bởi CAPTCHA khi mở bằng automated browser (headless Chromium/Playwright). Không dùng Google.
- **Bing Images**: Hoạt động tốt. Server dùng Playwright để render trang, extract images từ DOM.
- **Kỹ thuật**: Bing lưu ảnh dưới dạng thumbnail (query param `?w=234`). Để lấy ảnh gốc: strip query params → thêm `?w=2000` → ảnh full-resolution.
- **Kỹ thuật lấy kích thước**: Đọc trực tiếp JPEG/PNG/GIF header (512 bytes đầu) để lấy width/height mà không cần tải full ảnh.

## Directory Structure
```
{root}/
├── index.html          ← Web app entry point
├── css/
│   └── style.css       ← Giao diện (dark header, light body, grid 4-col)
├── js/
│   ├── app.js          ← Điều phối: validation → search → render → download
│   ├── searchService.js ← Gọi /search endpoint của server
│   ├── imageStore.js   ← Lưu trữ ảnh, auto-select/auto-disable
│   ├── uiRenderer.js  ← Render grid, card, overlay
│   └── downloadManager.js ← Download ảnh qua <a download> blob URL
├── server.py            ← Python server + Playwright search
├── icon.png
├── manifest.json        ← (file cũ, không còn dùng)
└── ai-agent/           ← Tài liệu cho AI agent đọc
    ├── rules.md
    └── spec/
        ├── requirements.md
        └── homepage.png
```
