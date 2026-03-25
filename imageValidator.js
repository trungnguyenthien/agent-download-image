/**
 * ImageValidator class
 * Handles validation of images based on keyword match and dimensions
 */
class ImageValidator {
  /**
   * Check if image title or alt contains the keyword
   * @param {string} text - The title or alt text to check
   * @param {string} keyword - The keyword to search for
   * @returns {boolean} True if keyword is found
   */
  static containsKeyword(text, keyword) {
    if (!text || !keyword) return false;
    
    const normalizedText = text.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase();
    
    return normalizedText.includes(normalizedKeyword);
  }

  /**
   * Validate image dimensions against minimum requirements
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   * @param {number} minSize - Minimum size for both width and height (default 150px)
   * @returns {boolean} True if both dimensions meet requirements
   */
  static validateDimensions(width, height, minSize = 150) {
    return width >= minSize && height >= minSize;
  }

  /**
   * Get image dimensions from URL by fetching headers
   * @param {string} imageUrl - The image URL
   * @returns {Promise<{width: number, height: number}|null>} Object with width and height, or null if failed
   */
  static async getImageDimensions(imageUrl) {
    try {
      // Fetch first 512 bytes to read image header
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-511'
        }
      });

      if (!response.ok) {
        // Try without range if server doesn't support it
        const fullResponse = await fetch(imageUrl);
        const blob = await fullResponse.blob();
        return await this.getDimensionsFromBlob(blob);
      }

      const buffer = await response.arrayBuffer();
      const dimensions = this.parseDimensionsFromBuffer(buffer);
      
      return dimensions;
    } catch (error) {
      console.error('‼️ Error getting image dimensions:', error);
      return null;
    }
  }

  /**
   * Get dimensions from a blob using Image element
   * @param {Blob} blob - The image blob
   * @returns {Promise<{width: number, height: number}>} Dimensions object
   */
  static getDimensionsFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Parse image dimensions from buffer (JPEG, PNG, GIF)
   * @param {ArrayBuffer} buffer - The image data buffer
   * @returns {{width: number, height: number}|null} Dimensions or null
   */
  static parseDimensionsFromBuffer(buffer) {
    const arr = new Uint8Array(buffer);

    // JPEG
    if (arr[0] === 0xFF && arr[1] === 0xD8) {
      return this.parseJPEGDimensions(arr);
    }

    // PNG
    if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
      return this.parsePNGDimensions(arr);
    }

    // GIF
    if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
      return this.parseGIFDimensions(arr);
    }

    return null;
  }

  /**
   * Parse JPEG image dimensions
   * @param {Uint8Array} arr - The image data array
   * @returns {{width: number, height: number}|null} Dimensions or null
   */
  static parseJPEGDimensions(arr) {
    let offset = 2;
    while (offset < arr.length) {
      if (arr[offset] !== 0xFF) break;
      
      const marker = arr[offset + 1];
      offset += 2;

      // SOF markers (Start of Frame)
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        const height = (arr[offset + 3] << 8) | arr[offset + 4];
        const width = (arr[offset + 5] << 8) | arr[offset + 6];
        return { width, height };
      }

      const length = (arr[offset] << 8) | arr[offset + 1];
      offset += length;
    }

    return null;
  }

  /**
   * Parse PNG image dimensions
   * @param {Uint8Array} arr - The image data array
   * @returns {{width: number, height: number}|null} Dimensions or null
   */
  static parsePNGDimensions(arr) {
    // PNG dimensions are at bytes 16-23 in IHDR chunk
    const width = (arr[16] << 24) | (arr[17] << 16) | (arr[18] << 8) | arr[19];
    const height = (arr[20] << 24) | (arr[21] << 16) | (arr[22] << 8) | arr[23];
    return { width, height };
  }

  /**
   * Parse GIF image dimensions
   * @param {Uint8Array} arr - The image data array
   * @returns {{width: number, height: height}|null} Dimensions or null
   */
  static parseGIFDimensions(arr) {
    // GIF dimensions are at bytes 6-9
    const width = arr[6] | (arr[7] << 8);
    const height = arr[8] | (arr[9] << 8);
    return { width, height };
  }
}

export default ImageValidator;
