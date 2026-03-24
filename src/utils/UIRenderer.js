/**
 * UIRenderer.js
 * Handles all DOM rendering for the images grid.
 * Pure functions — no external state, no side-effects except DOM.
 */

const GRID_COLUMNS = 4;

/**
 * Generates the DOM element for a single image card.
 * @param {import('./ImageStore.js').StoredImage} img
 * @param {(id: string) => void} onToggle
 * @returns {HTMLElement}
 */
function createImageCard(img, onToggle) {
  const card = document.createElement('div');
  card.className = [
    'image-card',
    img.selected  ? 'selected' : '',
    img.disabled  ? 'disabled' : '',
  ].filter(Boolean).join(' ');
  card.dataset.id = img.id;

  // Source badge
  const sourceEl = document.createElement('span');
  sourceEl.className = 'image-card__source';
  sourceEl.textContent = img.source;

  // Keyword badge
  const keywordEl = document.createElement('span');
  keywordEl.className = 'image-card__keyword';
  keywordEl.textContent = img.keyword;

  // Image
  const imgEl = document.createElement('img');
  imgEl.className   = 'image-card__img';
  imgEl.src         = img.thumbUrl || img.url;
  imgEl.alt         = img.title || img.alt || img.keyword;
  imgEl.loading     = 'lazy';
  imgEl.draggable   = false;

  // Overlay with checkmark
  const overlay = document.createElement('div');
  overlay.className = 'image-card__overlay';
  const check = document.createElement('div');
  check.className   = 'image-card__check';
  check.textContent = '✓';
  overlay.appendChild(check);

  // Size label
  const sizeEl = document.createElement('span');
  sizeEl.className   = 'image-card__size';
  sizeEl.textContent = `${img.width}×${img.height}`;

  card.appendChild(imgEl);
  card.appendChild(overlay);
  card.appendChild(sourceEl);
  card.appendChild(keywordEl);
  card.appendChild(sizeEl);

  // Click handler
  card.addEventListener('click', () => onToggle(img.id));

  return card;
}

/**
 * Toggles classes on an existing card without full re-render.
 * @param {HTMLElement} gridEl
 * @param {string} imageId
 * @param {import('./ImageStore.js').StoredImage} img
 */
function updateCardStateInDOM(gridEl, imageId, img) {
  const card = gridEl.querySelector(`[data-id="${imageId}"]`);
  if (!card) return;

  card.classList.toggle('selected', img.selected);
  card.classList.toggle('disabled', img.disabled);

  const check = card.querySelector('.image-card__check');
  if (check) check.textContent = img.selected ? '✓' : '';
}

/**
 * Renders a list of images into the grid.
 * Uses document fragment for performance; appends incrementally.
 *
 * @param {HTMLElement} gridEl
 * @param {import('./ImageStore.js').StoredImage[]} images
 * @param {(id: string) => void} onToggle
 * @param {HTMLElement|null} emptyStateEl
 */
function renderImagesToDOM(gridEl, images, onToggle, emptyStateEl) {
  const fragment = document.createDocumentFragment();
  for (const img of images) {
    fragment.appendChild(createImageCard(img, onToggle));
  }
  gridEl.appendChild(fragment);
  if (images.length > 0 && emptyStateEl) {
    emptyStateEl.style.display = 'none';
  }
}

export class UIRenderer {
  /**
   * Clears all image cards from the grid.
   * @param {HTMLElement} gridEl
   */
  static clearGrid(gridEl) {
    gridEl.innerHTML = '';
  }

  /**
   * Renders a fresh set of images (replaces current grid content).
   * @param {HTMLElement} gridEl
   * @param {import('./ImageStore.js').StoredImage[]} images
   * @param {(id: string) => void} onToggle
   * @param {HTMLElement|null} emptyStateEl
   */
  static renderImages(gridEl, images, onToggle, emptyStateEl) {
    this.clearGrid(gridEl);
    if (images.length === 0) {
      if (emptyStateEl) emptyStateEl.style.display = '';
      return;
    }
    if (emptyStateEl) emptyStateEl.style.display = 'none';
    renderImagesToDOM(gridEl, images, onToggle, emptyStateEl);
  }

  /**
   * Refreshes the entire grid (used after selectAll / deselectAll).
   * @param {HTMLElement} gridEl
   * @param {import('./ImageStore.js').StoredImage[]} images
   * @param {(id: string) => void} onToggle
   * @param {HTMLElement|null} emptyStateEl
   */
  static refreshGrid(gridEl, images, onToggle, emptyStateEl) {
    if (images.length === 0) {
      this.clearGrid(gridEl);
      if (emptyStateEl) emptyStateEl.style.display = '';
      return;
    }
    if (emptyStateEl) emptyStateEl.style.display = 'none';
    // Rebuild to sync visual state with store
    renderImagesToDOM(gridEl, images, onToggle, emptyStateEl);
  }

  /**
   * Updates a single card's visual state (selected / disabled).
   * Does NOT re-render the entire grid.
   * @param {HTMLElement} gridEl
   * @param {string} imageId
   * @param {import('./ImageStore.js').StoredImage} img
   */
  static updateCardState(gridEl, imageId, img) {
    updateCardStateInDOM(gridEl, imageId, img);
  }

  /**
   * Shows or hides the empty-state placeholder.
   * @param {HTMLElement|null} emptyStateEl
   * @param {boolean} show
   */
  static showEmptyState(emptyStateEl, show) {
    if (!emptyStateEl) return;
    emptyStateEl.style.display = show ? '' : 'none';
  }
}
