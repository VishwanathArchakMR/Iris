/**
 * test-agent-overlay.js
 * Verification suite for Milestone 18: Live Explainable Agent Overlay
 */

const assert = require("assert");

// Lightweight DOM Mock for pure Node.js environments
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.id = "";
    this.className = "";
    this.attributes = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.isConnected = true;
    this.innerHTML = "";
    this.innerText = "";
    this.textContent = "";
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }

  getAttribute(k) {
    return this.attributes[k] || null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx >= 0) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
    this.isConnected = false;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (selector === "#sih-agent-overlay-root" && curr.id === "sih-agent-overlay-root") return curr;
      if (selector === "[id^='sih-agent-overlay']" && curr.id && curr.id.startsWith("sih-agent-overlay")) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  getBoundingClientRect() {
    return { top: 100, left: 50, width: 120, height: 36, bottom: 136, right: 170 };
  }

  querySelectorAll(sel) {
    return [];
  }

  querySelector(sel) {
    return null;
  }
}

// Setup global window & document mocks
const body = new MockElement("body");
const documentMock = {
  body: body,
  createElement(tag) {
    const el = new MockElement(tag);
    return el;
  },
  getElementById(id) {
    function search(node) {
      if (node.id === id) return node;
      for (const ch of node.children) {
        const found = search(ch);
        if (found) return found;
      }
      return null;
    }
    return search(body);
  },
  querySelectorAll(sel) {
    return [];
  },
  querySelector(sel) {
    return null;
  }
};

global.window = {
  scrollX: 0,
  scrollY: 0,
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = documentMock;

const content = require("./content.js");

console.log("============================================================");
console.log("RUNNING M18 LIVE EXPLAINABLE AGENT OVERLAY TESTS");
console.log("============================================================\n");

function runTests() {
  // Test 1: Function exports
  console.log("[TEST 1] Checking exported overlay functions in content.js");
  assert.strictEqual(typeof content.showAgentOverlay, "function", "showAgentOverlay must be exported");
  assert.strictEqual(typeof content.updateAgentOverlay, "function", "updateAgentOverlay must be exported");
  assert.strictEqual(typeof content.clearAgentOverlay, "function", "clearAgentOverlay must be exported");
  console.log("  ✓ All overlay functions exist and are callable.\n");

  // Test 2: GROUNDED state overlay creation
  console.log("[TEST 2] showAgentOverlay creates DOM elements with 'AGENT TARGET'");
  content.showAgentOverlay({
    state: "GROUNDED",
    action: "CLICK",
    target: "Search button",
    targetLabel: "Search",
    confidence: 0.98,
    method: "local-fuzzy-match",
    bbox: { x: 50, y: 100, width: 80, height: 30 }
  });

  const root = document.getElementById("sih-agent-overlay-root");
  assert(root, "#sih-agent-overlay-root must exist in document");
  assert.strictEqual(root.getAttribute("data-sih-overlay"), "true", "Root must have data-sih-overlay attribute");
  assert.strictEqual(root.style.pointerEvents, "none", "Root must have pointer-events: none");

  const box = document.getElementById("sih-agent-overlay-box");
  assert(box, "#sih-agent-overlay-box must exist");
  assert.strictEqual(box.style.pointerEvents, "none", "Box must have pointer-events: none");

  const card = document.getElementById("sih-agent-overlay-card");
  assert(card, "#sih-agent-overlay-card must exist");
  assert(card.innerHTML.includes("AGENT TARGET"), "Card must display 'AGENT TARGET'");
  assert(card.innerHTML.includes("CLICK"), "Card must display action 'CLICK'");
  assert(card.innerHTML.includes("Search"), "Card must display target 'Search'");
  assert(card.innerHTML.includes("0.98"), "Card must display confidence '0.98'");
  assert(card.innerHTML.includes("local-fuzzy-match"), "Card must display method 'local-fuzzy-match'");
  console.log("  ✓ GROUNDED state correctly initialized in DOM.\n");

  // Test 3: EXECUTING state update
  console.log("[TEST 3] updateAgentOverlay transitions to 'EXECUTING'");
  content.updateAgentOverlay({
    state: "EXECUTING",
    action: "CLICK",
    target: "Search button"
  });

  const executingCard = document.getElementById("sih-agent-overlay-card");
  assert(executingCard.innerHTML.includes("EXECUTING"), "Card must display 'EXECUTING'");
  assert(executingCard.innerHTML.includes("CLICK"), "Card must display action 'CLICK'");
  assert(executingCard.innerHTML.includes("Search"), "Card must display target");
  assert(!executingCard.innerHTML.includes("Confidence:"), "EXECUTING state should omit confidence row");
  console.log("  ✓ EXECUTING state correctly displayed.\n");

  // Test 4: VERIFIED state update
  console.log("[TEST 4] updateAgentOverlay transitions to 'VERIFIED'");
  content.updateAgentOverlay({
    state: "VERIFIED",
    action: "CLICK",
    target: "Search button"
  });

  const verifiedCard = document.getElementById("sih-agent-overlay-card");
  assert(verifiedCard.innerHTML.includes("VERIFIED"), "Card must display 'VERIFIED'");
  assert(verifiedCard.innerHTML.includes("CLICK"), "Card must display action 'CLICK'");
  assert(box.style.border.includes("10b981") || box.style.border.includes("16, 185, 129"), "Box must display emerald border");
  console.log("  ✓ VERIFIED state correctly displayed.\n");

  // Test 5: SAFETY_BLOCKED state update
  console.log("[TEST 5] updateAgentOverlay transitions to 'SAFETY BLOCKED'");
  content.updateAgentOverlay({
    state: "SAFETY_BLOCKED",
    action: "SUBMIT",
    target: "Submit Form",
    reason: "Consequential action requires explicit human approval"
  });

  const blockedCard = document.getElementById("sih-agent-overlay-card");
  assert(blockedCard.innerHTML.includes("SAFETY BLOCKED"), "Card must display 'SAFETY BLOCKED'");
  assert(blockedCard.innerHTML.includes("Consequential action requires explicit human approval"), "Card must display rejection reason");
  assert(box.style.border.includes("ef4444") || box.style.border.includes("239, 68, 68"), "Box must display red border");
  console.log("  ✓ SAFETY BLOCKED state correctly displayed.\n");

  // Test 6: Perception Isolation
  console.log("[TEST 6] Verifying overlay is completely ignored by perception");
  assert.strictEqual(content.classifyVisualElement(root), null, "Root must not be classified as a visual element");
  assert.strictEqual(content.classifyVisualElement(box), null, "Box must not be classified as a visual element");
  assert.strictEqual(content.classifyVisualElement(card), null, "Card must not be classified as a visual element");
  console.log("  ✓ Perception isolation verified: overlay is completely invisible to perception.\n");

  // Test 7: Clean teardown
  console.log("[TEST 7] clearAgentOverlay removes all overlay elements cleanly");
  content.clearAgentOverlay();
  assert.strictEqual(document.getElementById("sih-agent-overlay-root"), null, "Root must be removed from DOM");
  assert.strictEqual(document.getElementById("sih-agent-overlay-box"), null, "Box must be removed from DOM");
  assert.strictEqual(document.getElementById("sih-agent-overlay-card"), null, "Card must be removed from DOM");
  console.log("  ✓ Teardown verified: DOM cleanly restored.\n");

  console.log("============================================================");
  console.log("ALL M18 LIVE EXPLAINABLE AGENT OVERLAY TESTS PASSED!");
  console.log("============================================================");
}

runTests();
