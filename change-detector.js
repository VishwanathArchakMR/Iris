/**
 * change-detector.js - Milestone 14: On-device Local Screen-Change Detection
 * Computes lightweight perceptual image fingerprints and DOM structure signatures
 * to verify whether an executed agent action produced a meaningful screen change.
 *
 * Privacy & Security Guarantees:
 * - Operates entirely client-side on-device using the HTML5 Canvas API.
 * - Computes coarse, downsampled (32x32) perceptual average-hashes; never persists images.
 * - Computes structural DOM signatures from existing M8 element descriptors; never reads input values.
 * - Signatures are purely local and are NEVER transmitted over any network request.
 */

// Configurable perceptual difference threshold (Hamming distance on 1024-bit hash)
// ~3% of pixels differing indicates a visible change on downsampled 32x32 canvas
const PIXEL_CHANGE_THRESHOLD = 30;

/**
 * Computes a lightweight FNV-1a 32-bit string hash.
 * Used for fast, deterministic hashing of sorted DOM element descriptors.
 *
 * @param {string} str - String to hash
 * @returns {string} Hexadecimal hash string
 */
function hashString(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Computes a compact perceptual screen signature from a screenshot data URL and DOM elements.
 *
 * @param {string} screenshotDataUrl - Screenshot image data URL (data:image/...)
 * @param {Array<Object>} visualElements - Array of M8 visual element descriptors
 * @returns {Promise<Object>} { pixelHash: string, domSignature: string, elementCount: number, timestamp: number }
 */
function computeScreenSignature(screenshotDataUrl, visualElements = []) {
  return new Promise((resolve) => {
    const timestamp = Date.now();
    const elements = Array.isArray(visualElements) ? visualElements : [];
    const elementCount = elements.length;

    // 1. Compute lightweight DOM structural signature
    const sortedSummary = elements
      .map((el) => `${el.type || ""}:${el.label || ""}:${el.semanticTag || ""}`)
      .sort()
      .join("|");
    const domSignature = hashString(sortedSummary);

    // 2. Compute 32x32 perceptual average-hash from screenshot
    if (!screenshotDataUrl || typeof screenshotDataUrl !== "string" || !screenshotDataUrl.startsWith("data:image/")) {
      return resolve({
        pixelHash: "0".repeat(1024),
        domSignature,
        elementCount,
        timestamp
      });
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          return resolve({
            pixelHash: "0".repeat(1024),
            domSignature,
            elementCount,
            timestamp
          });
        }

        // Downsample image to 32x32
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const data = imgData.data;

        // Compute luminance for each pixel and calculate mean luminance
        const luminances = new Float32Array(1024);
        let sumLuminance = 0;

        for (let i = 0; i < 1024; i++) {
          const idx = i * 4;
          // Standard ITU-R BT.601 perceptual luminance
          const y = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          luminances[i] = y;
          sumLuminance += y;
        }

        const meanLuminance = sumLuminance / 1024;

        // Generate 1024-bit binary string (1 if >= mean, else 0)
        let pixelHash = "";
        for (let i = 0; i < 1024; i++) {
          pixelHash += luminances[i] >= meanLuminance ? "1" : "0";
        }

        resolve({
          pixelHash,
          domSignature,
          elementCount,
          timestamp
        });
      } catch (err) {
        console.warn("computeScreenSignature canvas error:", err);
        resolve({
          pixelHash: "0".repeat(1024),
          domSignature,
          elementCount,
          timestamp
        });
      }
    };

    img.onerror = () => {
      resolve({
        pixelHash: "0".repeat(1024),
        domSignature,
        elementCount,
        timestamp
      });
    };

    img.src = screenshotDataUrl;
  });
}

/**
 * Computes Hamming distance between two binary hash strings.
 *
 * @param {string} hashA - First binary string
 * @param {string} hashB - Second binary string
 * @returns {number} Count of differing bits
 */
function computeHammingDistance(hashA = "", hashB = "") {
  if (!hashA || !hashB || hashA.length !== hashB.length) {
    return 1024;
  }
  let dist = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) {
      dist++;
    }
  }
  return dist;
}

