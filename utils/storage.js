/**
 * Storage Manager
 * Provides caching functionality for summaries
 */

class StorageManager {
  static CACHE_KEY_PREFIX = 'summary_';
  static CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  /**
   * Generate cache key from URL
   * @param {string} url - Page URL
   * @returns {string} Cache key
   */
  static getCacheKey(url) {
    // Use URL hash to create consistent key
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.CACHE_KEY_PREFIX}${Math.abs(hash)}`;
  }

  /**
   * Save summary to storage
   * @param {string} url - Page URL
   * @param {Object} summary - Summary object to cache
   */
  static async saveSummary(url, summary) {
    try {
      const key = this.getCacheKey(url);
      const data = {
        url: url,
        summary: summary,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({
        [key]: data
      });

      console.log(' Summary cached for URL:', url);
    } catch (error) {
      console.error(' Failed to save summary:', error);
    }
  }

  /**
   * Get cached summary
   * @param {string} url - Page URL
   * @returns {Promise<Object|null>} Cached summary or null if not found/expired
   */
  static async getSummary(url) {
    try {
      const key = this.getCacheKey(url);
      const result = await chrome.storage.local.get([key]);

      if (!result[key]) {
        return null;
      }

      const { summary, timestamp } = result[key];

      // Check if cache has expired
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        await this.clearSummary(url);
        return null;
      }

      console.log(' Retrieved cached summary for URL:', url);
      return summary;
    } catch (error) {
      console.error(' Failed to get summary:', error);
      return null;
    }
  }

  /**
   * Clear cached summary
   * @param {string} url - Page URL
   */
  static async clearSummary(url) {
    try {
      const key = this.getCacheKey(url);
      await chrome.storage.local.remove([key]);
      console.log(' Cache cleared for URL:', url);
    } catch (error) {
      console.error(' Failed to clear summary:', error);
    }
  }

  /**
   * Clear all cached summaries
   */
  static async clearAll() {
    try {
      const result = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(result).filter(key =>
        key.startsWith(this.CACHE_KEY_PREFIX)
      );

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(' All cached summaries cleared');
      }
    } catch (error) {
      console.error(' Failed to clear all summaries:', error);
    }
  }

  /**
   * Get storage stats
   * @returns {Promise<Object>} Storage statistics
   */
  static async getStats() {
    try {
      const result = await chrome.storage.local.get(null);
      const summaries = Object.keys(result).filter(key =>
        key.startsWith(this.CACHE_KEY_PREFIX)
      );

      return {
        cachedSummaries: summaries.length,
        keys: summaries
      };
    } catch (error) {
      console.error(' Failed to get stats:', error);
      return null;
    }
  }
}
