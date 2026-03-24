/**
 * DownloadManager.js
 * Handles downloading images using the chrome.downloads API.
 * Saves each image to /Download/{saveFolder}/{source}-{timestamp}-{keyword}.{ext}
 */

/**
 * Downloads a single image and saves it with a formatted filename.
 * @param {object} img  StoredImage object
 * @param {string} saveFolder  Subfolder under Downloads
 * @returns {Promise<{success: boolean, filename: string, error?: string}>}
 */
async function downloadSingleImage(img, saveFolder) {
  const timestamp = Date.now();
  const safeKeyword = (img.keyword || 'unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .substring(0, 50);
  const filename = `${img.source}-${timestamp}-${safeKeyword}.${img.extension}`;

  // Chrome Downloads API: saves to the user's default Downloads folder
  // We pass the saveas dialog through the DownloadsAPI path
  return new Promise((resolve) => {
    const options = {
      url:      img.url,
      filename: `${saveFolder}/${filename}`,
      conflictAction: 'uniquify',
      saveAs:  false,
    };

    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, filename, error: chrome.runtime.lastError.message });
      } else {
        resolve({ success: true, filename, downloadId });
      }
    });
  });
}

/**
 * Downloads all provided images with progress reporting.
 *
 * @param {import('./ImageStore.js').StoredImage[]} images
 * @param {string} saveFolder
 * @param {(done: number, total: number) => void} onProgress
 * @returns {Promise<Array<{success:boolean, filename:string, error?:string}>>}
 */
export async function downloadAll(images, saveFolder, onProgress) {
  const results = [];
  const total   = images.length;

  // Ensure the folder path prefix exists (Chrome creates intermediate dirs)
  // We trigger a dummy download with a directory placeholder first
  if (total > 0) {
    try {
      await new Promise((resolve) => {
        chrome.downloads.download(
          { url: 'data:text/plain,placeholder', filename: `${saveFolder}/.placeholder` },
          resolve,
        );
      });
    } catch (_) {}
  }

  for (let i = 0; i < total; i++) {
    const result = await downloadSingleImage(images[i], saveFolder);
    results.push(result);
    onProgress(i + 1, total);

    // Small delay between downloads to avoid rate limiting
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return results;
}

export class DownloadManager {
  static downloadAll = downloadAll;
}
