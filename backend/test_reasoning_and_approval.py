"""
backend/test_reasoning_and_approval.py
Comprehensive test suite for Local Reasoning & Safety Planner and Human-in-the-loop Approval.

Validates the 15 mandatory test cases:
1. low-risk FILL does not require approval
2. high-risk Submit requires approval
3. Delete requires approval
4. Send requires approval
5. Purchase requires approval
6. Cancel stops execution
7. approval cannot be bypassed
8. stale approval is invalidated after page change
9. target change invalidates approval
10. multi-field form produces correct ordered plan
11. sanitized plan contains no literal values
12. reasoning plan does not expose literal values
13. backend cannot bypass local safety gate
14. Submit executes only after approval
15. identical stale actions remain protected
"""

import subprocess
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANNER_JS_PATH = os.path.join(REPO_ROOT, "reasoning-planner.js")
PARSER_JS_PATH = os.path.join(REPO_ROOT, "task-parser.js")

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

# 1. low-risk FILL does not require approval
def test_low_risk_fill_does_not_require_approval():
    res = run_node_eval("""
    const risk = SIHReasoningPlanner.classifyActionRisk(
      { action: "FILL", targetLabel: "Full Name", targetType: "input" },
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(risk));
    """)
    assert res["risk"] == "LOW", f"Expected LOW risk, got {res['risk']}"
    assert res["requiresApproval"] is False, "Low-risk FILL should not require approval"
    print("[PASS] 1. low-risk FILL does not require approval")

# 2. high-risk Submit requires approval
def test_high_risk_submit_requires_approval():
    res = run_node_eval("""
    const risk = SIHReasoningPlanner.classifyActionRisk(
      { action: "CLICK", target: "SUBMIT_BUTTON", targetLabel: "Submit Form" },
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(risk));
    """)
    assert res["risk"] == "HIGH", f"Expected HIGH risk, got {res['risk']}"
    assert res["requiresApproval"] is True, "Submit action must require approval"
    print("[PASS] 2. high-risk Submit requires approval")

# 3. Delete requires approval
def test_delete_requires_approval():
    res = run_node_eval("""
    const risk = SIHReasoningPlanner.classifyActionRisk(
      { action: "CLICK", targetLabel: "Delete Account", targetType: "button" },
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(risk));
    """)
    assert res["risk"] in ["HIGH", "CRITICAL"], f"Expected HIGH or CRITICAL, got {res['risk']}"
    assert res["requiresApproval"] is True, "Delete action must require approval"
    print("[PASS] 3. Delete requires approval")

# 4. Send requires approval
def test_send_requires_approval():
    res = run_node_eval("""
    const risk = SIHReasoningPlanner.classifyActionRisk(
      { action: "CLICK", targetLabel: "Send Message", targetType: "button" },
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(risk));
    """)
    assert res["risk"] == "HIGH", f"Expected HIGH, got {res['risk']}"
    assert res["requiresApproval"] is True, "Send action must require approval"
    print("[PASS] 4. Send requires approval")

# 5. Purchase requires approval
def test_purchase_requires_approval():
    res = run_node_eval("""
    const risk = SIHReasoningPlanner.classifyActionRisk(
      { action: "CLICK", targetLabel: "Purchase Now", targetType: "button" },
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(risk));
    """)
    assert res["risk"] in ["HIGH", "CRITICAL"], f"Expected HIGH or CRITICAL, got {res['risk']}"
    assert res["requiresApproval"] is True, "Purchase action must require approval"
    print("[PASS] 5. Purchase requires approval")

