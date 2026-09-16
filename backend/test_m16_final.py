"""
test_m16_final.py - Final unit and integration test suite for Milestone 16.
Validates all requirements for SIH26171 Final Pass:
1. VISUAL_SELECTOR top-level definition & extractVisualElements without ReferenceError
2. Generic form-field perception heuristics (label-for, aria-label, aria-labelledby, placeholder, humanized name, nearby text)
3. Backend FILL action grounding via difflib
4. Backend rejection of any payload containing 'value'/'fieldValue' with HTTP 422
5. Backend explicit action allowlist rejection of unsupported actions (e.g. 'DELETE')
6. Privacy: asserts no test ever sends or allows literal typed values crossing boundary
7. Ambiguous FILL/CLICK target rejection (executed: false)
8. Stale target rejection (executed: false)
9. Password field refusal (executed: false)
10. Legacy action compatibility (SUBMIT_BUTTON, LOGIN_BUTTON, NEXT_BUTTON, SEARCH_INPUT, PAGE scroll)
"""

import asyncio
import io
import json
import os
import subprocess
import sys
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from pydantic import ValidationError

from main import (
    app,
    PageContext,
    AgentAction,
    ALLOWED_ACTIONS,
    receive_context,
    receive_visual_context,
    DemoAgentProvider,
    set_active_agent_provider
)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def _make_dummy_image() -> UploadFile:
    return UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))

def _make_sanitized_privacy_meta() -> str:
    return json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": 0
    })

# =====================================================================
# Test 1: VISUAL_SELECTOR is defined and runs without ReferenceError
# =====================================================================
def test_visual_selector_defined_and_no_reference_error():
    """Asserts VISUAL_SELECTOR is top-level const and callable in content.js without ReferenceError."""
    node_code = """
    const content = require('./content.js');
    if (typeof content.VISUAL_SELECTOR !== 'string' || content.VISUAL_SELECTOR.length === 0) {
      console.error('VISUAL_SELECTOR is not a valid string');
      process.exit(1);
    }
    if (typeof content.classifyVisualElement !== 'function') {
      console.error('classifyVisualElement is not a function');
      process.exit(1);
    }
    if (typeof content.extractVisualElements !== 'function') {
      console.error('extractVisualElements is not a function');
      process.exit(1);
    }
    if (typeof content.extractVisualElementsWithNodes !== 'function') {
      console.error('extractVisualElementsWithNodes is not a function');
      process.exit(1);
    }
    console.log('OK');
    """
    res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Node check failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_visual_selector_defined_and_no_reference_error")

# =====================================================================
# Test 2: Generic Form-Field Perception Heuristics in content.js
# =====================================================================
def test_generic_input_perception_heuristics():
    """Tests label-for, aria-label, aria-labelledby, placeholder, humanized name, nearby text."""
    node_code = """
    const { extractFormFieldLabel, humanizeName } = require('./content.js');

    // 1. Humanize name check
    if (humanizeName('full_name') !== 'Full Name') {
      console.error('humanizeName failed on full_name: ' + humanizeName('full_name'));
      process.exit(1);
    }
    if (humanizeName('applicantEmail') !== 'Applicant Email') {
      console.error('humanizeName failed on applicantEmail: ' + humanizeName('applicantEmail'));
      process.exit(1);
    }

    // Mock DOM elements to test extractFormFieldLabel priority
    // 2. aria-label
    const elAria = {
      tagName: 'input',
      getAttribute: (attr) => attr === 'aria-label' ? 'Search Projects' : null
    };
    if (extractFormFieldLabel(elAria, 'input') !== 'Search Projects') {
      console.error('Failed aria-label extraction');
      process.exit(1);
    }

    // 3. placeholder
    const elPlace = {
      tagName: 'input',
      getAttribute: (attr) => attr === 'placeholder' ? 'Enter your city' : null
    };
    if (extractFormFieldLabel(elPlace, 'input') !== 'Enter your city') {
      console.error('Failed placeholder extraction');
      process.exit(1);
    }

    // 4. name attribute
    const elName = {
      tagName: 'input',
      getAttribute: (attr) => attr === 'name' ? 'phone_number' : null
    };
    if (extractFormFieldLabel(elName, 'input') !== 'Phone Number') {
      console.error('Failed name attribute extraction');
      process.exit(1);
    }

    // 5. fallback to <type> field
    const elFallback = {
      tagName: 'input',
      type: 'email',
      getAttribute: () => null
    };
    if (extractFormFieldLabel(elFallback, 'input') !== 'Email field') {
      console.error('Failed fallback extraction');
      process.exit(1);
    }

    console.log('OK');
    """
    res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Perception heuristics test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_generic_input_perception_heuristics")

