/**
 * perception-fusion.js - Milestone 9 & 10: Unified Visual-DOM Perception Fusion & State
 * 
 * Fuses local DOM-extracted visual elements with on-device ONNX vision detections
 * and OCR spatial bounding boxes into a unified perception layer.
 * 
 * Privacy & Security Guarantees:
 * - Runs 100% locally on-device in the browser client context.
 * - Raw screenshots, DOM visual elements, bounding boxes, sensitive regions,
 *   OCR text/boxes, and fused perception data are NEVER transmitted to FastAPI or external servers.
 */

// Centralized Perception State (Milestone 9 - Section 10)
const centralizedPerceptionState = {
  ready: false,
  modelAvailable: true,
  inferenceRunning: false,
  lastInferenceTime: null,
  visualDetections: [],
  domElements: [],
  fusedElements: [],
  pageSignature: null,
  visualSignature: null,
  changed: false,
  reason: "Initial observation",
  modelName: "squeezenet1.1-7.onnx",
  executionProvider: "wasm"
};

/**
 * Computes spatial overlap and intersection ratio between a DOM bounding box and a visual bounding box.
 * 
 * @param {Object} domBox - { x, y, width, height }
 * @param {Object} visBox - { x, y, width, height }
 * @param {Object} viewport - { width, height } for coordinate normalization if needed
 * @returns {number} Overlap coefficient between 0.0 and 1.0
 */
function computeSpatialOverlap(domBox, visBox, viewport = { width: 1280, height: 800 }) {
  if (!domBox || !visBox) return 0;

  // Scale normalized coordinates [0, 1] to pixel space if needed
  let vx = visBox.x;
  let vy = visBox.y;
  let vw = visBox.width;
  let vh = visBox.height;

  if (vw <= 1.0 && vh <= 1.0 && viewport.width > 0 && viewport.height > 0) {
    vx = Math.round(vx * viewport.width);
    vy = Math.round(vy * viewport.height);
    vw = Math.round(vw * viewport.width);
    vh = Math.round(vh * viewport.height);
  }

  const xOverlap = Math.max(0, Math.min(domBox.x + domBox.width, vx + vw) - Math.max(domBox.x, vx));
  const yOverlap = Math.max(0, Math.min(domBox.y + domBox.height, vy + vh) - Math.max(domBox.y, vy));
  const intersectionArea = xOverlap * yOverlap;

  if (intersectionArea <= 0) return 0;

  const domArea = Math.max(1, domBox.width * domBox.height);
  const visArea = Math.max(1, vw * vh);
  const minArea = Math.min(domArea, visArea);

  // Intersection over min area (IoMin) captures contained elements nicely
  const ioMin = intersectionArea / minArea;
  // Intersection over union (IoU)
  const unionArea = domArea + visArea - intersectionArea;
  const iou = intersectionArea / Math.max(1, unionArea);

  return Math.max(iou, ioMin * 0.75);
}

/**
 * Fuses DOM-extracted elements with on-device ONNX visual detections into unified visual perception.
 * 
 * @param {Array<Object>} domElements - M8 DOM element descriptors
 * @param {Array<Object>} visualDetections - M9 ONNX visual detections
 * @param {Array<Object>} ocrWords - M12 OCR word bounding boxes
 * @returns {Array<Object>} Array of fused visual-DOM elements
 */
