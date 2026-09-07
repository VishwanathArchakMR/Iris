/**
 * screenshot-redactor.js - Milestones 11 & 12: Local Screenshot-Level Privacy Redaction
 * Generates a locally sanitized (redacted) copy of the tab screenshot by masking
 * the screen regions of DOM elements identified as sensitive by attribute/type (M11)
 * merged with on-device OCR-detected visual PII regions (M12).
 *
 * Privacy & Security Guarantees:
 * - Operates entirely client-side via an offscreen HTML5 canvas copy.
 * - Original screenshot data is never mutated.
 * - Fail-closed: returns null on any error (never falls back to raw screenshot).
 * - No screenshot (raw or sanitized) is ever transmitted to the backend.
 * - Coordinates only; never carries or displays raw sensitive strings.
 */

/**
 * Merges DOM-derived sensitive regions and OCR-derived sensitive regions into
 * a unified, normalized, bounds-clipped, deduplicated region list in screenshot pixel space.
 *
 * @param {Array<Object>} domRegions - Sensitive regions from DOM (CSS pixels)
 * @param {Array<Object>} ocrRegions - Sensitive regions from OCR (screenshot pixels)
 * @param {number} screenshotWidth - Screenshot width in pixels
 * @param {number} screenshotHeight - Screenshot height in pixels
 * @param {number} dpr - Window devicePixelRatio
 * @returns {Array<Object>} Unified merged regions in screenshot pixel coordinates
 */
function mergeSensitiveRegions(domRegions = [], ocrRegions = [], screenshotWidth = 0, screenshotHeight = 0, dpr = 1) {
  const normalized = [];
  const safeDpr = (typeof dpr === "number" && dpr > 0) ? dpr : 1;

  // 1. Normalize DOM regions: CSS pixels -> screenshot pixels
  if (Array.isArray(domRegions)) {
    domRegions.forEach((r) => {
      if (!r || typeof r.x !== "number" || typeof r.y !== "number" ||
          typeof r.width !== "number" || typeof r.height !== "number") return;

      const rx = r.scaled ? Math.round(r.x) : Math.round(r.x * safeDpr);
      const ry = r.scaled ? Math.round(r.y) : Math.round(r.y * safeDpr);
      const rw = r.scaled ? Math.round(r.width) : Math.round(r.width * safeDpr);
      const rh = r.scaled ? Math.round(r.height) : Math.round(r.height * safeDpr);

      normalized.push({
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        source: r.source || "dom",
        scaled: true
      });
    });
  }

  // 2. Normalize OCR regions: already in screenshot pixel space
  if (Array.isArray(ocrRegions)) {
    ocrRegions.forEach((r) => {
      if (!r || typeof r.x !== "number" || typeof r.y !== "number" ||
          typeof r.width !== "number" || typeof r.height !== "number") return;

      normalized.push({
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        source: r.source || "ocr",
        scaled: true
      });
    });
  }

  // 3. Clip to screenshot bounds
  const clipped = [];
  normalized.forEach((r) => {
    let x0 = r.x;
    let y0 = r.y;
    let x1 = r.x + r.width;
    let y1 = r.y + r.height;

    if (screenshotWidth > 0) {
      x0 = Math.max(0, Math.min(screenshotWidth, x0));
      x1 = Math.max(0, Math.min(screenshotWidth, x1));
    }
    if (screenshotHeight > 0) {
      y0 = Math.max(0, Math.min(screenshotHeight, y0));
      y1 = Math.max(0, Math.min(screenshotHeight, y1));
    }

    const w = x1 - x0;
    const h = y1 - y0;

    if (w > 0 && h > 0) {
      clipped.push({
        x: x0,
        y: y0,
        width: w,
        height: h,
        source: r.source,
        scaled: true
      });
    }
  });

  // 4. Merge overlapping/duplicate regions via bounding-box union
  let currentList = [...clipped];
  let hasMerged = true;

  while (hasMerged) {
    hasMerged = false;
    const nextList = [];
    const mergedIndices = new Set();

    for (let i = 0; i < currentList.length; i++) {
      if (mergedIndices.has(i)) continue;

      let boxA = { ...currentList[i] };

      for (let j = i + 1; j < currentList.length; j++) {
        if (mergedIndices.has(j)) continue;

        const boxB = currentList[j];

        // Check if boxA and boxB overlap
        const xOverlap = Math.max(0, Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x));
        const yOverlap = Math.max(0, Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y));

        if (xOverlap > 0 && yOverlap > 0) {
          const minX = Math.min(boxA.x, boxB.x);
          const minY = Math.min(boxA.y, boxB.y);
          const maxX = Math.max(boxA.x + boxA.width, boxB.x + boxB.width);
          const maxY = Math.max(boxA.y + boxA.height, boxB.y + boxB.height);

          boxA.x = minX;
          boxA.y = minY;
          boxA.width = maxX - minX;
          boxA.height = maxY - minY;
          boxA.source = boxA.source === boxB.source ? boxA.source : "merged";

          mergedIndices.add(j);
          hasMerged = true;
        }
      }

      nextList.push(boxA);
    }

    currentList = nextList;
  }

  return currentList;
}

