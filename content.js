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
  
  // Get all images on the page
  const allImages = document.querySelectorAll('img');
  console.log(`🎯 Google: Found ${allImages.length} img tags`);
  
  let skippedEmpty = 0;
  let skippedSmall = 0;
  let accepted = 0;
  
  allImages.forEach((img, index) => {
    try {
      const imageUrl = img.src;
      
      // Skip empty URLs
      if (!imageUrl) {
        skippedEmpty++;
        return;
      }
      
      // Accept both http/https URLs AND base64 data URLs
      // Google uses data:image/jpeg;base64,... for thumbnails
      const isValidUrl = imageUrl.startsWith('http') || imageUrl.startsWith('data:image/');
      
      if (!isValidUrl) {
        skippedEmpty++;
        return;
      }
      
      // Get dimensions - use getAttribute first, fallback to properties
      let width = parseInt(img.getAttribute('width')) || img.width || img.naturalWidth || 0;
      let height = parseInt(img.getAttribute('height')) || img.height || img.naturalHeight || 0;
      
      // If dimensions unknown, assume they're valid
      if (width === 0 && height === 0) {
        width = 200;
        height = 200;
      }
      
      const title = img.alt || img.title || '';
      
      // Skip only clearly tiny images (likely icons)
      if (width > 0 && height > 0 && (width < 100 || height < 100)) {
        skippedSmall++;
        return;
      }
      
      images.push({
        url: imageUrl,
        title: title || keyword,
        width: width,
        height: height,
        source: 'google'
      });
      accepted++;
      
      if (accepted <= 5) {
        const urlPreview = imageUrl.startsWith('data:') ? 'data:image/...' : imageUrl.substring(0, 60);
        console.log(`✅ Google image ${accepted} (${width}x${height}): ${urlPreview}...`);
      }
    } catch (error) {
      console.error('‼️ Error parsing Google image:', error);
    }
  });
  
  console.log(`✅ Google: Extracted ${images.length} images (skipped: ${skippedEmpty} empty, ${skippedSmall} too small)`);
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
  
  // Get all images on the page
  const allImages = document.querySelectorAll('img');
  console.log(`🎯 Bing: Found ${allImages.length} img tags`);
  
  allImages.forEach((img, index) => {
    try {
      const imageUrl = img.src;
      
      // Skip data URLs
      if (!imageUrl || imageUrl.startsWith('data:')) {
        return;
      }
      
      // Get dimensions - try multiple sources
      let width = parseInt(img.getAttribute('width')) || img.width || img.naturalWidth || 0;
      let height = parseInt(img.getAttribute('height')) || img.height || img.naturalHeight || 0;
      
      // If dimensions unknown, assume valid
      if (width === 0 && height === 0) {
        width = 200;
        height = 200;
      }
      
      const title = img.alt || img.title || '';
      
      // Skip only clearly tiny images
      if (width > 0 && height > 0 && (width < 100 || height < 100)) {
        return;
      }
      
      // Accept all http/https images
      if (imageUrl.startsWith('http')) {
        images.push({
          url: imageUrl,
          title: title || keyword,
          width: width,
          height: height,
          source: 'bing'
        });
        
        if (index < 5) {
          console.log(`✅ Bing image ${index + 1} (${width}x${height}): ${imageUrl.substring(0, 80)}...`);
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
  
  // Get all images on the page
  const allImages = document.querySelectorAll('img');
  console.log(`🎯 Yandex: Found ${allImages.length} img tags`);
  
  allImages.forEach((img, index) => {
    try {
      const imageUrl = img.src;
      
      // Skip data URLs
      if (!imageUrl || imageUrl.startsWith('data:')) {
        return;
      }
      
      // Get dimensions - try multiple sources
      let width = parseInt(img.getAttribute('width')) || img.width || img.naturalWidth || 0;
      let height = parseInt(img.getAttribute('height')) || img.height || img.naturalHeight || 0;
      
      // If dimensions unknown, assume valid
      if (width === 0 && height === 0) {
        width = 200;
        height = 200;
      }
      
      const title = img.alt || img.title || '';
      
      // Skip only clearly tiny images
      if (width > 0 && height > 0 && (width < 100 || height < 100)) {
        return;
      }
      
      // Accept all http/https images
      if (imageUrl.startsWith('http')) {
        images.push({
          url: imageUrl,
          title: title || keyword,
          width: width,
          height: height,
          source: 'yandex'
        });
        
        if (index < 5) {
          console.log(`✅ Yandex image ${index + 1} (${width}x${height}): ${imageUrl.substring(0, 80)}...`);
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
