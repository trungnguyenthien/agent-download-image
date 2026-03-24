chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        const lowerKeyword = request.keyword.toLowerCase();
        const originalKeyword = request.keyword;
        
        let scrolls = 0;
        const maxScrolls = 10;
        window.downloadedUrls = window.downloadedUrls || new Set();

        const scrollInterval = setInterval(() => {
            extractAndSendImages(lowerKeyword, originalKeyword);
            
            const currentHeight = document.body.scrollHeight || document.documentElement.scrollHeight;
            window.scrollTo({ top: currentHeight, behavior: 'smooth' });
            
            // Dispatch a generic scroll event to trigger infinite loaders listening to 'scroll'
            window.dispatchEvent(new Event('scroll'));
            
            scrolls++;
            
            // Click "Show more" buttons if available for different engines
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            
            const moreBtnGoogle = document.querySelector('.mye4qd');
            if (moreBtnGoogle && moreBtnGoogle.offsetHeight > 0) moreBtnGoogle.dispatchEvent(clickEvent);
            
            const moreBtnBing = document.querySelector('a.btn_seemore');
            if (moreBtnBing && moreBtnBing.offsetHeight > 0) moreBtnBing.dispatchEvent(clickEvent);
            
            // Attempt to find any element (button or link) that is visible and contains "load" or "more" phrases
            // This caters to localized texts like "Chuyển đến trang khác", "Hiển thị thêm", etc.
            const genericMoreBtns = document.querySelectorAll('a, button, div');
            for (let btn of genericMoreBtns) {
                if (btn.offsetHeight > 0) {
                    const text = (btn.innerText || '').toLowerCase().trim();
                    const cls = (btn.className || '');
                    if (
                        text === 'show more results' || text === 'hiển thị thêm' || text === 'tải thêm' || text === 'xem thêm kết quả' || text === 'xem thêm hình ảnh' || 
                        (cls && typeof cls === 'string' && (cls.includes('loadmore') || cls.includes('seemore') || cls.includes('more_direction_next') || cls.includes('SerpList-LoadMoreButton')))
                    ) {
                        btn.dispatchEvent(clickEvent);
                    }
                }
            }
            
            if (scrolls >= maxScrolls) {
                clearInterval(scrollInterval);
                extractAndSendImages(lowerKeyword, originalKeyword); // Final extraction
            }
        }, 1500);
    }
});

function extractAndSendImages(lowerKeyword, originalKeyword) {
    let sourceName = 'unknown';
    if (window.location.hostname.includes('google')) sourceName = 'google';
    else if (window.location.hostname.includes('bing')) sourceName = 'bing';
    else if (window.location.hostname.includes('baidu')) sourceName = 'baidu';

    const fullHtml = sourceName === 'google' ? document.documentElement.innerHTML : '';
    const images = Array.from(document.querySelectorAll('img'));
    const matchedUrls = [];
    
    images.forEach(img => {
        const src = img.src || img.getAttribute('data-src');
        const alt = (img.alt || '').toLowerCase();
        
        const anchor = img.closest('a');
        const titleAttr = anchor ? (anchor.title || '').toLowerCase() : '';
        const ariaLabel = anchor ? (anchor.getAttribute('aria-label') || '').toLowerCase() : '';
        const textContent = anchor ? (anchor.textContent || '').toLowerCase() : '';
        
        // Try to obtain high-res URL if available (Bing uses m="{murl:...}", Baidu uses data-objurl)
        let highResSrc = null;
        const mAttr = anchor ? anchor.getAttribute('m') : null;
        if (mAttr && mAttr.includes('murl')) {
            try {
                const mData = JSON.parse(mAttr);
                if (mData.murl) highResSrc = mData.murl;
            } catch(e) {}
        }
        const baiduSrc = img.getAttribute('data-imgurl') || img.getAttribute('data-objurl') || img.getAttribute('objurl') || (img.dataset && img.dataset.imgurl);
        if (baiduSrc) highResSrc = baiduSrc;

        // Google Google High-Res Extraction via internal JSON mapping (tbnid)
        if (sourceName === 'google') {
            const tbnContainer = img.closest('[data-tbnid]');
            const tbnid = tbnContainer ? tbnContainer.getAttribute('data-tbnid') : null;
            if (tbnid) {
                const searchIdx = fullHtml.indexOf('"' + tbnid + '"');
                if (searchIdx !== -1) {
                    try {
                        const slice = fullHtml.substring(searchIdx, searchIdx + 4000);
                        // In Google's internal JSON, the high res URL and its dimensions usually look like: ["https://original.com/x.jpg", 1920, 1080]
                        const match = slice.match(/\["(https?:\/\/[^"]+)",\d+,\d+\]/);
                        if (match && match[1]) {
                            // Unescape \u003d -> =, \u0026 -> & safely via JSON.parse
                            highResSrc = JSON.parse('"' + match[1] + '"');
                        }
                    } catch(e) {}
                }
            }
            
            // Fallback: Try to parse imgurl from Google's anchor (often in /imgres?imgurl=...)
            if (!highResSrc && anchor && anchor.href) {
                try {
                    const u = new URL(anchor.href, window.location.origin);
                    if (u.searchParams.has('imgurl')) {
                        highResSrc = u.searchParams.get('imgurl');
                    } else if (u.searchParams.has('url') && u.pathname.includes('imgres')) {
                        highResSrc = u.searchParams.get('url');
                    }
                } catch (err) {}
            }
        }
        
        const isMatch = alt.includes(lowerKeyword) || titleAttr.includes(lowerKeyword) || ariaLabel.includes(lowerKeyword) || textContent.includes(lowerKeyword);
        
        if (isMatch) {
            // We successfully extracted the original URL, assume it's large and high res
            if (highResSrc) {
                matchedUrls.push(highResSrc);
            } else {
                // If we couldn't find a high-res equivalent, we MUST check if the thumbnail itself is large enough (> 300x300)
                const w = img.naturalWidth || parseInt(img.getAttribute('width') || 0);
                const h = img.naturalHeight || parseInt(img.getAttribute('height') || 0);
                if (w >= 300 && h >= 300 && src) {
                    matchedUrls.push(src);
                }
            }
        }
    });
    
    const uniqueUrls = [...new Set(matchedUrls)].filter(u => !window.downloadedUrls.has(u));
    uniqueUrls.forEach(u => window.downloadedUrls.add(u));
    
    if (uniqueUrls.length > 0) {
        chrome.runtime.sendMessage({
            action: 'downloadImages',
            images: uniqueUrls,
            keyword: originalKeyword,
            source: sourceName
        });
    }
}
