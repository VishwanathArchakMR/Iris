"""
test_multi_step_agent.py — End-to-end multi-step agent loop verification.
Tests the multi-step Wikipedia task:
"find english and click it and find the search box and search for artificial intelligence and find search button and click it"
Verifies:
1. Grounding and action proposal at each step.
2. Provider telemetry (Gemini when available; Demo fallback when key missing or quota exhausted).
3. Local safety validation and allowlisting.
"""

import os
import sys
import json
import io
import asyncio

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
for p in [CURRENT_DIR, PROJECT_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import UploadFile
from main import (
    receive_visual_context,
    get_agent_provider,
    set_active_agent_provider,
    ALLOWED_ACTIONS
)

def make_dummy_img():
    return UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"fake_sanitized_image_bytes"))

def make_privacy_meta(count=1):
    return json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": count,
        "timestamp": 1726000000000
    })

async def run_multi_step_test():
    provider = get_agent_provider()
    set_active_agent_provider(provider)

    task = "find english and click it and find the search box and search for artificial intelligence and find search button and click it"
    print("=" * 65)
    print("TESTING MULTI-STEP AGENT FLOW:")
    print(f"Task: {task}")
    print(f"Configured Provider: {provider.last_provider_name} ({provider.last_provider_type})")
    print("=" * 65)

    # STEP 1: Wikipedia Landing Page
    step1_ctx = {
        "title": "Wikipedia, the free encyclopedia",
        "elements": [
            {"index": 0, "type": "link", "label": "English - 7,237,000+ articles", "tag": "a"},
            {"index": 1, "type": "link", "label": "Español - 1,900,000+ artículos", "tag": "a"},
            {"index": 2, "type": "link", "label": "Français - 2,600,000+ articles", "tag": "a"}
        ]
    }
    res1 = await receive_visual_context(
        sanitizedScreenshot=make_dummy_img(),
        task="Find English and click it",
        context=json.dumps(step1_ctx),
        privacyMetadata=make_privacy_meta(0),
        requestId="req-step-1"
    )
    print(f"\n[STEP 1 RESULT]")
    print(f"  Action proposed: {res1['action']['action']} -> {res1['action'].get('targetLabel') or res1['action'].get('target')}")
    print(f"  Provider: {res1['provider']} (Type: {res1['providerType']}, Fallback Used: {res1['fallbackUsed']})")
    assert res1["action"]["action"] == "CLICK", f"Expected CLICK, got {res1['action']['action']}"
    assert res1["action"]["action"] in ALLOWED_ACTIONS

    # STEP 2: Navigated to English Wikipedia Main Page
    step2_ctx = {
        "title": "Wikipedia, the free encyclopedia (English)",
        "elements": [
            {"index": 0, "type": "link", "label": "Main Page", "tag": "a"},
            {"index": 1, "type": "input", "label": "Search Wikipedia", "placeholder": "Search Wikipedia", "tag": "input"},
            {"index": 2, "type": "button", "label": "Search", "tag": "button"}
        ]
    }
    res2 = await receive_visual_context(
        sanitizedScreenshot=make_dummy_img(),
        task="find the search box and search for artificial intelligence",
        context=json.dumps(step2_ctx),
        privacyMetadata=make_privacy_meta(0),
        requestId="req-step-2"
    )
    print(f"\n[STEP 2 RESULT]")
    print(f"  Action proposed: {res2['action']['action']} -> {res2['action'].get('targetLabel') or res2['action'].get('target')}")
    print(f"  Provider: {res2['provider']} (Type: {res2['providerType']}, Fallback Used: {res2['fallbackUsed']})")
    assert res2["action"]["action"] in {"FILL", "CLICK"}, f"Expected FILL or CLICK, got {res2['action']['action']}"
    assert res2["action"]["action"] in ALLOWED_ACTIONS

    # STEP 3: Click Search Button
    step3_ctx = {
        "title": "Wikipedia, the free encyclopedia (English)",
        "elements": [
            {"index": 0, "type": "input", "label": "Search Wikipedia", "tag": "input"},
            {"index": 1, "type": "button", "label": "Search", "tag": "button"}
        ]
    }
    res3 = await receive_visual_context(
        sanitizedScreenshot=make_dummy_img(),
        task="find search button and click it",
        context=json.dumps(step3_ctx),
        privacyMetadata=make_privacy_meta(0),
        requestId="req-step-3"
    )
    print(f"\n[STEP 3 RESULT]")
    print(f"  Action proposed: {res3['action']['action']} -> {res3['action'].get('targetLabel') or res3['action'].get('target')}")
    print(f"  Provider: {res3['provider']} (Type: {res3['providerType']}, Fallback Used: {res3['fallbackUsed']})")
    assert res3["action"]["action"] == "CLICK", f"Expected CLICK, got {res3['action']['action']}"
    assert res3["action"]["action"] in ALLOWED_ACTIONS

    print("\n" + "=" * 65)
    print("ALL 3 STEPS COMPLETED SUCCESSFULLY!")
    print(f"Provider Active Across Steps: {res3['provider']}")
    print(f"Fallback Used: {res3['fallbackUsed']}")
    if res3.get("fallbackReason"):
        print(f"Fallback Reason: {res3['fallbackReason']}")
    print("=" * 65)
    return res3

if __name__ == "__main__":
    asyncio.run(run_multi_step_test())