/**
 * Builds a sanitized copy of the screenshot with sensitive regions masked.
 *
 * @param {string} screenshotDataUrl - Original screenshot data URL
 * @param {Array<Object>} sensitiveRegions - Array of bounding box descriptors {x, y, width, height, scaled?}
 * @returns {Promise<Object>} { success: boolean, sanitizedScreenshotDataUrl: string|null, error?: string }
 */
async function buildSanitizedScreenshot(screenshotDataUrl, sensitiveRegions) {
  return new Promise((resolve) => {
    try {
      if (!screenshotDataUrl || typeof screenshotDataUrl !== "string" || !screenshotDataUrl.startsWith("data:image/")) {
        return resolve({
          success: false,
          sanitizedScreenshotDataUrl: null,
          error: "Invalid screenshot data URL"
        });
      }

      if (!Array.isArray(sensitiveRegions)) {
        return resolve({
          success: false,
          sanitizedScreenshotDataUrl: null,
          error: "Sensitive regions must be an array"
        });
      }

      const img = new Image();
      img.onload = () => {
        try {
          const naturalW = img.naturalWidth || img.width;
          const naturalH = img.naturalHeight || img.height;

          if (!naturalW || !naturalH) {
            throw new Error("Invalid screenshot dimensions");
          }

          const canvas = document.createElement("canvas");
          canvas.width = naturalW;
          canvas.height = naturalH;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Unable to obtain 2D canvas context");
          }

          // Draw the original screenshot onto the offscreen canvas COPY (original is never modified)
          ctx.drawImage(img, 0, 0);

          const dpr = (typeof window !== "undefined" && typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0)
            ? window.devicePixelRatio
            : 1;

          for (const region of sensitiveRegions) {
            if (!region || typeof region.x !== "number" || typeof region.y !== "number" ||
                typeof region.width !== "number" || typeof region.height !== "number") {
              throw new Error("Malformed sensitive region descriptor");
            }

            // If region was already scaled to screenshot pixel space (e.g. by mergeSensitiveRegions), use directly
            const rx = region.scaled ? Math.round(region.x) : Math.round(region.x * dpr);
            const ry = region.scaled ? Math.round(region.y) : Math.round(region.y * dpr);
            const rw = region.scaled ? Math.round(region.width) : Math.round(region.width * dpr);
            const rh = region.scaled ? Math.round(region.height) : Math.round(region.height * dpr);

            // Skip zero or negative area regions
            if (rw <= 0 || rh <= 0) continue;

            // Draw opaque solid black masking box over the sensitive region
            ctx.fillStyle = "#000000";
            ctx.fillRect(rx, ry, rw, rh);

            // Small "REDACTED" label if region is sufficiently sized
            if (rw >= 40 && rh >= 14) {
              ctx.fillStyle = "#ffffff";
              const fontSize = Math.max(9, Math.min(13, Math.floor(rh * 0.45)));
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textBaseline = "middle";
              ctx.textAlign = "center";
              ctx.fillText("REDACTED", rx + rw / 2, ry + rh / 2);
            }
          }

          const sanitizedScreenshotDataUrl = canvas.toDataURL("image/jpeg", 0.85);

          resolve({
            success: true,
            sanitizedScreenshotDataUrl,
            regionCount: sensitiveRegions.length
          });
        } catch (canvasErr) {
          // Fail-closed: Never fall back to the raw screenshot
          resolve({
            success: false,
            sanitizedScreenshotDataUrl: null,
            error: canvasErr.message || "Canvas redaction processing error"
          });
        }
      };

      img.onerror = () => {
        // Fail-closed
        resolve({
          success: false,
          sanitizedScreenshotDataUrl: null,
          error: "Failed to load screenshot image for redaction"
        });
      };

      img.src = screenshotDataUrl;
    } catch (outerErr) {
      // Fail-closed
      resolve({
        success: false,
        sanitizedScreenshotDataUrl: null,
        error: outerErr.message || "Unexpected redaction exception"
      });
    }
  });
}

if (typeof window !== "undefined") {
  window.SIHRedactor = {
    buildSanitizedScreenshot,
    mergeSensitiveRegions
  };
  window.buildSanitizedScreenshot = buildSanitizedScreenshot;
  window.mergeSensitiveRegions = mergeSensitiveRegions;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildSanitizedScreenshot,
    mergeSensitiveRegions
  };
}
