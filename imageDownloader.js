/**
 * ImageDownloader class
 * Handles downloading images to user's machine
 */
class ImageDownloader {
  /**
   * Download a single image
   * @param {string} imageUrl - The URL of the image to download
   * @param {string} filename - The desired filename
   * @param {string} saveFolder - The folder name to save in (within Downloads)
   * @returns {Promise<boolean>} True if download succeeded
   */
  static async downloadImage(imageUrl, filename, saveFolder) {
    try {
      console.log('🎯 Downloading image:', filename);

      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      console.log('✅ Image downloaded:', filename);
      return true;
    } catch (error) {
      console.error('‼️ Error downloading image:', filename, error);
      return false;
    }
  }

  /**
   * Download multiple images with progress callback
   * @param {Array<{url: string, source: string, keyword: string, extension: string}>} images - Array of image objects
   * @param {string} saveFolder - The folder name to save in
   * @param {Function} onProgress - Callback function (current, total)
   * @returns {Promise<{success: number, failed: number}>} Download statistics
   */
  static async downloadMultiple(images, saveFolder, onProgress = null) {
    let success = 0;
    let failed = 0;
    const total = images.length;

    console.log(`🎯 Starting download of ${total} images`);

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const filename = this.generateFilename(
        image.source,
        image.keyword,
        image.extension
      );

      const result = await this.downloadImage(image.url, filename, saveFolder);
      
      if (result) {
        success++;
      } else {
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }

      // Small delay to avoid overwhelming the browser
      await this.sleep(100);
    }

    console.log(`✅ Download complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Generate filename for downloaded image
   * @param {string} source - The search engine source (bing, duckduckgo, etc.)
   * @param {string} keyword - The search keyword
   * @param {string} extension - File extension (jpg, png, gif, webp)
   * @returns {string} Generated filename
   */
  static generateFilename(source, keyword, extension) {
    const timestamp = Date.now();
    const cleanKeyword = keyword
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    
    return `${source}-${timestamp}-${cleanKeyword}.${extension}`;
  }

  /**
   * Get file extension from URL or MIME type
   * @param {string} url - The image URL
   * @returns {string} File extension (jpg, png, gif, webp)
   */
  static getExtensionFromUrl(url) {
    // Handle base64 data URLs - extract MIME type
    if (url.startsWith('data:image/')) {
      const mimeMatch = url.match(/^data:image\/(jpeg|jpg|png|gif|webp)/i);
      if (mimeMatch) {
        const ext = mimeMatch[1].toLowerCase();
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
    
    // Try to get extension from regular URL
    const urlPath = url.split('?')[0];
    const match = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (match) {
      const ext = match[1].toLowerCase();
      return ext === 'jpeg' ? 'jpg' : ext;
    }

    // Default to jpg if no extension found
    return 'jpg';
  }

  /**
   * Helper function to sleep/delay
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ImageDownloader;
