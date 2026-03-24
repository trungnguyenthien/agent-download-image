/**
 * imageStore.js — Image Origin Downloader
 * Centralized in-memory store for all discovered images.
 * Auto-selects images with both dimensions >= 300px; auto-disables otherwise.
 */

let _idCounter = 0;

/**
 * @typedef {Object} StoredImage
 * @property {string}  id
 * @property {string}  url
 * @property {string}  thumbUrl
 * @property {string}  title
 * @property {string}  alt
 * @property {string}  keyword
 * @property {string}  source       'google' | 'bing'
 * @property {number}  width
 * @property {number}  height
 * @property {string}  extension
 * @property {boolean} selected
 * @property {boolean} disabled
 */

/** @type {Map<string, StoredImage>} */
const _store = new Map();

function _newId()     { return `img_${++_idCounter}_${Date.now()}`; }

function _extension(url) {
  try {
    const ext = new URL(url).pathname.split('.').pop().split('?')[0].toLowerCase();
    return ['jpg','jpeg','png','gif','webp','bmp'].includes(ext) ? (ext==='jpeg'?'jpg':ext) : 'jpg';
  } catch (_) { return 'jpg'; }
}

function _disable(w, h) { return w < 300 || h < 300; }

export class ImageStore {
  // ── Mutations ───────────────────────────────────────────────
  static add(img) {
    if (!img.url) return null;
    if ([..._store.values()].some(i => i.url === img.url)) return null;

    const w = img.width || 0, h = img.height || 0;
    const id = _newId();
    _store.set(id, {
      id,
      url:        img.url,
      thumbUrl:   img.thumbUrl || img.url,
      title:      img.title   || '',
      alt:        img.alt      || '',
      keyword:    img.keyword  || '',
      source:     img.source   || 'unknown',
      width:      w,
      height:     h,
      extension:  _extension(img.url),
      selected:   !_disable(w, h),
      disabled:   _disable(w, h),
    });
    return id;
  }

  static toggleSelected(id) {
    const img = _store.get(id);
    if (img && !img.disabled) img.selected = !img.selected;
  }

  static selectAll()  { for (const i of _store.values()) { if (!i.disabled) i.selected = true; } }
  static deselectAll(){ for (const i of _store.values()) i.selected = false; }
  static clear()      { _store.clear(); }

  // ── Queries ─────────────────────────────────────────────────
  static get(id)         { return _store.get(id); }
  static getAll()        { return [..._store.values()]; }
  static getSelected()   { return [..._store.values()].filter(i => i.selected && !i.disabled); }
  static get size()       { return _store.size; }
  static get count()      { return _store.size; }
}
