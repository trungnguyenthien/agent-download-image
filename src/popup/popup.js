/**
 * popup.js — Image Origin Downloader
 * Entry point for the extension popup UI.
 * Orchestrates user interactions, search flow, and image download.
 */

import { ImageSearchService } from '../utils/ImageSearchService.js';
import { ImageStore } from '../utils/ImageStore.js';
import { UIRenderer } from '../utils/UIRenderer.js';
import { DownloadManager } from '../utils/DownloadManager.js';

// ── DOM References ────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dom = {
  saveFolder:       $('saveFolder'),
  keywords:         $('keywords'),
  googleCheck:     $('googleCheck'),
  bingCheck:       $('bingCheck'),
  statusText:      $('statusText'),
  searchBtn:       $('searchBtn'),
  stopBtn:         $('stopBtn'),
  progressWrap:    $('progressWrap'),
  progressLabel:   $('progressLabel'),
  progressCount:   $('progressCount'),
  progressFill:    $('progressFill'),
  imagesGrid:      $('imagesGrid'),
  emptyState:      $('emptyState'),
  imageCount:      $('imageCount'),
  selectAllBtn:    $('selectAllBtn'),
  deselectAllBtn:  $('deselectAllBtn'),
  downloadBtn:     $('downloadBtn'),
  selectedCount:  $('selectedCount'),
};

// ── State ─────────────────────────────────────────────────
let isSearching    = false;
let isAborted       = false;
let searchService  = null;

// ── Validation ─────────────────────────────────────────────
/**
 * Validates user input fields.
 * @returns {{ valid: boolean, saveFolder: string, keywordList: string[] }}
 */
function validateInput() {
  const saveFolder = dom.saveFolder.value.trim();
  const rawKeywords = dom.keywords.value.trim();

  if (!saveFolder) {
    showStatus('⚠️ Save folder is required', 'warning');
    return { valid: false };
  }
  if (!rawKeywords) {
    showStatus('⚠️ At least one keyword is required', 'warning');
    return { valid: false };
  }

  const keywordList = rawKeywords
    .split('\n')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywordList.length === 0) {
    showStatus('⚠️ No valid keywords found', 'warning');
    return { valid: false };
  }

  return { valid: true, saveFolder, keywordList };
}

// ── Status Helpers ────────────────────────────────────────
/**
 * Displays a status message in the controls bar.
 * @param {string} msg
 * @param {'info'|'warning'|'error'} type
 */
function showStatus(msg, type = 'info') {
  const iconMap = { info: '🎯', warning: '⚠️', error: '‼️' };
  dom.statusText.textContent = `${iconMap[type] || ''} ${msg}`;
  if (type === 'error') dom.statusText.style.color = 'var(--clr-danger)';
  else dom.statusText.style.color = 'var(--clr-warning)';
  if (type === 'info') dom.statusText.style.color = 'var(--clr-text-muted)';
}

function clearStatus() {
  dom.statusText.textContent = '';
}

// ── Progress Helpers ──────────────────────────────────────
/**
 * Updates the progress bar UI.
 * @param {number} current
 * @param {number} total
 * @param {string} label
 */
function updateProgress(current, total, label = 'Searching...') {
  dom.progressWrap.classList.remove('hidden');
  dom.progressLabel.textContent = label;
  dom.progressCount.textContent = `${current} / ${total}`;
  dom.progressFill.style.width = total > 0 ? `${(current / total) * 100}%` : '0%';
}

function hideProgress() {
  dom.progressWrap.classList.add('hidden');
  dom.progressFill.style.width = '0%';
}

// ── Search Flow ───────────────────────────────────────────
/**
 * Initiates the full search flow: validate → clear → search → render.
 */
