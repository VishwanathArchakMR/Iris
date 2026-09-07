/**
 * perception-fusion.js - Milestones 10, 11 & 12: Local Visual-Perception Fusion
 * Fuses local DOM-extracted visual elements (M8), on-device SqueezeNet vision classification (M9),
 * local screenshot privacy redaction metrics (M11), and local OCR-detected visual PII metrics (M12)
 * with complete pipeline timing telemetry.
 *
 * Privacy & Security Guarantees:
 * - Runs strictly on-device in the browser client context.
 * - Raw screenshots, DOM visual elements, bounding boxes, sensitive regions,
 *   OCR text/boxes, and fused perception data are NEVER transmitted to FastAPI or external servers.
 */

/**
 * Builds a consolidated, structured local perception object.
 *
 * @param {Array<Object>} visualElements - Detected DOM UI elements (M8)
 * @param {Object|null} visionResult - SqueezeNet classification result (M9)
 * @param {Object} timing - Execution latencies for pipeline stages (M10/M11/M12)
 * @param {number|null} sensitiveRegionCount - Count of DOM sensitive regions detected (M11)
 * @param {Object|null} ocrStats - OCR-derived region metrics (M12)
 * @returns {Object} Fused local perception object
 */
function buildLocalPerception(visualElements = [], visionResult = null, timing = {}, sensitiveRegionCount = null, ocrStats = null) {
  const elements = Array.isArray(visualElements) ? visualElements : [];

  // Group elements by UI type
  const elementCounts = {
    buttons: 0,
    links: 0,
    inputs: 0,
    headings: 0,
    other: 0
  };

  elements.forEach((el) => {
    const type = (el && el.type ? el.type : "").toLowerCase();
    if (type === "button") {
      elementCounts.buttons++;
    } else if (type === "link") {
      elementCounts.links++;
    } else if (["input", "textarea", "select", "checkbox", "radio"].includes(type)) {
      elementCounts.inputs++;
    } else if (type === "heading") {
      elementCounts.headings++;
    } else {
      elementCounts.other++;
    }
  });

  return {
    timestamp: new Date().toISOString(),
    visualElementsCount: elements.length,
    elementCounts,
    elements: elements,
    vision: visionResult ? {
      classIndex: visionResult.classIndex ?? null,
      confidence: visionResult.confidence ?? null,
      executionProvider: visionResult.executionProvider ?? "wasm",
      status: "completed"
    } : {
      classIndex: null,
      confidence: null,
      executionProvider: null,
      status: "none"
    },
    privacy: {
      sensitiveRegionCount: typeof sensitiveRegionCount === "number" ? sensitiveRegionCount : null,
      ocrTextRegionCount: typeof ocrStats?.ocrTextRegionCount === "number" ? ocrStats.ocrTextRegionCount : null,
      ocrSensitiveRegionCount: typeof ocrStats?.ocrSensitiveRegionCount === "number" ? ocrStats.ocrSensitiveRegionCount : null,
      totalRedactedRegionCount: typeof ocrStats?.totalRedactedRegionCount === "number" ? ocrStats.totalRedactedRegionCount : null,
      onDeviceOnly: true,
      backendTransmitted: false
    },
    timing: {
      domExtractionMs: timing?.domExtractionMs ?? null,
      screenshotMs: timing?.screenshotMs ?? null,
      visionInferenceMs: timing?.visionInferenceMs ?? null,
      sensitiveRegionDetectionMs: timing?.sensitiveRegionDetectionMs ?? null,
      ocrInitMs: timing?.ocrInitMs ?? null,
      ocrInferenceMs: timing?.ocrInferenceMs ?? null,
      ocrSensitiveDetectionMs: timing?.ocrSensitiveDetectionMs ?? null,
      regionMergeMs: timing?.regionMergeMs ?? null,
      redactionMs: timing?.redactionMs ?? null,
      fusionMs: timing?.fusionMs ?? null
    }
  };
}

if (typeof window !== "undefined") {
  window.SIHFusion = {
    buildLocalPerception
  };
  window.buildLocalPerception = buildLocalPerception;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildLocalPerception };
}
