/**
 * ocr-entry.js - Milestone 12: Local OCR-Based Visual PII Detection
 * Uses local, bundled Tesseract.js (WASM) to recognize text on the tab screenshot
 * and locate sensitive visual PII regions (reusing M2 detectors).
 *
 * Privacy & Security Guarantees:
 * - Runs 100% locally on-device in the browser context via WebAssembly.
 * - Zero network requests: all worker scripts, WASM binaries, and traineddata are local.
 * - OCR text and bounding boxes are NEVER transmitted to FastAPI or any server.
 * - Sensitive string values are never stored in region objects or displayed in the UI.
 */

import { createWorker } from "tesseract.js";

let ocrWorkerInstance = null;
let ocrWorkerInitPromise = null;
let lastInitDurationMs = null;

/**
 * Lazily initializes and caches a single Tesseract.js worker instance across captures.
 *
 * @returns {Promise<Worker>} Tesseract worker instance
 */
async function getOcrWorker() {
  if (ocrWorkerInstance) {
    return ocrWorkerInstance;
  }
  if (ocrWorkerInitPromise) {
    return ocrWorkerInitPromise;
  }

  ocrWorkerInitPromise = (async () => {
    const t0 = performance.now();
    const workerPath = chrome.runtime.getURL("lib/ocr/worker.min.js");
    const corePath = chrome.runtime.getURL("lib/ocr");
    const langPath = chrome.runtime.getURL("lib/ocr");

    // Initialize worker with local extension assets only (no CDN)
    const worker = await createWorker("eng", 1, {
      workerPath,
      corePath,
      langPath,
      gzip: true,
      workerBlobURL: false, // Required for Manifest V3 extension CSP compatibility
      logger: () => {} // Silent
    });

    lastInitDurationMs = Math.round(performance.now() - t0);
    ocrWorkerInstance = worker;
    ocrWorkerInitPromise = null;
    return ocrWorkerInstance;
  })();

  return ocrWorkerInitPromise;
}

/**
 * Prepares the screenshot image with optional bounded downsampling for performance.
 * Tradeoff: Downsampling large screenshots (max dimension <= 1600px) significantly
 * reduces WASM OCR memory footprint and execution latency while retaining high
 * word-level recognition accuracy for typical screen text.
 *
 * @param {string} dataUrl - Screenshot image data URL
 * @param {number} maxDim - Maximum allowed dimension (width or height)
 * @returns {Promise<Object>} Processed canvas, dimensions, and scaling factors
 */
function prepareScreenshotImage(dataUrl, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      if (!origW || !origH) {
        return reject(new Error("Invalid screenshot dimensions"));
      }

      let targetW = origW;
      let targetH = origH;
      let scale = 1;

      if (Math.max(origW, origH) > maxDim) {
        scale = maxDim / Math.max(origW, origH);
        targetW = Math.round(origW * scale);
        targetH = Math.round(origH * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return reject(new Error("Unable to create canvas 2D context"));
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      resolve({
        canvas,
        origW,
        origH,
        targetW,
        targetH,
        scaleX: origW / targetW,
        scaleY: origH / targetH,
        scale
      });
    };
    img.onerror = () => reject(new Error("Failed to load screenshot image for OCR"));
    img.src = dataUrl;
  });
}

/**
 * Runs on-device OCR on the screenshot and returns detected words and lines
 * with bounding boxes mapped back to the original screenshot's pixel dimensions.
 *
 * @param {string} screenshotDataUrl - Tab screenshot JPEG/PNG data URL
 * @returns {Promise<Object>} OCR results including words, lines, and latencies
 */
async function runOcr(screenshotDataUrl) {
  try {
    if (!screenshotDataUrl || typeof screenshotDataUrl !== "string" || !screenshotDataUrl.startsWith("data:image/")) {
      return {
        success: false,
        reason: "Invalid screenshot data URL",
        words: [],
        lines: [],
        initTimeMs: 0,
        inferenceTimeMs: 0
      };
    }

    const tInit0 = performance.now();
    const worker = await getOcrWorker();
    const initTimeMs = lastInitDurationMs !== null ? lastInitDurationMs : Math.round(performance.now() - tInit0);

    const { canvas, origW, origH, scaleX, scaleY, scale } = await prepareScreenshotImage(screenshotDataUrl, 1600);

    const tInfer0 = performance.now();
    const recognition = await worker.recognize(canvas);
    const inferenceTimeMs = Math.round(performance.now() - tInfer0);

    const data = recognition && recognition.data ? recognition.data : {};
    const rawWords = data.words || [];
    const rawLines = data.lines || [];

    // Map word coordinates back to the original screenshot's pixel space
    const mappedWords = rawWords.map((w) => {
      const bbox = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
      const x = Math.round(bbox.x0 * scaleX);
      const y = Math.round(bbox.y0 * scaleY);
      const width = Math.round((bbox.x1 - bbox.x0) * scaleX);
      const height = Math.round((bbox.y1 - bbox.y0) * scaleY);

      return {
        text: (w.text || "").trim(),
        x,
        y,
        width,
        height,
        confidence: w.confidence || 0
      };
    }).filter(w => w.text.length > 0 && w.width > 0 && w.height > 0);

    // Map line coordinates back to the original screenshot's pixel space
    const mappedLines = rawLines.map((l) => {
      const bbox = l.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
      const x = Math.round(bbox.x0 * scaleX);
      const y = Math.round(bbox.y0 * scaleY);
      const width = Math.round((bbox.x1 - bbox.x0) * scaleX);
      const height = Math.round((bbox.y1 - bbox.y0) * scaleY);

      const words = (l.words || []).map((w) => {
        const wb = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
        return {
          text: (w.text || "").trim(),
          x: Math.round(wb.x0 * scaleX),
          y: Math.round(wb.y0 * scaleY),
          width: Math.round((wb.x1 - wb.x0) * scaleX),
          height: Math.round((wb.y1 - wb.y0) * scaleY),
          confidence: w.confidence || 0
        };
      }).filter(w => w.text.length > 0);

      return {
        text: (l.text || "").trim(),
        x,
        y,
        width,
        height,
        words
      };
    }).filter(l => l.text.length > 0 && l.width > 0 && l.height > 0);

    return {
      success: true,
      words: mappedWords,
      lines: mappedLines,
      initTimeMs,
      inferenceTimeMs,
      scaleFactor: scale,
      screenshotDimensions: { width: origW, height: origH }
    };
  } catch (err) {
    return {
      success: false,
      reason: err.message || "OCR recognition failed",
      words: [],
      lines: [],
      initTimeMs: 0,
      inferenceTimeMs: 0
    };
  }
}

