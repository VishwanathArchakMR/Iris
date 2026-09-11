"""
test_ai_reasoning_provider.py — Comprehensive Test Suite for SIH26171 AI Reasoning Integration
Validates:
 1. Provider selection (AGENT_PROVIDER=demo vs AGENT_PROVIDER=gemini)
 2. Demo provider deterministic stability and backwards compatibility
 3. Gemini provider unavailable / network failure -> automatic fallback to DemoAgentProvider
 4. Missing GEMINI_API_KEY -> automatic safe fallback
 5. Gemini malformed JSON response -> safe recovery / fallback
 6. Invalid AI action outside allowlist -> strictly rejected
 7. AI cannot execute arbitrary JavaScript or browser APIs
 8. Privacy contract: Sensitive data (passwords, PII, form values) excluded from AI prompt
 9. Password fields explicitly stripped from perceived elements before prompt generation
10. FILL_FORM values remain local; AI proposals never transmit profile values
11. Local grounding remains authoritative over AI target selection
12. Ambiguous targets trigger safe rejection (NONE / AMBIGUOUS)
13. High-risk submit / consequential actions enforce human approval gate
14. Semantic phrasing resolution (English vs English language, Next vs Continue vs Proceed, Search)
15. Multi-page webpage structure testing across 10 demo page contexts
16. Mocked Gemini responses for automated deterministic testing
17. Live integration test (skipped when GEMINI_API_KEY is not configured)
"""

import os
import sys
import json
import io
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi import UploadFile, HTTPException

# Ensure backend directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from main import (
    app,
    ALLOWED_ACTIONS,
    AgentAction,
    DemoAgentProvider,
    GeminiAgentProvider,
    get_agent_provider,
    set_active_agent_provider,
    receive_visual_context,
    assert_no_forbidden_value_keys
)

def _make_dummy_image() -> UploadFile:
    return UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummy_sanitized_image_bytes"))

def _make_privacy_meta(count: int = 1) -> str:
    return json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": count,
        "timestamp": 1726000000000
    })

# ==============================================================================
# 1. PROVIDER SELECTION TESTS
# ==============================================================================

def test_provider_selection_demo_default():
    """Default provider must be DemoAgentProvider without external API keys."""
    with patch.dict(os.environ, {"AGENT_PROVIDER": "demo"}):
        provider = get_agent_provider()
        assert isinstance(provider, DemoAgentProvider)
        assert provider.last_provider_type == "demo"
        assert provider.last_provider_name == "Demo"

def test_provider_selection_gemini():
    """AGENT_PROVIDER=gemini instantiates GeminiAgentProvider."""
    with patch.dict(os.environ, {"AGENT_PROVIDER": "gemini", "GEMINI_API_KEY": "mock-test-key"}):
        provider = get_agent_provider("gemini")
        assert isinstance(provider, GeminiAgentProvider)
        assert provider.api_key == "mock-test-key"
        assert isinstance(provider.fallback_provider, DemoAgentProvider)

# ==============================================================================
# 2. DEMO PROVIDER STILL WORKS
# ==============================================================================

def test_demo_provider_click_action():
    """DemoAgentProvider correctly proposes CLICK for visible buttons and submits."""
    provider = DemoAgentProvider()
    
    # Generic button grounding (returns targetIndex)
    context_pricing = {
        "elements": [
            {"index": 0, "type": "button", "label": "Pricing Details", "disabled": False}
        ]
    }
    action_p, _ = provider.propose_action("Click pricing details", context_pricing)
    assert action_p["action"] == "CLICK"
    assert action_p["targetIndex"] == 0

    # Submit detection (returns SUBMIT_BUTTON)
    context_submit = {
        "elements": [
            {"index": 0, "type": "button", "label": "Submit Application", "disabled": False}
        ]
    }
    action_s, _ = provider.propose_action("Click submit", context_submit)
    assert action_s["action"] == "CLICK"
    assert action_s["target"] == "SUBMIT_BUTTON"
    assert provider.last_fallback_used is False

def test_demo_provider_scroll_action():
    """DemoAgentProvider correctly bounds and proposes SCROLL."""
    provider = DemoAgentProvider()
    context = {"elements": []}
    action, reasoning = provider.propose_action("Scroll down 600px", context)
    assert action["action"] == "SCROLL"
    assert action["amount"] == 600
    assert "SCROLL" in reasoning

# ==============================================================================
# 3. GEMINI FALLBACK WHEN UNAVAILABLE / NETWORK ERROR
# ==============================================================================

