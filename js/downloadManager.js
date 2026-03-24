/**
 * downloadManager.js — Browser-native image downloader.
 * Uses fetch + Blob URL + <a download> for cross-origin images.
 * For cross-origin images we must use fetch with no-cors mode to get a blob,
 * then create a download link. Note: no-cors means we can't read the response body,
 * but we can still trigger a download via blob URL.
 */

/**
 * Downloads a single image using a temporary blob URL.
 * Falls back to direct URL navigation if blob approach fails.
 *
 * @param {import('./imageStore.js').StoredImage} img
 * @param {string} saveFolder  (Used in filename only; actual download path is browser-controlled)
 * @returns {Promise<{success: boolean, filename: string, error?: string}>}
 */
async function downloadSingle(img, saveFolder) {
  const timestamp  = Date.now();
  const safeKw     = (img.keyword || 'unknown').replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
  const filename   = `${img.source}-${timestamp}-${safeKw}.${img.extension}`;
  const link       = document.createElement('a');

  // If the image URL is same-origin, use direct download
  try {
    const urlObj = new URL(img.url);
    if (urlObj.origin === window.location.origin) {
      link.href      = img.url;
      link.download  = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, filename };
    }
  } catch (_) {}

  // Cross-origin: fetch as blob, then trigger download
  try {
    const res  = await fetch(img.url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    link.href     = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke after a short delay to allow download to start
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    return { success: true, filename };
  } catch (fetchErr) {
    // Final fallback: open in new tab (user can save from there)
    window.open(img.url, '_blank');
    return { success: true, filename, error: 'Opened in new tab (CORS blocked fetch)' };
  }
}

/**
 * Downloads all images sequentially with progress callback.
 * @param {import('./imageStore.js').StoredImage[]} images
 * @param {string} saveFolder
 * @param {(done: number, total: number) => void} onProgress
 * @returns {Promise<Array>}
 */
export async function downloadAll(images, saveFolder, onProgress) {
  const results = [];
  const total   = images.length;
  for (let i = 0; i < total; i++) {
    const result = await downloadSingle(images[i], saveFolder);
    results.push(result);
    onProgress(i + 1, total);
    // Small delay between downloads
    if (i < total - 1) await new Promise(r => setTimeout(r, 200));
  }
  return results;
}
