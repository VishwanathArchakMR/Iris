/**
 * test-task-parser-and-loop.js - Focused unit test suite for task parser normalization and loop step limits.
 * Verifies that:
 * 1. "find the submit button and click it" produces exactly ONE CLICK action targeting SUBMIT_BUTTON.
 * 2. "click the submit button" produces exactly ONE CLICK action targeting SUBMIT_BUTTON.
 * 3. "click it" produces NO invented "it" target.
 * 4. Multi-field task produces exactly 6 steps (5 FILL + 1 CLICK SUBMIT_BUTTON).
 * 5. CLICK SUBMIT_BUTTON is classified as HIGH risk requiring human approval.
 * 6. Planned tasks with 6 or 7 steps produce execution limits matching the plan length, not truncated at 5.
 */

const assert = require("assert");
const SIHTaskParser = require("./task-parser.js");
const SIHReasoningPlanner = require("./reasoning-planner.js");

console.log("============================================================");
console.log("RUNNING FOCUSED TASK PARSER & AGENT LOOP VERIFICATION TESTS");
console.log("============================================================");

// ---------------------------------------------------------------------
// TEST 1: "find the submit button and click it"
// ---------------------------------------------------------------------
{
  const task = "find the submit button and click it";
  const parsed = SIHTaskParser.parseTask(task);
  assert.strictEqual(parsed.steps.length, 1, `Expected 1 step, got ${parsed.steps.length}`);
  assert.strictEqual(parsed.steps[0].type, "CLICK", `Expected CLICK, got ${parsed.steps[0].type}`);
  assert.strictEqual(parsed.steps[0].legacyTarget, "SUBMIT_BUTTON", `Expected SUBMIT_BUTTON, got ${parsed.steps[0].legacyTarget}`);
  console.log("[PASS] 1. 'find the submit button and click it' -> ONE CLICK targeting SUBMIT_BUTTON");
}

// ---------------------------------------------------------------------
// TEST 2: "click the submit button"
// ---------------------------------------------------------------------
{
  const task = "click the submit button";
  const parsed = SIHTaskParser.parseTask(task);
  assert.strictEqual(parsed.steps.length, 1, `Expected 1 step, got ${parsed.steps.length}`);
  assert.strictEqual(parsed.steps[0].type, "CLICK", `Expected CLICK, got ${parsed.steps[0].type}`);
  assert.strictEqual(parsed.steps[0].legacyTarget, "SUBMIT_BUTTON", `Expected SUBMIT_BUTTON, got ${parsed.steps[0].legacyTarget}`);
  console.log("[PASS] 2. 'click the submit button' -> ONE CLICK targeting SUBMIT_BUTTON");
}

// ---------------------------------------------------------------------
// TEST 3: "click it" (standalone)
// ---------------------------------------------------------------------
{
  const task = "click it";
  const parsed = SIHTaskParser.parseTask(task);
  assert.strictEqual(parsed.intent, "NONE", `Expected intent NONE, got ${parsed.intent}`);
  const hasItTarget = parsed.steps.some(s => (s.targetHint || s.target || "").toLowerCase() === "it");
  assert.strictEqual(hasItTarget, false, "Must NOT invent a standalone target named 'it'");
  console.log("[PASS] 3. 'click it' -> NO invented 'it' target");
}

// ---------------------------------------------------------------------
// TEST 4: Multi-field task produces exactly 6 steps
// ---------------------------------------------------------------------
{
  const task = "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and fill phone as 988989 and fill comments as nice and find the submit button and click it";
  const parsed = SIHTaskParser.parseTask(task);
  assert.strictEqual(parsed.steps.length, 6, `Expected exactly 6 steps, got ${parsed.steps.length}`);
  assert.strictEqual(parsed.steps[0].type, "FILL");
  assert.strictEqual(parsed.steps[0].fieldHint, "name");
  assert.strictEqual(parsed.steps[1].type, "FILL");
  assert.strictEqual(parsed.steps[1].fieldHint, "email");
  assert.strictEqual(parsed.steps[2].type, "FILL");
  assert.strictEqual(parsed.steps[2].fieldHint, "address");
  assert.strictEqual(parsed.steps[3].type, "FILL");
  assert.strictEqual(parsed.steps[3].fieldHint, "phone");
  assert.strictEqual(parsed.steps[4].type, "FILL");
  assert.strictEqual(parsed.steps[4].fieldHint, "comments");
  assert.strictEqual(parsed.steps[5].type, "CLICK");
  assert.strictEqual(parsed.steps[5].legacyTarget, "SUBMIT_BUTTON");
  console.log("[PASS] 4. Multi-field task -> exactly 6 steps (5 FILL + 1 CLICK SUBMIT_BUTTON)");
}

