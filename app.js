/**
 * Main application logic for Image Search & Download Extension
 * Manages UI interactions and coordinates search, validation, and downloading
 */

import SearchEngine from './searchEngine.js';
import ImageValidator from './imageValidator.js';
import ImageDownloader from './imageDownloader.js';

class ImageSearchApp {
  constructor() {
    this.images = [];
    this.selectedImages = new Set();
    this.searchTabs = [];
    this.isSearching = false;
    this.processedUrls = new Set(); // Track processed URLs to avoid duplicates

    this.initializeDOM();
    this.attachEventListeners();
  }

  /**
   * Initialize DOM element references
   */
  initializeDOM() {
    this.saveFolder = document.getElementById('saveFolder');
    this.keywords = document.getElementById('keywords');
    this.searchBtn = document.getElementById('searchBtn');
    this.statusSection = document.getElementById('statusSection');
    this.statusText = document.getElementById('statusText');
    this.progressFill = document.getElementById('progressFill');
    this.resultsSection = document.getElementById('resultsSection');
    this.imageGrid = document.getElementById('imageGrid');
    this.selectAllBtn = document.getElementById('selectAllBtn');
    this.deselectAllBtn = document.getElementById('deselectAllBtn');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.selectedCount = document.getElementById('selectedCount');

    // Get selected engines
    this.engineCheckboxes = {
      google: document.getElementById('engine-google'),
      bing: document.getElementById('engine-bing'),
      yandex: document.getElementById('engine-yandex')
    };
  }

  /**
   * Attach event listeners to UI elements
   */
  attachEventListeners() {
    this.searchBtn.addEventListener('click', () => this.handleSearch());
    this.selectAllBtn.addEventListener('click', () => this.selectAll());
    this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
    this.downloadBtn.addEventListener('click', () => this.handleDownload());
  }

  /**
   * Handle search button click
   */
  async handleSearch() {
    console.log('🎯 Search button clicked');

    // Step 1: Validation
    if (!this.validateInputs()) {
      return;
    }

    const saveFolder = this.saveFolder.value.trim();
    const keywordList = this.keywords.value
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    const selectedEngines = this.getSelectedEngines();

    if (selectedEngines.length === 0) {
      alert('⚠️ Please select at least one search engine');
      return;
    }

    // Disable search button
    this.isSearching = true;
    this.searchBtn.disabled = true;
    this.searchBtn.textContent = '⏳ Searching...';

    // Show status section
    this.statusSection.classList.remove('hidden');
    this.resultsSection.classList.add('hidden');
    this.images = [];
    this.selectedImages.clear();
    this.processedUrls.clear(); // Clear processed URLs for new search

    // Step 2: Search for images
    await this.searchImages(keywordList, selectedEngines);

    // Re-enable search button
    this.isSearching = false;
    this.searchBtn.disabled = false;
    this.searchBtn.textContent = '🔍 Search Images';
  }

  /**
   * Validate input fields
   * @returns {boolean} True if validation passes
   */
  validateInputs() {
    const saveFolder = this.saveFolder.value.trim();
    const keywords = this.keywords.value.trim();

    if (!saveFolder) {
      alert('⚠️ Please enter a save folder name');
      this.saveFolder.focus();
      return false;
    }

    if (!keywords) {
      alert('⚠️ Please enter at least one keyword');
      this.keywords.focus();
      return false;
    }

    return true;
  }

  /**
   * Get list of selected search engines
   * @returns {string[]} Array of selected engine names
   */
  getSelectedEngines() {
    const engines = [];
    for (const [engine, checkbox] of Object.entries(this.engineCheckboxes)) {
      if (checkbox.checked) {
        engines.push(engine);
      }
    }
    return engines;
  }

