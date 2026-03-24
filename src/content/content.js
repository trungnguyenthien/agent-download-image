/**
 * content.js — Image Origin Downloader
 * Content script injected into Google Image and Bing Image search pages.
 * Extracts high-quality image data from the page DOM and sends it to the popup.
 */

// ── Helpers ────────────────────────────────────────────────

/**
 * Extracts the best available URL from an <img> element.
 * Prefers data-src (lazy-loaded) over src.
 * @param {HTMLImageElement} img
 * @returns {string}
 */
function getBestSrc(img) {
  return img.dataset.full || img.dataset.src || img.dataset.lzpsrc || img.currentSrc || img.src;
}

/**
 * Extracts a clean text from an element, stripping extra whitespace.
 * @param {Element|null} el
 * @returns {string}
 */
function getText(el) {
  return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
}

// ── Google Image Extractor ─────────────────────────────────

/**
 * Extracts high-quality image data from a Google Images search page.
 *
 * Strategy:
 *  1. Walk through visible image containers (div.ivg-i).
 *  2. Find the inner <img> — it holds the preview / lazy src.
 *  3. The high-res URL is stored in img.parentElement.dataset or extracted
 *     from a sibling link's href that points to the original image page.
 *  4. title / alt are pulled from surrounding metadata.
 *
 * @returns {Array<{url:string, thumbUrl:string, title:string, alt:string, width:number, height:number}>}
 */
function extractGoogleImages() {
  const results = [];

  // Primary selector: each result card
  const cards = document.querySelectorAll('div.ivg-i, div[data-ved]');

  cards.forEach((card) => {
    // Look for the main image inside the card
    const img = card.querySelector('img');
    if (!img) return;

    const thumbUrl = getBestSrc(img);
    if (!thumbUrl || !thumbUrl.startsWith('http')) return;

    // Try to find the high-res URL
    // Google stores it in the parent <a> href pointing to /imgres?imgurl=...
    const link  = card.closest('a') || card.querySelector('a');
    let highResUrl = thumbUrl;

    if (link && link.href) {
      try {
        const params = new URL(link.href, window.location.href).searchParams;
        const imgurl = params.get('imgurl');
        if (imgurl && imgurl.startsWith('http')) {
          highResUrl = imgurl;
        }
      } catch (_) {}
    }

    // Fallback: look for data attributes on the img or card
    const cardData = card.dataset;
    if (cardData.src)         highResUrl = cardData.src;
    if (cardData.full)        highResUrl = cardData.full;
    if (cardData.lzpsrc)      highResUrl = cardData.lzpsrc;

    // Metadata: title
    const titleEl = card.querySelector('.title, .fKDtNb, [role="heading"]') ||
                     card.closest('[data-query]')?.querySelector('.title');
    const title = getText(titleEl);

    // Metadata: alt / description
    const metaEl = card.querySelector('.VVEnSb, .DuOXVc, [data-ved]');
    const alt    = getText(metaEl);

    // Size: Google shows dimensions in a span if available
    let width  = 0;
    let height = 0;
    const sizeEl = card.querySelector('.G8a9O, .oufhcb, [style*="width"]');
    if (sizeEl) {
      const sizeText = getText(sizeEl);
      const match    = sizeText.match(/(\d+)\s*[×xX]\s*(\d+)/);
      if (match) {
        width  = parseInt(match[1], 10);
        height = parseInt(match[2], 10);
      }
    }

    // If size is still missing, try to extract from URL params or img natural dimensions
    if (!width || !height) {
      width  = img.naturalWidth  || img.width  || 0;
      height = img.naturalHeight || img.height || 0;
    }

    // Deduplicate by URL
    if (results.some((r) => r.url === highResUrl)) return;

    results.push({
      url:      highResUrl,
      thumbUrl: thumbUrl,
      title,
      alt,
      width,
      height,
    });
  });

  // Fallback: if no cards found, try older Google Image structure
  if (results.length === 0) {
    const imgs = document.querySelectorAll('img.rg_i, img.Q4LuWd');
    imgs.forEach((img) => {
      const url = getBestSrc(img);
      if (!url || !url.startsWith('http')) return;
      if (results.some((r) => r.url === url)) return;
      results.push({
        url:      url,
        thumbUrl: url,
        title:    img.alt || img.title || '',
        alt:      img.alt || '',
        width:    img.naturalWidth  || img.width  || 0,
        height:   img.naturalHeight || img.height || 0,
      });
    });
  }

  return results;
}

