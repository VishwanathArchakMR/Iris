/**
 * test-search-workflow.js
 * Automated verification suite for the SIH26171 M13 Cross-Website Robustness Patch.
 * Tests generic multi-stage search workflows:
 *   1. NL search task parsing (Google/DuckDuckGo/Bing/generic engines)
 *   2. Search plan generation with explicit SUBMIT step
 *   3. Autonomous LOW risk safety classification for search SUBMIT
 *   4. Precondition and postcondition verification for search steps
 *   5. Grounding and privacy boundary enforcement
 */

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

console.log("============================================================");
console.log("RUNNING M13 CROSS-WEBSITE SEARCH WORKFLOW TESTS");
console.log("============================================================");

// Load browser-like sandbox
const sandbox = {
  window: {},
  document: { title: "Google", location: { href: "https://www.google.com" } },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  performance: { now: () => Date.now() }
};
sandbox.window = sandbox;

const taskParserCode = fs.readFileSync("./task-parser.js", "utf-8");
vm.runInNewContext(taskParserCode, sandbox);

const reasoningPlannerCode = fs.readFileSync("./reasoning-planner.js", "utf-8");
vm.runInNewContext(reasoningPlannerCode, sandbox);

const TaskParser = sandbox.SIHTaskParser;
const Planner = sandbox.SIHReasoningPlanner;

assert(TaskParser, "SIHTaskParser must be loaded");
assert(Planner, "SIHReasoningPlanner must be loaded");

// TEST 1: Parsing "search for machine learning, then click the first result"
console.log("\n[TEST 1] Parsing 'search for machine learning, then click the first result'");
const task1 = TaskParser.parseTask("search for machine learning, then click the first result");
assert(task1.isMultiStep === true);
assert.strictEqual(task1.intent, "MULTI_STEP");
assert(Array.isArray(task1.steps), "Steps must be an array");
assert.strictEqual(task1.steps.length, 3, "Must have 3 steps: FILL search, SUBMIT, CLICK result");
assert.strictEqual(task1.steps[0].type, "FILL");
assert.strictEqual(task1.steps[0].value, "machine learning");
assert.strictEqual(task1.steps[1].type, "SUBMIT");
assert.strictEqual(task1.steps[1].query, "machine learning");
assert.strictEqual(task1.steps[2].type, "CLICK");
assert(task1.steps[2].query === "machine learning", "Click step must reference query for relevance");
console.log("  ✓ Correctly produced FILL -> SUBMIT -> CLICK result");

// TEST 2: Parsing "search for artificial intelligence"
console.log("\n[TEST 2] Parsing 'search for artificial intelligence'");
const task2 = TaskParser.parseTask("search for artificial intelligence");
assert(task2.isMultiStep === true);
assert.strictEqual(task2.intent, "MULTI_STEP");
assert.strictEqual(task2.steps.length, 2, "Must have FILL + SUBMIT");
assert.strictEqual(task2.steps[0].type, "FILL");
assert.strictEqual(task2.steps[0].value, "artificial intelligence");
assert.strictEqual(task2.steps[1].type, "SUBMIT");
assert.strictEqual(task2.steps[1].query, "artificial intelligence");
console.log("  ✓ Correctly produced FILL -> SUBMIT");

// TEST 3: Parsing "find the search box, fill machine learning, submit search and click the first result"
console.log("\n[TEST 3] Parsing 4-stage explicit search query");
const task3 = TaskParser.parseTask("find the search box, fill machine learning, submit search and click the first result");
assert(task3.steps.length >= 3, "Must have at least 3 steps");
const types3 = task3.steps.map(s => s.type);
assert(types3.includes("FILL"), "Must include FILL");
assert(types3.includes("SUBMIT"), "Must include SUBMIT");
assert(types3.includes("CLICK"), "Must include CLICK");
console.log("  ✓ Correctly recognized multi-step search stages: " + types3.join(" -> "));

// TEST 3b: User's exact task
console.log("\n[TEST 3b] User exact task: 'Find the search box, search for iPhone 15 and identify the most relevant product, open it, find the Add to Cart button, and click it.'");
const taskUser = TaskParser.parseTask("Find the search box, search for iPhone 15 and identify the most relevant product, open it, find the Add to Cart button, and click it.");
console.log("  Steps count:", taskUser.steps ? taskUser.steps.length : 0);
console.log("  Steps:", JSON.stringify(taskUser.steps, null, 2));
console.log("  localValues:", JSON.stringify(taskUser.localValues, null, 2));

