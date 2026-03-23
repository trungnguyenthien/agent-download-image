document.getElementById('searchBtn').addEventListener('click', () => {
    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) {
        document.getElementById('status').innerText = 'Vui lòng nhập từ khoá.';
        return;
    }
    
    document.getElementById('status').innerText = 'Đang mở tab tìm kiếm...';
    
    chrome.runtime.sendMessage({ action: 'searchAndDownload', keyword: keyword }, (response) => {
        if (chrome.runtime.lastError) {
             document.getElementById('status').innerText = 'Lỗi: ' + chrome.runtime.lastError.message;
        } else {
             document.getElementById('status').innerText = response.status;
        }
    });
});