def test_gemini_fallback_on_network_error():
    """When Gemini API call throws a network or HTTP error, silently falls back to DemoAgentProvider."""
    provider = GeminiAgentProvider(api_key="valid-mock-key")
    context = {
        "elements": [
            {"index": 0, "type": "link", "label": "Pricing Details", "disabled": False}
        ]
    }

    with patch.object(provider, "_call_gemini", side_effect=RuntimeError("Connection refused to Gemini API")):
        action, reasoning = provider.propose_action("Click pricing details", context)
        assert provider.last_fallback_used is True
        assert provider.last_provider_type == "demo_fallback"
        assert "Demo Fallback" in reasoning
        assert action["action"] == "CLICK"
        assert action["targetIndex"] == 0

def test_gemini_fallback_on_timeout():
    """When Gemini API times out, automatically falls back to DemoAgentProvider."""
    import concurrent.futures
    provider = GeminiAgentProvider(api_key="valid-mock-key", timeout_seconds=0.1)
    context = {
        "elements": [
            {"index": 0, "type": "button", "label": "Download Weights", "disabled": False}
        ]
    }

    with patch.object(provider, "_call_gemini", side_effect=concurrent.futures.TimeoutError("Request timed out")):
        action, reasoning = provider.propose_action("Click download weights", context)
        assert provider.last_fallback_used is True
        assert "timed out" in provider.last_fallback_reason.lower()
        assert action["action"] == "CLICK"
        assert action["targetIndex"] == 0

# ==============================================================================
# 4. MISSING API KEY FALLBACK
# ==============================================================================

def test_gemini_fallback_when_api_key_empty():
    """If GEMINI_API_KEY is empty or unset, GeminiAgentProvider gracefully delegates to DemoAgentProvider."""
    provider = GeminiAgentProvider(api_key="")
    context = {
        "elements": [
            {"index": 0, "type": "button", "label": "Save Changes", "disabled": False}
        ]
    }
    action, reasoning = provider.propose_action("Save changes", context)
    assert provider.last_fallback_used is True
    assert "GEMINI_API_KEY is not set" in provider.last_fallback_reason
    assert action["action"] == "CLICK"
    assert action["targetIndex"] == 0

# ==============================================================================
# 5. MALFORMED JSON HANDLING
# ==============================================================================

def test_gemini_malformed_json_fallback():
    """Non-JSON or invalid JSON returned by model triggers safe fallback."""
    provider = GeminiAgentProvider(api_key="valid-mock-key")
    context = {
        "elements": [
            {"index": 0, "type": "button", "label": "Continue", "disabled": False}
        ]
    }

    with patch.object(provider, "_call_gemini", return_value="Here is your answer: I think you should click the continue button."):
        action, reasoning = provider.propose_action("Click continue", context)
        assert provider.last_fallback_used is True
        assert "Malformed JSON" in provider.last_fallback_reason
        assert action["action"] == "CLICK"

# ==============================================================================
# 6. STRICT SCHEMA & ACTION ALLOWLIST
# ==============================================================================

def test_gemini_invalid_action_rejected():
    """If Gemini returns an invalid action not in ALLOWED_ACTIONS, it is safely rejected/fell back."""
    provider = GeminiAgentProvider(api_key="valid-mock-key")
    context = {
        "elements": [
            {"index": 0, "type": "button", "label": "Submit", "disabled": False}
        ]
    }
    malicious_ai_output = json.dumps({
        "action": "EXECUTE_SCRIPT",
        "target": "document.cookie",
        "confidence": 0.99,
        "reasoning": "Attempting unauthorized execution"
    })

    with patch.object(provider, "_call_gemini", return_value=malicious_ai_output):
        action, reasoning = provider.propose_action("Submit form", context)
        assert provider.last_fallback_used is True
        assert "Invalid action" in provider.last_fallback_reason
        # Fallback executes safe allowlisted action
        assert action["action"] in ALLOWED_ACTIONS

# ==============================================================================
# 7. AI CANNOT EXECUTE ARBITRARY JAVASCRIPT
# ==============================================================================

def test_ai_cannot_execute_javascript():
    """Verifies that arbitrary JS or eval payloads are never allowed as actions or targets."""
    for bad_action in ["EVAL", "RUN_JS", "JAVASCRIPT", "EXEC", "FETCH", "NAVIGATE_ARBITRARY"]:
        with pytest.raises(Exception):
            AgentAction(action=bad_action)

# ==============================================================================
# 8. SENSITIVE DATA EXCLUDED FROM AI PAYLOAD
# ==============================================================================

