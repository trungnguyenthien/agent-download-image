/**
 * uiRenderer.js — Renders the images grid and manages card state.
 * Pure DOM manipulation, no external state.
 */

/**
 * Creates a single image card DOM element.
 * @param {import('./imageStore.js').StoredImage} img
 * @param {(id: string) => void} onToggle
 * @returns {HTMLElement}
 */
function createCard(img, onToggle) {
  const card = document.createElement('div');
  card.className = ['image-card', img.selected ? 'selected' : '', img.disabled ? 'disabled' : ''].filter(Boolean).join(' ');
  card.dataset.id = img.id;

  const imgEl = document.createElement('img');
  imgEl.className   = 'image-card__img';
  imgEl.src         = img.thumbUrl || img.url;
  imgEl.alt         = img.title || img.alt || img.keyword;
  imgEl.loading     = 'lazy';
  imgEl.draggable   = false;

  const overlay = document.createElement('div');
  overlay.className = 'image-card__overlay';
  const check = document.createElement('div');
  check.className   = 'image-card__check';
  check.textContent = img.selected ? '✓' : '';
  overlay.appendChild(check);

  const meta = document.createElement('div');
  meta.className = 'image-card__meta';

  const kw = document.createElement('span');
  kw.className   = 'image-card__keyword';
  kw.textContent = img.keyword;

  const src = document.createElement('span');
  src.className   = 'image-card__source';
  src.textContent = img.source;

  const size = document.createElement('span');
  size.className   = 'image-card__size';
  size.textContent = `${img.width}×${img.height}`;

  meta.appendChild(kw);
  meta.appendChild(src);
  meta.appendChild(size);

  card.appendChild(imgEl);
  card.appendChild(overlay);
  card.appendChild(meta);

  card.addEventListener('click', () => onToggle(img.id));
  return card;
}

function _updateCardState(gridEl, id, img) {
  const card = gridEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.classList.toggle('selected', img.selected);
  card.classList.toggle('disabled', img.disabled);
  const check = card.querySelector('.image-card__check');
  if (check) check.textContent = img.selected ? '✓' : '';
}

export class UIRenderer {
  static clearGrid(el)                        { el.innerHTML = ''; }

  static renderImages(el, images, onToggle, emptyEl) {
    this.clearGrid(el);
    if (images.length === 0) { if (emptyEl) emptyEl.style.display = ''; return; }
    if (emptyEl) emptyEl.style.display = 'none';
    const frag = document.createDocumentFragment();
    for (const img of images) frag.appendChild(createCard(img, onToggle));
    el.appendChild(frag);
  }

  static refreshGrid(el, images, onToggle, emptyEl) {
    this.renderImages(el, images, onToggle, emptyEl);
  }

  static updateCardState(el, id, img) { _updateCardState(el, id, img); }

  static showEmptyState(el, show) { if (el) el.style.display = show ? '' : 'none'; }
}
