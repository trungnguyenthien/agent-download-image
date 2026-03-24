/**
 * ImageStore.js
 * Centralized, in-memory store for all discovered images.
 * Handles adding, selecting, deselecting, and querying images.
 */

let _idCounter = 0;

/**
 * @typedef {Object} StoredImage
 * @property {string}  id
 * @property {string}  url          Full-resolution image URL
 * @property {string}  thumbUrl     Thumbnail URL for display
 * @property {string}  title
 * @property {string}  alt
 * @property {string}  keyword
 * @property {string}  source       'google' | 'bing'
 * @property {number}  width
 * @property {number}  height
 * @property {string}  extension   'jpg' | 'png' | 'gif' | 'webp'
 * @property {boolean} selected
 * @property {boolean} disabled    True if at least one dimension < 300
 */

/** @type {Map<string, StoredImage>} */
const _store = new Map();

/**
 * Returns a new unique ID string.
 * @returns {string}
 */
function _newId() {
  return `img_${++_idCounter}_${Date.now()}`;
}

/**
 * Derives file extension from a URL string.
 * @param {string} url
 * @returns {string}
 */
function _getExtension(url) {
  try {
    const u = new URL(url);
    const ext = u.pathname.split('.').pop().split('?')[0].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch (_) {}
  return 'jpg'; // default fallback
}

/**
 * Determines whether an image should be disabled (one dimension < 300).
 * @param {number} w
 * @param {number} h
 * @returns {boolean}
 */
function _shouldDisable(w, h) {
  return w < 300 || h < 300;
}

/**
 * ImageStore API — all methods are pure regarding external state.
 */
export class ImageStore {
  // ── Mutations ───────────────────────────────────────────

  /**
   * Adds a single image to the store.
   * Auto-selects if both dimensions > 300; auto-disables otherwise.
   * Skips duplicate URLs.
   * @param {Partial<StoredImage>} img
   * @returns {string} The assigned image id, or null if skipped.
   */
  static add(img) {
    if (!img.url) return null;

    // Skip duplicates by URL
    const existing = [..._store.values()].find((i) => i.url === img.url);
    if (existing) return null;

    const w = img.width  || 0;
    const h = img.height || 0;
    const disabled = _shouldDisable(w, h);
    // Auto-select only if NOT disabled (both dims >= 300)
    const selected = !disabled;

    const id = _newId();
    const entry = {
      id,
      url:         img.url,
      thumbUrl:    img.thumbUrl    || img.url,
      title:       img.title       || '',
      alt:         img.alt          || '',
      keyword:     img.keyword      || '',
      source:      img.source       || 'unknown',
      width:       w,
      height:      h,
      extension:   _getExtension(img.url),
      selected,
      disabled,
    };

    _store.set(id, entry);
    return id;
  }

  /**
   * Toggles the selected state of an image.
   * No-op if the image is disabled.
   * @param {string} id
   */
  static toggleSelected(id) {
    const img = _store.get(id);
    if (!img || img.disabled) return;
    img.selected = !img.selected;
  }

  /**
   * Selects all non-disabled images.
   */
  static selectAll() {
    for (const img of _store.values()) {
      if (!img.disabled) img.selected = true;
    }
  }

  /**
   * Deselects all images.
   */
  static deselectAll() {
    for (const img of _store.values()) {
      img.selected = false;
    }
  }

  /**
   * Removes all images from the store.
   */
  static clear() {
    _store.clear();
  }

  // ── Queries ─────────────────────────────────────────────

  /**
   * Returns a single image by id.
   * @param {string} id
   * @returns {StoredImage|undefined}
   */
  static get(id) {
    return _store.get(id);
  }

  /**
   * Returns all images as an array.
   * @returns {StoredImage[]}
   */
  static getAll() {
    return [..._store.values()];
  }

  /**
   * Returns only selected images.
   * @returns {StoredImage[]}
   */
  static getSelected() {
    return [..._store.values()].filter((img) => img.selected && !img.disabled);
  }

  /**
   * Returns the total number of images in the store.
   * @returns {number}
   */
  static size() {
    return _store.size;
  }
}