// Meaningful Change Classification Levels
const CHANGE_LEVELS = Object.freeze({
  NO_CHANGE: "NO_CHANGE",
  MINOR_CHANGE: "MINOR_CHANGE",
  MEANINGFUL_CHANGE: "MEANINGFUL_CHANGE",
  MAJOR_CHANGE: "MAJOR_CHANGE"
});

/**
 * Compares two screen signatures to determine if a meaningful visual or DOM change occurred.
 * Classifies changes into: NO_CHANGE, MINOR_CHANGE, MEANINGFUL_CHANGE, MAJOR_CHANGE.
 *
 * @param {Object|null} prev - Previous screen signature
 * @param {Object|null} current - Current screen signature
 * @param {number} pixelThreshold - Configurable Hamming distance threshold
 * @returns {Object} { changed: boolean, changeLevel: string, reason: string, pixelDiff: number, domDiff: boolean }
 */
function compareScreenSignatures(prev, current, pixelThreshold = PIXEL_CHANGE_THRESHOLD) {
  if (!prev || !current) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MAJOR_CHANGE,
      reason: "Initial observation (no previous signature)",
      pixelDiff: 0,
      domDiff: false
    };
  }

  const pixelDiff = computeHammingDistance(prev.pixelHash, current.pixelHash);
  const countDiff = current.elementCount !== prev.elementCount;
  const domDiff = current.domSignature !== prev.domSignature;

  // 1. Structural DOM count change (e.g. modal appeared, elements added/removed) -> MAJOR_CHANGE
  if (countDiff) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MAJOR_CHANGE,
      reason: `DOM structure changed (element count ${prev.elementCount} -> ${current.elementCount})`,
      pixelDiff,
      domDiff: true
    };
  }

  // 2. Large visual shift (>= 100 bits) -> MAJOR_CHANGE
  if (pixelDiff >= 100) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MAJOR_CHANGE,
      reason: `Major visual shift (${pixelDiff} bits changed >= 100)`,
      pixelDiff,
      domDiff
    };
  }

  // 3. Structural DOM content change (e.g. text or labels changed while count remained equal) -> MEANINGFUL_CHANGE
  if (domDiff) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MEANINGFUL_CHANGE,
      reason: `DOM element labels changed (signature ${prev.domSignature} -> ${current.domSignature})`,
      pixelDiff,
      domDiff: true
    };
  }

  // 4. Perceptual pixel change exceeding threshold -> MEANINGFUL_CHANGE
  if (pixelDiff >= pixelThreshold) {
    return {
      changed: true,
      changeLevel: CHANGE_LEVELS.MEANINGFUL_CHANGE,
      reason: `Visual difference exceeded threshold (${pixelDiff} bits changed >= ${pixelThreshold})`,
      pixelDiff,
      domDiff: false
    };
  }

  // 5. Minor perceptual difference (< threshold but > 5) -> MINOR_CHANGE
  if (pixelDiff > 5) {
    return {
      changed: false,
      changeLevel: CHANGE_LEVELS.MINOR_CHANGE,
      reason: `Minor sub-threshold pixel fluctuation (${pixelDiff} bits changed < ${pixelThreshold})`,
      pixelDiff,
      domDiff: false
    };
  }

  // 6. No meaningful change detected -> NO_CHANGE
  return {
    changed: false,
    changeLevel: CHANGE_LEVELS.NO_CHANGE,
    reason: `No meaningful change detected (${pixelDiff} bits changed < ${pixelThreshold})`,
    pixelDiff,
    domDiff: false
  };
}

if (typeof window !== "undefined") {
  window.SIHChangeDetector = {
    computeScreenSignature,
    compareScreenSignatures,
    computeHammingDistance,
    hashString,
    PIXEL_CHANGE_THRESHOLD,
    CHANGE_LEVELS
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeScreenSignature,
    compareScreenSignatures,
    computeHammingDistance,
    hashString,
    PIXEL_CHANGE_THRESHOLD,
    CHANGE_LEVELS
  };
}
