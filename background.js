/**
 * Background service worker for Image Search & Download Extension
 * Handles extension icon clicks and opens the main application page
 */

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('🎯 Extension icon clicked');
  
  // Open the main application page in a new tab
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});