def test_sensitive_data_not_in_ai_payload():
    """Verifies that prompt generation strips password fields and does not leak form values."""
    provider = GeminiAgentProvider(api_key="mock-key")
    dirty_context = {
        "title": "Registration Page",
        "elements": [
            {"index": 0, "type": "text", "label": "Full Name", "disabled": False},
            {"index": 1, "type": "password", "label": "User Password", "disabled": False},
            {"index": 2, "type": "hidden", "label": "CSRF Token", "disabled": False},
            {"index": 3, "type": "button", "label": "Register", "disabled": False}
        ]
    }

    sanitized = provider._sanitize_context_for_prompt(dirty_context)
    element_labels = [el["label"] for el in sanitized["elements"]]
    element_types = [el["type"] for el in sanitized["elements"]]

    # Password and hidden fields must NOT be in sanitized payload
    assert "User Password" not in element_labels
    assert "password" not in element_types
    assert "CSRF Token" not in element_labels
    assert "hidden" not in element_types
    assert "Full Name" in element_labels
    assert "Register" in element_labels

def test_forbidden_keys_rejected_by_assertion():
    """Backend assert_no_forbidden_value_keys rejects any literal form values."""
    payload_with_value = {
        "user_task": "fill form",
        "nested": {"field_value": "secret_password_123"}
    }
    with pytest.raises(HTTPException) as exc_info:
        assert_no_forbidden_value_keys(payload_with_value)
    assert exc_info.value.status_code == 422
    assert "Privacy violation" in exc_info.value.detail

# ==============================================================================
# 9. FILL_FORM VALUES REMAIN STRICTLY LOCAL
# ==============================================================================

def test_fill_form_action_values_remain_local():
    """FILL_FORM action returned by Gemini produces a structured intent without carrying form values."""
    provider = GeminiAgentProvider(api_key="mock-key")
    context = {
        "title": "Contact Form",
        "elements": [
            {"index": 0, "type": "input", "label": "Name", "disabled": False},
            {"index": 1, "type": "input", "label": "Email", "disabled": False},
        ]
    }
    gemini_fill_form_output = json.dumps({
        "action": "FILL_FORM",
        "target": "all form fields",
        "confidence": 0.95,
        "reasoning": "User requested filling the entire contact form.",
        "ambiguity": "NONE",
        "requiresApproval": False
    })

    with patch.object(provider, "_call_gemini", return_value=gemini_fill_form_output):
        action, reasoning = provider.propose_action("Fill the form with my profile", context)
        assert action["action"] == "FILL_FORM"
        assert "value" not in action
        assert "fieldValue" not in action
        assert action["groundingMethod"] == "gemini-profile-fill"

# ==============================================================================
# 10. LOCAL GROUNDING IS AUTHORITATIVE OVER AI
# ==============================================================================

def test_hallucinated_ai_target_rejected_by_grounding():
    """If Gemini proposes a target that does not exist in the DOM elements, grounding fails safely."""
    provider = GeminiAgentProvider(api_key="mock-key")
    context = {
        "title": "Store Catalog",
        "elements": [
            {"index": 0, "type": "button", "label": "Search Catalog", "disabled": False},
            {"index": 1, "type": "link", "label": "Cart (0)", "disabled": False}
        ]
    }
    hallucinated_ai_output = json.dumps({
        "action": "CLICK",
        "target": "Checkout Immediately",
        "targetRole": "button",
        "targetIndex": 99,
        "confidence": 0.90,
        "reasoning": "Selecting checkout button",
        "ambiguity": "NONE",
        "requiresApproval": False
    })

    with patch.object(provider, "_call_gemini", return_value=hallucinated_ai_output):
        action, reasoning = provider.propose_action("Click checkout immediately", context)
        assert action["action"] == "NONE"
        assert action["groundingMethod"] == "grounding-failed"
        assert "could not be safely grounded" in reasoning

# ==============================================================================
# 11. AMBIGUOUS TARGETS ARE REJECTED
# ==============================================================================

def test_ambiguous_targets_rejected():
    """If Gemini or local grounding identifies ambiguous targets, safe rejection is enforced."""
    provider = GeminiAgentProvider(api_key="mock-key")
    context = {
        "title": "Language Selector",
        "elements": [
            {"index": 0, "type": "link", "label": "Download English PDF", "disabled": False},
            {"index": 1, "type": "link", "label": "Download English DOC", "disabled": False}
        ]
    }
    gemini_ambiguous_output = json.dumps({
        "action": "CLICK",
        "target": "English",
        "confidence": 0.60,
        "reasoning": "Multiple English links exist",
        "ambiguity": "AMBIGUOUS",
        "requiresApproval": False
    })

    with patch.object(provider, "_call_gemini", return_value=gemini_ambiguous_output):
        action, reasoning = provider.propose_action("Click English", context)
        assert action["action"] == "NONE"
        assert action["ambiguity"] == "AMBIGUOUS"