// ── Bing Image Extractor ───────────────────────────────────

/**
 * Extracts high-quality image data from a Bing Images search page.
 *
 * Strategy:
 *  1. Walk through .imgpt / .iusc containers.
 *  2. Extract m (metadata JSON) which contains the full-res URL, title, and size.
 *  3. The preview URL is in the img's src attribute.
 *
 * @returns {Array<{url:string, thumbUrl:string, title:string, alt:string, width:number, height:number}>}
 */
function extractBingImages() {
  const results = [];

  // Primary selector: result item containers
  const items = document.querySelectorAll('.imgpt, .iusc');

  items.forEach((item) => {
    let url      = '';
    let thumbUrl = '';
    let title    = '';
    let alt      = '';
    let width    = 0;
    let height   = 0;

    // Strategy 1: parse metadata from .iusc JSON
    const mjson = item.dataset.mbf || item.dataset.m || item.getAttribute('m');
    if (mjson) {
      try {
        const meta = JSON.parse(mjson);
        url    = meta.murl || meta.turl || '';
        title  = meta.t  || meta.title || '';
        alt    = meta.desc || meta.t || '';

        // Size from metadata
        if (meta.ow) width  = parseInt(meta.ow, 10);
        if (meta.oh) height = parseInt(meta.oh, 10);

        // thmb = thumbnail, mfn = medium, murl = main/full
        thumbUrl = meta.tbn || meta.mfn || url;
      } catch (_) {}
    }

    // Strategy 2: fallback to img element
    if (!url) {
      const img = item.querySelector('img');
      if (img) {
        url      = img.dataset.full || img.dataset.src || img.currentSrc || img.src;
        thumbUrl = img.src || url;
        title    = img.alt || '';
        alt      = img.alt || '';
        width    = img.naturalWidth  || 0;
        height   = img.naturalHeight || 0;
      }
    }

    // Strategy 3: extract from href link to image
    if (!url) {
      const link = item.closest('a') || item.querySelector('a[href*="/images/search"]');
      if (link && link.href) {
        try {
          const params = new URL(link.href, window.location.href).searchParams;
          url = params.get('imgurl') || params.get('url') || '';
        } catch (_) {}
      }
    }

    if (!url || !url.startsWith('http')) return;
    if (!thumbUrl) thumbUrl = url;
    if (results.some((r) => r.url === url)) return;

    results.push({ url, thumbUrl, title, alt, width, height });
  });

  return results;
}

// ── Message Listener ────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_IMAGES') {
    const engine = message.engine;
    let images = [];

    if (engine === 'google') {
      images = extractGoogleImages();
    } else if (engine === 'bing') {
      images = extractBingImages();
    }

    // Resolve image dimensions for any image where width/height are still 0
    const pending = images.filter((img) => !img.width || !img.height);
    images = images.filter((img) => img.width && img.height);

    // For images without dimensions, try to load them to get natural size
    const dimensionPromises = pending.map(
      (img) =>
        new Promise((resolve) => {
          const testImg = new Image();
          testImg.onload = () => {
            img.width  = testImg.naturalWidth;
            img.height = testImg.naturalHeight;
            resolve();
          };
          testImg.onerror = () => resolve();
          testImg.src = img.url;
          // Timeout after 3s
          setTimeout(resolve, 3000);
        }),
    );

    Promise.all(dimensionPromises).then(() => {
      sendResponse(images);
    });

    return true; // keep channel open for async response
  }

  return false;
});
