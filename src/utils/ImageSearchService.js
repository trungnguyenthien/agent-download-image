/**
 * ImageSearchService.js
 * Handles fetching image search results from Google Image and Bing Image.
 *
 * Strategy:
 *  - Sends messages to the content script (injected into search engine tabs)
 *    to extract image data directly from the live DOM.
 *  - If the active tab is not a supported search engine, opens a new tab and
 *    navigates to the search URL.
 */

import { Messenger } from './Messenger.js';

// ── URL Builders ───────────────────────────────────────────

/**
 * Builds a search URL for Google Images.
 * @param {string} keyword
 * @param {number} page  0-indexed
 * @returns {string}
 */
function buildGoogleURL(keyword, page) {
  const encoded = encodeURIComponent(keyword);
  // Google Images: each page = 20 images (0, 1, 2 …)
  const start = page * 20;
  return `https://www.google.com/search?tbm=isch&q=${encoded}&start=${start}`;
}

/**
 * Builds a search URL for Bing Images.
 * @param {string} keyword
 * @param {number} page  0-indexed
 * @returns {string}
 */
function buildBingURL(keyword, page) {
  const encoded = encodeURIComponent(keyword);
  // Bing Images: first page = 35 imgs, subsequent = 48 each
  const first = 35;
  const subsequent = 48;
  const offset = page === 0 ? 0 : first + (page - 1) * subsequent;
  return `https://www.bing.com/images/search?q=${encoded}&first=${offset}`;
}

// ── Search Engine Extractors ────────────────────────────────

/**
 * Extracts images from Google Images search page via content script.
 * Looks for data in JSON-LD, og:image meta, and direct img src.
 * @param {string} tabUrl
 * @returns {Promise<Array<{url:string, thumbUrl:string, title:string, alt:string, width:number, height:number}>>}
 */
async function extractGoogleImages(tabUrl) {
  if (!tabUrl.includes('google.com/search?tbm=isch')) return [];
  try {
    const response = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = response[0];
    if (!tab || !tab.id) return [];

    // Message the content script to extract data
    const results = await Messenger.sendToTab(tab.id, { type: 'EXTRACT_IMAGES', engine: 'google' });
    return results || [];
  } catch (_) {
    return [];
  }
}

/**
 * Extracts images from Bing Images search page via content script.
 * @param {string} tabUrl
 * @returns {Promise<Array<{url:string, thumbUrl:string, title:string, alt:string, width:number, height:number}>>}
 */
async function extractBingImages(tabUrl) {
  if (!tabUrl.includes('bing.com/images/search')) return [];
  try {
    const response = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = response[0];
    if (!tab || !tab.id) return [];

    const results = await Messenger.sendToTab(tab.id, { type: 'EXTRACT_IMAGES', engine: 'bing' });
    return results || [];
  } catch (_) {
    return [];
  }
}

// ── Open Search Tab ───────────────────────────────────────

/**
 * Opens a new tab with the given URL (or re-uses an existing search tab).
 * @param {string} url
 * @returns {Promise<{tabId: number, tab: chrome.tabs.Tab}>}
 */
async function openSearchTab(url) {
  // Check if we already have an open search tab we can reuse
  const existing = await chrome.tabs.query({
    url: ['https://www.google.com/*', 'https://www.bing.com/*'],
    currentWindow: true,
  });

  if (existing.length > 0) {
    const tab = existing[0];
    await chrome.tabs.update(tab.id, { url, active: true });
    return { tabId: tab.id, tab };
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve({ tabId: tab.id, tab });
      }
    });
  });
}

/**
 * Waits for the tab to finish loading (status = 'complete').
 * @param {number} tabId
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
async function waitForTabReady(tabId, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function check() {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (tab.status === 'complete') {
          // Give scripts a moment to run
          setTimeout(resolve, 600);
        } else if (Date.now() > deadline) {
          resolve(); // don't block, continue anyway
        } else {
          setTimeout(check, 200);
        }
      });
    }
    check();
  });
}

// ── ImageSearchService ─────────────────────────────────────

export class ImageSearchService {
  constructor() {
    this._aborted = false;
  }

  /**
   * Aborts any pending search operations.
   */
  abort() {
    this._aborted = true;
  }

  /**
   * Searches for images for a given keyword and engine on a specific page.
   * Opens the search URL in a tab, waits for load, extracts images via content script.
   *
   * @param {string} keyword
   * @param {'google'|'bing'} engine
   * @param {number} page  0-indexed
   * @returns {Promise<Array<{url:string, thumbUrl:string, title:string, alt:string, width:number, height:number}>>}
   */
  async search(keyword, engine, page) {
    this._aborted = false;

    const url = engine === 'google' ? buildGoogleURL(keyword, page) : buildBingURL(keyword, page);

    let tabId = null;
    try {
      // Open / navigate to search tab
      const { tabId: id } = await openSearchTab(url);
      tabId = id;

      // Wait for the page to load
      await waitForTabReady(tabId, 10000);

      if (this._aborted) return [];

      // Extract images from the tab
      const currentTab = await chrome.tabs.get(tabId);
      let images = [];

      if (engine === 'google') {
        images = await extractGoogleImages(currentTab.url || '');
      } else {
        images = await extractBingImages(currentTab.url || '');
      }

      // Validate that images have a real URL
      images = images.filter((img) => img.url && img.url.startsWith('http'));

      return images;
    } catch (err) {
      console.error(`‼️ ImageSearchService.search error [${engine}][${keyword}][p${page}]:`, err);
      return [];
    }
  }
}
