/**
 * background.js - Background Service Worker for Manifest V3
 * Milestone 7: Captures screenshot of the active visible tab on demand.
 *
 * Security & Privacy:
 * Screenshot data is kept strictly local (client-side only).
 * It is never sent to the backend server or external services.
 */

// Listen for messages from popup or extension components
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureScreenshot") {
    // Capture the visible area of the currently focused window
    chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message
        });
      } else if (!dataUrl) {
        sendResponse({
          success: false,
          error: "Failed to generate screenshot data URL"
        });
      } else {
        sendResponse({
          success: true,
          dataUrl: dataUrl
        });
      }
    });

    // Return true to indicate asynchronous response handling
    return true;
  }
});