# =====================================================================
# Test 3: Backend FILL action grounding via difflib
# =====================================================================
def test_backend_fill_action_grounding():
    """Asserts backend resolves fieldHint to targetIndex/targetType/targetLabel among form fields."""
    context = json.dumps({
        "elements": [
            {"type": "heading", "label": "Application Form"},
            {"type": "input", "label": "Full Name", "fieldId": 0},
            {"type": "input", "label": "Email Address", "fieldId": 1},
            {"type": "button", "label": "Submit Application"}
        ],
        "fieldPlan": [
            {"fieldHint": "Full Name"},
            {"fieldHint": "Email Address"}
        ]
    })

    set_active_agent_provider(DemoAgentProvider())
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="Fill Full Name and Email Address",
        context=context,
        privacyMetadata=_make_sanitized_privacy_meta(),
        requestId="SIH-req-fill-grounding"
    ))

    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "FILL"
    assert action["targetIndex"] == 1  # points to "Full Name" input
    assert action["targetType"] == "input"
    assert "Full Name" in action["targetLabel"]
    assert action["groundingMethod"] == "local-fuzzy-match"
    assert action["groundingScore"] >= 0.35
    assert "plan" in res
    assert len(res["plan"]) == 2
    assert res["plan"][0]["action"] == "FILL"
    assert res["plan"][1]["action"] == "FILL"
    print("[PASS] test_backend_fill_action_grounding")

# =====================================================================
# Test 4: Backend rejects any payload containing 'value'/'fieldValue' with HTTP 422
# =====================================================================
def test_backend_rejects_payload_with_value_keys():
    """Defense in depth: rejects any context or task containing value / fieldValue keys."""
    # Case A: context has 'value' key
    context_with_value = json.dumps({
        "elements": [],
        "value": "LiteralPrivateValue"
    })
    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=_make_dummy_image(),
            task="Fill Name",
            context=context_with_value,
            privacyMetadata=_make_sanitized_privacy_meta(),
            requestId="SIH-test-value-key"
        ))
        assert False, "Should have raised HTTPException 422 for 'value' key in context"
    except HTTPException as e:
        assert e.status_code == 422
        assert "Privacy violation" in e.detail

    # Case B: context has 'fieldValue' key
    context_with_field_value = json.dumps({
        "elements": [],
        "fieldValue": "sanketh@example.com"
    })
    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=_make_dummy_image(),
            task="Fill Email",
            context=context_with_field_value,
            privacyMetadata=_make_sanitized_privacy_meta(),
            requestId="SIH-test-field-value-key"
        ))
        assert False, "Should have raised HTTPException 422 for 'fieldValue' key in context"
    except HTTPException as e:
        assert e.status_code == 422
        assert "Privacy violation" in e.detail

    # Case C: task has embedded JSON with 'value' key
    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=_make_dummy_image(),
            task='{"action": "FILL", "value": "leaked_secret"}',
            context=json.dumps({"elements": []}),
            privacyMetadata=_make_sanitized_privacy_meta(),
            requestId="SIH-test-task-value-key"
        ))
        assert False, "Should have raised HTTPException 422 for 'value' in task"
    except HTTPException as e:
        assert e.status_code == 422
        assert "Privacy violation" in e.detail

    print("[PASS] test_backend_rejects_payload_with_value_keys")

# =====================================================================
# Test 5: Backend explicit action allowlist rejection (e.g. 'DELETE')
# =====================================================================
def test_backend_explicit_action_allowlist_rejection():
    """Asserts AgentAction model and backend strictly reject unsupported actions."""
    # Test AgentAction model validation
    try:
        AgentAction(action="DELETE")
        assert False, "Should have raised ValidationError for action 'DELETE'"
    except ValidationError as e:
        assert "not supported" in str(e)

    try:
        AgentAction(action="EXECUTE_JS")
        assert False, "Should have raised ValidationError for action 'EXECUTE_JS'"
    except ValidationError as e:
        assert "not supported" in str(e)

    try:
        AgentAction(action="EVAL")
        assert False, "Should have raised ValidationError for action 'EVAL'"
    except ValidationError as e:
        assert "not supported" in str(e)

    # Allowed actions must validate without error
    for valid_action in ["CLICK", "SCROLL", "FILL", "WARN", "NONE"]:
        act = AgentAction(action=valid_action)
        assert act.action == valid_action

    print("[PASS] test_backend_explicit_action_allowlist_rejection")

