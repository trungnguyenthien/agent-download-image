#!/usr/bin/env python3
"""
server.py — Image Origin Downloader
Serves static files + uses Playwright to render search engine pages server-side.
"""

import http.server
import json
import os
import sys
import urllib.parse
import urllib.request
import struct
import io
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False
    print("WARNING: Playwright not installed. Run: pip3 install playwright && playwright install chromium")

# Thread pool for parallel image dimension fetching
_executor = ThreadPoolExecutor(max_workers=8)

# ── Image dimension helpers (no PIL needed — reads PNG/JPEG headers directly) ──
def get_image_size_from_bytes(data):
    """
    Reads PNG/JPEG/GIF image dimensions from raw bytes without fully downloading.
    Returns (width, height) or (0, 0) on failure.
    """
    if not data or len(data) < 12:
        return (0, 0)
    try:
        # PNG: signature + IHDR chunk
        if data[:8] == b'\x89PNG\r\n\x1a\n':
            w = struct.unpack('>I', data[16:20])[0]
            h = struct.unpack('>I', data[20:24])[0]
            return (w, h)
        # JPEG: SOF0 marker
        if data[:2] == b'\xff\xd8':
            i = 2
            while i < len(data) - 1:
                # Find next 0xFF byte
                try:
                    ni = data.index(b'\xff', i)
                except ValueError:
                    break
                if ni + 1 >= len(data):
                    break
                marker = data[ni + 1]
                # SOF0, SOF1, SOF2 contain dimensions
                if marker in (0xc0, 0xc1, 0xc2):
                    h = struct.unpack('>H', data[ni+5:ni+7])[0]
                    w = struct.unpack('>H', data[ni+7:ni+9])[0]
                    return (w, h)
                # Skip over this marker segment
                if marker == 0xd8 or marker == 0xd9:
                    i = ni + 2
                    continue
                # Read segment length and skip
                seg_len = struct.unpack('>H', data[ni+2:ni+4])[0]
                i = ni + 2 + seg_len
            return (0, 0)
        # GIF
        if data[:6] in (b'GIF87a', b'GIF89a'):
            w = struct.unpack('<H', data[6:8])[0]
            h = struct.unpack('<H', data[8:10])[0]
            return (w, h)
    except Exception:
        pass
    return (0, 0)

