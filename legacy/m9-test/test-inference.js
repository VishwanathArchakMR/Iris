const ort = require("onnxruntime-web");

async function main() {
    console.log("Loading SqueezeNet model...");

    const session = await ort.InferenceSession.create(
        "./squeezenet1.0-8.onnx"
    );

    console.log("Model loaded successfully!");
    console.log("Input:", session.inputNames);
    console.log("Output:", session.outputNames);
}

main().catch((error) => {
    console.error("Inference test failed:");
    console.error(error);
});