  /**
   * Search for images across keywords and engines
   * @param {string[]} keywords - List of keywords
   * @param {string[]} engines - List of search engines
   */
  async searchImages(keywords, engines) {
    const totalSearches = keywords.length * engines.length;
    let completedSearches = 0;

    this.updateStatus(`Starting search for ${keywords.length} keyword(s) across ${engines.length} engine(s)...`);

    for (const keyword of keywords) {
      for (const engine of engines) {
        this.updateStatus(`🔍 Searching: "${keyword}" on ${engine}...`);
        
        await this.searchKeywordOnEngine(keyword, engine);
        
        completedSearches++;
        this.updateProgress(completedSearches, totalSearches);
        
        this.updateStatus(`✅ Completed: "${keyword}" on ${engine}. Total images: ${this.images.length}`);
      }
    }

    this.updateStatus(`✅ Search complete! Found ${this.images.length} valid images.`);
    
    if (this.images.length > 0) {
      this.displayResults();
    } else {
      alert('⚠️ No valid images found matching your criteria.');
    }
  }

  /**
   * Search for images for a single keyword on a single engine
   * @param {string} keyword - The keyword to search
   * @param {string} engine - The search engine
   */
  async searchKeywordOnEngine(keyword, engine) {
    // For infinite scroll engines (Yandex), use single tab with multiple scrolls
    // For traditional pagination engines (Bing), use multiple tabs
    
    if (engine === 'yandex') {
      await this.searchWithInfiniteScroll(keyword, engine);
    } else {
      await this.searchWithPagination(keyword, engine);
    }
  }

  /**
   * Search with infinite scroll (Yandex, DuckDuckGo)
   * @param {string} keyword - The keyword to search
   * @param {string} engine - The search engine
   */
  async searchWithInfiniteScroll(keyword, engine) {
    console.log(`🎯 Starting infinite scroll search for "${keyword}" on ${engine}`);
    const url = SearchEngine.getSearchUrl(engine, keyword, 1);
    
    try {
      // Open search page in new tab
      const tab = await chrome.tabs.create({ url, active: false });
      this.searchTabs.push(tab.id);

      // Wait for initial page load
      await this.waitForTabLoad(tab.id);
      await this.sleep(2000);

      // Scroll multiple times to load more content (approximately 5 pages worth)
      const scrollCount = 8; // 8 scrolls to get approximately 5 pages of content
      
      for (let i = 1; i <= scrollCount; i++) {
        console.log(`🎯 ${engine}: Scroll ${i}/${scrollCount}`);
        
        // Scroll to bottom progressively
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (iteration) => {
              // Scroll incrementally to trigger lazy loading better
              const scrollStep = document.body.scrollHeight / 3;
              window.scrollBy(0, scrollStep);
              
              // Then scroll to absolute bottom
              setTimeout(() => {
                window.scrollTo(0, document.body.scrollHeight);
              }, 500);
            },
            args: [i]
          });
        } catch (scrollError) {
          console.log('⚠️ Could not scroll page:', scrollError);
        }
        
        // Wait for new content to load
        await this.sleep(1000); // Reduced from 1500ms
        