def fetch_image_dimensions(url, timeout=5):
    """
    Fetches the full-res version of a Bing thumbnail URL by stripping the
    thumbnail query params (?w=234&h=180...) and replacing with ?w=2000.
    Then reads only the first 512 bytes (JPEG header) to get real dimensions.
    Returns (width, height).
    """
    try:
        # Strip existing thumbnail params (?w=..., ?h=...) to get full-res
        # e.g. th.bing.com/.../id/OIP.xxx?w=234&h=180 → th.bing.com/.../id/OIP.xxx?w=2000
        u = urllib.parse.urlparse(url)
        base_url = f"{u.scheme}://{u.netloc}{u.path}"
        full_url = f"{base_url}?w=2000"
        req = urllib.request.Request(full_url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Range': 'bytes=0-512',
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read(512)
        return get_image_size_from_bytes(data)
    except Exception:
        return (0, 0)

PORT = 8080
STATIC_DIR = Path(__file__).parent.resolve()


# ── Playwright search ────────────────────────────────────────
def playwright_search(keyword, engine, page):
    if not PLAYWRIGHT_OK:
        return []

    q = urllib.parse.quote(keyword)
    if engine == 'bing':
        first = 0 if page == 0 else 35 + (page - 1) * 48
        url = f"https://www.bing.com/images/search?q={q}&first={first}"
    else:
        url = f"https://www.google.com/search?tbm=isch&q={q}&start={page * 20}"

    results = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            pg = browser.new_page(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                           'AppleWebKit/537.36 (KHTML, like Gecko) '
                           'Chrome/122.0.0.0 Safari/537.36'
            )
            pg.goto(url, wait_until='domcontentloaded', timeout=15000)
            pg.wait_for_timeout(3000)

            if engine == 'bing':
                # Scroll to trigger lazy loading
                pg.evaluate("""
                    (function() {
                        // Force load lazy images
                        var imgs = document.querySelectorAll('img[src*="th.bing.com"]');
                        imgs.forEach(function(img) {
                            if (img.dataset.src) img.src = img.dataset.src;
                            if (!img.src && img.dataset.lazy) img.src = img.dataset.lazy;
                        });
                        window.scrollBy(0, 300);
                        window.scrollBy(0, 600);
                    })()
                """)
                pg.wait_for_timeout(2000)

                # Extract using evaluate (avoids [m] attribute issue)
                raw_results = pg.evaluate("""
                    (function() {
                        var seen = {};
                        var r = [];
                        var items = document.querySelectorAll('.iusc');
                        for (var i = 0; i < items.length; i++) {
                            var item = items[i];
                            var img = item.querySelector('img.mimg') || item.querySelector('img');
                            if (!img) continue;
                            var src = img.currentSrc || img.src || '';
                            if (!src || src.indexOf('http') !== 0) continue;
                            var alt = img.alt || '';
                            var title = item.getAttribute('aria-label') || alt;
                            if (seen[src]) continue;
                            seen[src] = true;
                            r.push({
                                url: src,
                                thumbUrl: src,
                                title: title.trim(),
                                alt: alt.trim(),
                                width: 0,
                                height: 0
                            });
                        }
                        return r;
                    })()
                """)
                for item in (raw_results or []):
                    # Use thumbnail URL for dimension check (thumbUrl already set to original src)
                    thumb = item.get('thumbUrl') or item.get('url') or ''
                    # fetch_image_dimensions strips thumbnail params internally
                    w, h = fetch_image_dimensions(thumb)
                    item['width']  = w
                    item['height'] = h
                    # Replace URL with full-res version (strip thumbnail query params, add w=2000)
                    try:
                        u = urllib.parse.urlparse(thumb)
                        item['url'] = f"{u.scheme}://{u.netloc}{u.path}?w=2000"
                    except Exception:
                        pass  # keep original URL
                    results.append(item)

            else:  # google
                cards = pg.query_selector_all('div.ivg-i')
                for card in cards:
                    img = card.query_selector('img')
                    if not img:
                        continue
                    src = (img.get_attribute('data-full') or
                           img.get_attribute('data-src')  or
                           img.get_attribute('src')        or '')
                    if not src or not src.startswith('http'):
                        continue
                    title = ''
                    alt   = img.get_attribute('alt') or ''
                    w = img.get_attribute('width') or '0'
                    h = img.get_attribute('height') or '0'
                    link = card.query_selector('a')
                    if link:
                        href = link.get_attribute('href') or ''
                        try:
                            params = urllib.parse.parse_qs(
                                urllib.parse.urlparse(href).query)
                            iu = params.get('imgurl', [''])[0]
                            if iu.startswith('http'):
                                src = iu
                        except Exception:
                            pass
                    results.append({
                        'url':       src,
                        'thumbUrl':  src,
                        'title':     title,
                        'alt':       alt,
                        'width':     int(w) if str(w).isdigit() else 0,
                        'height':    int(h) if str(h).isdigit() else 0,
                    })
                if not results:
                    imgs = pg.query_selector_all('img.rg_i, img.Q4LuWd')
                    for img in imgs:
                        src = (img.get_attribute('data-src') or
                               img.get_attribute('src')        or '')
                        if src.startswith('http'):
                            results.append({
                                'url':      src,
                                'thumbUrl': src,
                                'title':    img.get_attribute('alt') or '',
                                'alt':      img.get_attribute('alt') or '',
                                'width':    0,
                                'height':   0,
                            })

            browser.close()
    except Exception as e:
        print(f"Playwright error: {e}", file=sys.stderr)

    return results


# ── HTTP Server ───────────────────────────────────────────────
class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"  [{self.log_date_time_string()}] {fmt % args}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path):
        path = path.rstrip('/')
        if not path:
            path = '/index.html'
        fp = (STATIC_DIR / path.lstrip('/')).resolve()
        if not str(fp).startswith(str(STATIC_DIR)) or not fp.is_file():
            self.send_error(404, 'Not Found')
            return
        ext  = fp.suffix.lower()
        mime = {
            '.html': 'text/html; charset=utf-8',
            '.css':  'text/css; charset=utf-8',
            '.js':   'application/javascript',
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.gif':  'image/gif',
            '.svg':  'image/svg+xml',
        }.get(ext, 'application/octet-stream')
        data = fp.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed  = urllib.parse.urlparse(self.path)
        path    = parsed.path
        params  = urllib.parse.parse_qs(parsed.query)

        # /search endpoint
        if path == '/search' or path.startswith('/search?'):
            keyword = params.get('keyword', [''])[0]
            engine  = params.get('engine', ['bing'])[0]
            page    = int(params.get('page', ['0'])[0])
            if not keyword:
                self.send_json({'error': 'missing keyword'}, 400)
                return
            print(f"  Searching: {engine} [{keyword}] page {page}")
            images = playwright_search(keyword, engine, page)
            print(f"  -> {len(images)} images")
            self.send_json({'images': images, 'keyword': keyword,
                             'engine': engine, 'page': page})
            return

        self.send_file(path)


if __name__ == '__main__':
    print(f"Server: http://127.0.0.1:{PORT}/")
    print(f"Search: http://127.0.0.1:{PORT}/search?keyword=panda&engine=bing&page=0")
    http.server.HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