function fuseVisualAndDOMResults(domElements = [], visualDetections = [], ocrWords = []) {
  const domList = Array.isArray(domElements) ? domElements : [];
  const visList = Array.isArray(visualDetections) ? visualDetections : [];
  const ocrList = Array.isArray(ocrWords) ? ocrWords : [];

  console.log(`[SIH26171][VISION] DOM + vision fusion started (${domList.length} DOM, ${visList.length} visual detections)`);

  let confirmedCount = 0;

  const fused = domList.map((el, idx) => {
    const domBox = {
      x: typeof el.x === "number" ? el.x : 0,
      y: typeof el.y === "number" ? el.y : 0,
      width: typeof el.width === "number" ? el.width : 50,
      height: typeof el.height === "number" ? el.height : 25
    };

    let bestVisMatch = null;
    let bestVisOverlap = 0;

    for (const vis of visList) {
      if (!vis || !vis.bbox) continue;
      const overlap = computeSpatialOverlap(domBox, vis.bbox);
      if (overlap > bestVisOverlap) {
        bestVisOverlap = overlap;
        bestVisMatch = vis;
      }
    }

    // Also check OCR word overlap for text-bearing elements
    let hasOcrConfirmation = false;
    if (ocrList.length > 0 && el.label) {
      const elLabelNorm = (el.label || "").toLowerCase().trim();
      for (const w of ocrList) {
        if (!w || !w.bbox || !w.text) continue;
        const wText = (w.text || "").toLowerCase().trim();
        if (elLabelNorm.includes(wText) || wText.includes(elLabelNorm)) {
          const overlap = computeSpatialOverlap(domBox, w.bbox);
          if (overlap > 0.20) {
            hasOcrConfirmation = true;
            break;
          }
        }
      }
    }

    const isVisOverlapSignificant = bestVisOverlap >= 0.15;
    const isVisualConfirmed = isVisOverlapSignificant || hasOcrConfirmation;

    if (isVisualConfirmed) {
      confirmedCount++;
    }

    // Fused confidence combines DOM visibility with visual detection overlap and confidence
    let fusedConfidence = 0.70;
    if (isVisualConfirmed) {
      const visConf = bestVisMatch ? (bestVisMatch.confidence || 0.8) : 0.85;
      fusedConfidence = Math.min(1.0, 0.45 + 0.35 * visConf + 0.20 * Math.min(1.0, bestVisOverlap || 0.5));
    } else {
      fusedConfidence = el.isVisible ? 0.75 : 0.40;
    }

    return {
      ...el,
      index: typeof el.index === "number" ? el.index : idx,
      domBbox: domBox,
      visualBbox: bestVisMatch ? bestVisMatch.bbox : null,
      visualType: bestVisMatch ? bestVisMatch.type : null,
      visualConfidence: bestVisMatch ? bestVisMatch.confidence : null,
      fusedConfidence: Math.round(fusedConfidence * 100) / 100,
      groundingMethod: isVisualConfirmed ? "dom+visual-fusion" : "dom-geometry",
      isVisualConfirmed: isVisualConfirmed
    };
  });

  console.log(`[SIH26171][VISION] DOM + vision fusion completed: ${fused.length} fused elements (${confirmedCount} visually confirmed)`);

  // Update centralized perception state
  centralizedPerceptionState.domElements = domList;
  centralizedPerceptionState.visualDetections = visList;
  centralizedPerceptionState.fusedElements = fused;
  centralizedPerceptionState.ready = true;
  centralizedPerceptionState.lastInferenceTime = Date.now();

  return fused;
}

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
  const visDetections = (visionResult && Array.isArray(visionResult.detections)) ? visionResult.detections : [];
  const ocrWords = (ocrStats && Array.isArray(ocrStats.words)) ? ocrStats.words : [];

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

  // Perform spatial fusion
  const fusedElements = fuseVisualAndDOMResults(elements, visDetections, ocrWords);

  return {
    timestamp: new Date().toISOString(),
    visualElementsCount: elements.length,
    fusedElementsCount: fusedElements.length,
    elementCounts,
    elements: elements,
    fusedElements: fusedElements,
    visualDetections: visDetections,
    vision: visionResult ? {
      classIndex: visionResult.classIndex ?? null,
      confidence: visionResult.confidence ?? null,
      executionProvider: visionResult.executionProvider ?? "wasm",
      modelName: visionResult.modelName || "squeezenet1.1-7.onnx",
      detectionsCount: visDetections.length,
      status: "completed"
    } : {
      classIndex: null,
      confidence: null,
      executionProvider: null,
      modelName: null,
      detectionsCount: 0,
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
    },
    perceptionState: { ...centralizedPerceptionState }
  };
}

/**
 * Returns the current centralized visual perception state.
 * @returns {Object}
 */
function getPerceptionState() {
  return { ...centralizedPerceptionState };
}

/**
 * Updates properties of the centralized perception state.
 * @param {Object} patch 
 */
function updatePerceptionState(patch = {}) {
  Object.assign(centralizedPerceptionState, patch);
}

/**
 * Invalidates stale perception state (e.g. after meaningful page change or action).
 * @param {string} reason 
 */
function invalidatePerception(reason = "Page state invalidated") {
  console.log(`[SIH26171][VISION] Perception invalidated: ${reason}`);
  centralizedPerceptionState.ready = false;
  centralizedPerceptionState.changed = true;
  centralizedPerceptionState.reason = reason;
}

if (typeof window !== "undefined") {
  window.SIHFusion = {
    buildLocalPerception,
    fuseVisualAndDOMResults,
    computeSpatialOverlap,
    getPerceptionState,
    updatePerceptionState,
    invalidatePerception
  };
  window.buildLocalPerception = buildLocalPerception;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildLocalPerception,
    fuseVisualAndDOMResults,
    computeSpatialOverlap,
    getPerceptionState,
    updatePerceptionState,
    invalidatePerception,
    centralizedPerceptionState
  };
}
