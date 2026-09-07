(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // popup.js
  var require_popup = __commonJS({
    "popup.js"() {
      document.addEventListener("DOMContentLoaded", () => {
        const captureBtn = document.getElementById("captureBtn");
        const outputArea = document.getElementById("output");
        const sampleOutput = document.getElementById("sampleOutput");
        const backendOutput = document.getElementById("backendOutput");
        const decisionOutput = document.getElementById("decisionOutput");
        const executionOutput = document.getElementById("executionOutput");
        const visualStatus = document.getElementById("visualStatus");
        const screenshotPreview = document.getElementById("screenshotPreview");
        const elementsOutput = document.getElementById("elementsOutput");
        const captureVisualContext = () => {
          visualStatus.textContent = "Capturing tab screenshot locally...";
          visualStatus.style.color = "#555";
          screenshotPreview.style.display = "none";
          screenshotPreview.src = "";
          chrome.runtime.sendMessage({ action: "captureScreenshot" }, (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              if (typeof chrome.tabs.captureVisibleTab === "function") {
                chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (dataUrl) => {
                  if (chrome.runtime.lastError || !dataUrl) {
                    const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture blocked";
                    visualStatus.textContent = `Screenshot capture failed (${err})`;
                    visualStatus.style.color = "#c62828";
                  } else {
                    visualStatus.textContent = "Screenshot captured locally (client-side only)";
                    visualStatus.style.color = "#2e7d32";
                    screenshotPreview.src = dataUrl;
                    screenshotPreview.style.display = "block";
                  }
                });
                return;
              }
              const errMsg = response && response.error || chrome.runtime.lastError?.message || "Capture failed";
              visualStatus.textContent = `Screenshot capture failed (${errMsg})`;
              visualStatus.style.color = "#c62828";
              return;
            }
            visualStatus.textContent = "Screenshot captured locally (client-side only)";
            visualStatus.style.color = "#2e7d32";
            screenshotPreview.src = response.dataUrl;
            screenshotPreview.style.display = "block";
          });
        };
        captureBtn.addEventListener("click", async () => {
          outputArea.value = "Requesting page info...";
          sampleOutput.value = "Scanning and redacting page text...";
          backendOutput.value = "Waiting for sanitized context...";
          decisionOutput.value = "Awaiting decision...";
          executionOutput.value = "Awaiting execution...";
          elementsOutput.value = "Scanning visible elements...";
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) {
              outputArea.value = "Error: No active tab found.";
              sampleOutput.value = "";
              backendOutput.value = "";
              decisionOutput.value = "";
              executionOutput.value = "";
              elementsOutput.value = "";
              visualStatus.textContent = "Screenshot capture failed (no active tab)";
              visualStatus.style.color = "#c62828";
              return;
            }
            if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
              outputArea.value = "Cannot capture Chrome/browser system pages.\nPlease test on a standard webpage (e.g. https://example.com).";
              sampleOutput.value = "";
              backendOutput.value = "";
              decisionOutput.value = "";
              executionOutput.value = "";
              elementsOutput.value = "";
              visualStatus.textContent = "Screenshot capture failed (restricted browser system page)";
              visualStatus.style.color = "#c62828";
              return;
            }
            captureVisualContext();
            const displayResponse = async (data) => {
              if (data && data.success) {
                outputArea.value = `Title: ${data.title}
URL: ${data.url}`;
                sampleOutput.value = data.redactedSample || "(No visible text found on page)";
                if (data.visualElements && Array.isArray(data.visualElements) && data.visualElements.length > 0) {
                  let elementsText = `Detected elements: ${data.visualElements.length}

`;
                  data.visualElements.forEach((el, index) => {
                    const typeUpper = (el.type || "ELEMENT").toUpperCase();
                    elementsText += `${index + 1}.${typeUpper} \u2014 ${el.label} [x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}]
`;
                  });
                  elementsOutput.value = elementsText.trim();
                } else {
                  elementsOutput.value = "No visual elements detected.";
                }
                backendOutput.value = "Sending sanitized data to backend (http://localhost:8000/api/context)...";
                decisionOutput.value = "Evaluating rule-based decision...";
                executionOutput.value = "Awaiting decision from backend...";
                try {
                  const apiRes = await fetch("http://localhost:8000/api/context", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: data.title,
                      url: data.url,
                      redactedSample: data.redactedSample || ""
                    })
                  });
                  if (apiRes.ok) {
                    const resJson = await apiRes.json();
                    backendOutput.value = JSON.stringify(resJson, null, 2);
                    if (resJson.action) {
                      const targetText = resJson.action.target ? resJson.action.target : "None";
                      if (resJson.action.amount !== void 0 && resJson.action.amount !== null) {
                        decisionOutput.value = `${resJson.action.action} \u2192 ${targetText} (amount: ${resJson.action.amount})`;
                      } else {
                        decisionOutput.value = `${resJson.action.action} \u2192 ${targetText}`;
                      }
                      executionOutput.value = "Executing action...";
                      chrome.tabs.sendMessage(
                        tab.id,
                        { action: "executeAction", payload: resJson.action },
                        (execRes) => {
                          if (chrome.runtime.lastError) {
                            executionOutput.value = `Execution error: ${chrome.runtime.lastError.message}`;
                          } else if (execRes && execRes.result) {
                            const r = execRes.result;
                            if (r.executed) {
                              if (r.amount !== void 0 && r.amount !== null) {
                                executionOutput.value = `Executed: ${r.action} \u2192 ${r.target} (amount: ${r.amount})`;
                              } else {
                                executionOutput.value = `Executed: ${r.action} \u2192 ${r.target}`;
                              }
                            } else {
                              executionOutput.value = `Not executed: ${r.reason}`;
                            }
                          } else {
                            executionOutput.value = "No execution response received";
                          }
                        }
                      );
                    } else {
                      decisionOutput.value = "No action returned";
                      executionOutput.value = "Not executed: No action payload";
                    }
                  } else {
                    backendOutput.value = `Backend Error: HTTP ${apiRes.status} ${apiRes.statusText}`;
                    decisionOutput.value = "Error from backend";
                    executionOutput.value = "Skipped (backend error)";
                  }
                } catch (networkErr) {
                  backendOutput.value = `Backend connection failed: ${networkErr.message}
(Ensure FastAPI is running: uvicorn main:app --reload --port 8000)`;
                  decisionOutput.value = "Unavailable (backend offline)";
                  executionOutput.value = "Skipped (backend offline)";
                }
              } else {
                outputArea.value = "Failed to retrieve page info.";
                sampleOutput.value = "";
                backendOutput.value = "Transmission skipped (no context available).";
                decisionOutput.value = "";
                executionOutput.value = "";
                elementsOutput.value = "No visual elements detected.";
              }
            };
            chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (response) => {
              if (chrome.runtime.lastError) {
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["pii-detector.js", "content.js"]
                  });
                  chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (retryResponse) => {
                    if (chrome.runtime.lastError) {
                      outputArea.value = `Error: ${chrome.runtime.lastError.message}`;
                      sampleOutput.value = "";
                      backendOutput.value = "";
                      decisionOutput.value = "";
                      executionOutput.value = "";
                      elementsOutput.value = "";
                    } else {
                      await displayResponse(retryResponse);
                    }
                  });
                } catch (injectError) {
                  outputArea.value = `Error injecting scripts: ${injectError.message}`;
                  sampleOutput.value = "";
                  backendOutput.value = "";
                  decisionOutput.value = "";
                  executionOutput.value = "";
                  elementsOutput.value = "";
                }
                return;
              }
              await displayResponse(response);
            });
          } catch (err) {
            outputArea.value = `Unexpected error: ${err.message}`;
            sampleOutput.value = "";
            backendOutput.value = "";
            decisionOutput.value = "";
            executionOutput.value = "";
            elementsOutput.value = "";
            visualStatus.textContent = `Screenshot capture failed (${err.message})`;
            visualStatus.style.color = "#c62828";
          }
        });
      });
    }
  });
  require_popup();
})();
