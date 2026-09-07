/**
 * popup.js - Script for the extension popup
 * Milestones 1–12: Page metadata capture, local PII redaction, backend decision/execution,
 * local visual context (tab screenshot), local DOM perception, on-device SqueezeNet vision classification,
 * local perception fusion, local screenshot privacy redaction, and local OCR-based visual PII detection.
 * Milestone 13: Secure Sanitized Visual Agent Gateway (Task Input -> Privacy Pipeline -> Gateway -> Demo Agent -> Safe Execution).
 */

document.addEventListener("DOMContentLoaded", () => {
  // Existing Milestone 1-8 DOM elements
  const captureBtn = document.getElementById("captureBtn");
  const outputArea = document.getElementById("output");
  const sampleOutput = document.getElementById("sampleOutput");
  const backendOutput = document.getElementById("backendOutput");
  const decisionOutput = document.getElementById("decisionOutput");
  const executionOutput = document.getElementById("executionOutput");
  const visualStatus = document.getElementById("visualStatus");
  const screenshotPreview = document.getElementById("screenshotPreview");
  const elementsOutput = document.getElementById("elementsOutput");

  // Milestone 9 DOM elements for on-device Vision Classification
  const visionStatus = document.getElementById("visionStatus");
  const visionDetails = document.getElementById("visionDetails");
  const visionStatusText = document.getElementById("visionStatusText");
  const visionProvider = document.getElementById("visionProvider");
  const visionLatency = document.getElementById("visionLatency");
  const visionClassIndex = document.getElementById("visionClassIndex");
  const visionConfidence = document.getElementById("visionConfidence");

  // Milestone 11 & 12 DOM elements for Local Visual Privacy (Screenshot Redaction + OCR)
  const privacyStatus = document.getElementById("privacyStatus");
  const privacyDetails = document.getElementById("privacyDetails");
  const privacyOriginalStatus = document.getElementById("privacyOriginalStatus");
  const privacyOcrStatus = document.getElementById("privacyOcrStatus");
  const privacyRegionCount = document.getElementById("privacyRegionCount");
  const privacyOcrTextCount = document.getElementById("privacyOcrTextCount");
  const privacyOcrSensitiveCount = document.getElementById("privacyOcrSensitiveCount");
  const privacyTotalRedactedCount = document.getElementById("privacyTotalRedactedCount");
  const privacyRedactionStatus = document.getElementById("privacyRedactionStatus");
  const sanitizedScreenshotPreview = document.getElementById("sanitizedScreenshotPreview");

  // Milestone 10/11/12 DOM elements for Perception Fusion & Pipeline Timing
  const fusionStatus = document.getElementById("fusionStatus");
  const fusionDetails = document.getElementById("fusionDetails");
  const fusionElementCount = document.getElementById("fusionElementCount");
  const fusionVisionClass = document.getElementById("fusionVisionClass");
  const fusionSensitiveCount = document.getElementById("fusionSensitiveCount");
  const timingDom = document.getElementById("timingDom");
  const timingScreenshot = document.getElementById("timingScreenshot");
  const timingVision = document.getElementById("timingVision");
  const timingSensitive = document.getElementById("timingSensitive");
  const timingOcrInit = document.getElementById("timingOcrInit");
  const timingOcrInference = document.getElementById("timingOcrInference");
  const timingOcrDetection = document.getElementById("timingOcrDetection");
  const timingMerge = document.getElementById("timingMerge");
  const timingRedaction = document.getElementById("timingRedaction");
  const timingFusion = document.getElementById("timingFusion");
  const timingGateway = document.getElementById("timingGateway");

  // Milestone 13 & 14 DOM elements: Browser Agent Task Input & Status Panel
  const taskInput = document.getElementById("taskInput");
  const runAgentTaskBtn = document.getElementById("runAgentTaskBtn");
  const agentTaskText = document.getElementById("agentTaskText");
  const agentRequestId = document.getElementById("agentRequestId");
  const agentScreenshotStatus = document.getElementById("agentScreenshotStatus");
  const agentPrivacyStatus = document.getElementById("agentPrivacyStatus");
  const agentDomPiiCount = document.getElementById("agentDomPiiCount");
  const agentOcrPiiCount = document.getElementById("agentOcrPiiCount");
  const agentSensitiveCount = document.getElementById("agentSensitiveCount");
  const agentRedactionStatus = document.getElementById("agentRedactionStatus");
  const agentSanitizedStatus = document.getElementById("agentSanitizedStatus");
  const agentRawUploadStatus = document.getElementById("agentRawUploadStatus");
  const agentSanitizedUploadStatus = document.getElementById("agentSanitizedUploadStatus");
  const agentModeStatus = document.getElementById("agentModeStatus");
  const agentActionText = document.getElementById("agentActionText");
  const agentReasoningText = document.getElementById("agentReasoningText");
  const agentSafetyStatus = document.getElementById("agentSafetyStatus");
  const agentExecutionStatus = document.getElementById("agentExecutionStatus");
  const agentGatewayLatency = document.getElementById("agentGatewayLatency");

  // Milestone 14 DOM elements: Bounded Loop & Verification
  const agentStepText = document.getElementById("agentStepText");
  const agentVerificationText = document.getElementById("agentVerificationText");
  const agentTraceContainer = document.getElementById("agentTraceContainer");

  // Milestone 15 DOM elements: Generalized Grounding Telemetry
  const groundingMethodText = document.getElementById("groundingMethodText");
  const groundingScoreText = document.getElementById("groundingScoreText");
  const groundedElementText = document.getElementById("groundedElementText");

  // Milestone 16 DOM elements: FILL Telemetry & Privacy Indicator
  const fillStepStatus = document.getElementById("fillStepStatus");
  const fieldValuesPrivacyNotice = document.getElementById("fieldValuesPrivacyNotice");

  // Milestone 14 & 16 Constants (Bounded Loop up to 5 steps)
  const MAX_AGENT_STEPS = 5;
  const PIXEL_CHANGE_THRESHOLD = 30;
  const ACTION_VERIFICATION_DELAY_MS = 600;

  // Milestone 14 Module-Level Loop & Trace State
  let previousScreenSignature = null;
  let executionTraceHistory = [];

  // State cache for current capture pass
  let latestScreenshotDataUrl = null;
  let latestScreenshotDims = { width: 0, height: 0 };
  let latestVisualElements = null;
  let latestSensitiveRegions = null;
  let latestOcrSensitiveRegions = [];
  let latestOcrWordCount = 0;
  let latestMergedRegions = null;
  let latestVisionResult = null;
  let latestSanitizedDataUrl = null;
  let latestPageData = null;
  let ocrCompleted = false;
  let redactionCompleted = false;
  let redactionError = null;

  // Listeners waiting for privacy redaction pass to conclude
  let onRedactionCompleteCallbacks = [];

  const timing = {
    domExtractionMs: null,
    screenshotMs: null,
    visionInferenceMs: null,
    sensitiveRegionDetectionMs: null,
    ocrInitMs: null,
    ocrInferenceMs: null,
    ocrSensitiveDetectionMs: null,
    regionMergeMs: null,
    redactionMs: null,
    fusionMs: null,
    gatewayMs: null
  };

  // Helper to notify any waiting promises when redaction finishes
  const notifyRedactionDone = (result) => {
    const cbs = [...onRedactionCompleteCallbacks];
    onRedactionCompleteCallbacks = [];
    cbs.forEach((cb) => {
      try { cb(result); } catch (e) { console.error("Redaction callback error:", e); }
    });
  };

  // Promise hook to await completion of the local redaction pipeline
  const waitForRedaction = () => {
    if (redactionCompleted) {
      return Promise.resolve({
        success: !!latestSanitizedDataUrl,
        sanitizedScreenshotDataUrl: latestSanitizedDataUrl,
        error: redactionError
      });
    }
    return new Promise((resolve) => {
      onRedactionCompleteCallbacks.push(resolve);
    });
  };

  // Helper function to scale screenshot to 224x224 ImageData (Milestone 9)
  // Security Note: All resizing and vision inference is client-side only (never transmitted).
  const resizeScreenshotTo224 = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 224;
          canvas.height = 224;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 224, 224);
          const imageData = ctx.getImageData(0, 0, 224, 224);
          resolve(imageData);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load screenshot image for scaling"));
      };
      img.src = dataUrl;
    });
  };

  // Helper to render the fused perception summary and timing telemetry (Milestones 10, 11, 12, 13)
  const renderPerceptionSummary = () => {
    if (!fusionStatus || !fusionDetails) return;

    const t0 = performance.now();
    let fused = null;
    if (window.SIHFusion && typeof window.SIHFusion.buildLocalPerception === "function") {
      fused = window.SIHFusion.buildLocalPerception(
        latestVisualElements,
        latestVisionResult,
        timing,
        latestSensitiveRegions ? latestSensitiveRegions.length : 0,
        {
          ocrTextRegionCount: latestOcrWordCount,
          ocrSensitiveRegionCount: latestOcrSensitiveRegions.length,
          totalRedactedRegionCount: latestMergedRegions ? latestMergedRegions.length : 0
        }
      );
    }
    const t1 = performance.now();
    timing.fusionMs = Math.round(t1 - t0);

    // Update timing metrics
    if (timingDom) timingDom.textContent = timing.domExtractionMs !== null ? `${timing.domExtractionMs} ms` : "-";
    if (timingScreenshot) timingScreenshot.textContent = timing.screenshotMs !== null ? `${timing.screenshotMs} ms` : "-";
    if (timingVision) timingVision.textContent = timing.visionInferenceMs !== null ? `${timing.visionInferenceMs} ms` : "-";
    if (timingSensitive) timingSensitive.textContent = timing.sensitiveRegionDetectionMs !== null ? `${timing.sensitiveRegionDetectionMs} ms` : "-";
    if (timingOcrInit) timingOcrInit.textContent = timing.ocrInitMs !== null ? `${timing.ocrInitMs} ms` : "-";
    if (timingOcrInference) timingOcrInference.textContent = timing.ocrInferenceMs !== null ? `${timing.ocrInferenceMs} ms` : "-";
    if (timingOcrDetection) timingOcrDetection.textContent = timing.ocrSensitiveDetectionMs !== null ? `${timing.ocrSensitiveDetectionMs} ms` : "-";
    if (timingMerge) timingMerge.textContent = timing.regionMergeMs !== null ? `${timing.regionMergeMs} ms` : "-";
    if (timingRedaction) timingRedaction.textContent = timing.redactionMs !== null ? `${timing.redactionMs} ms` : "-";
    if (timingFusion) timingFusion.textContent = timing.fusionMs !== null ? `${timing.fusionMs} ms` : "-";
    if (timingGateway) timingGateway.textContent = timing.gatewayMs !== null ? `${timing.gatewayMs} ms` : "-";

    // Update fusion summary counts
    if (fusionElementCount) {
      fusionElementCount.textContent = latestVisualElements ? latestVisualElements.length : "-";
    }
    if (fusionVisionClass) {
      if (latestVisionResult && typeof latestVisionResult.classIndex === "number") {
        fusionVisionClass.textContent = `Class ${latestVisionResult.classIndex} (${(latestVisionResult.confidence * 100).toFixed(1)}%)`;
      } else {
        fusionVisionClass.textContent = "Pending / None";
      }
    }
    if (fusionSensitiveCount) {
      const count = latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0);
      fusionSensitiveCount.textContent = count;
    }

    fusionStatus.textContent = "Local perception fused (on-device only)";
    fusionStatus.style.color = "#2e7d32";
    fusionDetails.style.display = "block";
  };

  // Helper function to execute local privacy redaction on the merged (DOM + OCR) regions (Milestones 11 & 12)
  // Fail-closed guarantee: Never displays or falls back to raw screenshot if final redaction throws/fails.
  const triggerRedaction = async () => {
    if (redactionCompleted || !latestScreenshotDataUrl || !latestSensitiveRegions || !ocrCompleted) {
      return;
    }
    redactionCompleted = true;

    if (privacyStatus) {
      privacyStatus.textContent = "Merging regions and redacting sensitive canvas areas...";
      privacyStatus.style.color = "#1565c0";
    }

    try {
      if (!window.SIHRedactor || typeof window.SIHRedactor.buildSanitizedScreenshot !== "function") {
        throw new Error("SIHRedactor module not loaded");
      }

      // Step 5: Region merging (DOM + OCR)
      const tMerge0 = performance.now();
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      let mergedRegions = [];

      if (typeof window.SIHRedactor.mergeSensitiveRegions === "function") {
        mergedRegions = window.SIHRedactor.mergeSensitiveRegions(
          latestSensitiveRegions,
          latestOcrSensitiveRegions,
          latestScreenshotDims.width,
          latestScreenshotDims.height,
          dpr
        );
      } else {
        // Fallback to DOM regions if merge function is absent
        mergedRegions = latestSensitiveRegions;
      }
      timing.regionMergeMs = Math.round(performance.now() - tMerge0);
      latestMergedRegions = mergedRegions;

      // Step 5.2: Build sanitized screenshot canvas copy
      const tRedact0 = performance.now();
      const redactionResult = await window.SIHRedactor.buildSanitizedScreenshot(
        latestScreenshotDataUrl,
        mergedRegions
      );
      timing.redactionMs = Math.round(performance.now() - tRedact0);

      if (redactionResult && redactionResult.success && redactionResult.sanitizedScreenshotDataUrl) {
        latestSanitizedDataUrl = redactionResult.sanitizedScreenshotDataUrl;
        redactionError = null;

        if (privacyStatus) {
          privacyStatus.textContent = "Local visual privacy redaction active";
          privacyStatus.style.color = "#2e7d32";
        }

        if (privacyOriginalStatus) privacyOriginalStatus.textContent = "CAPTURED LOCALLY";
        if (privacyOcrStatus) privacyOcrStatus.textContent = "ON DEVICE (WASM)";
        if (privacyRegionCount) privacyRegionCount.textContent = latestSensitiveRegions.length;
        if (privacyOcrTextCount) privacyOcrTextCount.textContent = latestOcrWordCount;
        if (privacyOcrSensitiveCount) privacyOcrSensitiveCount.textContent = latestOcrSensitiveRegions.length;
        if (privacyTotalRedactedCount) privacyTotalRedactedCount.textContent = mergedRegions.length;

        if (privacyRedactionStatus) {
          privacyRedactionStatus.textContent = "ACTIVE";
          privacyRedactionStatus.style.color = "#2e7d32";
        }
        if (sanitizedScreenshotPreview) {
          sanitizedScreenshotPreview.src = redactionResult.sanitizedScreenshotDataUrl;
          sanitizedScreenshotPreview.style.display = "block";
        }
        if (privacyDetails) privacyDetails.style.display = "block";

        notifyRedactionDone({
          success: true,
          sanitizedScreenshotDataUrl: latestSanitizedDataUrl
        });
      } else {
        // Fail-closed handling: Never fall back to raw screenshot
        throw new Error(redactionResult?.error || "Redaction returned empty output");
      }
    } catch (err) {
      latestSanitizedDataUrl = null;
      redactionError = err.message || String(err);
      console.error("Local screenshot redaction error:", err);

      if (privacyStatus) {
        privacyStatus.textContent = `Redaction failed: ${err.message || err}`;
        privacyStatus.style.color = "#c62828";
      }

      if (privacyOriginalStatus) privacyOriginalStatus.textContent = "CAPTURED LOCALLY";
      if (privacyOcrStatus) privacyOcrStatus.textContent = "ON DEVICE (WASM)";
      if (privacyRegionCount) privacyRegionCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
      if (privacyOcrTextCount) privacyOcrTextCount.textContent = latestOcrWordCount;
      if (privacyOcrSensitiveCount) privacyOcrSensitiveCount.textContent = latestOcrSensitiveRegions.length;
      if (privacyTotalRedactedCount) privacyTotalRedactedCount.textContent = 0;

      if (privacyRedactionStatus) {
        privacyRedactionStatus.textContent = "FAILED — sanitized screenshot withheld";
        privacyRedactionStatus.style.color = "#c62828";
      }
      if (sanitizedScreenshotPreview) {
        sanitizedScreenshotPreview.style.display = "none";
        sanitizedScreenshotPreview.src = "";
      }
      if (privacyDetails) privacyDetails.style.display = "block";

      notifyRedactionDone({
        success: false,
        sanitizedScreenshotDataUrl: null,
        error: redactionError
      });
    }

    renderPerceptionSummary();
  };

  // Helper function to run on-device OCR pipeline (Milestone 12)
  // Non-blocking: OCR failure gracefully falls back to DOM-only redaction
  const triggerOcrPipeline = async (dataUrl) => {
    ocrCompleted = false;
    latestOcrSensitiveRegions = [];
    latestOcrWordCount = 0;

    try {
      if (!window.SIHOCR || typeof window.SIHOCR.runOcr !== "function") {
        throw new Error("SIHOCR module not loaded");
      }

      const ocrResult = await window.SIHOCR.runOcr(dataUrl);

      if (ocrResult && ocrResult.success) {
        timing.ocrInitMs = ocrResult.initTimeMs;
        timing.ocrInferenceMs = ocrResult.inferenceTimeMs;
        latestOcrWordCount = (ocrResult.words || []).length;

        if (ocrResult.screenshotDimensions) {
          latestScreenshotDims = ocrResult.screenshotDimensions;
        }

        // Detect sensitive regions using M2's regex patterns
        const tDet0 = performance.now();
        if (typeof window.SIHOCR.detectSensitiveOcrRegions === "function") {
          latestOcrSensitiveRegions = window.SIHOCR.detectSensitiveOcrRegions(ocrResult);
        }
        timing.ocrSensitiveDetectionMs = Math.round(performance.now() - tDet0);
      } else {
        console.warn("OCR recognition notice:", ocrResult?.reason || "No OCR output");
        timing.ocrInitMs = ocrResult?.initTimeMs || 0;
        timing.ocrInferenceMs = ocrResult?.inferenceTimeMs || 0;
        timing.ocrSensitiveDetectionMs = 0;
      }
    } catch (ocrErr) {
      console.warn("OCR pipeline notice (falling back to DOM-only redaction):", ocrErr);
      timing.ocrInitMs = timing.ocrInitMs || 0;
      timing.ocrInferenceMs = 0;
      timing.ocrSensitiveDetectionMs = 0;
    } finally {
      ocrCompleted = true;
      // Trigger redaction once OCR settles (whether OCR succeeded or fell back)
      triggerRedaction();
    }
  };

  // Helper function to run on-device SqueezeNet vision classification (Milestone 9)
  const triggerVisionClassification = async (dataUrl) => {
    if (!visionStatus) return;

    visionStatus.textContent = "Classifying image with on-device vision model (SqueezeNet)...";
    visionStatus.style.color = "#1565c0";
    if (visionDetails) visionDetails.style.display = "none";

    try {
      if (!window.SIHVision || typeof window.SIHVision.runVisionInference !== "function") {
        throw new Error("SIHVision model runtime not loaded");
      }

      const resizedImageData = await resizeScreenshotTo224(dataUrl);

      const t0 = performance.now();
      const result = await window.SIHVision.runVisionInference(resizedImageData);
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      timing.visionInferenceMs = latencyMs;
      latestVisionResult = result;

      visionStatus.textContent = "Vision classification completed (on-device)";
      visionStatus.style.color = "#2e7d32";

      if (visionStatusText) visionStatusText.textContent = "Completed";
      if (visionProvider) visionProvider.textContent = result.executionProvider || "wasm";
      if (visionLatency) visionLatency.textContent = `${latencyMs} ms`;
      if (visionClassIndex) visionClassIndex.textContent = result.classIndex;
      if (visionConfidence) {
        visionConfidence.textContent = typeof result.confidence === "number"
          ? result.confidence.toFixed(4)
          : result.confidence;
      }
      if (visionDetails) visionDetails.style.display = "block";
    } catch (err) {
      console.error("Local vision classification error:", err);
      visionStatus.textContent = `Vision classification failed: ${err.message || err}`;
      visionStatus.style.color = "#c62828";
      if (visionDetails) visionDetails.style.display = "none";
      latestVisionResult = null;
    }

    renderPerceptionSummary();
  };

  // Helper function to capture tab screenshot locally (Milestone 7)
  // Security Note: Screenshot is strictly local (client-side only) and NEVER sent to backend raw.
  const captureVisualContext = (onScreenshotReady) => {
    if (visualStatus) {
      visualStatus.textContent = "Capturing tab screenshot locally...";
      visualStatus.style.color = "#555";
    }
    if (screenshotPreview) {
      screenshotPreview.style.display = "none";
      screenshotPreview.src = "";
    }

    if (visionStatus) {
      visionStatus.textContent = "Awaiting screenshot...";
      visionStatus.style.color = "#555";
    }
    if (visionDetails) visionDetails.style.display = "none";

    const t0 = performance.now();

    // 1. Request screenshot via background service worker
    chrome.runtime.sendMessage({ action: "captureScreenshot" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        // Fallback: Attempt capture directly if in active window context
        if (typeof chrome.tabs.captureVisibleTab === "function") {
          chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (dataUrl) => {
            const t1 = performance.now();
            timing.screenshotMs = Math.round(t1 - t0);

            if (chrome.runtime.lastError || !dataUrl) {
              const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture blocked";
              if (visualStatus) {
                visualStatus.textContent = `Screenshot capture failed (${err})`;
                visualStatus.style.color = "#c62828";
              }
              if (visionStatus) {
                visionStatus.textContent = "Vision classification skipped (screenshot unavailable)";
                visionStatus.style.color = "#c62828";
              }
              if (privacyStatus) {
                privacyStatus.textContent = "Redaction skipped (screenshot unavailable)";
                privacyStatus.style.color = "#c62828";
              }
              renderPerceptionSummary();
              if (typeof onScreenshotReady === "function") onScreenshotReady(null, err);
            } else {
              if (visualStatus) {
                visualStatus.textContent = "Screenshot captured locally (client-side only)";
                visualStatus.style.color = "#2e7d32";
              }
              if (screenshotPreview) {
                screenshotPreview.src = dataUrl;
                screenshotPreview.style.display = "block";
              }
              latestScreenshotDataUrl = dataUrl;

              // Read natural dimensions
              const tempImg = new Image();
              tempImg.onload = () => {
                latestScreenshotDims = {
                  width: tempImg.naturalWidth || tempImg.width,
                  height: tempImg.naturalHeight || tempImg.height
                };
              };
              tempImg.src = dataUrl;

              // Trigger local OCR on screenshot
              triggerOcrPipeline(dataUrl);

              // Trigger on-device vision classification
              triggerVisionClassification(dataUrl);

              if (typeof onScreenshotReady === "function") onScreenshotReady(dataUrl, null);
            }
          });
          return;
        }

        const errMsg = (response && response.error) || chrome.runtime.lastError?.message || "Capture failed";
        if (visualStatus) {
          visualStatus.textContent = `Screenshot capture failed (${errMsg})`;
          visualStatus.style.color = "#c62828";
        }
        if (visionStatus) {
          visionStatus.textContent = "Vision classification skipped (screenshot unavailable)";
          visionStatus.style.color = "#c62828";
        }
        if (privacyStatus) {
          privacyStatus.textContent = "Redaction skipped (screenshot unavailable)";
          privacyStatus.style.color = "#c62828";
        }
        renderPerceptionSummary();
        if (typeof onScreenshotReady === "function") onScreenshotReady(null, errMsg);
        return;
      }

      const t1 = performance.now();
      timing.screenshotMs = Math.round(t1 - t0);

      // 2. Successful capture: render local preview, trigger OCR pipeline, and trigger vision classification
      if (visualStatus) {
        visualStatus.textContent = "Screenshot captured locally (client-side only)";
        visualStatus.style.color = "#2e7d32";
      }
      if (screenshotPreview) {
        screenshotPreview.src = response.dataUrl;
        screenshotPreview.style.display = "block";
      }
      latestScreenshotDataUrl = response.dataUrl;

      // Read natural dimensions
      const tempImg = new Image();
      tempImg.onload = () => {
        latestScreenshotDims = {
          width: tempImg.naturalWidth || tempImg.width,
          height: tempImg.naturalHeight || tempImg.height
        };
      };
      tempImg.src = response.dataUrl;

      // Milestone 12: Trigger OCR pipeline on screenshot
      triggerOcrPipeline(response.dataUrl);

      // Milestone 9: Trigger on-device vision classification
      triggerVisionClassification(response.dataUrl);

      if (typeof onScreenshotReady === "function") onScreenshotReady(response.dataUrl, null);
    });
  };

  // Resets pipeline state for a fresh capture/agent pass
  const resetPipelineState = () => {
    latestScreenshotDataUrl = null;
    latestScreenshotDims = { width: 0, height: 0 };
    latestVisualElements = null;
    latestSensitiveRegions = null;
    latestOcrSensitiveRegions = [];
    latestOcrWordCount = 0;
    latestMergedRegions = null;
    latestVisionResult = null;
    latestSanitizedDataUrl = null;
    latestPageData = null;
    ocrCompleted = false;
    redactionCompleted = false;
    redactionError = null;
    onRedactionCompleteCallbacks = [];

    timing.domExtractionMs = null;
    timing.screenshotMs = null;
    timing.visionInferenceMs = null;
    timing.sensitiveRegionDetectionMs = null;
    timing.ocrInitMs = null;
    timing.ocrInferenceMs = null;
    timing.ocrSensitiveDetectionMs = null;
    timing.regionMergeMs = null;
    timing.redactionMs = null;
    timing.fusionMs = null;
    timing.gatewayMs = null;

    if (outputArea) outputArea.value = "Requesting page info...";
    if (sampleOutput) sampleOutput.value = "Scanning and redacting page text...";
    if (backendOutput) backendOutput.value = "Waiting for sanitized context...";
    if (decisionOutput) decisionOutput.value = "Awaiting decision...";
    if (executionOutput) executionOutput.value = "Awaiting execution...";
    if (elementsOutput) elementsOutput.value = "Scanning visible elements...";

    if (screenshotPreview) {
      screenshotPreview.style.display = "none";
      screenshotPreview.src = "";
    }
    if (sanitizedScreenshotPreview) {
      sanitizedScreenshotPreview.style.display = "none";
      sanitizedScreenshotPreview.src = "";
    }
    if (privacyDetails) privacyDetails.style.display = "none";
    if (privacyStatus) {
      privacyStatus.textContent = "Awaiting capture...";
      privacyStatus.style.color = "#555";
    }
    if (visionStatus) {
      visionStatus.textContent = "Awaiting screenshot...";
      visionStatus.style.color = "#555";
    }
    if (visionDetails) visionDetails.style.display = "none";
    if (fusionStatus) {
      fusionStatus.textContent = "Awaiting pipeline...";
      fusionStatus.style.color = "#555";
    }
    if (fusionDetails) fusionDetails.style.display = "none";
  };

  /**
   * Milestone 13: Secure Sanitized Visual Agent Gateway Upload
   *
   * SECURITY & PRIVACY CONTRACT:
   * - sanitizedScreenshotBlob MUST be a valid Blob created strictly from the client-side
   *   masked canvas output (latestSanitizedDataUrl).
   * - The raw screenshot (latestScreenshotDataUrl) is NEVER passed to this function or any network request.
   * - Must include privacyState: "SANITIZED" and rawScreenshotTransmitted: false.
   */
  const sendToVisualGateway = async (sanitizedScreenshotBlob, task, structuredContext, privacyMetadata, requestId) => {
    if (!sanitizedScreenshotBlob || !(sanitizedScreenshotBlob instanceof Blob)) {
      throw new Error("Invalid sanitized screenshot Blob: Cannot transmit to gateway.");
    }

    if (!privacyMetadata || privacyMetadata.privacyState !== "SANITIZED" || privacyMetadata.rawScreenshotTransmitted !== false) {
      throw new Error("Privacy contract violation: Only verified SANITIZED screenshots with rawScreenshotTransmitted=false may be sent.");
    }

    const formData = new FormData();
    formData.append("sanitizedScreenshot", sanitizedScreenshotBlob, "sanitized_screenshot.jpg");
    formData.append("task", task || "");
    formData.append("context", JSON.stringify(structuredContext));
    formData.append("privacyMetadata", JSON.stringify(privacyMetadata));
    formData.append("requestId", requestId);

    const tStart = performance.now();
    const res = await fetch("http://localhost:8000/api/visual-context", {
      method: "POST",
      body: formData
    });
    const tElapsed = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gateway Error HTTP ${res.status}: ${errText}`);
    }

    const resJson = await res.json();
    return {
      success: true,
      data: resJson,
      latencyMs: tElapsed
    };
  };

  /**
   * Fallback to text-only sanitized pipeline (/api/context).
   * Used when redaction fails (fail-closed) or when visual gateway is offline.
   * Ensures the raw screenshot is NEVER sent under any circumstance.
   */
  const executeTextOnlyFallback = async (tab, pageData, reasonNotice = "") => {
    if (backendOutput) {
      backendOutput.value = `Fallback: Sending sanitized text-only context to /api/context...\n${reasonNotice}`;
    }
    if (decisionOutput) decisionOutput.value = "Evaluating rule-based decision (text-only fallback)...";
    if (executionOutput) executionOutput.value = "Awaiting decision from backend...";
    if (agentActionText) agentActionText.textContent = "Evaluating text-only fallback...";

    try {
      const apiRes = await fetch("http://localhost:8000/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pageData?.title || "Unknown Title",
          url: pageData?.url || "Unknown URL",
          redactedSample: pageData?.redactedSample || ""
        })
      });

      if (apiRes.ok) {
        const resJson = await apiRes.json();
        if (backendOutput) backendOutput.value = JSON.stringify(resJson, null, 2);

        if (resJson.action) {
          const targetText = resJson.action.target ? resJson.action.target : "None";
          const actionStr = (resJson.action.amount !== undefined && resJson.action.amount !== null)
            ? `${resJson.action.action} → ${targetText} (amount: ${resJson.action.amount})`
            : `${resJson.action.action} → ${targetText}`;

          if (decisionOutput) decisionOutput.value = actionStr;
          if (agentActionText) agentActionText.textContent = actionStr;
          if (agentReasoningText) {
            agentReasoningText.textContent = `Visual context unavailable — decision based on sanitized text only (${reasonNotice || "Fallback"}).`;
          }

          if (executionOutput) executionOutput.value = "Executing action via local allowlist...";
          chrome.tabs.sendMessage(
            tab.id,
            { action: "executeAction", payload: resJson.action },
            (execRes) => {
              if (chrome.runtime.lastError) {
                if (executionOutput) executionOutput.value = `Execution error: ${chrome.runtime.lastError.message}`;
                if (agentSafetyStatus) agentSafetyStatus.textContent = `Error: ${chrome.runtime.lastError.message}`;
                if (agentExecutionStatus) agentExecutionStatus.textContent = executionOutput.value;
              } else if (execRes && execRes.result) {
                const r = execRes.result;
                if (r.executed) {
                  const execStr = (r.amount !== undefined && r.amount !== null)
                    ? `Executed: ${r.action} → ${r.target} (amount: ${r.amount})`
                    : `Executed: ${r.action} → ${r.target}`;
                  if (executionOutput) executionOutput.value = execStr;
                  if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (Local Allowlist Verified)";
                  if (agentExecutionStatus) agentExecutionStatus.textContent = execStr;
                } else {
                  if (executionOutput) executionOutput.value = `Not executed: ${r.reason}`;
                  if (agentSafetyStatus) agentSafetyStatus.textContent = `REJECTED: ${r.reason}`;
                  if (agentExecutionStatus) agentExecutionStatus.textContent = executionOutput.value;
                }
              } else {
                if (executionOutput) executionOutput.value = "No execution response received";
                if (agentExecutionStatus) agentExecutionStatus.textContent = "No execution response received";
              }
            }
          );
        } else {
          if (decisionOutput) decisionOutput.value = "No action returned";
          if (executionOutput) executionOutput.value = "Not executed: No action payload";
          if (agentActionText) agentActionText.textContent = "No action returned";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Not executed";
        }
      } else {
        if (backendOutput) backendOutput.value = `Backend Error: HTTP ${apiRes.status} ${apiRes.statusText}`;
        if (decisionOutput) decisionOutput.value = "Error from backend";
        if (executionOutput) executionOutput.value = "Skipped (backend error)";
        if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (backend error)";
      }
    } catch (networkErr) {
      if (backendOutput) {
        backendOutput.value = `Backend connection failed: ${networkErr.message}\n(Ensure FastAPI is running: uvicorn main:app --reload --port 8000)`;
      }
      if (decisionOutput) decisionOutput.value = "Unavailable (backend offline)";
      if (executionOutput) executionOutput.value = "Skipped (backend offline)";
      if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (backend offline)";
    }
  };

  /**
   * Helper to execute the core local perception pipeline (M7-M12) once.
   * Returns a promise resolving with { tab, pageData, redactionResult }.
   */
  const runLocalPipeline = () => {
    return new Promise(async (resolve, reject) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
          throw new Error("No active tab found");
        }

        if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
          throw new Error("Cannot capture Chrome/browser system pages");
        }

        // 1. Trigger local screenshot capture (M7, M9, M12)
        captureVisualContext();

        // 2. Query DOM metadata and sensitive regions via content script (M1, M2, M8, M11)
        const tDomStart = performance.now();

        const handleDomResponse = (response) => {
          const domElapsed = Math.round(performance.now() - tDomStart);
          if (response && response.success) {
            timing.domExtractionMs = domElapsed;
            timing.sensitiveRegionDetectionMs = typeof response.sensitiveDetectionMs === "number"
              ? response.sensitiveDetectionMs
              : 0;

            latestVisualElements = response.visualElements || [];
            latestSensitiveRegions = response.sensitiveRegions || [];
            latestPageData = response;

            // Display local sanitized context
            if (outputArea) outputArea.value = `Title: ${response.title}\nURL: ${response.url}`;
            if (sampleOutput) sampleOutput.value = response.redactedSample || "(No visible text found on page)";

            // Milestone 8: Display detected visual elements locally
            if (elementsOutput) {
              if (response.visualElements && Array.isArray(response.visualElements) && response.visualElements.length > 0) {
                let elementsText = `Detected elements: ${response.visualElements.length}\n\n`;
                response.visualElements.forEach((el, index) => {
                  const typeUpper = (el.type || "ELEMENT").toUpperCase();
                  elementsText += `${index + 1}.${typeUpper} — ${el.label} [x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}]\n`;
                });
                elementsOutput.value = elementsText.trim();
              } else {
                elementsOutput.value = "No visual elements detected.";
              }
            }

            renderPerceptionSummary();

            // Trigger redaction if screenshot + OCR are already settled
            triggerRedaction();

            // Await redaction completion (M11 + M12)
            waitForRedaction().then((redactionRes) => {
              resolve({
                tab,
                pageData: response,
                redactionResult: redactionRes
              });
            });
          } else {
            reject(new Error("Failed to retrieve page info from content script"));
          }
        };

        // Send getPageInfo to content script
        chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (response) => {
          if (chrome.runtime.lastError) {
            // Dynamic injection fallback if content script not yet present
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["pii-detector.js", "content.js"]
              });

              chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  handleDomResponse(retryResponse);
                }
              });
            } catch (injectErr) {
              reject(new Error(`Script injection failed: ${injectErr.message}`));
            }
            return;
          }

          handleDomResponse(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  // Milestone 14 Helper: Render Execution Trace History into popup UI
  const renderTraceHistory = () => {
    if (!agentTraceContainer) return;
    if (!executionTraceHistory || executionTraceHistory.length === 0) {
      agentTraceContainer.innerHTML = "<div style='color: #666; font-style: italic;'>No trace recorded yet.</div>";
      return;
    }
    let html = "";
    executionTraceHistory.forEach((t) => {
      const execColor = t.executed ? "#2e7d32" : (t.status === "completed" ? "#1565c0" : "#c62828");
      html += `<div style="border-bottom: 1px solid #e3f2fd; padding: 4px 0; margin-bottom: 3px;">
        <span style="font-weight: bold; color: #1565c0;">Step ${t.step}</span> [${t.requestId}]:
        <strong>${t.action?.action || "NONE"}</strong> &rarr; ${t.action?.target || "None"}${t.action?.amount ? " (" + t.action.amount + ")" : ""}
        <br/><span style="color: ${execColor}; font-weight: bold;">${t.executionResult}</span>
        ${t.verification ? `<br/><span style="color: #444; font-size: 9.5px;">Verification: ${t.verification}</span>` : ""}
      </div>`;
    });
    agentTraceContainer.innerHTML = html;
  };

  // =====================================================================
  // =====================================================================
  // Milestone 14, 15 & 16: Bounded Multi-Step Agent Loop with Safe Form Fill
  // Loop (up to MAX_AGENT_STEPS = 5): Observe -> Verify -> Gateway -> Execute -> Post-Verify
  // =====================================================================
  if (runAgentTaskBtn) {
    runAgentTaskBtn.addEventListener("click", async () => {
      const task = (taskInput ? taskInput.value : "").trim() || "Find the Submit button and click it.";

      // Milestone 16: Local deterministic NL task parser (client-side only; values never transmitted)
      let parsedTask = null;
      if (window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
        parsedTask = window.SIHTaskParser.parseTask(task);
      }

      const isPlannedTask = parsedTask && parsedTask.intent !== "NONE" && Array.isArray(parsedTask.steps) && parsedTask.steps.length > 0;
      const plannedSteps = isPlannedTask ? parsedTask.steps : null;
      const totalPlannedSteps = isPlannedTask ? Math.min(plannedSteps.length, MAX_AGENT_STEPS) : 1;
      const localValuesMap = (isPlannedTask && parsedTask.localValues) ? parsedTask.localValues : {};

      // Reset state for new agent task execution
      previousScreenSignature = null;
      executionTraceHistory = [];
      renderTraceHistory();

      if (fillStepStatus) {
        fillStepStatus.textContent = isPlannedTask && (parsedTask.intent.includes("FILL") || parsedTask.steps.some((s) => s.type === "FILL")) ? "Planning steps..." : "-";
      }
      if (fieldValuesPrivacyNotice) {
        fieldValuesPrivacyNotice.textContent = "Kept local (not sent)";
      }

      let currentStep = 1;
      let lastActionKey = null;

      while (currentStep <= MAX_AGENT_STEPS) {
        const requestId = "SIH-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        resetPipelineState();

        // Update step & verification indicators
        if (agentStepText) {
          const maxStepsToShow = isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS;
          agentStepText.textContent = `Step ${currentStep} of up to ${maxStepsToShow}`;
        }
        if (agentVerificationText) {
          agentVerificationText.textContent = currentStep === 1
            ? "Observing initial page state..."
            : "Observing updated page state...";
          agentVerificationText.style.color = "#1565c0";
        }

        // Show task in UI (never reveals literal extracted values in status)
        if (agentTaskText) agentTaskText.textContent = task;
        if (agentRequestId) agentRequestId.textContent = requestId;
        if (agentScreenshotStatus) agentScreenshotStatus.textContent = "CAPTURING LOCALLY...";
        if (agentPrivacyStatus) agentPrivacyStatus.textContent = "ACTIVE";
        if (agentDomPiiCount) agentDomPiiCount.textContent = "Scanning...";
        if (agentOcrPiiCount) agentOcrPiiCount.textContent = "Scanning...";
        if (agentSensitiveCount) agentSensitiveCount.textContent = "Calculating...";
        if (agentRedactionStatus) agentRedactionStatus.textContent = "PROCESSING...";
        if (agentSanitizedStatus) agentSanitizedStatus.textContent = "Awaiting Redaction...";
        if (agentRawUploadStatus) {
          agentRawUploadStatus.textContent = "BLOCKED (Never transmitted)";
        }
        if (agentSanitizedUploadStatus) {
          agentSanitizedUploadStatus.textContent = "AWAITING PIPELINE";
          agentSanitizedUploadStatus.style.color = "#555";
        }
        if (agentModeStatus) agentModeStatus.textContent = "DEMO MODE";
        if (agentActionText) agentActionText.textContent = "Awaiting pipeline...";
        if (agentReasoningText) agentReasoningText.textContent = `Step ${currentStep}: Running local privacy pipeline...`;
        if (agentSafetyStatus) agentSafetyStatus.textContent = "Pending...";
        if (agentExecutionStatus) agentExecutionStatus.textContent = "Pending...";
        if (agentGatewayLatency) agentGatewayLatency.textContent = "-";
        if (groundingMethodText) groundingMethodText.textContent = "-";
        if (groundingScoreText) groundingScoreText.textContent = "-";
        if (groundedElementText) groundedElementText.textContent = "-";

        let pipelineOutput = null;
        try {
          // Step 1: Run local observation pipeline (reused once per cycle)
          pipelineOutput = await runLocalPipeline();
        } catch (pipelineErr) {
          console.error("Observation pipeline error:", pipelineErr);
          if (agentReasoningText) agentReasoningText.textContent = `Pipeline Error: ${pipelineErr.message}`;
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "ERROR (Pipeline stopped)";
            agentSanitizedUploadStatus.style.color = "#c62828";
          }
          if (agentSafetyStatus) agentSafetyStatus.textContent = "Error";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (Pipeline error)";
          executionTraceHistory.push({
            step: currentStep,
            requestId,
            action: null,
            executed: false,
            status: "error",
            executionResult: `Pipeline error: ${pipelineErr.message}`,
            verification: "Pipeline observation failed"
          });
          renderTraceHistory();
          break;
        }

        const { tab, pageData, redactionResult } = pipelineOutput;

        // Step 2: Compute current screen signature on-device (perceptual 32x32 hash + DOM structure)
        let currentSignature = null;
        if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
          currentSignature = await window.SIHChangeDetector.computeScreenSignature(
            latestScreenshotDataUrl,
            latestVisualElements
          );
        }

        // Update panel with local perception metrics
        if (agentScreenshotStatus) agentScreenshotStatus.textContent = "CAPTURED LOCALLY (Client-Side Only)";
        if (agentDomPiiCount) agentDomPiiCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
        if (agentOcrPiiCount) agentOcrPiiCount.textContent = latestOcrSensitiveRegions ? latestOcrSensitiveRegions.length : 0;
        if (agentSensitiveCount) agentSensitiveCount.textContent = latestMergedRegions ? latestMergedRegions.length : 0;

        // Step 3: Verify M11/M12 redaction success (Fail-closed contract)
        if (!redactionResult || !redactionResult.success || !redactionResult.sanitizedScreenshotDataUrl) {
          console.warn("Visual privacy redaction failed. Failing closed: Falling back to text-only pipeline.");
          if (agentRedactionStatus) {
            agentRedactionStatus.textContent = "FAILED (Masking withheld for privacy)";
            agentRedactionStatus.style.color = "#c62828";
          }
          if (agentSanitizedStatus) {
            agentSanitizedStatus.textContent = "UNAVAILABLE (Fail-closed)";
            agentSanitizedStatus.style.color = "#c62828";
          }
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "N/A (BLOCKED: Redaction failed; raw screenshot NEVER transmitted)";
            agentSanitizedUploadStatus.style.color = "#c62828";
          }
          if (agentReasoningText) {
            agentReasoningText.textContent = "Visual context unavailable (redaction failed/withheld). Falling back to text-only sanitized pipeline.";
          }

          await executeTextOnlyFallback(tab, pageData, "Visual redaction withheld — text-only fallback");
          executionTraceHistory.push({
            step: currentStep,
            requestId,
            action: { action: "FALLBACK_TEXT_ONLY", target: "PAGE" },
            executed: true,
            status: "fallback",
            executionResult: "Executed text-only fallback",
            verification: "Fail-closed (visual upload blocked)"
          });
          renderTraceHistory();
          break;
        }

        // Redaction succeeded
        if (agentRedactionStatus) {
          agentRedactionStatus.textContent = "COMPLETE (Masked Offscreen)";
          agentRedactionStatus.style.color = "#2e7d32";
        }
        if (agentSanitizedStatus) {
          agentSanitizedStatus.textContent = "READY";
          agentSanitizedStatus.style.color = "#2e7d32";
        }
        if (agentSanitizedUploadStatus) {
          agentSanitizedUploadStatus.textContent = "TRANSMITTING (Sanitized Only)";
          agentSanitizedUploadStatus.style.color = "#1565c0";
        }

        // Step 4: Convert sanitized screenshot data URL to Blob (in-memory)
        const sanitizedBlobRes = await fetch(redactionResult.sanitizedScreenshotDataUrl);
        const sanitizedBlob = await sanitizedBlobRes.blob();

        // Step 5: Construct safe structured context and privacy metadata
        // CRITICAL PRIVACY: Never include literal values in structuredContext or fieldPlan!
        let currentStepPlan = isPlannedTask && (currentStep - 1 < plannedSteps.length)
          ? plannedSteps[currentStep - 1]
          : null;

        let taskToSend = task;
        if (currentStepPlan) {
          if (currentStepPlan.type === "FILL") {
            taskToSend = `Fill ${currentStepPlan.fieldHint}`;
          } else if (currentStepPlan.type === "CLICK") {
            taskToSend = currentStepPlan.legacyTarget
              ? currentStepPlan.legacyTarget
              : `Click ${currentStepPlan.targetHint}`;
          } else if (currentStepPlan.type === "SCROLL") {
            taskToSend = "Scroll down";
          }
        }

        const structuredContext = {
          title: pageData?.title || "",
          url: pageData?.url || "",
          redactedSample: pageData?.redactedSample || "",
          elementCount: (latestVisualElements || []).length,
          elements: (latestVisualElements || []).map((el) => ({
            type: el.type,
            label: el.label,
            semanticTag: el.semanticTag || null,
            fieldId: el.fieldId !== undefined ? el.fieldId : null,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height
          })),
          fieldPlan: isPlannedTask
            ? parsedTask.sanitizedPlan.filter((s) => s.type === "FILL")
            : [],
          sceneClassification: latestVisionResult ? {
            classIndex: latestVisionResult.classIndex,
            confidence: latestVisionResult.confidence
          } : null,
          sensitiveRegionCount: latestSensitiveRegions ? latestSensitiveRegions.length : 0,
          ocrTextRegionCount: latestOcrWordCount,
          totalRedactedRegionCount: latestMergedRegions ? latestMergedRegions.length : 0,
          loopStep: currentStep
        };

        const privacyMetadata = {
          privacyState: "SANITIZED",
          rawScreenshotTransmitted: false,
          redactedRegionsCount: latestMergedRegions ? latestMergedRegions.length : 0,
          timestamp: Date.now()
        };

        // Step 6: Send ONLY sanitized screenshot + structured data to Visual Gateway
        let gatewayResult = null;
        try {
          gatewayResult = await sendToVisualGateway(
            sanitizedBlob,
            taskToSend,
            structuredContext,
            privacyMetadata,
            requestId
          );
        } catch (gwErr) {
          console.warn("Visual gateway upload error, falling back to text-only pipeline:", gwErr);
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "GATEWAY FAILED (Falling back to text-only)";
            agentSanitizedUploadStatus.style.color = "#e65100";
          }
          if (agentReasoningText) {
            agentReasoningText.textContent = `Visual gateway call failed (${gwErr.message}). Falling back to text-only sanitized pipeline.`;
          }

          await executeTextOnlyFallback(tab, pageData, "Gateway error fallback");
          executionTraceHistory.push({
            step: currentStep,
            requestId,
            action: null,
            executed: false,
            status: "fallback",
            executionResult: `Gateway error: ${gwErr.message}`,
            verification: "Fell back to text-only (/api/context)"
          });
          renderTraceHistory();
          break;
        }

        // Step 7: Process Visual Gateway response
        const { data, latencyMs } = gatewayResult;
        timing.gatewayMs = latencyMs;
        if (agentGatewayLatency) agentGatewayLatency.textContent = `${latencyMs} ms`;
        if (timingGateway) timingGateway.textContent = `${latencyMs} ms`;

        if (agentSanitizedUploadStatus) {
          agentSanitizedUploadStatus.textContent = "ALLOWED (Delivered to Gateway)";
          agentSanitizedUploadStatus.style.color = "#2e7d32";
        }

        let agentAction = data.action;

        // Local grounding fallback for FILL steps if backend proposed NONE or no targetIndex
        if (currentStepPlan && currentStepPlan.type === "FILL" && (!agentAction || agentAction.action === "NONE" || agentAction.targetIndex === undefined)) {
          const FORM_TYPES = new Set(["input", "textarea", "select"]);
          const normalize = (s) => (s || "").trim().toLowerCase();
          const targetHintNorm = normalize(currentStepPlan.fieldHint);

          let bestIdx = -1;
          let bestScore = 0;
          (latestVisualElements || []).forEach((el, idx) => {
            if (!FORM_TYPES.has((el.type || "").toLowerCase())) return;
            const labelNorm = normalize(el.label);
            let score = 0;
            if (labelNorm === targetHintNorm) score = 1.0;
            else if (labelNorm.includes(targetHintNorm) || targetHintNorm.includes(labelNorm)) score = 0.8;
            if (score > bestScore) {
              bestScore = score;
              bestIdx = idx;
            }
          });

          if (bestIdx >= 0 && bestScore >= 0.35) {
            const matchedEl = latestVisualElements[bestIdx];
            agentAction = {
              action: "FILL",
              targetIndex: bestIdx,
              targetType: matchedEl.type,
              targetLabel: matchedEl.label,
              groundingScore: bestScore,
              groundingMethod: "local-fuzzy-match"
            };
          }
        }

        const targetStr = agentAction?.target
          ? agentAction.target
          : (agentAction?.targetIndex !== undefined ? `${agentAction.targetType}: '${agentAction.targetLabel}'` : "None");
        const actionDisplay = agentAction
          ? (agentAction.amount !== undefined && agentAction.amount !== null
              ? `${agentAction.action} → ${targetStr} (amount: ${agentAction.amount})`
              : `${agentAction.action} → ${targetStr}`)
          : "None";

        if (agentActionText) agentActionText.textContent = actionDisplay;
        if (agentReasoningText) agentReasoningText.textContent = data.reasoning || "Deterministic demo agent decision";
        if (decisionOutput) decisionOutput.value = actionDisplay;
        if (backendOutput) backendOutput.value = JSON.stringify(data, null, 2);

        // Milestone 15 & 16: Grounding UI telemetry
        if (groundingMethodText && groundingScoreText && groundedElementText) {
          if (agentAction?.targetIndex !== undefined) {
            groundingMethodText.textContent = agentAction.groundingMethod || "local-fuzzy-match";
            groundingScoreText.textContent = agentAction.groundingScore !== undefined ? String(agentAction.groundingScore) : "-";
            groundedElementText.textContent = `${agentAction.targetType}: '${agentAction.targetLabel}'`;
          } else if (agentAction?.target) {
            groundingMethodText.textContent = "keyword-rule (fixed target)";
            groundingScoreText.textContent = "-";
            groundedElementText.textContent = agentAction.target;
          } else {
            groundingMethodText.textContent = "-";
            groundingScoreText.textContent = "-";
            groundedElementText.textContent = "-";
          }
        }

        const actionTargetIdentifier = agentAction?.target || (agentAction?.targetIndex !== undefined ? `#${agentAction.targetIndex}:${agentAction.targetType}:${agentAction.targetLabel}` : "");
        const actionKey = `${agentAction?.action}:${actionTargetIdentifier}:${agentAction?.amount || ""}`;

        // Step 8: Stall Guard (Check if identical action proposed again with no screen change)
        if (currentStep > 1 && lastActionKey === actionKey) {
          if (agentVerificationText) {
            agentVerificationText.textContent = "Stall Guard: Proposing identical action with no page change. Loop halted.";
            agentVerificationText.style.color = "#c62828";
          }
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Halted: No further meaningful action possible";
          executionTraceHistory.push({
            step: currentStep,
            requestId,
            action: agentAction,
            executed: false,
            status: "stalled",
            executionResult: "Halted by Stall Guard",
            verification: "No change from previous action"
          });
          renderTraceHistory();
          break;
        }

        // Step 9: If agent returns NONE or no target, terminate loop gracefully
        if (!agentAction || agentAction.action === "NONE" || (!agentAction.target && agentAction.targetIndex === undefined)) {
          if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (No-op action safely handled)";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Task complete (No further action needed)";
          if (executionOutput) executionOutput.value = "Task complete (Action is NONE)";
          if (agentVerificationText) {
            agentVerificationText.textContent = "Verification: Goal reached or no actionable target.";
            agentVerificationText.style.color = "#2e7d32";
          }

          executionTraceHistory.push({
            step: currentStep,
            requestId,
            action: agentAction,
            executed: false,
            status: "completed",
            executionResult: "Skipped (Action is NONE)",
            verification: "Goal completed"
          });
          renderTraceHistory();
          break;
        }

        // Step 10: Safe Execution via Local Allowlist in content.js (Milestones 5, 6, 14, 15 & 16)
        let actionExecutionSummary = "";
        let actionExecutedSuccessfully = false;

        let executionPayload = null;
        if (agentAction.action === "FILL") {
          // CRITICAL PRIVACY: localValue is supplied from in-memory popup.js store via local IPC only
          let localVal = "";

          // 1. Direct from currentStepPlan if this step in the plan is a FILL step with a value
          if (currentStepPlan && currentStepPlan.type === "FILL" && currentStepPlan.value) {
            localVal = currentStepPlan.value;
          }

          // 2. Look up by step index (0-indexed) in localValuesMap
          if (!localVal && localValuesMap[currentStep - 1] !== undefined) {
            localVal = localValuesMap[currentStep - 1];
          }

          // 3. Look up by fieldHint / targetLabel match in plannedSteps
          if (!localVal && Array.isArray(plannedSteps)) {
            const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
            for (const st of plannedSteps) {
              if (st.type === "FILL" && st.value) {
                const hintNorm = (st.fieldHint || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                if (hintNorm && (targetNorm.includes(hintNorm) || hintNorm.includes(targetNorm))) {
                  localVal = st.value;
                  break;
                }
              }
            }
          }

          // 4. Look up by normalized targetLabel in localValuesMap
          if (!localVal && agentAction.targetLabel) {
            const targetNorm = agentAction.targetLabel.toLowerCase().replace(/[:*_-]/g, " ").trim();
            for (const [k, v] of Object.entries(localValuesMap)) {
              const kNorm = String(k).toLowerCase().replace(/[:*_-]/g, " ").trim();
              if (kNorm && (targetNorm.includes(kNorm) || kNorm.includes(targetNorm))) {
                localVal = v;
                break;
              }
            }
          }

          // 5. Fallback for single-field FILL task: if exactly one fill value exists in local store
          if (!localVal && Array.isArray(plannedSteps)) {
            const fillSteps = plannedSteps.filter((s) => s.type === "FILL" && s.value);
            if (fillSteps.length === 1) {
              localVal = fillSteps[0].value;
            }
          }

          // 6. Emergency local fallback: parse directly from task text if not previously planned
          if (!localVal && window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
            const freshParsed = window.SIHTaskParser.parseTask(task);
            if (freshParsed && Array.isArray(freshParsed.steps)) {
              const fillSteps = freshParsed.steps.filter((s) => s.type === "FILL" && s.value);
              if (fillSteps.length === 1) {
                localVal = fillSteps[0].value;
              } else if (fillSteps.length > 0) {
                const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                for (const st of fillSteps) {
                  const hintNorm = (st.fieldHint || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                  if (hintNorm && (targetNorm.includes(hintNorm) || hintNorm.includes(targetNorm))) {
                    localVal = st.value;
                    break;
                  }
                }
              }
            }
          }

          executionPayload = {
            action: "FILL",
            targetIndex: agentAction.targetIndex,
            targetType: agentAction.targetType || "input",
            targetLabel: agentAction.targetLabel,
            localValue: localVal
          };
        } else if (agentAction.targetIndex !== undefined) {
          executionPayload = {
            action: "CLICK",
            targetIndex: agentAction.targetIndex,
            targetType: agentAction.targetType,
            targetLabel: agentAction.targetLabel
          };
        } else {
          executionPayload = agentAction;
        }

        if (executionOutput) executionOutput.value = "Executing action via local allowlist...";
        await new Promise((resolveExec) => {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "executeAction", payload: executionPayload },
            (execRes) => {
              if (chrome.runtime.lastError) {
                actionExecutionSummary = `Execution error: ${chrome.runtime.lastError.message}`;
              } else if (execRes && execRes.result) {
                const r = execRes.result;
                if (r.executed) {
                  actionExecutedSuccessfully = true;
                  if (r.action === "FILL") {
                    actionExecutionSummary = `Executed: FILL → ${r.targetType}: '${r.targetLabel}' (index: ${r.groundedIndex}, verified: ${r.verified ? "OK" : "Pending"})`;
                    if (fillStepStatus) {
                      fillStepStatus.textContent = `Step ${currentStep} (${r.targetLabel}): OK (Verified: ${r.verified ? "OK" : "Pending"})`;
                    }
                  } else if (r.amount !== undefined && r.amount !== null) {
                    actionExecutionSummary = `Executed: ${r.action} → ${r.target} (amount: ${r.amount})`;
                  } else {
                    actionExecutionSummary = r.target
                      ? `Executed: ${r.action} → ${r.target}`
                      : `Executed: ${r.action} → ${r.targetType}: '${r.targetLabel}' (index: ${r.groundedIndex})`;
                  }
                } else {
                  actionExecutionSummary = `Not executed: ${r.reason}`;
                  if (fillStepStatus && agentAction.action === "FILL") {
                    fillStepStatus.textContent = `Step ${currentStep} (${agentAction.targetLabel}): Failed (${r.reason})`;
                  }
                }
              } else {
                actionExecutionSummary = "No execution response received";
              }
              resolveExec();
            }
          );
        });

        if (executionOutput) executionOutput.value = actionExecutionSummary;
        if (agentExecutionStatus) agentExecutionStatus.textContent = actionExecutionSummary;

        if (!actionExecutedSuccessfully) {
          if (agentSafetyStatus) agentSafetyStatus.textContent = `REJECTED by Allowlist: ${actionExecutionSummary}`;
          executionTraceHistory.push({
            step: currentStep,
            requestId,
            action: agentAction,
            executed: false,
            status: "rejected",
            executionResult: actionExecutionSummary,
            verification: "Allowlist rejected target"
          });
          renderTraceHistory();
          break;
        }

        if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (Allowlist Verified)";

        // Step 11: Post-Action Verification via Screen-Change Detection
        await new Promise((r) => setTimeout(r, ACTION_VERIFICATION_DELAY_MS));

        let postActionSignature = null;
        if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
          const updatedDom = await new Promise((resolveDom) => {
            chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, (resp) => {
              resolveDom((resp && resp.visualElements) ? resp.visualElements : latestVisualElements);
            });
          });

          const postDataUrl = await new Promise((resolveCapture) => {
            if (typeof chrome.tabs.captureVisibleTab === "function") {
              chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (dataUrl) => {
                resolveCapture(dataUrl || latestScreenshotDataUrl);
              });
            } else {
              resolveCapture(latestScreenshotDataUrl);
            }
          });

          postActionSignature = await window.SIHChangeDetector.computeScreenSignature(postDataUrl, updatedDom);
        }

        let verificationResultStr = "Verification unavailable";
        if (currentSignature && postActionSignature && window.SIHChangeDetector) {
          const changeResult = window.SIHChangeDetector.compareScreenSignatures(
            currentSignature,
            postActionSignature,
            PIXEL_CHANGE_THRESHOLD
          );
          verificationResultStr = changeResult.changed
            ? `Page changed as expected (${changeResult.reason})`
            : `No visible change detected (${changeResult.reason})`;
          if (agentVerificationText) {
            agentVerificationText.textContent = verificationResultStr;
            agentVerificationText.style.color = changeResult.changed ? "#2e7d32" : "#e65100";
          }
        }

        // Record trace for this step
        executionTraceHistory.push({
          step: currentStep,
          requestId,
          action: agentAction,
          executed: true,
          status: "success",
          executionResult: actionExecutionSummary,
          verification: verificationResultStr
        });
        renderTraceHistory();

        // Step 12: Loop termination condition
        const executedThisStep = actionExecutedSuccessfully;
        const screenActuallyChanged = !!(currentSignature && postActionSignature && window.SIHChangeDetector &&
          window.SIHChangeDetector.compareScreenSignatures(currentSignature, postActionSignature, PIXEL_CHANGE_THRESHOLD).changed);

        const hasMorePlannedSteps = isPlannedTask && currentStep < totalPlannedSteps;
        const shouldContinue = executedThisStep && (hasMorePlannedSteps || (screenActuallyChanged && currentStep < MAX_AGENT_STEPS));

        if (!shouldContinue) {
          if (agentStepText) {
            agentStepText.textContent = `Completed at Step ${currentStep} of ${isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS}`;
          }
          break;
        }

        // Prepare next iteration
        previousScreenSignature = postActionSignature || currentSignature;
        lastActionKey = actionKey;
        currentStep++;
      }
    });
  }

  // =====================================================================
  // Existing Milestone 1–12 "Capture Page Info" Button Listener (Preserved)
  // Calls text-only /api/context endpoint while triggering local perception
  // =====================================================================
  captureBtn.addEventListener("click", async () => {
    resetPipelineState();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        if (outputArea) outputArea.value = "Error: No active tab found.";
        if (visualStatus) {
          visualStatus.textContent = "Screenshot capture failed (no active tab)";
          visualStatus.style.color = "#c62828";
        }
        return;
      }

      if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
        if (outputArea) {
          outputArea.value = "Cannot capture Chrome/browser system pages.\nPlease test on a standard webpage (e.g. https://example.com).";
        }
        if (visualStatus) {
          visualStatus.textContent = "Screenshot capture failed (restricted browser system page)";
          visualStatus.style.color = "#c62828";
        }
        return;
      }

      // Milestone 7: Trigger local visual context capture
      captureVisualContext();

      // Display response helper for Milestone 1-6 flow
      const displayResponse = async (data, domElapsedMs) => {
        if (data && data.success) {
          timing.domExtractionMs = domElapsedMs;
          timing.sensitiveRegionDetectionMs = typeof data.sensitiveDetectionMs === "number"
            ? data.sensitiveDetectionMs
            : 0;

          latestVisualElements = data.visualElements || [];
          latestSensitiveRegions = data.sensitiveRegions || [];
          latestPageData = data;

          triggerRedaction();

          if (outputArea) outputArea.value = `Title: ${data.title}\nURL: ${data.url}`;
          if (sampleOutput) sampleOutput.value = data.redactedSample || "(No visible text found on page)";

          if (elementsOutput) {
            if (data.visualElements && Array.isArray(data.visualElements) && data.visualElements.length > 0) {
              let elementsText = `Detected elements: ${data.visualElements.length}\n\n`;
              data.visualElements.forEach((el, index) => {
                const typeUpper = (el.type || "ELEMENT").toUpperCase();
                elementsText += `${index + 1}.${typeUpper} — ${el.label} [x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}]\n`;
              });
              elementsOutput.value = elementsText.trim();
            } else {
              elementsOutput.value = "No visual elements detected.";
            }
          }

          renderPerceptionSummary();

          // Send ONLY sanitized text data to /api/context (Milestone 3-6)
          await executeTextOnlyFallback(tab, data, "Triggered via Capture Page Info button");
        } else {
          if (outputArea) outputArea.value = "Failed to retrieve page info.";
          if (backendOutput) backendOutput.value = "Transmission skipped (no context available).";
          renderPerceptionSummary();
        }
      };

      const tDomStart = performance.now();

      chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (response) => {
        if (chrome.runtime.lastError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["pii-detector.js", "content.js"]
            });

            chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (retryResponse) => {
              const domElapsed = Math.round(performance.now() - tDomStart);
              if (chrome.runtime.lastError) {
                if (outputArea) outputArea.value = `Error: ${chrome.runtime.lastError.message}`;
              } else {
                await displayResponse(retryResponse, domElapsed);
              }
            });
          } catch (injectError) {
            if (outputArea) outputArea.value = `Error injecting scripts: ${injectError.message}`;
          }
          return;
        }

        const domElapsed = Math.round(performance.now() - tDomStart);
        await displayResponse(response, domElapsed);
      });
    } catch (err) {
      if (outputArea) outputArea.value = `Unexpected error: ${err.message}`;
      if (visualStatus) {
        visualStatus.textContent = `Screenshot capture failed (${err.message})`;
        visualStatus.style.color = "#c62828";
      }
      renderPerceptionSummary();
    }
  });
});
