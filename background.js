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
    // If a windowId is provided in the request, prioritize it; otherwise null (defaults to last focused window)
    const targetWinId = (typeof request.windowId === "number") ? request.windowId : null;

    chrome.tabs.captureVisibleTab(targetWinId, { format: "jpeg", quality: 60 }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        // Fallback: If capture with specific windowId failed or returned empty, retry with null
        if (targetWinId !== null) {
          chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (retryDataUrl) => {
            if (chrome.runtime.lastError || !retryDataUrl) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture blocked"
              });
            } else {
              sendResponse({
                success: true,
                dataUrl: retryDataUrl
              });
            }
          });
          return;
        }

        sendResponse({
          success: false,
          error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to generate screenshot data URL"
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