async function startSearch() {
  // ✅ Step 1: Validation
  const validation = validateInput();
  if (!validation.valid) return;

  const { saveFolder, keywordList } = validation;

  // Get selected search engines
  const engines = [];
  if (dom.googleCheck.checked) engines.push('google');
  if (dom.bingCheck.checked)   engines.push('bing');

  if (engines.length === 0) {
    showStatus('⚠️ Select at least one search engine', 'warning');
    return;
  }

  // Reset state
  isSearching = true;
  isAborted   = false;
  clearStatus();
  UIRenderer.clearGrid(dom.imagesGrid);
  UIRenderer.showEmptyState(dom.emptyState, true);
  ImageStore.clear();
  updateImageCount();
  updateSelectedCount();

  // UI: loading state
  dom.searchBtn.disabled   = true;
  dom.stopBtn.disabled     = false;
  dom.downloadBtn.disabled = true;

  const PAGES_PER_ENGINE  = 10;
  const totalSteps         = keywordList.length * engines.length * PAGES_PER_ENGINE;
  let   currentStep       = 0;

  searchService = new ImageSearchService();

  try {
    // Iterate over each keyword
    for (const keyword of keywordList) {
      if (isAborted) break;

      // Iterate over each selected engine
      for (const engine of engines) {
        if (isAborted) break;

        // Iterate over each page
        for (let page = 0; page < PAGES_PER_ENGINE; page++) {
          if (isAborted) break;

          currentStep++;
          updateProgress(currentStep, totalSteps,
            `🎯 ${keyword} · ${engine} · page ${page + 1}`);

          // Perform search for this engine + keyword + page
          const images = await searchService.search(keyword, engine, page);

          // Filter images: only keep those whose title/alt contains the keyword
          const filtered = images.filter((img) => {
            const text = `${img.title || ''} ${img.alt || ''}`.toLowerCase();
            return text.includes(keyword.toLowerCase());
          });

          // Add to store (auto-select logic handled inside store)
          for (const img of filtered) {
            ImageStore.add({ ...img, keyword, source: engine });
          }

          // Re-render grid incrementally
          UIRenderer.renderImages(
            dom.imagesGrid,
            ImageStore.getAll(),
            onImageToggle,
            dom.emptyState,
          );
          updateImageCount();
          updateSelectedCount();
        }
      }
    }

    if (isAborted) {
      showStatus('Search stopped by user', 'warning');
    } else {
      showStatus(`✅ Found ${ImageStore.size()} images`, 'info');
    }
  } catch (err) {
    console.error('‼️ Search error:', err);
    showStatus('‼️ Search error: ' + err.message, 'error');
  } finally {
    isSearching = false;
    dom.searchBtn.disabled = false;
    dom.stopBtn.disabled   = true;
    dom.downloadBtn.disabled = ImageStore.getSelected().length === 0;
    updateProgress(totalSteps, totalSteps, '✅ Done');
    setTimeout(hideProgress, 2000);
  }
}

/**
 * Aborts the currently running search.
 */
function stopSearch() {
  isAborted = true;
  if (searchService) searchService.abort();
  dom.stopBtn.disabled = true;
  showStatus('Stopping...', 'warning');
}

// ── Image Selection ───────────────────────────────────────
/**
 * Handles toggling the selected state of a single image card.
 * @param {string} imageId
 */
function onImageToggle(imageId) {
  const img = ImageStore.get(imageId);
  if (!img || img.disabled) return;
  ImageStore.toggleSelected(imageId);
  UIRenderer.updateCardState(dom.imagesGrid, imageId, ImageStore.get(imageId));
  updateSelectedCount();
  dom.downloadBtn.disabled = ImageStore.getSelected().length === 0;
}

/**
 * Selects all non-disabled images.
 */
function selectAll() {
  ImageStore.selectAll();
  UIRenderer.refreshGrid(dom.imagesGrid, ImageStore.getAll(), onImageToggle, dom.emptyState);
  updateSelectedCount();
  dom.downloadBtn.disabled = false;
}

/**
 * Deselects all images.
 */
function deselectAll() {
  ImageStore.deselectAll();
  UIRenderer.refreshGrid(dom.imagesGrid, ImageStore.getAll(), onImageToggle, dom.emptyState);
  updateSelectedCount();
  dom.downloadBtn.disabled = true;
}

// ── Download Flow ───────────────────────────────────────────
/**
 * Downloads all selected images to the specified folder.
 */
async function startDownload() {
  const saveFolder = dom.saveFolder.value.trim();
  if (!saveFolder) {
    showStatus('⚠️ Save folder is required', 'warning');
    return;
  }

  const selectedImages = ImageStore.getSelected();
  if (selectedImages.length === 0) {
    showStatus('⚠️ No images selected', 'warning');
    return;
  }

  dom.downloadBtn.disabled = true;
  dom.searchBtn.disabled   = true;

  updateProgress(0, selectedImages.length, '⬇️ Downloading...');

  try {
    const result = await DownloadManager.downloadAll(selectedImages, saveFolder, (done, total) => {
      updateProgress(done, total, `⬇️ ${done} / ${total}`);
    });

    const successCount = result.filter((r) => r.success).length;
    showStatus(`✅ Downloaded ${successCount}/${selectedImages.length} images`, 'info');
  } catch (err) {
    console.error('‼️ Download error:', err);
    showStatus('‼️ Download error: ' + err.message, 'error');
  } finally {
    dom.searchBtn.disabled   = false;
    dom.downloadBtn.disabled = ImageStore.getSelected().length === 0;
    setTimeout(hideProgress, 3000);
  }
}

// ── UI Helpers ─────────────────────────────────────────────
function updateImageCount() {
  dom.imageCount.textContent = ImageStore.size();
}

function updateSelectedCount() {
  const count = ImageStore.getSelected().length;
  dom.selectedCount.textContent = `${count} selected`;
  dom.downloadBtn.disabled = count === 0;
}

// ── Event Bindings ─────────────────────────────────────────
dom.searchBtn.addEventListener('click', startSearch);
dom.stopBtn.addEventListener('click', stopSearch);
dom.selectAllBtn.addEventListener('click', selectAll);
dom.deselectAllBtn.addEventListener('click', deselectAll);
dom.downloadBtn.addEventListener('click', startDownload);

// ── Init ───────────────────────────────────────────────────
UIRenderer.showEmptyState(dom.emptyState, true);
dom.downloadBtn.disabled = true;
