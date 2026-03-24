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
  }

  console.log(`✅ Found ${images.length} images`);
  return images;
}

/**
 * Scrape images from Bing image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeBingImages(keyword) {
  const images = [];
  const imageElements = document.querySelectorAll('.iusc');

  imageElements.forEach((elem) => {
    try {
      const data = JSON.parse(elem.getAttribute('m') || '{}');
      const murl = data.murl; // Original image URL
      const title = data.t || '';
      const width = data.w || 0;
      const height = data.h || 0;

      if (murl && containsKeyword(title, keyword)) {
        images.push({
          url: murl,
          title: title,
          width: width,
          height: height,
          source: 'bing'
        });
      }
    } catch (error) {
      console.error('‼️ Error parsing Bing image:', error);
    }
  });

  return images;
}

/**
 * Scrape images from DuckDuckGo image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeDuckDuckGoImages(keyword) {
  const images = [];
  const imageElements = document.querySelectorAll('img[data-id]');

  imageElements.forEach((img) => {
    try {
      const src = img.getAttribute('data-src') || img.src;
      const alt = img.alt || '';

      if (src && src.startsWith('http') && containsKeyword(alt, keyword)) {
        images.push({
          url: src,
          title: alt,
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
          source: 'duckduckgo'
        });
      }
    } catch (error) {
      console.error('‼️ Error parsing DuckDuckGo image:', error);
    }
  });

  return images;
}

/**
 * Scrape images from Yandex image search
 * @param {string} keyword - The search keyword
 * @returns {Array} Array of image objects
 */
function scrapeYandexImages(keyword) {
  const images = [];
  const imageElements = document.querySelectorAll('.serp-item__link');

  imageElements.forEach((elem) => {
    try {
      const img = elem.querySelector('img');
      if (!img) return;

      const href = elem.href || '';
      const alt = img.alt || '';
      const width = parseInt(elem.getAttribute('data-bem')?.match(/"w":(\d+)/)?.[1] || '0');
      const height = parseInt(elem.getAttribute('data-bem')?.match(/"h":(\d+)/)?.[1] || '0');

      // Extract original URL from href
      const urlMatch = href.match(/img_url=([^&]+)/);
      const imageUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : img.src;

      if (imageUrl && containsKeyword(alt, keyword)) {
        images.push({
          url: imageUrl,
          title: alt,
          width: width,
          height: height,
          source: 'yandex'
        });
      }
    } catch (error) {
      console.error('‼️ Error parsing Yandex image:', error);
    }
  });

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
