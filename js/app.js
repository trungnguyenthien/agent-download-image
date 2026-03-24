/**
 * app.js — Image Origin Downloader
 * Entry point: orchestrates validation, search, grid rendering, and download.
 */

import { ImageSearchService, initSearchListener } from './searchService.js';
import { ImageStore }         from './imageStore.js';
import { UIRenderer }         from './uiRenderer.js';
import { downloadAll }        from './downloadManager.js';

// ── DOM refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
  saveFolder:     $('saveFolder'),
  keywords:       $('keywords'),
  googleCheck:    $('googleCheck'),
  bingCheck:      $('bingCheck'),
  statusText:     $('statusText'),
  searchBtn:      $('searchBtn'),
  stopBtn:        $('stopBtn'),
  progressWrap:   $('progressWrap'),
  progressLabel:  $('progressLabel'),
  progressCount:  $('progressCount'),
  progressFill:   $('progressFill'),
  imagesGrid:     $('imagesGrid'),
  emptyState:     $('emptyState'),
  imageCount:     $('imageCount'),
  selectAllBtn:   $('selectAllBtn'),
  deselectAllBtn:$('deselectAllBtn'),
  downloadBtn:    $('downloadBtn'),
  selectedCount: $('selectedCount'),
};

// ── Status helpers ───────────────────────────────────────────
function showStatus(msg, type = 'info') {
  const icons = { info: '🎯', warning: '⚠️', error: '‼️', success: '✅' };
  dom.statusText.textContent = `${icons[type] || ''} ${msg}`;
  dom.statusText.style.color = type === 'error' ? 'var(--clr-danger)'
    : type === 'success' ? 'var(--clr-success)'
    : type === 'warning' ? 'var(--clr-warning)' : 'var(--clr-text-muted)';
}
function clearStatus() { dom.statusText.textContent = ''; }

// ── Progress helpers ────────────────────────────────────────
function updateProgress(cur, total, label = 'Searching...') {
  dom.progressWrap.classList.remove('hidden');
  dom.progressLabel.textContent = label;
  dom.progressCount.textContent = `${cur} / ${total}`;
  dom.progressFill.style.width  = total > 0 ? `${(cur / total) * 100}%` : '0%';
}
function hideProgress() {
  dom.progressWrap.classList.add('hidden');
  dom.progressFill.style.width = '0%';
}

// ── Validation ───────────────────────────────────────────────
function validateInput() {
  const folder   = dom.saveFolder.value.trim();
  const rawKw    = dom.keywords.value.trim();
  if (!folder)  { showStatus('Save folder is required', 'warning'); return null; }
  if (!rawKw)   { showStatus('At least one keyword is required', 'warning'); return null; }
  const kws = rawKw.split('\n').map(k => k.trim()).filter(Boolean);
  if (!kws.length) { showStatus('No valid keywords found', 'warning'); return null; }
  return { folder, kws };
}

// ── UI refresh ───────────────────────────────────────────────
function refreshUI() {
  dom.imageCount.textContent  = ImageStore.count;
  const sel = ImageStore.getSelected().length;
  dom.selectedCount.textContent = `${sel} selected`;
  dom.downloadBtn.disabled     = sel === 0;
}
function onToggle(id) {
  ImageStore.toggleSelected(id);
  UIRenderer.updateCardState(dom.imagesGrid, id, ImageStore.get(id));
  refreshUI();
}

// ── Search flow ───────────────────────────────────────────────
let isSearching = false, isAborted = false, searchSvc = null;