# ==============================================================================
# 12. HIGH-RISK SUBMIT ACTIONS ENFORCE APPROVAL GATE
# ==============================================================================

def test_submit_action_enforces_requires_approval():
    """Even if AI sets requiresApproval=False on a submit action, safety rules enforce True."""
    provider = GeminiAgentProvider(api_key="mock-key")
    context = {
        "title": "Payment Portal",
        "elements": [
            {"index": 0, "type": "button", "label": "Submit Payment Now", "disabled": False}
        ]
    }
    gemini_submit_output = json.dumps({
        "action": "CLICK",
        "target": "Submit Payment Now",
        "targetRole": "button",
        "targetIndex": 0,
        "confidence": 0.98,
        "reasoning": "Clicking submit payment",
        "ambiguity": "NONE",
        "requiresApproval": False  # AI mistakenly claimed no approval needed
    })

    with patch.object(provider, "_call_gemini", return_value=gemini_submit_output):
        action, reasoning = provider.propose_action("Submit payment", context)
        assert action["action"] == "CLICK"
        # Local safety rule overrides AI: submit MUST require approval!
        assert action["requiresApproval"] is True

# ==============================================================================
# 13. SEMANTIC PHRASING RESOLUTION
# ==============================================================================

def test_semantic_phrasing_english_link():
    """Resolves 'Find the English link and click it' correctly."""
    provider = GeminiAgentProvider(api_key="mock-key")
    context = {
        "title": "Portal Navigation",
        "elements": [
            {"index": 0, "type": "link", "label": "Pricing Page", "disabled": False},
            {"index": 1, "type": "link", "label": "English", "disabled": False},
            {"index": 2, "type": "link", "label": "Documentation", "disabled": False}
        ]
    }
    gemini_output = json.dumps({
        "action": "CLICK",
        "target": "English",
        "targetRole": "link",
        "targetIndex": 1,
        "confidence": 0.96,
        "reasoning": "Target matches the requested English navigation link.",
        "ambiguity": "NONE",
        "requiresApproval": False
    })

    with patch.object(provider, "_call_gemini", return_value=gemini_output):
        action, reasoning = provider.propose_action("Find the English link and click it", context)
        assert action["action"] == "CLICK"
        assert action["targetIndex"] == 1
        assert action["targetLabel"] == "English"
        assert action["groundingMethod"] == "gemini-grounded-local"

def test_semantic_phrasing_continue_vs_next():
    """Resolves 'Proceed' or 'Continue' semantically to Next button."""
    provider = GeminiAgentProvider(api_key="mock-key")
    context = {
        "title": "Multi-step Wizard",
        "elements": [
            {"index": 0, "type": "button", "label": "Next Step", "disabled": False}
        ]
    }
    gemini_output = json.dumps({
        "action": "CLICK",
        "target": "Next Step",
        "targetRole": "button",
        "targetIndex": 0,
        "confidence": 0.92,
        "reasoning": "'Proceed' maps semantically to 'Next Step'.",
        "ambiguity": "NONE",
        "requiresApproval": False
    })

    with patch.object(provider, "_call_gemini", return_value=gemini_output):
        action, reasoning = provider.propose_action("Proceed to the next page", context)
        assert action["action"] == "CLICK"
        assert action["targetIndex"] == 0

# ==============================================================================
# 14. MULTI-PAGE STRUCTURE VERIFICATION
# ==============================================================================