// TEST 3c: Generic variation: wireless headphones
console.log("\n[TEST 3c] Generic task: 'Find the search box, search for wireless headphones, open the most relevant product, find the Add to Cart button, and click it.'");
const taskGeneric = TaskParser.parseTask("Find the search box, search for wireless headphones, open the most relevant product, find the Add to Cart button, and click it.");
console.log("  taskGeneric steps:", JSON.stringify(taskGeneric.steps, null, 2));
assert.strictEqual(taskGeneric.steps.length, 5);
assert.strictEqual(taskGeneric.steps[0].type, "CLICK");
assert.strictEqual(taskGeneric.steps[1].type, "FILL");
assert.strictEqual(taskGeneric.steps[1].value, "wireless headphones");
assert.strictEqual(taskGeneric.steps[2].type, "SUBMIT");
assert.strictEqual(taskGeneric.steps[3].type, "CLICK");
assert.strictEqual(taskGeneric.steps[3].query, "wireless headphones");
assert.strictEqual(taskGeneric.steps[4].type, "CLICK");
assert(taskGeneric.steps[4].targetHint.toLowerCase().includes("cart"));
console.log("  ✓ Generic variation correctly produced 5-stage sequential workflow with value 'wireless headphones'");
console.log("\n[TEST 4] Reasoning Planner planTask for search task");
const plan = Planner.planTask(task1, { title: "Google", url: "https://www.google.com" });
assert(plan, "Plan must be created");
assert(Array.isArray(plan.steps), "Plan must have steps");
assert.strictEqual(plan.steps.length, 3);
console.log("  Plan steps generated:");
plan.steps.forEach((s, idx) => {
  console.log(`    ${idx + 1}. [${s.type}] ${s.target || s.fieldHint || ""} -> Risk: ${s.risk}, Approval: ${s.requiresApproval}`);
});
console.log("  ✓ Reasoning plan correctly constructed");

// TEST 5: Risk classification for SUBMIT action
console.log("\n[TEST 5] Safety risk classification for SUBMIT");
const submitRisk = Planner.classifyActionRisk({ action: "SUBMIT", target: "search" });
assert.strictEqual(submitRisk.risk, "LOW", "Search SUBMIT must be LOW risk");
assert.strictEqual(submitRisk.requiresApproval, false, "Search SUBMIT must be autonomous (no approval required)");

const transactionalSubmitRisk = Planner.classifyActionRisk({ action: "SUBMIT", target: "checkout_order" });
assert.strictEqual(transactionalSubmitRisk.risk, "HIGH", "Financial SUBMIT must be HIGH risk");
assert.strictEqual(transactionalSubmitRisk.requiresApproval, true, "Financial SUBMIT requires approval");
console.log("  ✓ Search SUBMIT is autonomous LOW risk; financial SUBMIT is HIGH risk");

// TEST 6: Preconditions validation for search SUBMIT
console.log("\n[TEST 6] Preconditions check for search SUBMIT");
const submitStep = plan.steps[1];
const mockTraceBeforeFill = [];
const preCheck1 = Planner.validatePreconditions(submitStep, mockTraceBeforeFill);
assert.strictEqual(preCheck1.satisfied, false, "SUBMIT cannot precede query fill");

const mockTraceAfterFill = [
  { action: { action: "FILL" }, status: "success", executed: true }
];
const preCheck2 = Planner.validatePreconditions(submitStep, mockTraceAfterFill);
assert.strictEqual(preCheck2.satisfied, true, "SUBMIT is satisfied once query is filled");
console.log("  ✓ Preconditions correctly require query to be filled before SUBMIT");

// TEST 7: Postconditions verification for search SUBMIT
console.log("\n[TEST 7] Postconditions check for search SUBMIT");
const postCheckFail = Planner.verifyPostconditions(submitStep, { executed: false, reason: "Submission failed" });
assert.strictEqual(postCheckFail.verified, false, "Search submission must report failure if unexecuted");