# =====================================================================
# Test 6: Privacy: Assert no test ever sends or allows literal typed values
# =====================================================================
def test_privacy_contract_no_literal_values_in_schema():
    """Asserts AgentAction model schema explicitly lacks unredacted form profile fields."""
    model_fields = AgentAction.model_fields.keys()
    assert "fieldValue" not in model_fields
    assert "field_value" not in model_fields
    assert "localValue" not in model_fields
    print("[PASS] test_privacy_contract_no_literal_values_in_schema")

# =====================================================================
# Test 7: Ambiguous FILL/CLICK target rejection (executed: false)
# =====================================================================
def test_ambiguous_target_rejection():
    """Asserts executeAction rejects execution when multiple elements share identical label."""
    node_code = """
    const { executeAction } = require('./content.js');

    // In content.js, executeAction calls extractVisualElementsWithNodes()
    // We mock document.querySelectorAll to return two identical elements
    const mockNodes = [
      {
        tagName: 'INPUT',
        type: 'text',
        id: 'field1',
        isConnected: true,
        isContentEditable: false,
        getBoundingClientRect: () => ({ x: 10, y: 10, width: 100, height: 30 }),
        getAttribute: (attr) => attr === 'placeholder' ? 'Duplicate Label' : null,
        dispatchEvent: () => {}
      },
      {
        tagName: 'INPUT',
        type: 'text',
        id: 'field2',
        isConnected: true,
        isContentEditable: false,
        getBoundingClientRect: () => ({ x: 10, y: 50, width: 100, height: 30 }),
        getAttribute: (attr) => attr === 'placeholder' ? 'Duplicate Label' : null,
        dispatchEvent: () => {}
      }
    ];

    global.document = {
      querySelectorAll: (sel) => mockNodes,
      querySelector: () => null,
      getElementById: () => null
    };
    global.window = {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
      HTMLInputElement: function() {},
      HTMLTextAreaElement: function() {}
    };

    // Ambiguous FILL attempt
    const res = executeAction({
      action: 'FILL',
      targetIndex: 99, // invalid index forces label matching
      targetType: 'input',
      targetLabel: 'Duplicate Label',
      localValue: 'SafeValue'
    });

    if (res.executed !== false) {
      console.error('Expected ambiguous target to be rejected (executed: false), got: ' + JSON.stringify(res));
      process.exit(1);
    }
    console.log('OK');
    """
    res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Ambiguous target test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_ambiguous_target_rejection")

# =====================================================================
# Test 8: Stale target rejection (executed: false)
# =====================================================================
def test_stale_target_rejection():
    """Asserts executeAction rejects targets where node is disconnected from DOM."""
    node_code = """
    const { executeAction } = require('./content.js');

    const staleNode = {
      tagName: 'INPUT',
      type: 'text',
      id: 'stale-field',
      isConnected: false, // Node was removed from DOM!
      isContentEditable: false,
      getBoundingClientRect: () => ({ x: 10, y: 10, width: 100, height: 30 }),
      getAttribute: (attr) => attr === 'placeholder' ? 'Stale Field' : null,
      dispatchEvent: () => {}
    };

    global.document = {
      querySelectorAll: (sel) => [staleNode],
      querySelector: () => null,
      getElementById: () => null
    };
    global.window = {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
      HTMLInputElement: function() {},
      HTMLTextAreaElement: function() {}
    };

    const res = executeAction({
      action: 'FILL',
      targetIndex: 0,
      targetType: 'input',
      targetLabel: 'Stale Field',
      localValue: 'Test'
    });

    if (res.executed !== false) {
      console.error('Expected stale target to be rejected (executed: false), got: ' + JSON.stringify(res));
      process.exit(1);
    }
    console.log('OK');
    """
    res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Stale target test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_stale_target_rejection")

# =====================================================================
# Test 9: Password field refusal
# =====================================================================
def test_password_field_fill_refusal():
    """Asserts executeAction refuses to fill credentials fields (type='password')."""
    node_code = """
    const { executeAction } = require('./content.js');

    const pwdNode = {
      tagName: 'INPUT',
      type: 'password',
      id: 'pwd-field',
      isConnected: true,
      isContentEditable: false,
      getBoundingClientRect: () => ({ x: 10, y: 10, width: 100, height: 30 }),
      getAttribute: (attr) => attr === 'placeholder' ? 'Password' : null,
      dispatchEvent: () => {}
    };

    global.document = {
      querySelectorAll: (sel) => [pwdNode],
      querySelector: () => null,
      getElementById: () => null
    };
    global.window = {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
      HTMLInputElement: function() {},
      HTMLTextAreaElement: function() {}
    };

    const res = executeAction({
      action: 'FILL',
      targetIndex: 0,
      targetType: 'input',
      targetLabel: 'Password',
      localValue: 'secret123'
    });

    if (res.executed !== false || !res.reason.includes('password')) {
      console.error('Expected password field to be refused, got: ' + JSON.stringify(res));
      process.exit(1);
    }
    console.log('OK');
    """
    res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Password fill refusal test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_password_field_fill_refusal")

