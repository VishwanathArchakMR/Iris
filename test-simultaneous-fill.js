/**
 * test-simultaneous-fill.js — Node verification for Simultaneous Form Autofill
 * SIH26171: On-device Visual Perception for Lightweight Browser Agents
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { parseTask } = require("./task-parser.js");
const { planTask, classifyActionRisk } = require("./reasoning-planner.js");
const {
  getFormProfile,
  setFormProfile,
  resetFormProfile,
  matchFieldToProfile,
  getSimultaneousFormFillPlan
} = require("./form-profile.js");

console.log("============================================================");
console.log("RUNNING SIMULTANEOUS FORM AUTOFILL TESTS");
console.log("============================================================");

// Test 1: Verify form-profile.json file exists and is valid JSON
const profileJsonPath = path.join(__dirname, "form-profile.json");
assert(fs.existsSync(profileJsonPath), "form-profile.json must exist");
const profileJson = JSON.parse(fs.readFileSync(profileJsonPath, "utf8"));
assert(profileJson.name || profileJson.fullName, "Profile must have name");
assert(profileJson.email, "Profile must have email");
assert(profileJson.phone, "Profile must have phone");
assert(profileJson.address, "Profile must have address");
console.log("[PASS] 1. form-profile.json exists and is valid with name, email, phone, address, comments");

// Test 2: Verify form-profile.js helper functions
const defaultProf = getFormProfile();
assert.strictEqual(defaultProf.email, "sanketh@example.com");

const matchedName = matchFieldToProfile({ label: "Full Name", type: "input" });
assert(matchedName && matchedName.key === "fullName", "Should match fullName");

const matchedEmail = matchFieldToProfile({ label: "Email Address", type: "input" });
assert(matchedEmail && matchedEmail.key === "email", "Should match email");

const matchedPhone = matchFieldToProfile({ label: "Contact Phone Number", type: "input" });
assert(matchedPhone && matchedPhone.key === "phone", "Should match phone");

const matchedComments = matchFieldToProfile({ label: "Questions or Comments", type: "textarea" });
assert(matchedComments && matchedComments.key === "comments", "Should match comments");
console.log("[PASS] 2. form-profile.js matches field labels to profile keys with semantic tolerance");

// Test 3: getSimultaneousFormFillPlan on visual elements
const mockElements = [
  { index: 0, type: "input", label: "Full Name", disabled: false },
  { index: 1, type: "input", label: "Email Address", disabled: false },
  { index: 2, type: "input", label: "Phone", disabled: false },
  { index: 3, type: "input", label: "Organization", disabled: false },
  { index: 4, type: "input", label: "Street Address", disabled: false },
  { index: 5, type: "input", label: "City", disabled: false },
  { index: 6, type: "input", label: "Zip Code", disabled: false },
  { index: 7, type: "textarea", label: "Comments", disabled: false },
  { index: 8, type: "input", label: "Password", inputType: "password", disabled: false },
  { index: 9, type: "button", label: "Submit Registration", disabled: false }
];

const simultaneousPlan = getSimultaneousFormFillPlan(mockElements, defaultProf);
assert.strictEqual(simultaneousPlan.length, 8, "Should create fill plan for 8 non-password fields");
assert(!simultaneousPlan.some(p => p.fieldKey === "password" || /password/i.test(p.targetLabel)), "Must never plan password fill");
console.log("[PASS] 3. getSimultaneousFormFillPlan maps all 8 matching fields and skips password");

// Test 4: Task Parser 'fill the form' produces FILL_FORM step
const parsedFillForm = parseTask("fill the form");
assert.strictEqual(parsedFillForm.intent, "FILL_FORM");
assert.strictEqual(parsedFillForm.steps.length, 1);
assert.strictEqual(parsedFillForm.steps[0].type, "FILL_FORM");
assert.strictEqual(parsedFillForm.steps[0].simultaneous, true);
console.log("[PASS] 4. parseTask('fill the form') -> intent FILL_FORM with simultaneous: true");

// Test 5: Task Parser 'fill the form, then click submit' produces 2 steps (FILL_FORM + CLICK)
const parsedFillThenSubmit = parseTask("fill the form, then click submit");
assert.strictEqual(parsedFillThenSubmit.intent, "MULTI_STEP");
assert.strictEqual(parsedFillThenSubmit.steps.length, 2);
assert.strictEqual(parsedFillThenSubmit.steps[0].type, "FILL_FORM");
assert.strictEqual(parsedFillThenSubmit.steps[1].type, "CLICK");
assert.strictEqual(parsedFillThenSubmit.steps[1].legacyTarget, "SUBMIT_BUTTON");
console.log("[PASS] 5. parseTask('fill the form, then click submit') -> 2 steps (FILL_FORM + CLICK SUBMIT_BUTTON)");

// Test 6: Reasoning Planner handles FILL_FORM with LOW risk (Autonomous)
const reasoningPlan = planTask(parsedFillForm, { title: "Test Form", url: "http://localhost/test" });
assert.strictEqual(reasoningPlan.steps.length, 1);
assert.strictEqual(reasoningPlan.steps[0].type, "FILL_FORM");
assert.strictEqual(reasoningPlan.steps[0].risk, "LOW");
assert.strictEqual(reasoningPlan.steps[0].requiresApproval, false);
console.log("[PASS] 6. Reasoning Planner classifies FILL_FORM as LOW risk (Autonomous, no approval required)");

// Test 7: Reasoning Planner with Composite Submit Plan enforces Submit Approval
const compositeReasoningPlan = planTask(parsedFillThenSubmit, { title: "Test Form", url: "http://localhost/test" });
assert.strictEqual(compositeReasoningPlan.steps.length, 2);
assert.strictEqual(compositeReasoningPlan.steps[0].type, "FILL_FORM");
assert.strictEqual(compositeReasoningPlan.steps[0].requiresApproval, false);
assert.strictEqual(compositeReasoningPlan.steps[1].type, "CLICK");
assert.strictEqual(compositeReasoningPlan.steps[1].requiresApproval, true);
console.log("[PASS] 7. Composite Plan: FILL_FORM is autonomous, while final SUBMIT requires human approval");

// Test 8: Variations of form filling phrasing
const variations = [
  "fill form",
  "fill this form",
  "autofill form",
  "autofill the form",
  "fill all fields",
  "fill all details",
  "fill form simultaneously",
  "fill the registration form",
  "fill the contact form"
];

for (const v of variations) {
  const p = parseTask(v);
  assert(p.intent === "FILL_FORM" || (p.steps && p.steps[0] && p.steps[0].type === "FILL_FORM"), `Variation '${v}' must parse to FILL_FORM`);
}
console.log(`[PASS] 8. All ${variations.length} form filling phrasing variations parse to FILL_FORM`);

console.log("============================================================");
console.log("ALL SIMULTANEOUS FORM AUTOFILL TESTS PASSED CLEANLY!");
console.log("============================================================");
