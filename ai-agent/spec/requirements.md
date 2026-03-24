## Chức năng chính
Download ảnh gốc (không phải ảnh thumbnail) từ các công cụ search như: Google Image, Bing Image

## Trình tự xử lý
Dưới đây là trình tự xử lý khi user thực hiện:

### CLICK SEARCH BUTTON
- Step 1: Validation: 
    - user cần input đầy đủ các field: saveFolder, keywords.
    - keywords là danh sách keyword ví dụ như "rắn lục", "rắn đuôi chuông", "rắn hổ mang"... mỗi keyword 1 line
    - saveFolder là tên thư mục con trong thư mục /download/ để save ảnh download.

- Step 2: Get link ảnh gốc (ảnh chất lượng)
    - Với mỗi keyword hãy thực hiện search trên webview iframe lần lượt trên các công cụ khác nhau theo thứ tự [Google Image, Bing Image]
    - Mỗi keyword trong mỗi công cụ sẽ lấy 10 page kết quả.
    - Mỗi ảnh kết quả sẽ có phần title hoặc alt, chỉ cần có chứa keyword thì sẽ hợp lệ.
    - Lấy link ảnh chất lượng cao của các ảnh hợp lệ download về và hiển thị trong [Images result] grid (4 column, N row)
    - Các ảnh trong [Images result] có thể selected và unselected. Tuy nhiên, mặc định nếu có 2 kích thước (width, height) đều lớn hơn 300 thì mặc định là selected, nếu có 1 cạnh nhỏ hơn 300 thì bị disable + unselected luôn.
    - User có thể chuyển trạng thái selected <-> unselected cho các ảnh hợp lệ.


### CLICK DOWNLOAD BUTTON
- Download các selected image vào thư mục /Download/{saveFolder}
- Đặt tên ảnh theo format sau: {source}-{nowTimestampt}-{keyword}.{image extension}
    - source: "google", "bing"
    - keyword: "rắn lục", "rắn đuôi chuông", "rắn hổ mang"...
    - image extension: "jpg", "gif", "webp", "png"