async function startSearch() {
  const input = validateInput();
  if (!input) return;
  const { folder, kws } = input;

  const engines = [];
  if (dom.googleCheck.checked) engines.push('google');
  if (dom.bingCheck.checked)   engines.push('bing');
  if (!engines.length) { showStatus('Select at least one search engine', 'warning'); return; }

  // Reset state
  isSearching = true; isAborted = false;
  clearStatus();
  ImageStore.clear();
  UIRenderer.renderImages(dom.imagesGrid, [], onToggle, dom.emptyState);
  refreshUI();

  // UI loading state
  dom.searchBtn.disabled = true;
  dom.stopBtn.disabled   = false;
  dom.downloadBtn.disabled = true;

  const totalSteps = kws.length * engines.length * 10;
  let cur = 0;
  searchSvc = new ImageSearchService();

  try {
    for (const kw of kws) {
      if (isAborted) break;
      for (const engine of engines) {
        if (isAborted) break;
        for (let page = 0; page < 10; page++) {
          if (isAborted) break;
          cur++;
          updateProgress(cur, totalSteps, `🎯 ${kw} · ${engine} · page ${page + 1}`);

          const images = await searchSvc.search(kw, engine, page);

          // Filter: only keep images whose title/alt contains keyword
          const kwLower = kw.toLowerCase();
          const filtered = images.filter(img => {
            const text = `${img.title || ''} ${img.alt || ''}`.toLowerCase();
            return text.includes(kwLower);
          });

          // Add to store
          for (const img of filtered) ImageStore.add({ ...img, keyword: kw, source: engine });

          // Incremental render
          UIRenderer.renderImages(
            dom.imagesGrid, ImageStore.getAll(), onToggle, dom.emptyState,
          );
          refreshUI();
        }
      }
    }

    if (isAborted) {
      showStatus('Search stopped by user', 'warning');
    } else {
      showStatus(`Found ${ImageStore.count} images`, 'success');
    }
  } catch (err) {
    console.error('Search error:', err);
    showStatus('Search error: ' + err.message, 'error');
  } finally {
    isSearching = false;
    dom.searchBtn.disabled = false;
    dom.stopBtn.disabled   = true;
    refreshUI();
    updateProgress(totalSteps, totalSteps, '✅ Done');
    setTimeout(hideProgress, 2500);
  }
}

function stopSearch() {
  isAborted = true;
  if (searchSvc) searchSvc.abort();
  dom.stopBtn.disabled = true;
  showStatus('Stopping...', 'warning');
}

// ── Download flow ─────────────────────────────────────────────
async function startDownload() {
  const folder = dom.saveFolder.value.trim();
  if (!folder) { showStatus('Save folder is required', 'warning'); return; }
  const imgs = ImageStore.getSelected();
  if (!imgs.length) { showStatus('No images selected', 'warning'); return; }

  dom.downloadBtn.disabled = true;
  dom.searchBtn.disabled   = true;

  updateProgress(0, imgs.length, '⬇️ Downloading...');

  try {
    const results = await downloadAll(imgs, folder, (done, total) => {
      updateProgress(done, total, `⬇️ ${done} / ${total}`);
    });
    const ok = results.filter(r => r.success).length;
    showStatus(`Downloaded ${ok}/${imgs.length} images`, 'success');
  } catch (err) {
    showStatus('Download error: ' + err.message, 'error');
  } finally {
    dom.searchBtn.disabled   = false;
    dom.downloadBtn.disabled = false;
    setTimeout(hideProgress, 3000);
  }
}

// ── Event bindings ───────────────────────────────────────────
dom.searchBtn.addEventListener('click', startSearch);
dom.stopBtn.addEventListener('click', stopSearch);
dom.selectAllBtn.addEventListener('click', () => {
  ImageStore.selectAll();
  UIRenderer.refreshGrid(dom.imagesGrid, ImageStore.getAll(), onToggle, dom.emptyState);
  refreshUI();
});
dom.deselectAllBtn.addEventListener('click', () => {
  ImageStore.deselectAll();
  UIRenderer.refreshGrid(dom.imagesGrid, ImageStore.getAll(), onToggle, dom.emptyState);
  refreshUI();
});
dom.downloadBtn.addEventListener('click', startDownload);

// ── Init ─────────────────────────────────────────────────────
initSearchListener();
UIRenderer.showEmptyState(dom.emptyState, true);
dom.downloadBtn.disabled = true;
