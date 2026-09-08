import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = chrome.runtime.getURL("lib/");

let session = null;

async function loadVisionModel() {
    if (session) return session;

    session = await ort.InferenceSession.create(
        chrome.runtime.getURL("squeezenet1.1-7.onnx"),
        {
            executionProviders: ["wasm"]
        }
    );

    return session;
}

async function runVisionInference(imageData) {
    const model = await loadVisionModel();

    const size = 224;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);

    const pixels = ctx.getImageData(0, 0, size, size).data;

    const input = new Float32Array(1 * 3 * size * size);

    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const pixel = (y * size + x) * 4;
            const index = y * size + x;

            const r = pixels[pixel] / 255;
            const g = pixels[pixel + 1] / 255;
            const b = pixels[pixel + 2] / 255;

            input[index] =
                (r - mean[0]) / std[0];

            input[size * size + index] =
                (g - mean[1]) / std[1];

            input[2 * size * size + index] =
                (b - mean[2]) / std[2];
        }
    }

    const inputName = model.inputNames[0];

    const tensor = new ort.Tensor(
        "float32",
        input,
        [1, 3, 224, 224]
    );

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

    // Numerically stable softmax to produce bounded class probabilities [0, 1]
    let sumExp = 0;
    for (let i = 0; i < output.length; i++) {
        sumExp += Math.exp(output[i] - maxLogit);
    }
    const topProb = sumExp > 0 ? (Math.exp(output[bestIndex] - maxLogit) / sumExp) : 0;
    const boundedConfidence = Math.max(0.0, Math.min(1.0, topProb));

    return {
        classIndex: bestIndex,
        confidence: boundedConfidence,
        executionProvider: "wasm"
    };
}

window.SIHVision = {
    loadVisionModel,
    runVisionInference
};