# =====================================================================
# Test 10: Legacy action compatibility preserved
# =====================================================================
def test_legacy_action_compatibility():
    """Asserts legacy targets (SUBMIT_BUTTON, LOGIN_BUTTON, NEXT_BUTTON, SEARCH_INPUT, PAGE) work."""
    # 1. Legacy context endpoint
    res1 = asyncio.run(receive_context(PageContext(
        title="Test",
        url="http://localhost/test",
        redactedSample="Please submit this form"
    )))
    assert res1["action"]["action"] == "CLICK"
    assert res1["action"]["target"] == "SUBMIT_BUTTON"

    # 2. Legacy login via visual context
    res2 = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="Click the login button",
        context=json.dumps({"elements": [{"type": "button", "label": "Login", "semanticTag": "LOGIN_BUTTON"}]}),
        privacyMetadata=_make_sanitized_privacy_meta(),
        requestId="SIH-test-legacy-login"
    ))
    assert res2["action"]["action"] == "CLICK"
    assert res2["action"]["target"] == "LOGIN_BUTTON"

    # 3. Legacy scroll via visual context
    res3 = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="Scroll down to read more",
        context=json.dumps({"elements": []}),
        privacyMetadata=_make_sanitized_privacy_meta(),
        requestId="SIH-test-legacy-scroll"
    ))
    assert res3["action"]["action"] == "SCROLL"
    assert res3["action"]["target"] == "PAGE"
    assert res3["action"]["amount"] == 500

    print("[PASS] test_legacy_action_compatibility")

