/**
 * searchService.js — Uses the local server's /search endpoint.
 *
 * The server uses Playwright to render Bing Images pages server-side
 * and returns structured JSON data. This avoids all CORS/popup issues.
 */

const BASE_URL = location.origin;

async function fetchJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export class ImageSearchService {
  constructor() { this._aborted = false; this._controller = null; }

  abort() {
    this._aborted = true;
    if (this._controller) this._controller.abort();
  }

  /**
   * Searches for images via the local server's Playwright backend.
   * @param {string} keyword
   * @param {'google'|'bing'} engine
   * @param {number} page  0-indexed
   * @returns {Promise<Array>}
   */
  async search(keyword, engine, page) {
    if (this._aborted) return [];
    this._controller = new AbortController();
    const { signal } = this._controller;

    const url = `${BASE_URL}/search?keyword=${encodeURIComponent(keyword)}&engine=${encodeURIComponent(engine)}&page=${page}`;

    try {
      const data = await fetchJSON(url, signal);
      if (this._aborted) return [];

      const images = (data.images || [])
        // Ensure numeric dimensions
        .map(img => ({
          url:       img.url       || '',
          thumbUrl:  img.thumbUrl  || img.url || '',
          title:     img.title     || '',
          alt:       img.alt       || img.title || '',
          width:     parseInt(img.width)  || 0,
          height:    parseInt(img.height) || 0,
        }))
        // Filter valid URLs
        .filter(img => img.url && img.url.startsWith('http'));

      return images;
    } catch (err) {
      if (err.name === 'AbortError') return [];
      console.error(`Search error [${engine}][${keyword}][p${page}]:`, err);
      return [];
    }
  }
}

/** @type {Map<string, {resolve:(v:any)=>void, timer:ReturnType<typeof setTimeout>}>} */
const _pending = new Map();

export function initSearchListener() {
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'IMAGES_FOUND') return;
    const p = _pending.get(event.data.searchId);
    if (!p) return;
    clearTimeout(p.timer);
    _pending.delete(event.data.searchId);
    p.resolve(event.data.images || []);
  });
}
