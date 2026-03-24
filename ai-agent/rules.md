## General
- Đây là chrome extension v3
- Viết theo javascript và html thuần không sử dụng webpack hay các công cụ tương tự để đóng gói.
- Sử dụng ảnh `icon.png` làm icon đại diện cho extension.
- Có thể sử dụng third-party javascript library nhưng phải down về trong project để sử dụng.
- Giới hạn tối thiểu các permission cần thiết.

## Class & Function
- Ưu tiên viết pure function (hạn chế biến toàn cục tham gia vào logic hàm, mỗi hàm nên giữ một trách nhiệm duy nhất)
- Nên chia làm nhiều class mỗi class thực hiện một nhóm nhiệm vụ cụ thể.

## Comment & Log
- Comment bằng tiếng anh, không được comment cho từng line code nhưng cần comment mô tả cho mỗi class và function.
- Sử dụng tiếng Anh Log từng step chính (🎯), success results (✅), error message (‼️), warning (⚠️).