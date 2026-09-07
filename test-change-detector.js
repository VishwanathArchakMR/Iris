/**
 * test-change-detector.js - Unit tests for change-detector.js
 */

const assert = require("assert");
const {
  compareScreenSignatures,
  computeHammingDistance,
  hashString,
  PIXEL_CHANGE_THRESHOLD
} = require("./change-detector.js");

function runTests() {
  console.log("Running Change Detector unit tests...");

  // 1. Test hashString determinism
  const h1 = hashString("button:Submit Form:SUBMIT_BUTTON");
  const h2 = hashString("button:Submit Form:SUBMIT_BUTTON");
  const h3 = hashString("button:Other Button:OTHER");
  assert.strictEqual(h1, h2, "Identical strings must have identical hash");
  assert.notStrictEqual(h1, h3, "Different strings must produce different hash");
  console.log("[PASS] hashString determinism");

  // 2. Test computeHammingDistance
  const allZeros = "0".repeat(1024);
  const allOnes = "1".repeat(1024);
  assert.strictEqual(computeHammingDistance(allZeros, allZeros), 0, "Distance between identical hashes must be 0");
  assert.strictEqual(computeHammingDistance(allZeros, allOnes), 1024, "Distance between inverse hashes must be 1024");

  // 25 differing bits
  const hash25Diff = "1".repeat(25) + "0".repeat(999);
  assert.strictEqual(computeHammingDistance(allZeros, hash25Diff), 25, "Distance must match count of differing bits");
  console.log("[PASS] computeHammingDistance calculation");

  // 3. Test compareScreenSignatures: Initial observation
  const resInitial = compareScreenSignatures(null, {
    pixelHash: allZeros,
    domSignature: "abcd1234",
    elementCount: 5,
    timestamp: Date.now()
  });
  assert.strictEqual(resInitial.changed, true);
  assert.ok(resInitial.reason.includes("Initial observation"));
  console.log("[PASS] compareScreenSignatures: Initial observation");

  // 4. Test compareScreenSignatures: Identical signatures (No change)
  const sigA = {
    pixelHash: allZeros,
    domSignature: "abcd1234",
    elementCount: 5,
    timestamp: Date.now()
  };
  const sigIdentical = {
    pixelHash: allZeros,
    domSignature: "abcd1234",
    elementCount: 5,
    timestamp: Date.now() + 500
  };
  const resNoChange = compareScreenSignatures(sigA, sigIdentical);
  assert.strictEqual(resNoChange.changed, false);
  assert.strictEqual(resNoChange.pixelDiff, 0);
  assert.strictEqual(resNoChange.domDiff, false);
  assert.ok(resNoChange.reason.includes("No meaningful change detected"));
  console.log("[PASS] compareScreenSignatures: Identical signatures");

  // 5. Test compareScreenSignatures: DOM structure count difference
  const sigCountDiff = {
    pixelHash: allZeros,
    domSignature: "abcd1234",
    elementCount: 8,
    timestamp: Date.now() + 500
  };
  const resCountDiff = compareScreenSignatures(sigA, sigCountDiff);
  assert.strictEqual(resCountDiff.changed, true);
  assert.strictEqual(resCountDiff.domDiff, true);
  assert.ok(resCountDiff.reason.includes("element count 5 -> 8"));
  console.log("[PASS] compareScreenSignatures: DOM count change");

  // 6. Test compareScreenSignatures: DOM signature content difference
  const sigDomDiff = {
    pixelHash: allZeros,
    domSignature: "ef998877",
    elementCount: 5,
    timestamp: Date.now() + 500
  };
  const resDomDiff = compareScreenSignatures(sigA, sigDomDiff);
  assert.strictEqual(resDomDiff.changed, true);
  assert.strictEqual(resDomDiff.domDiff, true);
  assert.ok(resDomDiff.reason.includes("DOM element labels changed"));
  console.log("[PASS] compareScreenSignatures: DOM signature change");

  // 7. Test compareScreenSignatures: Sub-threshold pixel change (< 30) -> No change
  const sigSubThreshold = {
    pixelHash: hash25Diff, // 25 bits diff
    domSignature: "abcd1234",
    elementCount: 5,
    timestamp: Date.now() + 500
  };
  const resSub = compareScreenSignatures(sigA, sigSubThreshold);
  assert.strictEqual(resSub.changed, false);
  assert.strictEqual(resSub.pixelDiff, 25);
  console.log("[PASS] compareScreenSignatures: Sub-threshold pixel difference");

  // 8. Test compareScreenSignatures: Above-threshold pixel change (>= 30) -> Changed
  const hash50Diff = "1".repeat(50) + "0".repeat(974);
  const sigAboveThreshold = {
    pixelHash: hash50Diff, // 50 bits diff
    domSignature: "abcd1234",
    elementCount: 5,
    timestamp: Date.now() + 500
  };
  const resAbove = compareScreenSignatures(sigA, sigAboveThreshold);
  assert.strictEqual(resAbove.changed, true);
  assert.strictEqual(resAbove.pixelDiff, 50);
  assert.ok(resAbove.reason.includes("Visual difference exceeded threshold"));
  console.log("[PASS] compareScreenSignatures: Above-threshold pixel difference");

  console.log("\nALL CHANGE DETECTOR TESTS PASSED CLEANLY!");
}

runTests();
