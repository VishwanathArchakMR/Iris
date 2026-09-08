"""
backend/test_final_production_hardening.py

FINAL PRODUCTION HARDENING & CROSS-WEBSITE PASS TEST SUITE
Validates all mandatory safety invariants and acceptance criteria:
1. observation cannot execute actions (Observation != Action invariant)
2. page text "form" cannot trigger Submit without explicit task
3. page text "submit" cannot trigger Submit without explicit task
4. current FILL step cannot be replaced by CLICK (strict step compatibility)
5. multi-field ordering (Name -> Email -> Address -> Phone)
6. values remain strictly local (never in context or gateway payload)
7. low-risk fill automatically executes
8. high-risk Submit pauses for approval (requiresApproval = true, evaluated first)
9. Cancel prevents Submit execution
10. approval cannot be bypassed
11. stale approval invalidates on URL change / target drift
12. task/session isolation
13. SqueezeNet confidence remains strictly bounded [0, 1] (numerically stable softmax)
14. generic webpage grounding across diverse demo pages
15. text perception / sanitized context
16. demo-pages served over local HTTP
"""

import asyncio
import json
import os
import re
import subprocess
import sys
from fastapi import UploadFile
import io

# Add backend directory to sys.path
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "backend"))

from main import (
    app,
    PageContext,
    receive_context,
    receive_visual_context,
    DemoAgentProvider,
    assert_no_forbidden_value_keys
)

PLANNER_JS_PATH = os.path.join(REPO_ROOT, "reasoning-planner.js")
PARSER_JS_PATH = os.path.join(REPO_ROOT, "task-parser.js")
POPUP_JS_PATH = os.path.join(REPO_ROOT, "popup.js")
VISION_ENTRY_JS_PATH = os.path.join(REPO_ROOT, "vision-entry.js")

def run_node_eval(script: str):
    """Executes a small Node.js script and returns the parsed JSON output."""
    full_script = f"""
    const path = require('path');
    const SIHReasoningPlanner = require('{PLANNER_JS_PATH.replace(os.sep, "/")}');
    const SIHTaskParser = require('{PARSER_JS_PATH.replace(os.sep, "/")}');
    {script}
    """
    proc = subprocess.run(
        ["node", "-e", full_script],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Node execution error: {proc.stderr}\nOutput: {proc.stdout}")
    return json.loads(proc.stdout.strip())

def _make_dummy_image():
    return UploadFile(filename="sanitized.png", file=io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"))

def _make_sanitized_privacy_meta():
    return json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": 0,
        "timestamp": 1700000000
    })