@pytest.mark.parametrize("page_name,task,expected_action,element_label", [
    ("simple-form.html", "fill the form", "FILL_FORM", None),
    ("generic-form.html", "fill the comments field", "FILL", "Comments / Feedback"),
    ("navigation.html", "find the English link and click it", "CLICK", "English"),
    ("search.html", "find the search box", "CLICK", "Search query"),
    ("article.html", "scroll down the article", "SCROLL", None),
    ("shopping.html", "add product to cart", "CLICK", "Add to Cart"),
    ("dynamic.html", "load more items", "CLICK", "Load More Items"),
    ("login.html", "click login", "CLICK", "Sign In"),
    ("accessibility-form.html", "fill applicant name", "FILL", "Applicant Full Name"),
    ("controls.html", "toggle dark mode", "CLICK", "Dark Mode")
])
def test_multi_page_semantic_grounding(page_name, task, expected_action, element_label):
    """Verifies that the agent grounds appropriately across 10 diverse demo page layouts."""
    elements = []
    if element_label:
        elements.append({"index": 0, "type": "button" if "click" in task or "add" in task or "toggle" in task or "load" in task or "find" in task else "input", "label": element_label, "disabled": False})

    provider = GeminiAgentProvider(api_key="mock-key")
    gemini_response = json.dumps({
        "action": expected_action,
        "target": element_label if element_label else ("PAGE" if expected_action == "SCROLL" else "all form fields"),
        "targetIndex": 0 if element_label else None,
        "amount": 500 if expected_action == "SCROLL" else None,
        "confidence": 0.90,
        "reasoning": f"Grounded task '{task}' on {page_name}",
        "ambiguity": "NONE",
        "requiresApproval": False
    })

    with patch.object(provider, "_call_gemini", return_value=gemini_response):
        action, reasoning = provider.propose_action(task, {"title": page_name, "elements": elements})
        assert action["action"] == expected_action

# ==============================================================================
# 15. VISUAL CONTEXT ENDPOINT INTEGRATION
# ==============================================================================

def test_visual_context_endpoint_with_gemini_provider():
    """POST /api/visual-context returns correct provider metadata when Gemini is active."""
    gemini_provider = GeminiAgentProvider(api_key="mock-key")
    set_active_agent_provider(gemini_provider)

    mock_gemini_output = json.dumps({
        "action": "CLICK",
        "target": "English",
        "targetRole": "link",
        "targetIndex": 0,
        "confidence": 0.94,
        "reasoning": "Selected visible English link",
        "ambiguity": "NONE",
        "requiresApproval": False
    })

    with patch.object(gemini_provider, "_call_gemini", return_value=mock_gemini_output):
        context_json = json.dumps({
            "title": "Navigation Page",
            "elements": [{"index": 0, "type": "link", "label": "English", "disabled": False}]
        })
        res = asyncio.run(receive_visual_context(
            sanitizedScreenshot=_make_dummy_image(),
            task="Find the English link and click it",
            context=context_json,
            privacyMetadata=_make_privacy_meta(1),
            requestId="req-gemini-ai-1"
        ))

        assert res["status"] == "success"
        assert res["provider"] == "Gemini"
        assert res["agentMode"] == "gemini"
        assert res["fallbackUsed"] is False
        assert res["action"]["action"] == "CLICK"
        assert res["action"]["targetIndex"] == 0

    # Reset provider to default DemoAgentProvider
    set_active_agent_provider(DemoAgentProvider())

def test_visual_context_endpoint_fallback_telemetry():
    """POST /api/visual-context tags response as 'Demo fallback' when Gemini fails."""
    gemini_provider = GeminiAgentProvider(api_key="mock-key")
    set_active_agent_provider(gemini_provider)

    with patch.object(gemini_provider, "_call_gemini", side_effect=RuntimeError("Gemini 503 Overloaded")):
        context_json = json.dumps({
            "title": "Navigation Page",
            "elements": [{"index": 0, "type": "button", "label": "Submit", "disabled": False}]
        })
        res = asyncio.run(receive_visual_context(
            sanitizedScreenshot=_make_dummy_image(),
            task="Click submit",
            context=context_json,
            privacyMetadata=_make_privacy_meta(1),
            requestId="req-gemini-fallback-1"
        ))

        assert res["status"] == "success"
        assert res["provider"] == "Demo fallback"
        assert res["fallbackUsed"] is True
        assert res["agentMode"] == "demo"
        assert "fallbackReason" in res
        assert res["action"]["action"] == "CLICK"

    # Reset provider to default DemoAgentProvider
    set_active_agent_provider(DemoAgentProvider())

# ==============================================================================
# 16. LIVE GEMINI INTEGRATION (OPTIONAL)
# ==============================================================================

@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY environment variable not set")
def test_live_gemini_api_call():
    """Real live integration test with Gemini API; skipped if no key is present."""
    provider = GeminiAgentProvider(api_key=os.environ["GEMINI_API_KEY"])
    context = {
        "title": "Test Page",
        "elements": [
            {"index": 0, "type": "link", "label": "English language articles", "disabled": False}
        ]
    }
    action, reasoning = provider.propose_action("Find English link", context)
    assert action["action"] in ALLOWED_ACTIONS
    assert provider.last_fallback_used is False
