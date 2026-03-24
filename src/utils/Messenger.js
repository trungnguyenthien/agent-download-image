/**
 * Messenger.js
 * Wrapper around chrome.runtime.sendMessage / chrome.tabs.sendMessage
 * with timeout support for reliable communication between popup ↔ content scripts.
 */

const DEFAULT_TIMEOUT = 8000;

/**
 * Sends a one-time message to a content script in a specific tab.
 * Resolves with the response or [] on timeout / error.
 *
 * @param {number}   tabId
 * @param {object}   message
 * @param {number}   [timeoutMs]
 * @returns {Promise<any>}
 */
export function sendToTab(tabId, message, timeoutMs = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve([]);
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve([]);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Sends a message to the background service worker.
 * @param {object} message
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
export function sendToBackground(message, timeoutMs = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      resolve(chrome.runtime.lastError ? null : response);
    });
  });
}