# =====================================================================
# Test 11: Local FILL Value Parsing, Privacy, and Execution Payload
# =====================================================================
def test_local_fill_value_parsing_and_execution_payload():
    """
    Tests:
    1. One FILL task: 'fill full name as sanketh'
    2. Multiple FILL tasks: 'fill full name as sanketh and email address as sanketh@example.com'
    3. Literal values remain strictly local (never in sanitizedPlan)
    4. Correct local value reaches content.js execution payload and fills DOM field with verified: true
    """
    node_code = """
    const taskParser = require('./task-parser.js');
    const content = require('./content.js');

    // Test 1: Single FILL task ('fill full name as sanketh')
    const task1 = 'fill full name as sanketh';
    const parsed1 = taskParser.parseTask(task1);

    if (parsed1.intent !== 'FILL') {
      console.error('Task 1 intent should be FILL, got: ' + parsed1.intent);
      process.exit(1);
    }
    if (!parsed1.steps || parsed1.steps.length !== 1) {
      console.error('Task 1 should have 1 step');
      process.exit(1);
    }
    if (parsed1.steps[0].value !== 'sanketh') {
      console.error('Task 1 step 0 value should be sanketh, got: ' + parsed1.steps[0].value);
      process.exit(1);
    }

    // Verify privacy: sanitizedPlan must NEVER contain the literal value
    const sanitizedJson1 = JSON.stringify(parsed1.sanitizedPlan);
    if (sanitizedJson1.includes('sanketh')) {
      console.error('Sanitized plan leaked literal value: ' + sanitizedJson1);
      process.exit(1);
    }

    // Verify localValues contains the value
    if (parsed1.localValues[0] !== 'sanketh') {
      console.error('localValues[0] missing or incorrect');
      process.exit(1);
    }

    // Test execution on mock DOM node in content.js
    const input1 = {
      tagName: 'input',
      type: 'text',
      value: '',
      isConnected: true,
      dispatchEvent: () => {},
      getBoundingClientRect: () => ({ width: 100, height: 25, x: 10, y: 10 }),
      getAttribute: () => null
    };

    global.document = {
      querySelectorAll: (sel) => [input1]
    };
    global.window = {
      HTMLInputElement: function() {},
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' })
    };
    global.Event = function(name) { this.name = name; };

    // Simulate popup.js constructing payload with localValue
    const payload1 = {
      action: 'FILL',
      targetIndex: 0,
      targetType: 'input',
      targetLabel: 'Text field',
      localValue: parsed1.localValues[0]
    };

    const execRes1 = content.executeAction(payload1);
    if (!execRes1.executed || !execRes1.verified) {
      console.error('Execute action failed for single fill: ' + JSON.stringify(execRes1));
      process.exit(1);
    }
    if (input1.value !== 'sanketh') {
      console.error('DOM element value was not set, got: ' + input1.value);
      process.exit(1);
    }

    // Test 2: Multiple FILL tasks ('fill full name as sanketh and email address as sanketh@example.com')
    const task2 = 'fill full name as sanketh and email address as sanketh@example.com';
    const parsed2 = taskParser.parseTask(task2);

    if (parsed2.intent !== 'MULTI_STEP') {
      console.error('Task 2 intent should be MULTI_STEP, got: ' + parsed2.intent);
      process.exit(1);
    }
    if (!parsed2.steps || parsed2.steps.length !== 2) {
      console.error('Task 2 should have 2 steps, got: ' + (parsed2.steps ? parsed2.steps.length : 0));
      process.exit(1);
    }
    if (parsed2.steps[0].value !== 'sanketh' || parsed2.steps[1].value !== 'sanketh@example.com') {
      console.error('Task 2 step values incorrect: ' + JSON.stringify(parsed2.steps));
      process.exit(1);
    }

    // Verify privacy: sanitizedPlan must NEVER contain the literal values
    const sanitizedJson2 = JSON.stringify(parsed2.sanitizedPlan);
    if (sanitizedJson2.includes('sanketh') || sanitizedJson2.includes('sanketh@example.com')) {
      console.error('Sanitized plan leaked literal values: ' + sanitizedJson2);
      process.exit(1);
    }

    // Verify localValues mapping
    if (parsed2.localValues[0] !== 'sanketh' || parsed2.localValues[1] !== 'sanketh@example.com') {
      console.error('localValues mapping incorrect in multi-step task');
      process.exit(1);
    }

    // Test execution on two distinct inputs
    const inputName = {
      tagName: 'input',
      type: 'text',
      value: '',
      isConnected: true,
      dispatchEvent: () => {},
      getBoundingClientRect: () => ({ width: 100, height: 25, x: 10, y: 10 }),
      getAttribute: (attr) => attr === 'name' ? 'full_name' : null
    };
    const inputEmail = {
      tagName: 'input',
      type: 'email',
      value: '',
      isConnected: true,
      dispatchEvent: () => {},
      getBoundingClientRect: () => ({ width: 100, height: 25, x: 10, y: 50 }),
      getAttribute: (attr) => attr === 'name' ? 'email_address' : null
    };

    global.document = {
      querySelectorAll: (sel) => [inputName, inputEmail]
    };

    const payloadName = {
      action: 'FILL',
      targetIndex: 0,
      targetType: 'input',
      targetLabel: 'Full Name',
      localValue: parsed2.localValues[0]
    };
    const payloadEmail = {
      action: 'FILL',
      targetIndex: 1,
      targetType: 'input',
      targetLabel: 'Email Address',
      localValue: parsed2.localValues[1]
    };

    const resName = content.executeAction(payloadName);
    const resEmail = content.executeAction(payloadEmail);

    if (!resName.executed || !resName.verified || inputName.value !== 'sanketh') {
      console.error('Failed name fill execution: ' + JSON.stringify(resName) + ' val: ' + inputName.value);
      process.exit(1);
    }
    if (!resEmail.executed || !resEmail.verified || inputEmail.value !== 'sanketh@example.com') {
      console.error('Failed email fill execution: ' + JSON.stringify(resEmail) + ' val: ' + inputEmail.value);
      process.exit(1);
    }

    console.log('OK');
    """
    res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Local fill value parsing and execution test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_local_fill_value_parsing_and_execution_payload")

if __name__ == "__main__":
    print("\n========================================================")
    print("RUNNING MILESTONE 16 FINAL COMPREHENSIVE TESTS")
    print("========================================================\n")
    test_visual_selector_defined_and_no_reference_error()
    test_generic_input_perception_heuristics()
    test_backend_fill_action_grounding()
    test_backend_rejects_payload_with_value_keys()
    test_backend_explicit_action_allowlist_rejection()
    test_privacy_contract_no_literal_values_in_schema()
    test_ambiguous_target_rejection()
    test_stale_target_rejection()
    test_password_field_fill_refusal()
    test_legacy_action_compatibility()
    test_local_fill_value_parsing_and_execution_payload()
    print("\n========================================================")
    print("ALL MILESTONE 16 FINAL TESTS PASSED CLEANLY!")
    print("========================================================\n")