/**
 * Reuses M2's regex patterns to detect sensitive PII spans in OCR output.
 * Patterns: Passwords, Credit Cards, Phones, Emails.
 */
const PII_REGEXES = [
  /\b((?:password|pwd|passcode|secret)[\s:=]+(?:is[\s:=]*)?)([^\s\r\n,;!]+)/i,
  /\b(?:\d{4}[ -]?){3}\d{1,4}\b|\b\d{13,16}\b/,
  /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b\d{10}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
];

/**
 * Checks if a given text contains sensitive PII using M2 detectors.
 *
 * @param {string} text - Text to evaluate
 * @returns {boolean} True if sensitive PII matched
 */
function isSensitiveText(text) {
  if (!text || typeof text !== "string") return false;

  // Primary: delegate to window.redactText if available (exact M2 parity)
  if (typeof window !== "undefined" && typeof window.redactText === "function") {
    const redacted = window.redactText(text);
    if (redacted !== text) return true;
  }

  // Fallback: test identical regex array
  return PII_REGEXES.some(regex => regex.test(text));
}

/**
 * Detects sensitive PII regions from OCR words and lines.
 * Outputs coordinates only; never includes raw sensitive strings.
 *
 * @param {Object|Array} ocrData - OCR result with { words, lines } or words array
 * @returns {Array<Object>} Array of sensitive OCR regions in screenshot pixel coordinates
 */
function detectSensitiveOcrRegions(ocrData) {
  const regions = [];
  if (!ocrData) return regions;

  const words = Array.isArray(ocrData) ? ocrData : (ocrData.words || []);
  const lines = Array.isArray(ocrData.lines) ? ocrData.lines : [];

  const matchedWordIndices = new Set();

  // 1. Line-level scan: detect multi-word sensitive spans (e.g. grouped card numbers, emails, passwords)
  lines.forEach((line) => {
    if (!line || !line.text) return;

    if (isSensitiveText(line.text)) {
      const lineWords = Array.isArray(line.words) ? line.words : [];

      // Check sub-slices of adjacent words on the line
      let matchedSlice = false;
      for (let len = lineWords.length; len >= 1; len--) {
        for (let i = 0; i <= lineWords.length - len; i++) {
          const slice = lineWords.slice(i, i + len);
          const sliceText = slice.map(w => w.text).join(" ");

          if (isSensitiveText(sliceText)) {
            const minX = Math.min(...slice.map(w => w.x));
            const minY = Math.min(...slice.map(w => w.y));
            const maxX = Math.max(...slice.map(w => w.x + w.width));
            const maxY = Math.max(...slice.map(w => w.y + w.height));

            regions.push({
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
              source: "ocr",
              scaled: true
            });

            slice.forEach((_, idx) => matchedWordIndices.add(i + idx));
            matchedSlice = true;
          }
        }
      }

      // If no sub-slice isolated, redact the line bounding box
      if (!matchedSlice && line.width > 0 && line.height > 0) {
        regions.push({
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
          source: "ocr",
          scaled: true
        });
      }
    }
  });

  // 2. Standalone word scan for any single-word matches not captured by line grouping
  words.forEach((w) => {
    if (w && w.text && isSensitiveText(w.text)) {
      regions.push({
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        source: "ocr",
        scaled: true
      });
    }
  });

  return regions;
}

// Expose on window for extension popup
if (typeof window !== "undefined") {
  window.SIHOCR = {
    getOcrWorker,
    runOcr,
    detectSensitiveOcrRegions
  };
  window.runOcr = runOcr;
  window.detectSensitiveOcrRegions = detectSensitiveOcrRegions;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getOcrWorker,
    runOcr,
    detectSensitiveOcrRegions
  };
}
