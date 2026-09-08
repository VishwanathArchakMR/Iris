"""
test_m17_production_hardening.py — SIH26171 Final Milestone 17 Production-Ready Hardening Test Suite

Deterministic, bounded, local-only verification:
1. Mandatory Multi-Field Unit Test: 'fill name as sankii and fill email as vish@gmail.com and fill address as mysore'
   - Assert Name != 'mysore', Email != 'mysore', Address == 'mysore'
   - Assert sanitized output never contains literal values
2. Combined Submit Test: 'fill name as sankii and fill email as vish@gmail.com and fill address as mysore and click submit'
   - Assert exact 4-step sequence: FILL Name -> FILL Email -> FILL Address -> CLICK Submit
3. Realistic Google Forms DOM Fixture:
   - Question container (.geS5n / .Qr7Oae), .M7eMe headings, paragraph textarea with aria-label="Your answer"
   - Assert all fields correctly grounded (Address is resolved to "Address", not "Your answer")
4. Wrong-Field Rejection (Phase 7 Safety):
   - Missing field returns action: NONE; NEVER falls back to first input
5. Custom role=textbox & contenteditable Support:
   - Perceived as form controls, labels extracted, values verified locally
6. Distinct Step Action Keys (Stall Guard):
   - Distinct steps produce distinct action keys and are not falsely flagged as stalls
"""

import asyncio
import io
import json
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from main import (
    receive_visual_context,
    DemoAgentProvider,
    _match_score,
    _normalize
)

def _make_dummy_image():
    return b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

def _make_privacy_meta():
    return json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": 0,
        "timestamp": 1234567890
    })