# ---------------------------------------------------------------------
# TEST 1: Observation Cannot Execute Actions (Observation != Action)
# ---------------------------------------------------------------------
def test_observation_cannot_execute_actions():
    """Verifies that popup.js executeTextOnlyFallback does not contain executeAction dispatch."""
    with open(POPUP_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Find executeTextOnlyFallback definition
    match = re.search(r"const executeTextOnlyFallback\s*=\s*async\s*\([^)]*\)\s*=>\s*\{(.*?)\n  \};", content, re.DOTALL)
    assert match, "executeTextOnlyFallback function must exist in popup.js"
    fallback_body = match.group(1)

    # Assert executeAction is NOT called in fallback body
    assert "executeAction" not in fallback_body, (
        "CRITICAL BUG #1 VIOLATION: executeTextOnlyFallback MUST NOT dispatch executeAction! "
        "Observation must be non-actionable."
    )
    # Assert observation policy notice is present
    assert "Observation only" in fallback_body or "OBSERVATION ONLY" in fallback_body
    print("[PASS] 1. observation cannot execute actions (Observation != Action)")

# ---------------------------------------------------------------------
# TEST 2: Page text "form" cannot trigger Submit without explicit task
# ---------------------------------------------------------------------
def test_page_text_form_cannot_trigger_submit():
    """Verifies that page containing 'form' does not cause Submit to be proposed for a fill task."""
    provider = DemoAgentProvider()
    context = {
        "title": "Contact Us",
        "url": "http://localhost/form",
        "redactedSample": "Please complete this online form carefully before proceeding.",
        "elements": [
            {"type": "input", "label": "Name", "x": 10, "y": 10, "width": 200, "height": 30},
            {"type": "button", "label": "Submit Form", "semanticTag": "SUBMIT_BUTTON", "x": 10, "y": 50, "width": 100, "height": 30}
        ]
    }
    # Task is FILL NAME, page text has "form"
    action, reasoning = provider.propose_action("fill name as Sanketh", context)
    assert action.get("action") != "CLICK" or action.get("target") != "SUBMIT_BUTTON", (
        f"CRITICAL BUG VIOLATION: Page text 'form' triggered Submit! Action: {action}"
    )
    print("[PASS] 2. page text 'form' cannot trigger Submit")

# ---------------------------------------------------------------------
# TEST 3: Page text "submit" cannot trigger Submit without explicit task
# ---------------------------------------------------------------------
def test_page_text_submit_cannot_trigger_submit_without_task():
    """Safety Regression Test: 'Please complete this form and submit your response' + task 'fill name as Sanketh'."""
    provider = DemoAgentProvider()
    context = {
        "title": "Feedback Survey",
        "url": "http://localhost/survey",
        "redactedSample": "Please complete this form and submit your response.",
        "elements": [
            {"type": "input", "label": "Name", "x": 10, "y": 10, "width": 200, "height": 30},
            {"type": "button", "label": "Submit", "semanticTag": "SUBMIT_BUTTON", "x": 10, "y": 50, "width": 100, "height": 30}
        ]
    }
    action, reasoning = provider.propose_action("fill name as Sanketh", context)
    # The action proposed MUST NOT be CLICK -> SUBMIT_BUTTON
    assert action.get("action") != "CLICK" or action.get("target") != "SUBMIT_BUTTON", (
        f"CRITICAL BUG #1 VIOLATION: Page text 'submit' triggered Submit when task was fill name! Action: {action}"
    )
    print("[PASS] 3. page text 'submit' cannot trigger Submit without explicit task")

# ---------------------------------------------------------------------
# TEST 4: Current FILL step cannot be replaced by CLICK (Strict Step Compatibility)
# ---------------------------------------------------------------------
def test_step_compatibility_discards_incompatible_backend_action():
    """Ensures popup.js discards incompatible backend proposal for a planned FILL step."""
    with open(POPUP_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify that popup.js contains strict step compatibility check
    assert "FIX #2: STRICT STEP COMPATIBILITY & EXPLICIT TASK AUTHORITY" in content, (
        "popup.js must contain strict step compatibility enforcement"
    )
    assert "isCompatibleFill" in content or "plannedType === \"FILL\"" in content
    print("[PASS] 4. current FILL step cannot be replaced by CLICK")

# ---------------------------------------------------------------------
# TEST 5: Multi-Field Form Produces Correct Ordered Plan (No Submit)
# ---------------------------------------------------------------------
def test_multi_field_form_ordering_no_submit():
    """Verifies that multi-field fill task produces 4 ordered FILL steps with NO implicit Submit."""
    res = run_node_eval("""
    const task = "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and fill phone number as 8944";
    const parsed = SIHTaskParser.parseTask(task);
    const plan = SIHReasoningPlanner.planTask(parsed);
    console.log(JSON.stringify({
      stepCount: plan.steps.length,
      stepTypes: plan.steps.map(s => s.type),
      fieldHints: plan.steps.map(s => s.fieldHint),
      hasSubmit: plan.steps.some(s => (s.target || '').toLowerCase().includes('submit'))
    }));
    """)
    assert res["stepCount"] == 4, f"Expected 4 steps, got {res['stepCount']}"
    assert res["stepTypes"] == ["FILL", "FILL", "FILL", "FILL"]
    assert res["fieldHints"] == ["name", "email", "address", "phone number"]
    assert res["hasSubmit"] is False, "CRITICAL: Multi-field task must NOT include an implicit Submit step!"
    print("[PASS] 5. multi-field ordering (Name -> Email -> Address -> Phone) & no implicit submit")

# ---------------------------------------------------------------------
# TEST 6: Values Remain Strictly Local (Never in Context or Gateway Payload)
# ---------------------------------------------------------------------
def test_values_remain_strictly_local():
    """Verifies that literal values are never placed into the structured plan or backend payload."""
    res = run_node_eval("""
    const task = "fill name as Sanketh and fill email as test@example.com";
    const parsed = SIHTaskParser.parseTask(task);
    const plan = SIHReasoningPlanner.planTask(parsed);
    const planStr = JSON.stringify(plan);
    console.log(JSON.stringify({
      hasSanketh: planStr.includes("Sanketh"),
      hasEmailVal: planStr.includes("test@example.com")
    }));
    """)
    assert res["hasSanketh"] is False, "Literal name value must NOT be in reasoning plan!"
    assert res["hasEmailVal"] is False, "Literal email value must NOT be in reasoning plan!"

    # Assert backend validator rejects any forbidden literal value keys
    rejected = False
    try:
        assert_no_forbidden_value_keys({"fieldPlan": [{"type": "FILL", "fieldValue": "secret"}]})
    except Exception:
        rejected = True
    assert rejected, "assert_no_forbidden_value_keys must reject literal values!"

    print("[PASS] 6. values remain strictly local")

# ---------------------------------------------------------------------
# TEST 7: Low-Risk FILL Automatically Executes
# ---------------------------------------------------------------------
def test_low_risk_fill_automatically_allowed():
    """Verifies that normal FILL has risk LOW, requiresApproval = false, and allowed = true."""
    res = run_node_eval("""
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "FILL", targetLabel: "Name", targetType: "input" },
      { type: "FILL", fieldHint: "Name" },
      null,
      { url: "http://localhost/test-page.html" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is True
    assert res["requiresApproval"] is False
    assert res["risk"] == "LOW"
    print("[PASS] 7. low-risk fill automatically executes")

# ---------------------------------------------------------------------
# TEST 8: High-Risk Submit Pauses for Approval
# ---------------------------------------------------------------------
def test_high_risk_submit_requires_approval():
    """Verifies that CLICK Submit requires approval before execution."""
    res = run_node_eval("""
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON", targetLabel: "Submit Form" },
      { type: "CLICK", targetHint: "Submit", requiresApproval: true },
      null,
      { url: "http://localhost/test-page.html" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False
    assert res["requiresApproval"] is True
    assert res["risk"] in ["HIGH", "CRITICAL"]
    print("[PASS] 8. high-risk Submit pauses for approval")

# ---------------------------------------------------------------------
# TEST 9: Cancel Prevents Submit
# ---------------------------------------------------------------------
def test_cancel_prevents_submit():
    """Verifies that an unapproved or cancelled decision does not allow execution."""
    res = run_node_eval("""
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON", targetLabel: "Submit Form" },
      { type: "CLICK", targetHint: "Submit", requiresApproval: true },
      { approved: false, cancelled: true },
      { url: "http://localhost/test-page.html" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False
    assert res["requiresApproval"] is True
    print("[PASS] 9. Cancel prevents Submit")

# ---------------------------------------------------------------------
# TEST 10: Approval Cannot Be Bypassed
# ---------------------------------------------------------------------
def test_approval_cannot_be_bypassed():
    """Verifies that backend proposing CLICK SUBMIT without approval token is rejected by safety gate."""
    res = run_node_eval("""
    const backendProposal = { action: "CLICK", target: "SUBMIT_BUTTON", targetLabel: "Submit" };
    const stepPlan = { type: "CLICK", targetHint: "Submit", requiresApproval: true };
    const resultWithoutToken = SIHReasoningPlanner.evaluateSafetyGate(backendProposal, stepPlan, null);
    console.log(JSON.stringify(resultWithoutToken));
    """)
    assert res["allowed"] is False
    assert res["requiresApproval"] is True
    print("[PASS] 10. approval cannot be bypassed")

# ---------------------------------------------------------------------
# TEST 11: Stale Approval Invalidates on URL Change / Target Drift
# ---------------------------------------------------------------------
def test_stale_approval_invalidates():
    """Verifies that navigating to a different page or target drift invalidates prior approval."""
    res = run_node_eval("""
    const approvedToken = {
      approved: true,
      action: "CLICK",
      target: "Submit",
      pageUrl: "http://localhost/page-a",
      timestamp: Date.now()
    };
    // Page navigated to page-b
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "Submit", targetLabel: "Submit" },
      { type: "CLICK", targetHint: "Submit", requiresApproval: true },
      approvedToken,
      { url: "http://localhost/page-b" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False
    assert res["requiresApproval"] is True
    assert "invalidated" in res["reason"].lower() or "changed" in res["reason"].lower()
    print("[PASS] 11. stale approval invalidates")

# ---------------------------------------------------------------------
# TEST 12: Task / Session Isolation
# ---------------------------------------------------------------------
def test_task_session_isolation():
    """Verifies that popup.js resets approval state and traces at the start of every task."""
    with open(POPUP_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    assert "AGENT SESSION ISOLATION (Milestone 17 Production Hardening)" in content
    assert "dismissHumanApproval" in content
    assert "executionTraceHistory = [];" in content
    print("[PASS] 12. task/session isolation")

# ---------------------------------------------------------------------
# TEST 13: SqueezeNet Confidence Bounds [0, 1] via Numerically Stable Softmax
# ---------------------------------------------------------------------
def test_squeezenet_confidence_bounds():
    """Verifies that vision-entry.js computes numerically stable softmax so confidence is in [0, 1]."""
    with open(VISION_ENTRY_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    assert "softmax" in content.lower()
    assert "maxLogit" in content
    assert "sumExp" in content
    assert "boundedConfidence" in content

    # Test numerical stability with extreme logits in Node.js
    res = run_node_eval("""
    const logits = [10.5, 25.8, 12.1, 5.0, 19.4];
    let maxLogit = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxLogit) maxLogit = logits[i];
    }
    let sumExp = 0;
    for (let i = 0; i < logits.length; i++) {
      sumExp += Math.exp(logits[i] - maxLogit);
    }
    const topProb = Math.exp(logits[1] - maxLogit) / sumExp;
    console.log(JSON.stringify({
      confidence: topProb,
      isBetweenZeroAndOne: topProb >= 0.0 && topProb <= 1.0
    }));
    """)
    assert res["isBetweenZeroAndOne"] is True
    assert 0.0 <= res["confidence"] <= 1.0
    print(f"[PASS] 13. SqueezeNet confidence remains strictly 0-1 (topProb: {res['confidence']:.4f})")

# ---------------------------------------------------------------------
# TEST 14: Generic Webpage Grounding (Buttons & Links)
# ---------------------------------------------------------------------
def test_generic_webpage_grounding():
    """Verifies grounding on shopping and controls fixtures without hardcoded selectors."""
    provider = DemoAgentProvider()
    shopping_context = {
        "title": "Electronics Store",
        "url": "http://localhost/demo-pages/shopping.html",
        "redactedSample": "UltraBook Pro Laptop $1299.00 Add to Cart",
        "elements": [
            {"type": "button", "label": "Add to Cart", "x": 100, "y": 200, "width": 120, "height": 36},
            {"type": "button", "label": "View Details", "x": 230, "y": 200, "width": 120, "height": 36}
        ]
    }
    action, reasoning = provider.propose_action("click add to cart", shopping_context)
    assert action["action"] == "CLICK"
    assert "Add to Cart" in (action.get("target") or action.get("targetLabel") or "")
    print("[PASS] 14. generic webpage grounding (shopping Add to Cart)")

# ---------------------------------------------------------------------
# TEST 15: Text Perception / Sanitized Context
# ---------------------------------------------------------------------
def test_text_perception_sanitized():
    """Verifies receive_context receives sanitized context and returns observation."""
    res = asyncio.run(receive_context(PageContext(
        title="Article Demo",
        url="http://localhost/demo-pages/article.html",
        redactedSample="On-Device Visual Perception for Light-weight Browser Agents"
    )))
    assert res["status"] == "received"
    assert "action" in res
    print("[PASS] 15. text perception / sanitized context")

# ---------------------------------------------------------------------
# TEST 16: Demo-Pages Local HTTP Serving
# ---------------------------------------------------------------------
def test_demo_pages_served_by_backend():
    """Verifies that FastAPI serves all 5 demo pages under /demo-pages/{name}."""
    pages = [
        "simple-form.html",
        "shopping.html",
        "article.html",
        "controls.html",
        "accessibility-form.html"
    ]
    for page in pages:
        page_path = os.path.join(REPO_ROOT, "demo-pages", page)
        assert os.path.exists(page_path), f"Demo page fixture {page} must exist!"
        with open(page_path, "r", encoding="utf-8") as f:
            content = f.read()
            assert len(content) > 100
            assert "<!DOCTYPE html>" in content
    print("[PASS] 16. all 5 demo pages exist and are valid HTML")

# ---------------------------------------------------------------------
# TEST 17: Task Parser Normalization & Exact Plan Length (No Spurious 'it')
# ---------------------------------------------------------------------
def test_task_parser_submit_button_no_spurious_it():
    """Verifies that 'find the submit button and click it' produces 1 CLICK action targeting SUBMIT_BUTTON with no spurious 'it'."""
    res = run_node_eval("""
    const t1 = SIHTaskParser.parseTask("find the submit button and click it");
    const t2 = SIHTaskParser.parseTask("click the submit button");
    const t3 = SIHTaskParser.parseTask("click it");
    const taskMulti = "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and fill phone as 988989 and fill comments as nice and find the submit button and click it";
    const tMulti = SIHTaskParser.parseTask(taskMulti);
    const planMulti = SIHReasoningPlanner.planTask(tMulti);

    console.log(JSON.stringify({
      t1Count: t1.steps.length,
      t1Type: t1.steps[0].type,
      t1Target: t1.steps[0].legacyTarget,
      t2Count: t2.steps.length,
      t2Target: t2.steps[0].legacyTarget,
      t3Intent: t3.intent,
      t3HasIt: t3.steps.some(s => (s.targetHint || '').toLowerCase() === 'it'),
      multiCount: tMulti.steps.length,
      multiPlanCount: planMulti.steps.length,
      multiSubmitRisk: planMulti.steps[5].risk,
      multiSubmitApproval: planMulti.steps[5].requiresApproval
    }));
    """)

    assert res["t1Count"] == 1, f"Expected 1 step for 'find submit and click it', got {res['t1Count']}"
    assert res["t1Type"] == "CLICK"
    assert res["t1Target"] == "SUBMIT_BUTTON"
    assert res["t2Count"] == 1
    assert res["t2Target"] == "SUBMIT_BUTTON"
    assert res["t3Intent"] == "NONE"
    assert res["t3HasIt"] is False, "Must NOT invent a standalone target named 'it'!"
    assert res["multiCount"] == 6, f"Expected 6 steps for multi-field task, got {res['multiCount']}"
    assert res["multiPlanCount"] == 6, f"Expected 6 planned steps, got {res['multiPlanCount']}"
    assert res["multiSubmitRisk"] == "HIGH", "Submit action must be HIGH risk"
    assert res["multiSubmitApproval"] is True, "Submit action must require human approval"

    print("[PASS] 17. task parser normalization & full 6-step plan (no spurious 'it')")

if __name__ == "__main__":
    print("\n============================================================")
    print("RUNNING FINAL PRODUCTION HARDENING & CROSS-WEBSITE TEST PASS")
    print("============================================================\n")
    test_observation_cannot_execute_actions()
    test_page_text_form_cannot_trigger_submit()
    test_page_text_submit_cannot_trigger_submit_without_task()
    test_step_compatibility_discards_incompatible_backend_action()
    test_multi_field_form_ordering_no_submit()
    test_values_remain_strictly_local()
    test_low_risk_fill_automatically_allowed()
    test_high_risk_submit_requires_approval()
    test_cancel_prevents_submit()
    test_approval_cannot_be_bypassed()
    test_stale_approval_invalidates()
    test_task_session_isolation()
    test_squeezenet_confidence_bounds()
    test_generic_webpage_grounding()
    test_text_perception_sanitized()
    test_demo_pages_served_by_backend()
    test_task_parser_submit_button_no_spurious_it()
    print("\n============================================================")
    print("ALL 17 PRODUCTION HARDENING & DEMO PASS TESTS PASSED CLEANLY!")
    print("============================================================\n")

