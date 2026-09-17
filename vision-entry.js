/**
 * vision-entry.js - Milestone 9: On-device Visual Perception Foundation
 * 
 * Uses on-device ONNX Runtime Web (WASM) to run computer vision models directly in
 * the browser context without sending raw screenshots or pixels to any cloud server.
 * 
 * Technical Architecture & Contracts:
 * 1. Active Classification Model: squeezenet1.1-7.onnx (4.95 MB)
 *    - Input: Tensor "data", shape [1, 3, 224, 224], Float32, NCHW, ImageNet mean/std normalized
 *    - Output: Tensor "squeezenet0_flatten0_reshape0", shape [1, 1000] logits -> stable softmax
 * 
 * 2. Pluggable UI Object Detection Model Contract (ui-detector.onnx):
 *    - Expected Filename: "ui-detector.onnx" (in extension root or lib/)
 *    - Input: Tensor "images", shape [1, 3, 640, 640] or [1, 3, 320, 320], Float32 RGB [0, 1]
 *    - Output: Tensor "output0", shape [1, num_anchors, 6] -> [x, y, w, h, conf, class_id]
 *    - Classes: ["button", "input", "link", "text", "icon", "checkbox", "select"]
 * 
 * Privacy & Security Guarantees:
 * - 100% on-device WebAssembly execution.
 * - Zero network exfiltration of raw visual pixels or screenshots.
 */

import * as ort from "onnxruntime-web";

// Configure WASM asset resolution within Chrome Extension MV3
ort.env.wasm.wasmPaths = chrome.runtime.getURL("lib/");
ort.env.wasm.numThreads = 1; // Strict single-threading for extension popup environment
ort.env.wasm.proxy = false;

let session = null;
let sessionLoadingPromise = null;
let activeModelName = "squeezenet1.1-7.onnx";

/**
 * Loads the local ONNX vision model inside the browser.
 * Caches the compiled InferenceSession to avoid redundant compilations.
 * 
 * @returns {Promise<ort.InferenceSession>}
 */
async function loadVisionModel() {
    if (session) return session;
    if (sessionLoadingPromise) return sessionLoadingPromise;

    sessionLoadingPromise = (async () => {
        try {
            console.log(`[SIH26171][VISION] Loading local ONNX model: ${activeModelName}...`);
            const modelUrl = chrome.runtime.getURL(activeModelName);
            
            session = await ort.InferenceSession.create(
                modelUrl,
                {
                    executionProviders: ["wasm"]
                }
            );

            console.log(`[SIH26171][VISION] Model loaded successfully: ${activeModelName} (Execution Provider: wasm)`);
            sessionLoadingPromise = null;
            return session;
        } catch (err) {
            console.warn(`[SIH26171][VISION] Primary model load notice (${err.message}). Falling back to DOM perception`);
            sessionLoadingPromise = null;
            throw err;
        }
    })();

    return sessionLoadingPromise;
}

/**
 * Preprocesses visual image data into a normalized Float32 NCHW tensor.
 * Standard ImageNet normalization: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225].
 * 
 * @param {ImageData|HTMLCanvasElement|Image} imageData 
 * @param {number} size 
 * @returns {ort.Tensor}
 */
function preprocessVisualInput(imageData, size = 224) {
    let pixels;
    if (imageData && imageData.data && imageData.width === size && imageData.height === size) {
        pixels = imageData.data;
    } else {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (imageData instanceof ImageData) {
            ctx.putImageData(imageData, 0, 0);
        } else if (imageData && (imageData.width || imageData.naturalWidth)) {
            ctx.drawImage(imageData, 0, 0, size, size);
        }
        pixels = ctx.getImageData(0, 0, size, size).data;
    }

    const input = new Float32Array(1 * 3 * size * size);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const channelSize = size * size;

    for (let i = 0; i < channelSize; i++) {
        const pixel = i * 4;
        const r = pixels[pixel] / 255;
        const g = pixels[pixel + 1] / 255;
        const b = pixels[pixel + 2] / 255;

        input[i] = (r - mean[0]) / std[0];
        input[channelSize + i] = (g - mean[1]) / std[1];
        input[2 * channelSize + i] = (b - mean[2]) / std[2];
    }

    return new ort.Tensor("float32", input, [1, 3, size, size]);
}

/**
 * Extracts candidate visual UI regions directly from visual representation (e.g. contrast edges/clusters).
 * Produces structured visual detections for spatial fusion with DOM perception.
 * 
 * @param {ImageData} imageData 
 * @returns {Array<Object>} Array of visual detection objects { type, label, confidence, bbox }
 */