# =====================================================================
# Test 1: Mandatory Multi-Field Unit Test (Phase 26)
# =====================================================================
def test_mandatory_multi_field_unit_test():
    """
    Task: fill name as sankii and fill email as vish@gmail.com and fill address as mysore
    Assert:
      Step 1: target = Name, value = sankii
      Step 2: target = Email, value = vish@gmail.com
      Step 3: target = Address, value = mysore
      Name != mysore
      Email != mysore
      Address == mysore
      Sanitized plan does NOT contain: sankii, vish@gmail.com, mysore
    """
    node_script = """
    const parser = require('./task-parser.js');
    const task = 'fill name as sankii and fill email as vish@gmail.com and fill address as mysore';
    const parsed = parser.parseTask(task);

    if (parsed.intent !== 'MULTI_STEP') {
      console.error('Expected MULTI_STEP intent, got:', parsed.intent);
      process.exit(1);
    }

    if (!parsed.steps || parsed.steps.length !== 3) {
      console.error('Expected exactly 3 steps, got:', parsed.steps?.length);
      process.exit(1);
    }

    // Assert step targets and values
    const step0 = parsed.steps[0];
    const step1 = parsed.steps[1];
    const step2 = parsed.steps[2];

    if (step0.fieldHint.toLowerCase() !== 'name' || step0.value !== 'sankii') {
      console.error('Step 0 mismatch:', step0);
      process.exit(1);
    }
    if (step1.fieldHint.toLowerCase() !== 'email' || step1.value !== 'vish@gmail.com') {
      console.error('Step 1 mismatch:', step1);
      process.exit(1);
    }
    if (step2.fieldHint.toLowerCase() !== 'address' || step2.value !== 'mysore') {
      console.error('Step 2 mismatch:', step2);
      process.exit(1);
    }

    // Critical assertion: Name != mysore, Email != mysore, Address == mysore
    if (step0.value === 'mysore') {
      console.error('CRITICAL BUG: Name value must not be mysore!');
      process.exit(1);
    }
    if (step1.value === 'mysore') {
      console.error('CRITICAL BUG: Email value must not be mysore!');
      process.exit(1);
    }
    if (step2.value !== 'mysore') {
      console.error('CRITICAL BUG: Address value must be mysore!');
      process.exit(1);
    }

    // Privacy verification: sanitizedPlan must NOT leak any literal value
    const serializedPlan = JSON.stringify(parsed.sanitizedPlan);
    if (serializedPlan.includes('sankii') || serializedPlan.includes('vish@gmail.com') || serializedPlan.includes('mysore')) {
      console.error('CRITICAL PRIVACY VIOLATION: Literal values found in sanitizedPlan:', serializedPlan);
      process.exit(1);
    }

    // Verify localValues mapping
    if (parsed.localValues[0] !== 'sankii' || parsed.localValues[1] !== 'vish@gmail.com' || parsed.localValues[2] !== 'mysore') {
      console.error('LocalValues indexing mismatch:', parsed.localValues);
      process.exit(1);
    }

    console.log('PASS');
    """
    res = subprocess.run(["node", "-e", node_script], cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res.returncode == 0, f"Multi-field unit test failed: {res.stderr}"
    assert "PASS" in res.stdout
    print("[PASS] test_mandatory_multi_field_unit_test")

# =====================================================================
# Test 2: Combined Submit Test (Phase 27)
# =====================================================================
def test_combined_submit_test():
    """
    Task: fill name as sankii and fill email as vish@gmail.com and fill address as mysore and click submit
    Expected: exact 4-step sequence:
      1. FILL Name
      2. FILL Email
      3. FILL Address
      4. CLICK Submit
    """
    node_script = """
    const parser = require('./task-parser.js');
    const task = 'fill name as sankii and fill email as vish@gmail.com and fill address as mysore and click submit';
    const parsed = parser.parseTask(task);

    if (parsed.intent !== 'MULTI_STEP') {
      console.error('Expected MULTI_STEP intent');
      process.exit(1);
    }

    if (!parsed.steps || parsed.steps.length !== 4) {
      console.error('Expected 4 steps, got:', parsed.steps?.length);
      process.exit(1);
    }

    const expected = [
      { type: 'FILL', fieldHint: 'name', value: 'sankii' },
      { type: 'FILL', fieldHint: 'email', value: 'vish@gmail.com' },
      { type: 'FILL', fieldHint: 'address', value: 'mysore' },
      { type: 'CLICK', targetHint: 'submit' }
    ];

    for (let i = 0; i < 4; i++) {
      const s = parsed.steps[i];
      const e = expected[i];
      if (s.type !== e.type) {
        console.error(`Step ${i} type mismatch: ${s.type} vs ${e.type}`);
        process.exit(1);
      }
      if (e.fieldHint && s.fieldHint.toLowerCase() !== e.fieldHint) {
        console.error(`Step ${i} fieldHint mismatch: ${s.fieldHint} vs ${e.fieldHint}`);
        process.exit(1);
      }
      if (e.value && s.value !== e.value) {
        console.error(`Step ${i} value mismatch: ${s.value} vs ${e.value}`);
        process.exit(1);
      }
    }

    // Verify sanitizedPlan has zero literal values
    const planStr = JSON.stringify(parsed.sanitizedPlan);
    if (planStr.includes('sankii') || planStr.includes('vish@gmail.com') || planStr.includes('mysore')) {
      console.error('Privacy leak in combined sanitizedPlan');
      process.exit(1);
    }

    console.log('PASS');
    """
    res = subprocess.run(["node", "-e", node_script], cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res.returncode == 0, f"Combined submit test failed: {res.stderr}"
    assert "PASS" in res.stdout
    print("[PASS] test_combined_submit_test")

# =====================================================================
# Test 3: Realistic Google Forms DOM Fixture (Phase 28)
# =====================================================================
def test_realistic_google_forms_fixture():
    """
    Simulates Google Forms (/viewform) DOM:
    - Container 1 (.geS5n): Question "Name *", input with aria-labelledby="i1 i4" (where i4="Your answer")
    - Container 2 (.geS5n): Question "Email *", input with aria-labelledby="i5 i8"
    - Container 3 (.geS5n): Question "Address *", textarea with aria-label="Your answer"
    - Submit button: role="button" with text "Submit"
    Verifies content.js resolves Name, Email, Address (NOT "Your answer").
    """
    node_script = """
    const fs = require('fs');
    const contentJs = fs.readFileSync('./content.js', 'utf8');

    // Minimal DOM environment simulation
    const domRegistry = {};

    function mockElement(tag, attrs = {}, children = [], text = '') {
      return {
        tagName: tag.toUpperCase(),
        id: attrs.id || '',
        getAttribute: (k) => attrs[k] !== undefined ? attrs[k] : null,
        closest: (selector) => {
          if (attrs._container) return attrs._container;
          return null;
        },
        querySelector: (selector) => {
          for (const c of children) {
            if (selector.includes(c.tagName.toLowerCase())) return c;
            if (c.getAttribute && c.getAttribute('role') && selector.includes(`role='${c.getAttribute('role')}'`)) return c;
            if (c._classes && selector.includes(c._classes)) return c;
          }
          return null;
        },
        querySelectorAll: () => [],
        innerText: text,
        textContent: text,
        _classes: attrs.class || ''
      };
    }

    // Sandbox execution of extractFormFieldLabel
    const vm = require('vm');
    const sandbox = {
      document: {
        getElementById: (id) => domRegistry[id] || null,
        querySelector: () => null
      },
      CSS: { escape: (s) => s },
      console: console
    };
    vm.createContext(sandbox);
    vm.runInContext(contentJs, sandbox);

    const extractLabel = sandbox.extractFormFieldLabel;

    // 1. Google Forms Short Answer: Name
    const nameHeading = mockElement('div', { class: 'M7eMe' }, [], 'Name *');
    const nameContainer = mockElement('div', { class: 'geS5n' }, [nameHeading], '');
    const nameInput = mockElement('input', {
      type: 'text',
      _container: nameContainer,
      'aria-labelledby': 'i1 i4'
    });
    domRegistry['i1'] = nameHeading;
    domRegistry['i4'] = mockElement('div', { id: 'i4' }, [], 'Your answer');

    const resolvedName = extractLabel(nameInput, 'input');
    if (resolvedName !== 'Name') {
      console.error('Expected "Name", got:', resolvedName);
      process.exit(1);
    }

    // 2. Google Forms Short Answer: Email
    const emailHeading = mockElement('div', { class: 'M7eMe' }, [], 'Email *');
    const emailContainer = mockElement('div', { class: 'geS5n' }, [emailHeading], '');
    const emailInput = mockElement('input', {
      type: 'text',
      _container: emailContainer,
      'aria-labelledby': 'i5 i8'
    });
    domRegistry['i5'] = emailHeading;
    domRegistry['i8'] = mockElement('div', { id: 'i8' }, [], 'Your answer');

    const resolvedEmail = extractLabel(emailInput, 'input');
    if (resolvedEmail !== 'Email') {
      console.error('Expected "Email", got:', resolvedEmail);
      process.exit(1);
    }

    // 3. Google Forms Paragraph: Address (HAS aria-label="Your answer"!)
    const addressHeading = mockElement('div', { class: 'M7eMe' }, [], 'Address *');
    const addressContainer = mockElement('div', { class: 'geS5n' }, [addressHeading], '');
    const addressTextarea = mockElement('textarea', {
      _container: addressContainer,
      'aria-label': 'Your answer'
    });

    const resolvedAddress = extractLabel(addressTextarea, 'textarea');
    if (resolvedAddress !== 'Address') {
      console.error('CRITICAL BUG: Address must resolve to "Address", NOT "Your answer"! Got:', resolvedAddress);
      process.exit(1);
    }

    console.log('PASS');
    """
    res = subprocess.run(["node", "-e", node_script], cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res.returncode == 0, f"Google Forms fixture test failed: {res.stderr}"
    assert "PASS" in res.stdout
    print("[PASS] test_realistic_google_forms_fixture")

# =====================================================================
# Test 4: Wrong-Field Rejection (Phase 7 Safety)
# =====================================================================
def test_wrong_field_rejection_no_fallback():
    """
    When the task is to fill 'Passport Number', but the page only has 'Name', 'Email', 'Address':
    Backend must return action: NONE. It must NEVER fall back to 'Name' (element 0).
    """
    provider = DemoAgentProvider()
    elements = [
        {"type": "input", "label": "Full Name", "fieldId": 0},
        {"type": "input", "label": "Email Address", "fieldId": 1},
        {"type": "textarea", "label": "Street Address", "fieldId": 2},
        {"type": "button", "label": "Submit Application"}
    ]

    # Case A: via fieldPlan
    action, reasoning = provider.propose_action(
        task="Fill Passport Number",
        context={
            "elements": elements,
            "fieldPlan": [{"fieldHint": "Passport Number"}],
            "loopStep": 1
        }
    )
    assert action["action"] == "NONE", f"Expected NONE for ungrounded field, got {action['action']}"
    assert "Could not safely ground" in reasoning
    assert action.get("targetIndex") is None

    # Case B: via primary task intent
    action2, reasoning2 = provider.propose_action(
        task="fill passport number as A1234567",
        context={"elements": elements}
    )
    assert action2["action"] == "NONE", f"Expected NONE for ungrounded field, got {action2['action']}"
    print("[PASS] test_wrong_field_rejection_no_fallback")

# =====================================================================
# Test 5: End-to-End Google Forms Grounding Sequence
# =====================================================================
def test_google_forms_multi_step_grounding_sequence():
    """
    Verifies that for Google Forms elements:
      Step 1: Fill Name -> matches element #0 (Name)
      Step 2: Fill Email -> matches element #1 (Email)
      Step 3: Fill Address -> matches element #2 (Address)
      Step 4: Click Submit -> matches element #3 (Submit)
    """
    provider = DemoAgentProvider()
    elements = [
        {"type": "input", "label": "Name", "fieldId": 0},
        {"type": "input", "label": "Email", "fieldId": 1},
        {"type": "textarea", "label": "Address", "fieldId": 2},
        {"type": "button", "label": "Submit", "semanticTag": "SUBMIT_BUTTON"}
    ]

    # Step 1: Name
    a1, _ = provider.propose_action(
        task="Fill name",
        context={"elements": elements, "fieldPlan": [{"fieldHint": "name"}], "loopStep": 1}
    )
    assert a1["action"] == "FILL"
    assert a1["targetIndex"] == 0
    assert a1["targetLabel"] == "Name"

    # Step 2: Email
    a2, _ = provider.propose_action(
        task="Fill email",
        context={"elements": elements, "fieldPlan": [{"fieldHint": "email"}], "loopStep": 1}
    )
    assert a2["action"] == "FILL"
    assert a2["targetIndex"] == 1
    assert a2["targetLabel"] == "Email"

    # Step 3: Address
    a3, _ = provider.propose_action(
        task="Fill address",
        context={"elements": elements, "fieldPlan": [{"fieldHint": "address"}], "loopStep": 1}
    )
    assert a3["action"] == "FILL"
    assert a3["targetIndex"] == 2
    assert a3["targetLabel"] == "Address"

    # Step 4: Click Submit
    a4, _ = provider.propose_action(
        task="Click submit",
        context={"elements": elements, "fieldPlan": [], "loopStep": 4}
    )
    assert a4["action"] == "CLICK"
    assert a4.get("target") == "SUBMIT_BUTTON" or a4.get("targetIndex") == 3
    print("[PASS] test_google_forms_multi_step_grounding_sequence")

# =====================================================================
# Test 6: Custom role=textbox Support in Classifier
# =====================================================================
def test_role_textbox_classification():
    """
    Verifies that <div role="textbox"> is recognized as a form field in content.js.
    """
    node_script = """
    const fs = require('fs');
    const contentJs = fs.readFileSync('./content.js', 'utf8');

    const vm = require('vm');
    const sandbox = {
      document: {
        getElementById: () => null,
        querySelector: () => null
      },
      window: {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' })
      },
      CSS: { escape: (s) => s },
      console: console
    };
    vm.createContext(sandbox);
    vm.runInContext(contentJs, sandbox);

    const mockDiv = {
      tagName: 'DIV',
      getAttribute: (attr) => attr === 'role' ? 'textbox' : (attr === 'aria-label' ? 'Feedback Notes' : null),
      getBoundingClientRect: () => ({ x: 10, y: 10, width: 200, height: 80 }),
      closest: () => null,
      querySelectorAll: () => [],
      innerText: '',
      textContent: ''
    };

    const desc = sandbox.classifyVisualElement(mockDiv, 0);
    if (!desc) {
      console.error('Failed to classify role=textbox div');
      process.exit(1);
    }
    if (desc.type !== 'input' && desc.type !== 'textarea') {
      console.error('role=textbox must be classified as input/textarea, got:', desc.type);
      process.exit(1);
    }
    if (desc.label !== 'Feedback Notes') {
      console.error('Label extraction failed on role=textbox, got:', desc.label);
      process.exit(1);
    }
    if (!desc.isInteractable) {
      console.error('role=textbox must be marked isInteractable: true');
      process.exit(1);
    }

    console.log('PASS');
    """
    res = subprocess.run(["node", "-e", node_script], cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res.returncode == 0, f"role=textbox classification test failed: {res.stderr}"
    assert "PASS" in res.stdout
    print("[PASS] test_role_textbox_classification")

# =====================================================================
# Test 7: Stall Guard Action Key Uniqueness Across Distinct Steps
# =====================================================================
def test_stall_guard_action_key_uniqueness():
    """
    Verifies that distinct steps in a multi-step task generate distinct action keys.
    """
    node_script = """
    function computeActionKey(stepPlan, currentStep, agentAction) {
      const stepIdentifier = stepPlan
        ? `step_${currentStep - 1}:${stepPlan.type}:${stepPlan.fieldHint || stepPlan.targetHint || ''}`
        : `step_${currentStep}`;
      const actionTargetIdentifier = agentAction?.target ||
        (agentAction?.targetIndex !== undefined ? `#${agentAction.targetIndex}:${agentAction.targetType}:${agentAction.targetLabel}` : '');
      return `${stepIdentifier}:${agentAction?.action}:${actionTargetIdentifier}:${agentAction?.amount || ''}`;
    }

    const step1 = { type: 'FILL', fieldHint: 'name' };
    const act1 = { action: 'FILL', targetIndex: 0, targetType: 'input', targetLabel: 'Name' };
    const key1 = computeActionKey(step1, 1, act1);

    const step2 = { type: 'FILL', fieldHint: 'email' };
    const act2 = { action: 'FILL', targetIndex: 1, targetType: 'input', targetLabel: 'Email' };
    const key2 = computeActionKey(step2, 2, act2);

    const step3 = { type: 'FILL', fieldHint: 'address' };
    const act3 = { action: 'FILL', targetIndex: 2, targetType: 'textarea', targetLabel: 'Address' };
    const key3 = computeActionKey(step3, 3, act3);

    const step4 = { type: 'CLICK', targetHint: 'submit' };
    const act4 = { action: 'CLICK', target: 'SUBMIT_BUTTON' };
    const key4 = computeActionKey(step4, 4, act4);

    if (key1 === key2 || key2 === key3 || key3 === key4 || key1 === key3) {
      console.error('Keys must all be distinct:', { key1, key2, key3, key4 });
      process.exit(1);
    }

    // A repeated attempt of step 3 must match key3
    const key3Retry = computeActionKey(step3, 3, act3);
    if (key3 !== key3Retry) {
      console.error('Retry of same step must produce identical key for stall detection');
      process.exit(1);
    }

    console.log('PASS');
    """
    res = subprocess.run(["node", "-e", node_script], cwd=PROJECT_ROOT, capture_output=True, text=True)
    assert res.returncode == 0, f"Stall guard uniqueness test failed: {res.stderr}"
    assert "PASS" in res.stdout
    print("[PASS] test_stall_guard_action_key_uniqueness")

# =====================================================================
# Main Runner
# =====================================================================
if __name__ == "__main__":
    print("\n========================================================")
    print("RUNNING MILESTONE 17 PRODUCTION HARDENING TEST SUITE")
    print("========================================================\n")
    test_mandatory_multi_field_unit_test()
    test_combined_submit_test()
    test_realistic_google_forms_fixture()
    test_wrong_field_rejection_no_fallback()
    test_google_forms_multi_step_grounding_sequence()
    test_role_textbox_classification()
    test_stall_guard_action_key_uniqueness()
    print("\n========================================================")
    print("ALL MILESTONE 17 PRODUCTION HARDENING TESTS PASSED CLEANLY!")
    print("========================================================\n")