# 6. Cancel stops execution
def test_cancel_stops_execution():
    res = run_node_eval("""
    // Simulating user clicking cancel: no approvalToken passed
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON" },
      { type: "CLICK", target: "Submit", risk: "HIGH", requiresApproval: true },
      null, // approvalToken is null
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["requiresApproval"], "Gate must require approval"
    assert res["allowed"] is False, "Without approval token, action must NOT be allowed to execute"
    print("[PASS] 6. Cancel stops execution (unapproved action blocked)")

# 7. approval cannot be bypassed
def test_approval_cannot_be_bypassed():
    res = run_node_eval("""
    // Try to pass a forged or mismatched token
    const forgedToken = {
      action: "CLICK",
      target: "DIFFERENT_TARGET",
      pageUrl: "https://example.com",
      timestamp: Date.now()
    };
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON" },
      { type: "CLICK", target: "SUBMIT_BUTTON", risk: "HIGH", requiresApproval: true },
      forgedToken,
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False, "Forged or mismatched approval token must NOT bypass safety gate"
    print("[PASS] 7. approval cannot be bypassed")

# 8. stale approval is invalidated after page change
def test_stale_approval_invalidated_after_page_change():
    res = run_node_eval("""
    const oldToken = {
      action: "CLICK",
      target: "SUBMIT_BUTTON",
      pageUrl: "https://example.com/form1",
      timestamp: Date.now()
    };
    // Page navigated to /form2
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON" },
      { type: "CLICK", target: "SUBMIT_BUTTON", risk: "HIGH", requiresApproval: true },
      oldToken,
      { url: "https://example.com/form2" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False, "Stale approval from different page URL must be invalidated"
    assert "page url changed" in res.get("reason", "").lower() or "invalidated" in res.get("reason", "").lower()
    print("[PASS] 8. stale approval is invalidated after page change")

# 9. target change invalidates approval
def test_target_change_invalidates_approval():
    res = run_node_eval("""
    const validToken = {
      action: "CLICK",
      target: "Submit Form",
      pageUrl: "https://example.com",
      timestamp: Date.now()
    };
    // Action changed target to "Delete Form"
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "Delete Form" },
      { type: "CLICK", target: "Delete Form", risk: "HIGH", requiresApproval: true },
      validToken,
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False, "Target change must invalidate previous approval"
    print("[PASS] 9. target change invalidates approval")

# 10. multi-field form produces correct ordered plan
def test_multi_field_form_produces_correct_ordered_plan():
    res = run_node_eval("""
    const parsed = SIHTaskParser.parseTask(
      "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and click submit"
    );
    const plan = SIHReasoningPlanner.planTask(parsed, { url: "https://example.com" });
    console.log(JSON.stringify(plan));
    """)
    steps = res["steps"]
    assert len(steps) == 4, f"Expected 4 steps, got {len(steps)}"
    assert steps[0]["type"] == "FILL" and steps[0]["target"].lower() == "name"
    assert steps[1]["type"] == "FILL" and steps[1]["target"].lower() == "email"
    assert steps[2]["type"] == "FILL" and steps[2]["target"].lower() == "address"
    assert steps[3]["type"] == "CLICK" and "submit" in steps[3]["target"].lower()
    assert steps[0]["requiresApproval"] is False
    assert steps[1]["requiresApproval"] is False
    assert steps[2]["requiresApproval"] is False
    assert steps[3]["requiresApproval"] is True
    print("[PASS] 10. multi-field form produces correct ordered plan")

# 11. sanitized plan contains no literal values
def test_sanitized_plan_contains_no_literal_values():
    res = run_node_eval("""
    const parsed = SIHTaskParser.parseTask(
      "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and click submit"
    );
    console.log(JSON.stringify(parsed.sanitizedPlan));
    """)
    raw_str = json.dumps(res).lower()
    assert "sanketh" not in raw_str, "Literal name 'sanketh' found in sanitizedPlan!"
    assert "test@example.com" not in raw_str, "Literal email 'test@example.com' found in sanitizedPlan!"
    assert "mysore" not in raw_str, "Literal address 'mysore' found in sanitizedPlan!"
    print("[PASS] 11. sanitized plan contains no literal values")

# 12. reasoning plan does not expose literal values
def test_reasoning_plan_does_not_expose_literal_values():
    res = run_node_eval("""
    const parsed = SIHTaskParser.parseTask(
      "fill name as Sanketh and fill email as test@example.com and fill address as Mysore and click submit"
    );
    const plan = SIHReasoningPlanner.planTask(parsed, { url: "https://example.com" });
    console.log(JSON.stringify(plan));
    """)
    raw_str = json.dumps(res).lower()
    assert "sanketh" not in raw_str, "Literal name 'sanketh' leaked into reasoning plan!"
    assert "test@example.com" not in raw_str, "Literal email 'test@example.com' leaked into reasoning plan!"
    assert "mysore" not in raw_str, "Literal address 'mysore' leaked into reasoning plan!"
    print("[PASS] 12. reasoning plan does not expose literal values")

# 13. backend cannot bypass local safety gate
def test_backend_cannot_bypass_local_safety_gate():
    res = run_node_eval("""
    // Even if backend returned an unsolicited CLICK -> Submit
    const backendAction = { action: "CLICK", target: "SUBMIT_BUTTON" };
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      backendAction,
      null, // No client step plan
      null, // No approval token
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["requiresApproval"] is True, "Backend returned high-risk action but safety gate did not require approval!"
    assert res["allowed"] is False, "Backend cannot execute high-risk action without client approval token!"
    print("[PASS] 13. backend cannot bypass local safety gate")

# 14. Submit executes only after approval
def test_submit_executes_only_after_approval():
    res = run_node_eval("""
    const approvedToken = {
      action: "CLICK",
      target: "SUBMIT_BUTTON",
      pageUrl: "https://example.com",
      timestamp: Date.now()
    };
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON" },
      { type: "CLICK", target: "SUBMIT_BUTTON", risk: "HIGH", requiresApproval: true },
      approvedToken,
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is True, f"Submit should be allowed when valid approval token exists, got: {res}"
    print("[PASS] 14. Submit executes only after approval")

# 15. identical stale actions remain protected
def test_identical_stale_actions_remain_protected():
    res = run_node_eval("""
    // Token that expired (> 5 minutes old)
    const expiredToken = {
      action: "CLICK",
      target: "SUBMIT_BUTTON",
      pageUrl: "https://example.com",
      timestamp: Date.now() - (6 * 60 * 1000)
    };
    const gate = SIHReasoningPlanner.evaluateSafetyGate(
      { action: "CLICK", target: "SUBMIT_BUTTON" },
      { type: "CLICK", target: "SUBMIT_BUTTON", risk: "HIGH", requiresApproval: true },
      expiredToken,
      { url: "https://example.com" }
    );
    console.log(JSON.stringify(gate));
    """)
    assert res["allowed"] is False, "Expired approval token must be rejected"
    assert "expired" in res.get("reason", "").lower()
    print("[PASS] 15. identical stale actions remain protected")

# 16. regression test: LOW-risk FILL with satisfied preconditions MUST be allowed
def test_low_risk_fill_preconditions_and_safety_gate_allowed():
    res = run_node_eval("""
    const stepPlan = {
      id: 1,
      stepId: 0,
      type: "FILL",
      target: "Name",
      fieldHint: "Name",
      risk: "LOW",
      requiresApproval: false,
      preconditions: ["target_grounded", "target_visible", "target_not_disabled"],
      postconditions: ["field_value_verified_locally"]
    };
    const agentAction = {
      action: "FILL",
      targetIndex: 3,
      targetType: "input",
      targetLabel: "Name",
      localValue: "Sankii"
    };
    const preCheck = SIHReasoningPlanner.validatePreconditions(stepPlan, [], null);
    const gate = SIHReasoningPlanner.evaluateSafetyGate(agentAction, stepPlan, null, { url: "https://example.com" });
    console.log(JSON.stringify({ preCheck, gate }));
    """)
    preCheck = res["preCheck"]
    gate = res["gate"]
    assert preCheck["valid"] is True, "Preconditions for low-risk FILL must be valid"
    assert preCheck["satisfied"] is True, "Preconditions for low-risk FILL must be satisfied"
    assert gate["allowed"] is True, "Safety gate must allow LOW-risk FILL"
    assert gate["requiresApproval"] is False, "LOW-risk FILL must NOT require approval"
    assert gate["risk"] == "LOW", "Risk must be LOW"
    print("[PASS] 16. regression test: LOW-risk FILL with satisfied preconditions is ALLOWED (not blocked)")

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("RUNNING LOCAL REASONING & HUMAN APPROVAL TEST SUITE (15 TESTS)")
    print("=" * 60 + "\n")

    test_low_risk_fill_does_not_require_approval()
    test_high_risk_submit_requires_approval()
    test_delete_requires_approval()
    test_send_requires_approval()
    test_purchase_requires_approval()
    test_cancel_stops_execution()
    test_approval_cannot_be_bypassed()
    test_stale_approval_invalidated_after_page_change()
    test_target_change_invalidates_approval()
    test_multi_field_form_produces_correct_ordered_plan()
    test_sanitized_plan_contains_no_literal_values()
    test_reasoning_plan_does_not_expose_literal_values()
    test_backend_cannot_bypass_local_safety_gate()
    test_submit_executes_only_after_approval()
    test_identical_stale_actions_remain_protected()
    test_low_risk_fill_preconditions_and_safety_gate_allowed()

    print("\n" + "=" * 60)
    print("ALL LOCAL REASONING & HUMAN APPROVAL TESTS PASSED CLEANLY!")
    print("=" * 60 + "\n")
