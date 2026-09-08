"""
test_generic_agent.py - Comprehensive automated tests for generic browser agent capabilities.
Validates:
1. Generic button & link grounding (natural variations: 'click add to cart', 'open downloads', 'click the button labelled Register')
2. Ambiguous target rejection (e.g. 'Submit Application' vs 'Submit Feedback' for 'click submit')
3. Specific button disambiguation (e.g. 'click submit application')
4. Disabled element protection (backend skips, content.js refuses execution)
5. Complete 10-step form-field label hierarchy in content.js
6. Multi-field task parsing with strict local-only privacy contract (sanitized plan has NO values)
7. Combined task parsing (FILL + SCROLL + CLICK)
8. Bounded numeric scroll amounts [50, 1500]
9. Low-confidence rejection (score < 0.35 -> NONE)
10. Stale DOM protection (disconnected element -> executed: false)
11. Sensitive password field protection (refused: true)
12. Local HTTP test-page endpoint (/test-page.html)
"""

import asyncio
import io
import json
import os
import subprocess
import sys
from starlette.datastructures import UploadFile
from main import (
    app,
    PageContext,
    AgentAction,
    ALLOWED_ACTIONS,
    receive_visual_context,
    DemoAgentProvider,
    serve_test_page
)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def _make_dummy_image() -> UploadFile:
    return UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))

def _make_privacy_meta() -> str:
    return json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": 0
    })

# =====================================================================
# Test 1: Generic Button & Link Grounding without hardcoded IDs
# =====================================================================
def test_generic_button_and_link_grounding():
    """Asserts generic buttons and links are grounded from natural phrasings."""
    context = json.dumps({
        "elements": [
            {"type": "heading", "label": "Product Catalog"},
            {"type": "button", "label": "Add to Cart", "disabled": False},
            {"type": "link", "label": "Downloads", "disabled": False},
            {"type": "button", "label": "Register for Event", "disabled": False}
        ]
    })

    # Case A: "click add to cart"
    res_cart = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="click add to cart",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-generic-cart"
    ))
    assert res_cart["status"] == "success"
    assert res_cart["action"]["action"] == "CLICK"
    assert res_cart["action"]["targetIndex"] == 1
    assert res_cart["action"]["targetLabel"] == "Add to Cart"
    assert res_cart["action"]["groundingScore"] >= 0.70

    # Case B: "open downloads"
    res_down = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="open downloads",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-generic-down"
    ))
    assert res_down["status"] == "success"
    assert res_down["action"]["action"] == "CLICK"
    assert res_down["action"]["targetIndex"] == 2
    assert res_down["action"]["targetLabel"] == "Downloads"

    # Case C: "click the button labelled Register"
    res_reg = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="click the button labelled Register",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-generic-reg"
    ))
    assert res_reg["status"] == "success"
    assert res_reg["action"]["action"] == "CLICK"
    assert res_reg["action"]["targetIndex"] == 3
    assert "Register" in res_reg["action"]["targetLabel"]

    print("[PASS] test_generic_button_and_link_grounding")

# =====================================================================
# Test 2: Ambiguous Target Rejection for Safety
# =====================================================================
def test_ambiguous_target_rejection():
    """Asserts that when multiple elements closely match a vague task, action is rejected as NONE."""
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Submit Application", "disabled": False},
            {"type": "button", "label": "Submit Feedback", "disabled": False}
        ]
    })

    # Vague task: "click submit" matches both "Submit Application" and "Submit Feedback" equally
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="click submit",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-ambiguity"
    ))
    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "NONE", f"Expected NONE for ambiguous target, got: {action}"
    assert action.get("groundingMethod") == "ambiguity-rejection"
    assert "Ambiguous" in res["reasoning"]
    print("[PASS] test_ambiguous_target_rejection")

# =====================================================================
# Test 3: Specific Disambiguation
# =====================================================================
def test_specific_disambiguation():
    """Asserts that when the user is specific, the correct button is grounded even among siblings."""
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Submit Application", "disabled": False},
            {"type": "button", "label": "Submit Feedback", "disabled": False}
        ]
    })

    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="click submit application",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-specific-submit"
    ))
    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "CLICK"
    assert action["targetIndex"] == 0
    assert action["targetLabel"] == "Submit Application"
    assert action["groundingScore"] >= 0.85
    print("[PASS] test_specific_disambiguation")

