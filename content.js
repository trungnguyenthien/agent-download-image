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
  const seenUrls = new Set(); // Track URLs to avoid duplicates in this scrape

  console.log(`🎯 Scraping ${engine} for keyword: ${keyword}`);

  let rawImages = [];
  switch (engine) {
    case 'google':
      rawImages = scrapeGoogleImages(keyword);
      break;
    case 'bing':
      rawImages = scrapeBingImages(keyword);
      break;
    case 'yandex':
      rawImages = scrapeYandexImages(keyword);
      break;
    default:
      console.error(`‼️ Unknown engine: ${engine}`);
  }

  // Deduplicate by URL in this batch
  rawImages.forEach(img => {
    if (!seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      images.push(img);
    }
  });

  console.log(`✅ Found ${images.length} unique images from ${engine}`);
  
  if (images.length === 0) {
    console.log(`⚠️ No images found. Check if selectors are correct for ${engine}`);
  }
  
  return images;
}

/**
 * Scrape images from Google image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeGoogleImages(keyword) {
  const images = [];
  
  console.log('🎯 Google: Looking for images...');
  
  // Google Images uses various selectors
  // Try multiple approaches
  let imageElements = document.querySelectorAll('img[data-src]');
  
  if (imageElements.length === 0) {
    imageElements = document.querySelectorAll('.rg_i');
  }
  
  if (imageElements.length === 0) {
    // Fallback: get all images with decent size
    const allImgs = document.querySelectorAll('img');
    const filtered = [];
    allImgs.forEach(img => {
      const width = img.width || img.naturalWidth || 0;
      const height = img.height || img.naturalHeight || 0;
      if (width > 100 && height > 100) {
        filtered.push(img);
      }
    });
    imageElements = filtered;
  }
  
  console.log(`🎯 Google: Found ${imageElements.length} image elements`);

  imageElements.forEach((img, index) => {
    try {
      // Try to get the original image URL from data attributes
      let imageUrl = img.getAttribute('data-src') || 
                     img.getAttribute('data-iurl') ||
                     img.src;
      
      const title = img.alt || img.title || '';
      
      // Skip invalid URLs
      if (!imageUrl || !imageUrl.startsWith('http')) {
        return;
      }
      
      // Skip Google's own assets
      if (imageUrl.includes('google.com') && !imageUrl.includes('googleusercontent')) {
        return;
      }
      
      // Try to get dimensions from parent element's metadata
      let width = 0;
      let height = 0;
      
      const parent = img.closest('[data-w]') || img.closest('div[jsname]');
      if (parent) {
        width = parseInt(parent.getAttribute('data-w')) || 0;
        height = parseInt(parent.getAttribute('data-h')) || 0;
      }

      images.push({
        url: imageUrl,
        title: title || keyword,
        width: width || 0,
        height: height || 0,
        source: 'google'
      });
      
      if (index < 5) {
        console.log(`✅ Google image ${index + 1}: ${imageUrl.substring(0, 80)}...`);
      }
    } catch (error) {
      console.error('‼️ Error parsing Google image:', error);
    }
  });
  
  console.log(`✅ Google: Extracted ${images.length} images`);
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
  console.log('🎯 DuckDuckGo: Current URL:', window.location.href);
  
  // Try multiple selectors in order of preference
  const selectors = [
    '.tile--img',
    '.tile',
    '[data-id]',
    '.tile--img__media',
    'div[data-id] img',
    '.tile img'
  ];
  
  let elements = [];
  for (const selector of selectors) {
    elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`🎯 DuckDuckGo: Found ${elements.length} elements using: ${selector}`);
      break;
    }
  }
  
  // If still no elements, try getting all images as last resort
  if (elements.length === 0) {
    console.log('⚠️ DuckDuckGo: No tiles found, scanning all images on page');
    const allImgs = document.querySelectorAll('img');
    console.log(`🎯 DuckDuckGo: Total images on page: ${allImgs.length}`);
    
    allImgs.forEach((img, idx) => {
      if (idx < 5) {
        console.log(`Image ${idx}: src=${img.src?.substring(0, 50)}, width=${img.width}, height=${img.height}`);
      }
    });
    
    // Filter to only significant images
    elements = Array.from(allImgs).filter(img => {
      const width = img.width || img.naturalWidth || 0;
      const height = img.height || img.naturalHeight || 0;
      return width > 80 && height > 80; // Filter out small icons
    });
    
    console.log(`🎯 DuckDuckGo: Filtered to ${elements.length} significant images`);
  }

  elements.forEach((elem, index) => {
    try {
      // Get the img element
      let img = elem;
      if (elem.tagName !== 'IMG') {
        img = elem.querySelector('img');
      }
      
      if (!img) {
        if (index < 3) console.log(`⚠️ Element ${index}: No img found`);
        return;
      }
      
      // Try all possible sources for image URL
      let imageUrl = img.getAttribute('data-src') || 
                     img.getAttribute('src') || 
                     img.currentSrc ||
                     img.getAttribute('data-lazy-src');
      
      const title = img.alt || img.title || '';
      
      if (index < 3) {
        console.log(`Image ${index}: url=${imageUrl?.substring(0, 60)}, title=${title.substring(0, 30)}`);
      }
      
      // Skip invalid URLs
      if (!imageUrl || !imageUrl.startsWith('http')) {
        if (index < 3) console.log(`⚠️ Image ${index}: Invalid URL`);
        return;
      }
      
      // Skip DuckDuckGo's own icons/assets (but keep external-content)
      if (imageUrl.includes('duckduckgo.com') && !imageUrl.includes('external-content')) {
        if (index < 3) console.log(`⚠️ Image ${index}: DuckDuckGo internal asset`);
        return;
      }

      images.push({
        url: imageUrl,
        title: title || keyword,
        width: 0,  // Will use default in processing
        height: 0,
        source: 'duckduckgo'
      });
      
      if (index < 5) {
        console.log(`✅ DuckDuckGo image ${images.length}: ${imageUrl.substring(0, 80)}...`);
      }
    } catch (error) {
      console.error('‼️ Error parsing DuckDuckGo image:', error);
    }
  });
  
  console.log(`✅ DuckDuckGo: Extracted ${images.length} valid images`);
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