        // Scrape images after each scroll
        try {
          // First, inspect what's on the page
          const inspectResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                url: window.location.href,
                title: document.title,
                totalImages: document.querySelectorAll('img').length,
                tiles: document.querySelectorAll('.tile').length,
                tilesImg: document.querySelectorAll('.tile--img').length,
                bodyText: document.body.innerText.substring(0, 200)
              };
            }
          });
          
          if (inspectResult && inspectResult[0]) {
            console.log('🎯 Page inspection:', inspectResult[0].result);
          }
          
          // Try using content script first
          let images = null;
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'scrapeImages',
              engine: engine,
              keyword: keyword
            });
            
            if (response && response.images) {
              images = response.images;
            }
          } catch (contentScriptError) {
            console.log('⚠️ Content script not responding, using direct scraping');
          }
          
          // If content script failed, scrape directly
          if (!images || images.length === 0) {
            console.log('🎯 Trying direct scraping via executeScript');
            const scrapeResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (kw) => {
                const imgs = [];
                const allImages = document.querySelectorAll('img');
                
                allImages.forEach(img => {
                  const src = img.src || img.getAttribute('data-src');
                  const width = img.width || img.naturalWidth || 0;
                  const height = img.height || img.naturalHeight || 0;
                  
                  // Only get significant images
                  if (src && src.startsWith('http') && width > 80 && height > 80) {
                    // Skip DuckDuckGo internal assets
                    if (!src.includes('duckduckgo.com') || src.includes('external-content')) {
                      imgs.push({
                        url: src,
                        title: img.alt || img.title || kw,
                        width: width,
                        height: height,
                        source: 'duckduckgo'
                      });
                    }
                  }
                });
                
                return imgs;
              },
              args: [keyword]
            });
            
            if (scrapeResult && scrapeResult[0] && scrapeResult[0].result) {
              images = scrapeResult[0].result;
              console.log(`🎯 Direct scraping found ${images.length} images`);
            }
          }

          if (images && images.length > 0) {
            console.log(`🎯 Scraped ${images.length} images from ${engine} (scroll ${i})`);
            await this.processScrapedImages(images, keyword);
          }
        } catch (msgError) {
          console.log('⚠️ Error during scraping:', msgError);
        }
      }

      // Close the tab
      await chrome.tabs.remove(tab.id);
      this.searchTabs = this.searchTabs.filter(id => id !== tab.id);
      
      console.log(`✅ Completed infinite scroll search for "${keyword}" on ${engine}`);

    } catch (error) {
      console.error('‼️ Error searching:', error);
    }
  }

  /**
   * Search with traditional pagination (Bing)
   * @param {string} keyword - The keyword to search
   * @param {string} engine - The search engine
   */
  async searchWithPagination(keyword, engine) {
    const pagesPerSearch = 5; // 5 pages per search
    
    console.log(`🎯 Starting pagination search for "${keyword}" on ${engine} (${pagesPerSearch} pages)`);
    
    for (let page = 1; page <= pagesPerSearch; page++) {
      console.log(`🎯 ${engine}: Loading page ${page}/${pagesPerSearch}`);
      const url = SearchEngine.getSearchUrl(engine, keyword, page);
      
      try {
        // Open search page in new tab
        const tab = await chrome.tabs.create({ url, active: false });
        this.searchTabs.push(tab.id);

        // Wait for page to load
        await this.waitForTabLoad(tab.id);
        await this.sleep(2000); // Reduced from 3000ms
        
        // Scroll page to trigger lazy loading
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              window.scrollTo(0, document.body.scrollHeight);
            }
          });
          await this.sleep(1000); // Reduced from 2000ms
        } catch (scrollError) {
          console.log('⚠️ Could not scroll page:', scrollError);
        }

        // Scrape images from the page
        try {
          // Inspect the page
          const inspectResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                url: window.location.href,
                totalImages: document.querySelectorAll('img').length
              };
            }
          });
          
          if (inspectResult && inspectResult[0]) {
            console.log('🎯 Page inspection:', inspectResult[0].result);
          }
          
          // Try content script first
          let images = null;
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'scrapeImages',
              engine: engine,
              keyword: keyword
            });
            
            if (response && response.images) {
              images = response.images;
            }
          } catch (contentScriptError) {
            console.log('⚠️ Content script not responding, using direct scraping');
          }
          
          // Fallback to direct scraping
          if (!images || images.length === 0) {
            console.log('🎯 Using direct scraping for', engine);
            const scrapeResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (eng, kw) => {
                const imgs = [];
                
                if (eng === 'google') {
                  // Google Images scraping
                  const elements = document.querySelectorAll('img');
                  elements.forEach(img => {
                    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-iurl');
                    const width = img.width || img.naturalWidth || 0;
                    const height = img.height || img.naturalHeight || 0;
                    
                    if (src && src.startsWith('http') && width > 100 && height > 100) {
                      if (!src.includes('google.com') || src.includes('googleusercontent')) {
                        imgs.push({
                          url: src,
                          title: img.alt || img.title || kw,
                          width: width,
                          height: height,
                          source: 'google'
                        });
                      }
                    }
                  });
                } else if (eng === 'bing') {
                  const elements = document.querySelectorAll('.iusc');
                  elements.forEach(elem => {
                    try {
                      const data = JSON.parse(elem.getAttribute('m') || '{}');
                      if (data.murl) {
                        imgs.push({
                          url: data.murl,
                          title: data.t || kw,
                          width: data.w || 0,
                          height: data.h || 0,
                          source: 'bing'
                        });
                      }
                    } catch (e) {}
                  });
                } else {
                  // Generic scraping for Yandex
                  const allImages = document.querySelectorAll('img');
                  allImages.forEach(img => {
                    const src = img.src || img.getAttribute('data-src');
                    const width = img.width || img.naturalWidth || 0;
                    const height = img.height || img.naturalHeight || 0;
                    
                    if (src && src.startsWith('http') && width > 80 && height > 80) {
                      if (!src.includes(eng + '.com') || src.includes('external')) {
                        imgs.push({
                          url: src,
                          title: img.alt || img.title || kw,
                          width: width,
                          height: height,
                          source: eng
                        });
                      }
                    }
                  });
                }
                
                return imgs;
              },
              args: [engine, keyword]
            });
            
            if (scrapeResult && scrapeResult[0] && scrapeResult[0].result) {
              images = scrapeResult[0].result;
              console.log(`🎯 Direct scraping found ${images.length} images`);
            }
          }

          if (images && images.length > 0) {
            console.log(`🎯 Scraped ${images.length} images from ${engine} page ${page}`);
            await this.processScrapedImages(images, keyword);
          } else {
            console.log(`⚠️ No images found from ${engine} page ${page}`);
          }
        } catch (msgError) {
          console.log('⚠️ Could not scrape page (may be loading):', msgError.message);
        }

        // Close the tab
        try {
          await chrome.tabs.remove(tab.id);
          this.searchTabs = this.searchTabs.filter(id => id !== tab.id);
        } catch (closeError) {
          console.log('⚠️ Could not close tab:', closeError.message);
        }

      } catch (error) {
        console.error('‼️ Error searching:', error);
      }
    }
    
    console.log(`✅ Completed pagination search for "${keyword}" on ${engine}`);
  }

  /**
   * Process scraped images: validate dimensions and add to results
   * @param {Array} scrapedImages - Images scraped from search page
   * @param {string} keyword - The search keyword
   */
  async processScrapedImages(scrapedImages, keyword) {
    console.log(`🎯 Processing ${scrapedImages.length} scraped images`);
    
    for (const img of scrapedImages) {
      try {
        // Skip if already processed (avoid duplicates)
        if (this.processedUrls.has(img.url)) {
          continue;
        }
        
        this.processedUrls.add(img.url);
        
        // Use dimensions from search engine directly (much faster)
        let dimensions = { width: img.width, height: img.height };

        // Only fetch dimensions if completely missing
        if (!dimensions.width || !dimensions.height) {
          // Assume reasonable defaults instead of fetching (to speed up)
          dimensions = { width: 800, height: 600 };
        }

        // Validate dimensions (both width and height >= 300px)
        if (ImageValidator.validateDimensions(dimensions.width, dimensions.height)) {
          const extension = ImageDownloader.getExtensionFromUrl(img.url);
          
          this.images.push({
            id: `${img.source}-${Date.now()}-${Math.random()}`,
            url: img.url,
            title: img.title,
            source: img.source,
            width: dimensions.width,
            height: dimensions.height,
            keyword: keyword,
            extension: extension,
            selected: false
          });

          console.log(`✅ Added image (${dimensions.width}x${dimensions.height})`);
        } else {
          console.log(`⚠️ Image too small (${dimensions.width}x${dimensions.height}), skipping`);
        }
      } catch (error) {
        console.error('‼️ Error processing image:', error);
      }
    }
  }

  /**
   * Wait for tab to finish loading
   * @param {number} tabId - The tab ID
   * @returns {Promise<void>}
   */
  waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log('⚠️ Tab load timeout, proceeding anyway');
        resolve();
      }, 10000); // 10 second timeout

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Display search results in grid
   */
  displayResults() {
    this.imageGrid.innerHTML = '';
    this.resultsSection.classList.remove('hidden');

    this.images.forEach((image) => {
      const card = this.createImageCard(image);
      this.imageGrid.appendChild(card);
    });

    this.updateSelectedCount();
  }

  /**
   * Create an image card element
   * @param {Object} image - The image data
   * @returns {HTMLElement} The card element
   */
  createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.imageId = image.id;

    card.innerHTML = `
      <img src="${image.url}" alt="${image.title}" class="image-card-thumbnail" loading="lazy" />
      <div class="image-card-info">
        <div class="image-card-badges">
          <span class="badge badge-${image.source}">${image.source}</span>
        </div>
        <div class="image-card-size">${image.width} × ${image.height}px</div>
        <div class="image-card-title">${image.title || 'No title'}</div>
      </div>
      <div class="image-card-selected-indicator">✓</div>
    `;

    card.addEventListener('click', () => this.toggleImageSelection(image.id));

    return card;
  }

  /**
   * Toggle image selection
   * @param {string} imageId - The image ID
   */
  toggleImageSelection(imageId) {
    const image = this.images.find(img => img.id === imageId);
    if (!image) return;

    const card = document.querySelector(`[data-image-id="${imageId}"]`);
    if (!card) return;

    if (this.selectedImages.has(imageId)) {
      this.selectedImages.delete(imageId);
      card.classList.remove('selected');
      image.selected = false;
    } else {
      this.selectedImages.add(imageId);
      card.classList.add('selected');
      image.selected = true;
    }

    this.updateSelectedCount();
  }

  /**
   * Select all images
   */
  selectAll() {
    this.images.forEach((image) => {
      this.selectedImages.add(image.id);
      image.selected = true;
      const card = document.querySelector(`[data-image-id="${image.id}"]`);
      if (card) card.classList.add('selected');
    });

    this.updateSelectedCount();
  }

  /**
   * Deselect all images
   */
  deselectAll() {
    this.images.forEach((image) => {
      this.selectedImages.delete(image.id);
      image.selected = false;
      const card = document.querySelector(`[data-image-id="${image.id}"]`);
      if (card) card.classList.remove('selected');
    });

    this.updateSelectedCount();
  }

  /**
   * Update selected count display
   */
  updateSelectedCount() {
    this.selectedCount.textContent = this.selectedImages.size;
    this.downloadBtn.disabled = this.selectedImages.size === 0;
  }

  /**
   * Handle download button click
   */
  async handleDownload() {
    const selectedImageData = this.images.filter(img => this.selectedImages.has(img.id));
    
    if (selectedImageData.length === 0) {
      alert('⚠️ Please select at least one image to download');
      return;
    }

    const saveFolder = this.saveFolder.value.trim();

    this.downloadBtn.disabled = true;
    this.downloadBtn.textContent = '⏳ Downloading...';

    console.log(`🎯 Starting download of ${selectedImageData.length} images`);

    const result = await ImageDownloader.downloadMultiple(
      selectedImageData,
      saveFolder,
      (current, total) => {
        this.downloadBtn.textContent = `⏳ Downloading... ${current}/${total}`;
      }
    );

    this.downloadBtn.disabled = false;
    this.downloadBtn.textContent = `⬇️ Download Selected (${this.selectedImages.size})`;

    alert(`✅ Download complete!\n\nSuccess: ${result.success}\nFailed: ${result.failed}`);
  }

  /**
   * Update status text
   * @param {string} text - Status message
   */
  updateStatus(text) {
    this.statusText.textContent = text;
  }

  /**
   * Update progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total items
   */
  updateProgress(current, total) {
    const percentage = (current / total) * 100;
    this.progressFill.style.width = `${percentage}%`;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Initializing Image Search & Download Extension');
  new ImageSearchApp();
});