const postCheckPass = Planner.verifyPostconditions(submitStep, { executed: true, action: "SUBMIT" }, { changed: true, reason: "Search results page loaded" });
assert.strictEqual(postCheckPass.verified, true, "Search submission verified when execution succeeds");
console.log("  ✓ Postconditions correctly verify search results execution and screen change");

// TEST 8: Privacy Boundary Verification
console.log("\n[TEST 8] Privacy Boundary Verification");
assert(task1.sanitizedPlan, "Task must contain sanitizedPlan");
const sanitizedStr = JSON.stringify(task1.sanitizedPlan);
assert(!sanitizedStr.includes("machine learning"), "sanitizedPlan MUST NEVER include literal search query values");
console.log("  ✓ Sanitized plan contains zero literal query values (kept strictly client-side)");

// TEST 9: Multi-Page Repeated Search Workflows (Cases B, C, D)
console.log("\n[TEST 9] Multi-Page Repeated Search Workflows");

// Case B: YouTube then KGF Kannada songs (8 steps)
const taskCaseB = "Find the search box and search for YouTube, select the most relevant result and open it, then find the search box in YouTube and search for KGF Kannada songs and click the most relevant result.";
const parsedCaseB = TaskParser.parseTask(taskCaseB);
assert.strictEqual(parsedCaseB.steps.length, 8, `Expected 8 steps for Case B, got ${parsedCaseB.steps.length}`);
assert.strictEqual(parsedCaseB.steps[0].type, "CLICK");
assert.strictEqual(parsedCaseB.steps[0].targetHint, "search box");
assert.strictEqual(parsedCaseB.steps[1].type, "FILL");
assert.strictEqual(parsedCaseB.steps[1].value, "YouTube");
assert.strictEqual(parsedCaseB.steps[2].type, "SUBMIT");
assert.strictEqual(parsedCaseB.steps[2].query, "YouTube");
assert.strictEqual(parsedCaseB.steps[3].type, "CLICK");
assert.strictEqual(parsedCaseB.steps[4].type, "CLICK");
assert.strictEqual(parsedCaseB.steps[4].targetHint, "search box");
assert.strictEqual(parsedCaseB.steps[5].type, "FILL");
assert.strictEqual(parsedCaseB.steps[5].value, "KGF Kannada songs");
assert.strictEqual(parsedCaseB.steps[6].type, "SUBMIT");
assert.strictEqual(parsedCaseB.steps[6].query, "KGF Kannada songs");
assert.strictEqual(parsedCaseB.steps[7].type, "CLICK");
assert.strictEqual(parsedCaseB.localValues[1], "YouTube");
assert.strictEqual(parsedCaseB.localValues[5], "KGF Kannada songs");
console.log("  ✓ Case B: 8 steps parsed with 'YouTube' and 'KGF Kannada songs' retained locally");

// Case C: Google then Artificial Intelligence (6 steps)
const taskCaseC = "search for Google, open the most relevant result, then search for artificial intelligence and click the first result";
const parsedCaseC = TaskParser.parseTask(taskCaseC);
assert.strictEqual(parsedCaseC.steps.length, 6, `Expected 6 steps for Case C, got ${parsedCaseC.steps.length}`);
assert.strictEqual(parsedCaseC.steps[0].value, "Google");
assert.strictEqual(parsedCaseC.steps[3].value, "artificial intelligence");
console.log("  ✓ Case C: 2 sequential search workflows (6 steps total)");

// Case D: Wireless headphones then laptop bags (6 steps)
const taskCaseD = "search for wireless headphones, open the most relevant product, then search for laptop bags and click the most relevant result";
const parsedCaseD = TaskParser.parseTask(taskCaseD);
assert.strictEqual(parsedCaseD.steps.length, 6, `Expected 6 steps for Case D, got ${parsedCaseD.steps.length}`);
assert.strictEqual(parsedCaseD.steps[0].value, "wireless headphones");
assert.strictEqual(parsedCaseD.steps[3].value, "laptop bags");
console.log("  ✓ Case D: 2 sequential shopping search workflows (6 steps total)");

console.log("\n============================================================");
console.log("ALL M13 SEARCH WORKFLOW TESTS PASSED CLEANLY!");
console.log("============================================================");
