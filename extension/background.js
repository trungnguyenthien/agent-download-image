chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'searchAndDownload') {
        const keywords = request.keyword.split(',').map(k => k.trim()).filter(k => k);
        let totalTabs = 0;
        
        if (keywords.length === 0) return true;
        
        keywords.forEach(kw => {
            const encodedKeyword = encodeURIComponent(kw);
            const engines = [
                `https://www.google.com/search?tbm=isch&q=${encodedKeyword}`,
                `https://www.bing.com/images/search?q=${encodedKeyword}`,
                `https://image.baidu.com/search/index?tn=baiduimage&word=${encodedKeyword}`
            ];
            
            engines.forEach(url => {
                totalTabs++;
                chrome.tabs.create({ url: url, active: false }, (tab) => {
                    // Cố tình đợi 3 giây thay vì chờ 'complete' vì nhiều trang search load vô tận gây kẹt
                    setTimeout(() => {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        }, () => {
                            setTimeout(() => {
                               chrome.tabs.sendMessage(tab.id, { action: 'startScraping', keyword: kw });
                            }, 500);
                        });
                    }, 3000);
                });
            });
        });
        
        sendResponse({ status: `Đã mở ${totalTabs} tab tìm kiếm, đang xử lý tải xuống (khoảng 15-20s)...` });
        return true;
    }

    if (request.action === 'downloadImages') {
        const images = request.images;
        const keyword = request.keyword;
        const safeKeyword = keyword.replace(/[\/\\?%*:|"<>]/g, '-');
        const sourceName = request.source || 'img';
        
        if (!images || images.length === 0) {
            console.log("Không có ảnh nào để tải từ một tab.");
            return;
        }

        const getTimestamp = () => Date.now().toString();

        images.forEach((imgUrl, index) => {
            setTimeout(() => {
                const timestamp = getTimestamp();
                const filename = `${safeKeyword}/${sourceName}_${timestamp}-${safeKeyword}.jpg`;
                
                chrome.downloads.download({
                    url: imgUrl,
                    filename: filename,
                    saveAs: false
                });
            }, index * 200);
        });
    }
});