function extractVisualDetections(imageData) {
    if (!imageData || !imageData.data) return [];
    
    const width = imageData.width || 224;
    const height = imageData.height || 224;
    const data = imageData.data;
    const detections = [];

    // Lightweight grid-based perceptual luminance clustering to locate visual cards/buttons/inputs
    const gridSize = 16;
    const stepX = Math.floor(width / gridSize);
    const stepY = Math.floor(height / gridSize);
    const gridEnergies = [];

    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            let sumLum = 0;
            let count = 0;
            for (let y = gy * stepY; y < (gy + 1) * stepY && y < height; y += 2) {
                for (let x = gx * stepX; x < (gx + 1) * stepX && x < width; x += 2) {
                    const idx = (y * width + x) * 4;
                    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    sumLum += lum;
                    count++;
                }
            }
            gridEnergies.push({ gx, gy, avgLum: count > 0 ? sumLum / count : 128 });
        }
    }

    // Identify visually distinct regions
    const meanGlobalLum = gridEnergies.reduce((acc, c) => acc + c.avgLum, 0) / gridEnergies.length;
    let detIndex = 0;

    for (let gy = 1; gy < gridSize - 1; gy += 2) {
        for (let gx = 1; gx < gridSize - 1; gx += 2) {
            const cell = gridEnergies[gy * gridSize + gx];
            const contrast = Math.abs(cell.avgLum - meanGlobalLum);
            if (contrast > 25 && detIndex < 12) {
                const bx = Math.round((gx - 0.5) * stepX);
                const by = Math.round((gy - 0.5) * stepY);
                const bw = Math.min(width - bx, stepX * 2);
                const bh = Math.min(height - by, stepY * 2);
                const conf = Math.min(0.95, 0.60 + (contrast / 255) * 0.35);

                detections.push({
                    type: "visual-element",
                    label: `Visual Region #${detIndex + 1}`,
                    confidence: Math.round(conf * 100) / 100,
                    bbox: {
                        x: bx,
                        y: by,
                        width: bw,
                        height: bh
                    }
                });
                detIndex++;
            }
        }
    }

    return detections;
}

/**
 * Runs on-device visual inference and returns structured detections and classification.
 * 
 * @param {ImageData|HTMLCanvasElement} imageData - Resized image or canvas
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Detection results, classification, latency and execution provider
 */
async function runVisionInference(imageData, options = {}) {
    const t0 = performance.now();
    console.log("[SIH26171][VISION] Inference started");

    const model = await loadVisionModel();
    const size = 224;
    const tensor = preprocessVisualInput(imageData, size);
    const inputName = model.inputNames[0];

    const results = await model.run({
        [inputName]: tensor
    });

    const outputName = model.outputNames[0];
    const output = results[outputName].data;

    let bestIndex = 0;
    let maxLogit = -Infinity;

    for (let i = 0; i < output.length; i++) {
        if (output[i] > output[bestIndex]) {
            bestIndex = i;
        }
        if (output[i] > maxLogit) {
            maxLogit = output[i];
        }
    }

    // Numerically stable softmax for bounded probabilities [0, 1]
    let sumExp = 0;
    for (let i = 0; i < output.length; i++) {
        sumExp += Math.exp(output[i] - maxLogit);
    }
    const topProb = sumExp > 0 ? (Math.exp(output[bestIndex] - maxLogit) / sumExp) : 0;
    const boundedConfidence = Math.max(0.0, Math.min(1.0, topProb));

    // Extract visual detections from visual representation
    const detections = extractVisualDetections(imageData);
    const latencyMs = Math.round(performance.now() - t0);

    console.log(`[SIH26171][VISION] Inference completed in ${latencyMs} ms (Top Class: ${bestIndex}, Confidence: ${(boundedConfidence * 100).toFixed(1)}%)`);
    console.log(`[SIH26171][VISION] Visual detections: ${detections.length}`);

    return {
        classIndex: bestIndex,
        confidence: boundedConfidence,
        executionProvider: "wasm",
        modelName: activeModelName,
        detections: detections,
        latencyMs: latencyMs,
        status: "completed"
    };
}

if (typeof window !== "undefined") {
    window.SIHVision = {
        loadVisionModel,
        runVisionInference,
        preprocessVisualInput,
        extractVisualDetections
    };
}
if (typeof globalThis !== "undefined") {
    globalThis.SIHVision = {
        loadVisionModel,
        runVisionInference,
        preprocessVisualInput,
        extractVisualDetections
    };
}