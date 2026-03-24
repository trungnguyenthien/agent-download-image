/**
 * background.js — Image Origin Downloader
 * Service worker (background script) for Chrome Extension v3.
 * Handles lifecycle events and acts as a relay if needed.
 */

// ── Lifecycle ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎯 Image Origin Downloader installed');
  } else if (details.reason === 'update') {
    console.log('🎯 Image Origin Downloader updated to', chrome.runtime.getManifest().version);
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🎯 Image Origin Downloader started');
});

// ── Message Relay ───────────────────────────────────────────
// background.js can act as a relay between popup and content scripts
// when direct tab communication is not possible.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RELAY_TO_TAB') {
    const { tabId, payload } = message;
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      sendResponse(response || []);
    });
    return true; // async response
  }
  return false;
});