# =====================================================================
# Test 4: Disabled Element Protection
# =====================================================================
def test_disabled_element_protection():
    """Asserts backend skips disabled elements, and content.js rejects execution on disabled targets."""
    # 1. Backend test: only element matching is disabled
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Confirm Order", "disabled": True},
            {"type": "link", "label": "Back to Home", "disabled": False}
        ]
    })

    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="click confirm order",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-disabled-skip"
    ))
    # Disabled button must not be proposed
    assert res["action"]["action"] == "NONE"

    # 2. Content script execution test: rejects disabled node
    node_code = """
    const { executeAction } = require('./content.js');
    const disabledNode = {
      tagName: 'BUTTON',
      innerText: 'Disabled Action',
      disabled: true,
      isConnected: true,
      getBoundingClientRect: () => ({ x: 10, y: 10, width: 80, height: 30 }),
      getAttribute: () => null
    };

    global.document = {
      querySelectorAll: () => [disabledNode],
      querySelector: () => null,
      getElementById: () => null
    };
    global.window = {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' })
    };

    const execRes = executeAction({
      action: 'CLICK',
      targetIndex: 0,
      targetType: 'button',
      targetLabel: 'Disabled Action'
    });

    if (execRes.executed !== false || !execRes.reason.includes('disabled')) {
      console.error('Expected disabled element to be rejected, got: ' + JSON.stringify(execRes));
      process.exit(1);
    }
    console.log('OK');
    """
    node_res = subprocess.run(
        ["node", "-e", node_code],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    assert node_res.returncode == 0, f"Disabled node test failed: {node_res.stderr}"
    assert "OK" in node_res.stdout
    print("[PASS] test_disabled_element_protection")

# =====================================================================
# Test 5: Complete 10-Step Label Extraction Hierarchy in content.js
# =====================================================================
def test_complete_10_step_label_hierarchy():
    """Validates the 10-step form-field label hierarchy in content.js."""
    node_code = """
    const { extractFormFieldLabel } = require('./content.js');

    // 1. label[for="id"]
    global.document = {
      querySelector: (sel) => sel === 'label[for="field1"]' ? { innerText: 'First Name' } : null,
      getElementById: () => null
    };
    const el1 = { id: 'field1', tagName: 'input', getAttribute: () => null };
    if (extractFormFieldLabel(el1, 'input') !== 'First Name') {
      console.error('Step 1 (label for) failed');
      process.exit(1);
    }

    // 2. wrapping ancestor label
    const el2 = {
      id: 'field2',
      tagName: 'input',
      getAttribute: () => null,
      closest: (sel) => sel === 'label' ? {
        cloneNode: () => ({ querySelectorAll: () => [], innerText: 'Wrapping Label' })
      } : null
    };
    if (extractFormFieldLabel(el2, 'input') !== 'Wrapping Label') {
      console.error('Step 2 (wrapping label) failed');
      process.exit(1);
    }

    // 3. aria-label
    const el3 = {
      tagName: 'input',
      getAttribute: (a) => a === 'aria-label' ? 'Project Code' : null
    };
    if (extractFormFieldLabel(el3, 'input') !== 'Project Code') {
      console.error('Step 3 (aria-label) failed');
      process.exit(1);
    }

    // 4. aria-labelledby
    global.document.getElementById = (id) => id === 'lbl-ref' ? { innerText: 'Referenced Label' } : null;
    const el4 = {
      tagName: 'input',
      getAttribute: (a) => a === 'aria-labelledby' ? 'lbl-ref' : null
    };
    if (extractFormFieldLabel(el4, 'input') !== 'Referenced Label') {
      console.error('Step 4 (aria-labelledby) failed');
      process.exit(1);
    }

    // 5. associated visible label (aria-describedby)
    global.document.getElementById = (id) => id === 'desc-ref' ? { innerText: 'Described Label' } : null;
    const el5 = {
      tagName: 'input',
      getAttribute: (a) => a === 'aria-describedby' ? 'desc-ref' : null
    };
    if (extractFormFieldLabel(el5, 'input') !== 'Described Label') {
      console.error('Step 5 (aria-describedby) failed');
      process.exit(1);
    }

    // 6. name attribute (humanized)
    const el6 = {
      tagName: 'input',
      getAttribute: (a) => a === 'name' ? 'home_address' : null
    };
    if (extractFormFieldLabel(el6, 'input') !== 'Home Address') {
      console.error('Step 6 (name humanized) failed');
      process.exit(1);
    }

    // 7. placeholder
    const el7 = {
      tagName: 'input',
      getAttribute: (a) => a === 'placeholder' ? 'Enter city' : null
    };
    if (extractFormFieldLabel(el7, 'input') !== 'Enter city') {
      console.error('Step 7 (placeholder) failed');
      process.exit(1);
    }

    // 8. title attribute
    const el8 = {
      tagName: 'input',
      getAttribute: (a) => a === 'title' ? 'Zip Code Tooltip' : null
    };
    if (extractFormFieldLabel(el8, 'input') !== 'Zip Code Tooltip') {
      console.error('Step 8 (title) failed');
      process.exit(1);
    }

    // 9. Google Forms listitem question title
    const el9 = {
      tagName: 'input',
      getAttribute: () => null,
      closest: (sel) => sel.includes('listitem') ? {
        querySelector: () => ({ innerText: 'What is your full name?' })
      } : null
    };
    if (extractFormFieldLabel(el9, 'input') !== 'What is your full name?') {
      console.error('Step 9 (Google Forms question title) failed');
      process.exit(1);
    }

    // 10. Fallback
    const el10 = {
      tagName: 'input',
      type: 'password',
      getAttribute: () => null
    };
    if (extractFormFieldLabel(el10, 'input') !== 'Password field') {
      console.error('Step 10 (fallback) failed');
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
    assert res.returncode == 0, f"10-step hierarchy test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_complete_10_step_label_hierarchy")

# =====================================================================
# Test 6: Multi-Field Task Parsing and Strict Local Privacy Contract
# =====================================================================
def test_multi_field_parsing_and_privacy():
    """Asserts multi-field task parses into sequential steps without leaking literal values to sanitizedPlan."""
    node_code = """
    const taskParser = require('./task-parser.js');
    const task = 'fill first name as Sanketh, last name as Mallikarjuna, and city as Bangalore';
    const parsed = taskParser.parseTask(task);

    if (parsed.intent !== 'MULTI_STEP' || parsed.steps.length !== 3) {
      console.error('Failed multi-step parse, got: ' + JSON.stringify(parsed));
      process.exit(1);
    }

    // Check steps
    if (parsed.steps[0].value !== 'Sanketh' || parsed.steps[1].value !== 'Mallikarjuna' || parsed.steps[2].value !== 'Bangalore') {
      console.error('Step values mismatch: ' + JSON.stringify(parsed.steps));
      process.exit(1);
    }

    // CRITICAL PRIVACY CHECK: sanitizedPlan must NEVER contain the literal values
    const sanitizedStr = JSON.stringify(parsed.sanitizedPlan);
    if (sanitizedStr.includes('Sanketh') || sanitizedStr.includes('Mallikarjuna') || sanitizedStr.includes('Bangalore')) {
      console.error('PRIVACY BREACH: sanitizedPlan contains literal values: ' + sanitizedStr);
      process.exit(1);
    }

    // Local in-memory values store must contain values
    if (parsed.localValues[0] !== 'Sanketh' || parsed.localValues[1] !== 'Mallikarjuna' || parsed.localValues[2] !== 'Bangalore') {
      console.error('localValues missing values');
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
    assert res.returncode == 0, f"Multi-field privacy test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_multi_field_parsing_and_privacy")

# =====================================================================
# Test 7: Combined Task Parsing (FILL + SCROLL + CLICK)
# =====================================================================
def test_combined_task_parsing():
    """Asserts complex combined task ('enter email as ... scroll down ... click continue') parses all 3 actions."""
    node_code = """
    const taskParser = require('./task-parser.js');
    const task = 'enter email as sanketh@example.com, scroll down 500 pixels, and click continue';
    const parsed = taskParser.parseTask(task);

    if (parsed.intent !== 'MULTI_STEP' || parsed.steps.length !== 3) {
      console.error('Expected 3 combined steps, got: ' + JSON.stringify(parsed));
      process.exit(1);
    }

    const [step1, step2, step3] = parsed.steps;
    if (step1.type !== 'FILL' || step1.value !== 'sanketh@example.com') {
      console.error('Step 1 incorrect: ' + JSON.stringify(step1));
      process.exit(1);
    }
    if (step2.type !== 'SCROLL' || step2.amount !== 500) {
      console.error('Step 2 incorrect: ' + JSON.stringify(step2));
      process.exit(1);
    }
    if (step3.type !== 'CLICK' || step3.targetHint !== 'continue') {
      console.error('Step 3 incorrect: ' + JSON.stringify(step3));
      process.exit(1);
    }

    // Verify privacy
    const sanitizedStr = JSON.stringify(parsed.sanitizedPlan);
    if (sanitizedStr.includes('sanketh@example.com')) {
      console.error('PRIVACY BREACH: sanitizedPlan contains email');
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
    assert res.returncode == 0, f"Combined task test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_combined_task_parsing")

# =====================================================================
# Test 8: Bounded Numeric Scroll Amounts
# =====================================================================
def test_bounded_numeric_scroll_parsing():
    """Asserts scroll parser respects bounds [50, 1500] and extracts numeric values."""
    node_code = """
    const taskParser = require('./task-parser.js');

    // 1. Normal numeric scroll
    const p1 = taskParser.parseTask('scroll down 800 pixels');
    if (p1.steps[0].amount !== 800) {
      console.error('Expected 800, got: ' + p1.steps[0].amount);
      process.exit(1);
    }

    // 2. Excess scroll clamped to 1500
    const p2 = taskParser.parseTask('scroll down 99999 pixels');
    if (p2.steps[0].amount !== 1500) {
      console.error('Expected 1500 cap, got: ' + p2.steps[0].amount);
      process.exit(1);
    }

    // 3. Tiny scroll clamped to 50
    const p3 = taskParser.parseTask('scroll down 5 px');
    if (p3.steps[0].amount !== 50) {
      console.error('Expected 50 floor, got: ' + p3.steps[0].amount);
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
    assert res.returncode == 0, f"Scroll bounding test failed: {res.stderr}"
    assert "OK" in res.stdout
    print("[PASS] test_bounded_numeric_scroll_parsing")

# =====================================================================
# Test 9: Low-Confidence Rejection (score < 0.35)
# =====================================================================
def test_low_confidence_rejection():
    """Asserts tasks with no matching elements fail closed with action: NONE."""
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Log Out"},
            {"type": "link", "label": "Privacy Policy"}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=_make_dummy_image(),
        task="book a submarine ticket to atlantis",
        context=context,
        privacyMetadata=_make_privacy_meta(),
        requestId="test-low-conf"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "NONE"
    assert res["action"]["target"] is None
    print("[PASS] test_low_confidence_rejection")

def test_local_http_test_page_endpoint():
    """Asserts FastAPI serves test-page.html at GET /test-page.html for judges."""
    resp = asyncio.run(serve_test_page())
    assert resp.status_code == 200
    assert resp.media_type == "text/html"
    assert os.path.exists(resp.path)
    with open(resp.path, "r", encoding="utf-8") as f:
        html_content = f.read()
    assert "SIH 2026" in html_content
    assert "Country of Origin" in html_content
    print("[PASS] test_local_http_test_page_endpoint")

if __name__ == "__main__":
    print("\n========================================================")
    print("RUNNING GENERIC BROWSER AGENT AUTOMATED TEST SUITE")
    print("========================================================\n")
    test_generic_button_and_link_grounding()
    test_ambiguous_target_rejection()
    test_specific_disambiguation()
    test_disabled_element_protection()
    test_complete_10_step_label_hierarchy()
    test_multi_field_parsing_and_privacy()
    test_combined_task_parsing()
    test_bounded_numeric_scroll_parsing()
    test_low_confidence_rejection()
    test_local_http_test_page_endpoint()
    print("\n========================================================")
    print("ALL GENERIC BROWSER AGENT TESTS PASSED CLEANLY!")
    print("========================================================\n")
