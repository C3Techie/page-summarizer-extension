/**
 * Messaging Service
 * Provides clean APIs for chrome.runtime messaging
 */

class MessagingService {
  /**
   * Send message to background service worker
   * @param {Object} message - Message object with action property
   * @returns {Promise} Response from background
   */
  static sendToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send message to content script in a specific tab
   * @param {number} tabId - Tab ID to send message to
   * @param {Object} message - Message object with action property
   * @returns {Promise} Response from content script
   */
  static sendToContentScript(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Listen for messages (for use in content scripts and background)
   * @param {Function} callback - Function called with (request, sender, sendResponse)
   */
  static listen(callback) {
    chrome.runtime.onMessage.addListener(callback);
  }
}
