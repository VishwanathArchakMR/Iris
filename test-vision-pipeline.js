/**
 * test-vision-pipeline.js
 * Verification test suite for Milestone 9: On-device Visual Perception Foundation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("============================================================");
console.log("RUNNING MILESTONE 9 ON-DEVICE VISION PIPELINE VERIFICATION");
console.log("============================================================\n");

// [TEST 1] Manifest V3 configuration checks
console.log("[TEST 1] Verifying manifest.json configuration");
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
assert.strictEqual(manifest.manifest_version, 3, "Manifest version must be 3");

// Verify CSP contains 'wasm-unsafe-eval'
const csp = manifest.content_security_policy?.extension_pages || "";
assert.ok(csp.includes("'wasm-unsafe-eval'"), "CSP extension_pages must include 'wasm-unsafe-eval' for WASM");
console.log("  ✓ CSP includes 'wasm-unsafe-eval':", csp);

// Verify web_accessible_resources contains vision and wasm assets
const warEntries = manifest.web_accessible_resources?.[0]?.resources || [];
const requiredResources = [
    "lib/vision.bundle.js",
    "squeezenet1.1-7.onnx",
    "lib/ort-wasm-simd-threaded.jsep.wasm",
    "lib/ort-wasm-simd-threaded.jsep.mjs"
];
for (const res of requiredResources) {
    assert.ok(warEntries.includes(res), `manifest web_accessible_resources must include ${res}`);
}
console.log("  ✓ manifest web_accessible_resources contains all required vision/WASM assets");

// [TEST 2] Model and WASM asset existence checks
console.log("\n[TEST 2] Verifying physical asset files");
assert.ok(fs.existsSync('squeezenet1.1-7.onnx'), "squeezenet1.1-7.onnx must exist in root");
const modelStat = fs.statSync('squeezenet1.1-7.onnx');
assert.ok(modelStat.size > 4000000, `Model file size (${modelStat.size}) is expected to be ~4.95MB`);
console.log(`  ✓ squeezenet1.1-7.onnx verified (${(modelStat.size / (1024 * 1024)).toFixed(2)} MB)`);

const wasmAssets = [
    'lib/vision.bundle.js',
    'lib/ort-wasm-simd-threaded.jsep.wasm',
    'lib/ort-wasm-simd-threaded.jsep.mjs'
];
for (const wa of wasmAssets) {
    assert.ok(fs.existsSync(wa), `${wa} must exist`);
    const s = fs.statSync(wa);
    console.log(`  ✓ ${wa} verified (${(s.size / 1024).toFixed(1)} KB)`);
}

// [TEST 3] Script order in popup.html
console.log("\n[TEST 3] Verifying script inclusion and order in popup.html");
const popupHtml = fs.readFileSync('popup.html', 'utf8');
const visionScriptIndex = popupHtml.indexOf('<script src="lib/vision.bundle.js"></script>');
const popupScriptIndex = popupHtml.indexOf('<script src="popup.js"></script>');

assert.ok(visionScriptIndex !== -1, "popup.html must include lib/vision.bundle.js");
assert.ok(popupScriptIndex !== -1, "popup.html must include popup.js");
assert.ok(visionScriptIndex < popupScriptIndex, "lib/vision.bundle.js must be loaded before popup.js");
console.log("  ✓ lib/vision.bundle.js correctly loads prior to popup.js in popup.html");

// [TEST 4] Vision DOM elements in popup.html
console.log("\n[TEST 4] Verifying Vision UI elements in popup.html");
const requiredElementIds = [
    "visionClassificationContainer",
    "visionModelStatus",
    "visionStatus",
    "visionDetails",
    "visionStatusText",
    "visionRuntime",
    "visionProvider",
    "visionLatency",
    "visionDetectionsCount",
    "visionFusionStatus",
    "visionPageChangeStatus",
    "visionClassIndex",
    "visionConfidence"
];
for (const id of requiredElementIds) {
    assert.ok(popupHtml.includes(`id="${id}"`), `popup.html must contain #${id}`);
}
console.log("  ✓ All 13 Vision status & telemetry UI elements present in popup.html");

// [TEST 5] Vision bundle initialization & window.SIHVision export
console.log("\n[TEST 5] Verifying lib/vision.bundle.js module loading and interface");
global.window = global;
global.document = {
    createElement: (tag) => {
        return {
            width: 224,
            height: 224,
            getContext: () => ({
                putImageData: () => {},
                drawImage: () => {},
                getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
            })
        };
    }
};
global.chrome = {
    runtime: {
        getURL: (p) => path.resolve(__dirname, p)
    }
};

require('./lib/vision.bundle.js');
assert.ok(typeof window.SIHVision === 'object', "window.SIHVision must be defined");
assert.ok(typeof window.SIHVision.loadVisionModel === 'function', "loadVisionModel must be a function");
assert.ok(typeof window.SIHVision.runVisionInference === 'function', "runVisionInference must be a function");
assert.ok(typeof window.SIHVision.extractVisualDetections === 'function', "extractVisualDetections must be a function");
console.log("  ✓ window.SIHVision correctly exported with loadVisionModel, runVisionInference, and extractVisualDetections");

// [TEST 6] OnnxRuntime Model Loading and Execution
console.log("\n[TEST 6] Verifying ONNX Runtime Web Model Loading and Inference");
async function testInference() {
    const ort = require('onnxruntime-web');
    const modelBuf = fs.readFileSync('squeezenet1.1-7.onnx');
    const session = await ort.InferenceSession.create(modelBuf, { executionProviders: ['wasm'] });

    assert.strictEqual(session.inputNames[0], 'data', "Model input name must be 'data'");
    assert.strictEqual(session.outputNames[0], 'squeezenet0_flatten0_reshape0', "Model output name must be 'squeezenet0_flatten0_reshape0'");
    console.log("  ✓ InferenceSession created: input='data', output='squeezenet0_flatten0_reshape0'");

    // Simulate 224x224 ImageData
    const size = 224;
    const dummyPixels = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < dummyPixels.length; i += 4) {
        dummyPixels[i] = 120;     // R
        dummyPixels[i + 1] = 140; // G
        dummyPixels[i + 2] = 160; // B
        dummyPixels[i + 3] = 255; // A
    }

    // Preprocessing
    const input = new Float32Array(1 * 3 * size * size);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const channelSize = size * size;

    for (let i = 0; i < channelSize; i++) {
        const p = i * 4;
        const r = dummyPixels[p] / 255;
        const g = dummyPixels[p + 1] / 255;
        const b = dummyPixels[p + 2] / 255;

        input[i] = (r - mean[0]) / std[0];
        input[channelSize + i] = (g - mean[1]) / std[1];
        input[2 * channelSize + i] = (b - mean[2]) / std[2];
    }

    const tensor = new ort.Tensor("float32", input, [1, 3, 224, 224]);
    assert.deepStrictEqual(tensor.dims, [1, 3, 224, 224], "Tensor shape must be [1, 3, 224, 224]");
    console.log("  ✓ Input tensor constructed with shape [1, 3, 224, 224] and ImageNet normalization");

    const t0 = performance.now();
    const results = await session.run({ [session.inputNames[0]]: tensor });
    const latencyMs = Math.round(performance.now() - t0);

    const output = results[session.outputNames[0]].data;
    assert.strictEqual(output.length, 1000, "SqueezeNet output must have 1000 classes");

    let bestIndex = 0;
    let maxLogit = -Infinity;
    for (let i = 0; i < output.length; i++) {
        if (output[i] > output[bestIndex]) bestIndex = i;
        if (output[i] > maxLogit) maxLogit = output[i];
    }

    let sumExp = 0;
    for (let i = 0; i < output.length; i++) {
        sumExp += Math.exp(output[i] - maxLogit);
    }
    const topProb = sumExp > 0 ? (Math.exp(output[bestIndex] - maxLogit) / sumExp) : 0;
    const boundedConfidence = Math.max(0.0, Math.min(1.0, topProb));

    console.log(`  ✓ Inference successful in ${latencyMs} ms:`);
    console.log(`    - Top Class Index: ${bestIndex}`);
    console.log(`    - Bounded Confidence: ${(boundedConfidence * 100).toFixed(2)}% (${boundedConfidence.toFixed(4)})`);
    console.log(`    - Execution Provider: wasm`);

    assert.ok(boundedConfidence >= 0.0 && boundedConfidence <= 1.0, "Confidence must be bounded [0, 1]");

    // [TEST 7] Visual + DOM Spatial Fusion and Centralized State
    console.log("\n[TEST 7] Verifying Visual + DOM Spatial Fusion & Centralized State");
    const fusion = require('./perception-fusion.js');
    assert.ok(typeof fusion.fuseVisualAndDOMResults === 'function', "fuseVisualAndDOMResults must be a function");
    assert.ok(typeof fusion.getPerceptionState === 'function', "getPerceptionState must be a function");

    const testDomElements = [
        { index: 0, type: "input", label: "Email Address", x: 100, y: 150, width: 250, height: 40, isVisible: true },
        { index: 1, type: "button", label: "Submit", x: 100, y: 220, width: 120, height: 45, isVisible: true }
    ];

    const testVisualDetections = [
        { type: "ui-region", label: "Visual Box 1", confidence: 0.92, bbox: { x: 95, y: 145, width: 260, height: 50 } },
        { type: "ui-region", label: "Visual Box 2", confidence: 0.88, bbox: { x: 98, y: 218, width: 125, height: 48 } }
    ];

    const fusedElements = fusion.fuseVisualAndDOMResults(testDomElements, testVisualDetections);
    assert.strictEqual(fusedElements.length, 2, "Fused elements count must match DOM element count");
    assert.ok(fusedElements[0].isVisualConfirmed, "Element 0 should be visually confirmed by overlapping detection");
    assert.ok(fusedElements[1].isVisualConfirmed, "Element 1 should be visually confirmed by overlapping detection");
    assert.strictEqual(fusedElements[0].groundingMethod, "dom+visual-fusion", "Grounding method should be dom+visual-fusion");
    assert.ok(fusedElements[0].fusedConfidence > 0.8, "Fused confidence should be elevated for confirmed elements");

    console.log("  ✓ Spatial fusion successfully matched 2/2 DOM elements with visual bounding boxes");
    console.log(`    - Element 0 [Email Address]: Confirmed=${fusedElements[0].isVisualConfirmed}, Score=${fusedElements[0].fusedConfidence}, Method=${fusedElements[0].groundingMethod}`);
    console.log(`    - Element 1 [Submit]: Confirmed=${fusedElements[1].isVisualConfirmed}, Score=${fusedElements[1].fusedConfidence}, Method=${fusedElements[1].groundingMethod}`);

    const state = fusion.getPerceptionState();
    assert.strictEqual(state.ready, true, "Centralized perception state ready flag must be true");
    assert.strictEqual(state.fusedElements.length, 2, "Centralized perception state must contain fused elements");
    console.log("  ✓ Centralized perception state verified (ready: true, fusedElements: 2)");

    // Test invalidation
    fusion.invalidatePerception("Page navigation detected");
    const invalidatedState = fusion.getPerceptionState();
    assert.strictEqual(invalidatedState.ready, false, "Invalidated state ready flag must be false");
    assert.strictEqual(invalidatedState.changed, true, "Invalidated state changed flag must be true");
    console.log("  ✓ Invalidation verified (ready: false, changed: true, reason: 'Page navigation detected')");

    console.log("\n============================================================");
    console.log("ALL MILESTONE 9 VISION PIPELINE VERIFICATION TESTS PASSED!");
    console.log("============================================================\n");
}

testInference().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
