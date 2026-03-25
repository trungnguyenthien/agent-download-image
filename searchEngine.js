/**
 * SearchEngine class
 * Handles URL generation for different search engines (Bing, DuckDuckGo, Baidu, Yandex)
 */
class SearchEngine {
  /**
   * Get search URL for a specific engine and keyword
   * @param {string} engine - The search engine name (bing, duckduckgo, baidu, yandex)
   * @param {string} keyword - The search keyword
   * @param {number} page - The page number (1-indexed)
   * @returns {string} The search URL
   */
  static getSearchUrl(engine, keyword, page = 1) {
    const encodedKeyword = encodeURIComponent(keyword);
    
    switch (engine.toLowerCase()) {
      case 'google':
        // Google Images - simple URL without pagination (uses infinite scroll)
        return `https://www.google.com/search?q=${encodedKeyword}&tbm=isch`;
      
      case 'bing':
        return `https://www.bing.com/images/search?q=${encodedKeyword}&first=${(page - 1) * 35 + 1}`;
      
      case 'yandex':
        return `https://yandex.com/images/search?text=${encodedKeyword}&p=${page - 1}`;
      
      default:
        throw new Error(`Unknown search engine: ${engine}`);
    }
  }

  /**
   * Get the list of supported search engines
   * @returns {string[]} Array of engine names
   */
  static getSupportedEngines() {
    return ['google', 'bing', 'yandex'];
  }

  /**
   * Validate if an engine is supported
   * @param {string} engine - The engine name to validate
   * @returns {boolean} True if supported
   */
  static isSupported(engine) {
    return this.getSupportedEngines().includes(engine.toLowerCase());
  }
}

export default SearchEngine;
