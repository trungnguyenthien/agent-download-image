/**
 * Content script for scraping images from search engine results
 * Runs on all search engine pages and extracts image information
 */

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeImages') {
    console.log('🎯 Starting image scraping for:', request.engine);
    
    const images = scrapeImagesFromPage(request.engine, request.keyword);
    sendResponse({ images });
    return true;
  }

  if (request.action === 'nextPage') {
    console.log('🎯 Navigating to next page');
    goToNextPage(request.engine);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Scrape images from the current page based on search engine
 * @param {string} engine - The search engine name
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeImagesFromPage(engine, keyword) {
  const images = [];

  console.log(`🎯 Scraping ${engine} for keyword: ${keyword}`);

  switch (engine) {
    case 'bing':
      images.push(...scrapeBingImages(keyword));
      break;
    case 'duckduckgo':
      images.push(...scrapeDuckDuckGoImages(keyword));
      break;
    case 'yandex':
      images.push(...scrapeYandexImages(keyword));
      break;
    default:
      console.error(`‼️ Unknown engine: ${engine}`);
  }

  console.log(`✅ Found ${images.length} images from ${engine}`);
  
  if (images.length === 0) {
    console.log(`⚠️ No images found. Check if selectors are correct for ${engine}`);
  }
  
  return images;
}

/**
 * Scrape images from Bing image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeBingImages(keyword) {
  const images = [];
  
  console.log('🎯 Bing: Looking for images...');
  const imageElements = document.querySelectorAll('.iusc');
  console.log(`🎯 Bing: Found ${imageElements.length} image elements`);

  imageElements.forEach((elem, index) => {
    try {
      const data = JSON.parse(elem.getAttribute('m') || '{}');
      const murl = data.murl; // Original image URL
      const title = data.t || '';
      const width = data.w || 0;
      const height = data.h || 0;

      if (murl) {
        images.push({
          url: murl,
          title: title || keyword,
          width: width,
          height: height,
          source: 'bing'
        });
        
        if (index < 5) {
          console.log(`✅ Bing image ${index + 1}: ${murl.substring(0, 60)}...`);
        }
      }
    } catch (error) {
      console.error('‼️ Error parsing Bing image:', error);
    }
  });

  console.log(`✅ Bing: Extracted ${images.length} images`);
  return images;
}

/**
 * Scrape images from DuckDuckGo image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeDuckDuckGoImages(keyword) {
  const images = [];
  
  console.log('🎯 DuckDuckGo: Looking for images...');
  
  // Try multiple selectors as DuckDuckGo structure can vary
  // First try: specific tile images
  let imageElements = document.querySelectorAll('.tile--img__img');
  
  // Fallback: try other possible selectors
  if (imageElements.length === 0) {
    imageElements = document.querySelectorAll('img[data-id]');
  }
  
  if (imageElements.length === 0) {
    imageElements = document.querySelectorAll('.tile img');
  }
  
  // Last resort: get all images and filter
  if (imageElements.length === 0) {
    console.log('⚠️ DuckDuckGo: Using fallback - all img tags');
    const allImages = document.querySelectorAll('img');
    const validImages = [];
    allImages.forEach(img => {
      // Filter out tiny images (icons, logos, etc)
      if (img.width > 100 || img.naturalWidth > 100 || img.getAttribute('width') > 100) {
        validImages.push(img);
      }
    });
    imageElements = validImages;
  }
  
  console.log(`🎯 DuckDuckGo: Found ${imageElements.length} image elements`);

  imageElements.forEach((img, index) => {
    try {
      // Get the highest quality source available
      let src = img.getAttribute('data-src') || 
                img.getAttribute('src') || 
                img.currentSrc ||
                img.getAttribute('data-lazy-src');
      
      // Skip if no valid source
      if (!src || !src.startsWith('http')) {
        return;
      }
      
      // Skip DuckDuckGo's own assets
      if (src.includes('duckduckgo.com') && !src.includes('external-content')) {
        return;
      }
      
      const alt = img.alt || img.title || '';
      
      // Try to get original image URL from parent element's data attributes or link
      const parent = img.closest('[data-id]') || img.closest('.tile') || img.closest('a');
      let originalUrl = src;
      
      if (parent) {
        // Check if parent is a link with better URL
        if (parent.tagName === 'A' && parent.href && parent.href.startsWith('http')) {
          // For DuckDuckGo, the link might contain the image parameter
          const linkUrl = parent.href;
          if (linkUrl.includes('http') && !linkUrl.includes('duckduckgo.com/y.js')) {
            originalUrl = linkUrl;
          }
        }
      }

      // Use the better of src or originalUrl
      const finalUrl = originalUrl.length > src.length ? originalUrl : src;

      if (finalUrl && finalUrl.startsWith('http')) {
        images.push({
          url: finalUrl,
          title: alt || keyword,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          source: 'duckduckgo'
        });
        
        if (index < 5) {
          console.log(`✅ DuckDuckGo image ${index + 1}: ${finalUrl.substring(0, 60)}...`);
        }
      }
    } catch (error) {
      console.error('‼️ Error parsing DuckDuckGo image:', error);
    }
  });
  
  console.log(`✅ DuckDuckGo: Extracted ${images.length} images`);
  return images;
}

/**
 * Scrape images from Yandex image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeYandexImages(keyword) {
  const images = [];
  
  console.log('🎯 Yandex: Looking for images...');
  
  // Try multiple selectors for Yandex
  let imageElements = document.querySelectorAll('.serp-item');
  
  if (imageElements.length === 0) {
    imageElements = document.querySelectorAll('.MediaGrid-Item');
  }
  
  if (imageElements.length === 0) {
    imageElements = document.querySelectorAll('.serp-item__link');
  }
  
  // Fallback: look for any images that might be search results
  if (imageElements.length === 0) {
    console.log('⚠️ Yandex: Using fallback - all img tags');
    const allImages = document.querySelectorAll('img');
    const validImages = [];
    allImages.forEach(img => {
      // Filter out tiny images (icons, logos, etc)
      if (img.width > 100 || img.naturalWidth > 100) {
        validImages.push(img.parentElement || img);
      }
    });
    imageElements = validImages;
  }
  
  console.log(`🎯 Yandex: Found ${imageElements.length} image elements`);

  imageElements.forEach((elem, index) => {
    try {
      const img = elem.querySelector('img') || (elem.tagName === 'IMG' ? elem : null);
      if (!img) return;

      const alt = img.alt || img.title || '';
      let imageUrl = img.src || img.getAttribute('src');
      let width = 0;
      let height = 0;

      // Try to get original image URL from parent link
      const link = elem.querySelector('a') || elem.closest('a') || elem;
      if (link && link.href) {
        // Extract original URL from href parameter
        const urlMatch = link.href.match(/img_url=([^&]+)/);
        if (urlMatch) {
          imageUrl = decodeURIComponent(urlMatch[1]);
        } else if (link.href.startsWith('http') && !link.href.includes('yandex.')) {
          // If href is a direct image URL (not yandex internal)
          imageUrl = link.href;
        }
      }

      // Try to extract dimensions from data attributes
      const dataJson = elem.getAttribute('data-bem') || elem.getAttribute('data-state');
      if (dataJson) {
        try {
          const widthMatch = dataJson.match(/"w[idth]*":(\d+)/i);
          const heightMatch = dataJson.match(/"h[eight]*":(\d+)/i);
          if (widthMatch) width = parseInt(widthMatch[1]);
          if (heightMatch) height = parseInt(heightMatch[1]);
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Fallback to natural dimensions
      if (!width) width = img.naturalWidth || img.width || 0;
      if (!height) height = img.naturalHeight || img.height || 0;

      if (imageUrl && imageUrl.startsWith('http')) {
        // Skip Yandex's own assets
        if (imageUrl.includes('yandex.') && !imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
          return;
        }
        
        images.push({
          url: imageUrl,
          title: alt || keyword,
          width: width,
          height: height,
          source: 'yandex'
        });
        
        if (index < 5) {
          console.log(`✅ Yandex image ${index + 1}: ${imageUrl.substring(0, 60)}...`);
        }
      }
    } catch (error) {
      console.error('‼️ Error parsing Yandex image:', error);
    }
  });
  
  console.log(`✅ Yandex: Extracted ${images.length} images`);
  return images;
}

/**
 * Check if text contains keyword (case-insensitive)
 * @param {string} text - The text to check
 * @param {string} keyword - The keyword to find
 * @returns {boolean} True if keyword is found
 */
function containsKeyword(text, keyword) {
  if (!text || !keyword) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Navigate to next page on the search engine
 * @param {string} engine - The search engine name
 */
function goToNextPage(engine) {
  let nextButton = null;

  switch (engine) {
    case 'bing':
      nextButton = document.querySelector('.sb_pagN');
      break;
    case 'duckduckgo':
      // DuckDuckGo uses infinite scroll, scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      break;
    case 'yandex':
      nextButton = document.querySelector('.Pager-Item_type_next .Link');
      break;
  }

  if (nextButton && nextButton.click) {
    nextButton.click();
    console.log('✅ Clicked next page button');
  } else {
    console.log('⚠️ No next page button found');
  }
}

console.log('🎯 Content script loaded');