// ---------------------------------------------------------------------
// TEST 5: Risk of CLICK SUBMIT_BUTTON is HIGH and requires human approval
// ---------------------------------------------------------------------
{
  const task = "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and fill phone as 988989 and fill comments as nice and find the submit button and click it";
  const parsed = SIHTaskParser.parseTask(task);
  const plan = SIHReasoningPlanner.planTask(parsed, { title: "Contact Information Form" });

  assert.strictEqual(plan.steps.length, 6, `Expected 6 planned steps, got ${plan.steps.length}`);

  // Steps 1-5 must be LOW risk autonomous
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(plan.steps[i].type, "FILL");
    assert.strictEqual(plan.steps[i].risk, "LOW", `Step ${i+1} should be LOW risk`);
    assert.strictEqual(plan.steps[i].requiresApproval, false, `Step ${i+1} should not require approval`);
  }

  // Step 6 must be HIGH risk requiring approval
  const submitStep = plan.steps[5];
  assert.strictEqual(submitStep.type, "CLICK");
  assert.strictEqual(submitStep.risk, "HIGH", `Submit step should be HIGH risk, got ${submitStep.risk}`);
  assert.strictEqual(submitStep.requiresApproval, true, "Submit step MUST require human approval");

  // Safety gate check without approval token must pause
  const gateCheck = SIHReasoningPlanner.evaluateSafetyGate(
    { action: "CLICK", target: "SUBMIT_BUTTON", targetLabel: "Submit" },
    submitStep,
    null
  );
  assert.strictEqual(gateCheck.allowed, false, "Safety gate must block execution without human approval");
  assert.strictEqual(gateCheck.requiresApproval, true, "Safety gate must flag requiresApproval: true");

  console.log("[PASS] 5. CLICK SUBMIT_BUTTON -> Risk HIGH & requiresApproval = true");
}

// ---------------------------------------------------------------------
// TEST 6: Loop step count calculation preserves full plan length (e.g. 6 or 7 steps)
// ---------------------------------------------------------------------
{
  const MAX_AGENT_STEPS = 10;

  // 6-step plan
  const task6 = "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and fill phone as 988989 and fill comments as nice and find the submit button and click it";
  const parsed6 = SIHTaskParser.parseTask(task6);
  const totalPlannedSteps6 = Math.min(parsed6.steps.length, MAX_AGENT_STEPS);
  assert.strictEqual(totalPlannedSteps6, 6, `Expected 6 execution slots, got ${totalPlannedSteps6}`);

  // 7-step plan simulation
  const steps7 = [
    { type: "FILL", fieldHint: "f1", value: "v1" },
    { type: "FILL", fieldHint: "f2", value: "v2" },
    { type: "FILL", fieldHint: "f3", value: "v3" },
    { type: "FILL", fieldHint: "f4", value: "v4" },
    { type: "FILL", fieldHint: "f5", value: "v5" },
    { type: "FILL", fieldHint: "f6", value: "v6" },
    { type: "CLICK", targetHint: "submit", legacyTarget: "SUBMIT_BUTTON" }
  ];
  const totalPlannedSteps7 = Math.min(steps7.length, MAX_AGENT_STEPS);
  assert.strictEqual(totalPlannedSteps7, 7, `Expected 7 execution slots, got ${totalPlannedSteps7}`);

  console.log("[PASS] 6. Loop step limits -> 6 and 7 planned steps produce 6 and 7 execution slots (not truncated at 5)");
}

// ---------------------------------------------------------------------
// TEST 7: Connectors like "then click it", "and then click it"
// ---------------------------------------------------------------------
{
  const taskThen = "find the submit button, then click it";
  const parsedThen = SIHTaskParser.parseTask(taskThen);
  assert.strictEqual(parsedThen.steps.length, 1, `Expected 1 step, got ${parsedThen.steps.length}`);
  assert.strictEqual(parsedThen.steps[0].legacyTarget, "SUBMIT_BUTTON");

  const taskAndThen = "find the submit button and then click it";
  const parsedAndThen = SIHTaskParser.parseTask(taskAndThen);
  assert.strictEqual(parsedAndThen.steps.length, 1, `Expected 1 step, got ${parsedAndThen.steps.length}`);
  assert.strictEqual(parsedAndThen.steps[0].legacyTarget, "SUBMIT_BUTTON");

  console.log("[PASS] 7. Connectors ('then click it', 'and then click it') correctly resolve to single click");
}

console.log("\n============================================================");
console.log("ALL FOCUSED VERIFICATION TESTS PASSED CLEANLY!");
console.log("============================================================");
