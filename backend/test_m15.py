"""
test_m15.py - Unit test suite for Milestone 15 backend generalized on-device grounding.
"""

import asyncio
import io
import json
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from main import (
    app,
    receive_visual_context,
    DemoAgentProvider
)

def test_grounded_matching_generic_button():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Add to Cart", "semanticTag": None},
            {"type": "link", "label": "Product Specifications", "semanticTag": None}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="add this product to my cart",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-cart"
    ))
    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "CLICK"
    assert action.get("targetIndex") == 0
    assert action.get("targetType") == "button"
    assert action.get("targetLabel") == "Add to Cart"
    assert action.get("groundingMethod") == "local-fuzzy-match"
    assert action.get("groundingScore", 0.0) >= 0.35
    assert "local on-device grounding" in res.get("reasoning", "").lower()
    print("[PASS] test_grounded_matching_generic_button")

def test_grounded_matching_sub_threshold_fallback():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Add to Cart", "semanticTag": None},
            {"type": "link", "label": "About Us", "semanticTag": None}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="fly an astronaut on space rocket",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-mars"
    ))
    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "NONE"
    assert action.get("target") is None
    assert action.get("targetIndex") is None
    print("[PASS] test_grounded_matching_sub_threshold_fallback")

def test_legacy_signals_priority_preserved():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Add to Cart", "semanticTag": None},
            {"type": "button", "label": "Log In", "semanticTag": "LOGIN_BUTTON"}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Click the login button to enter account",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-login-prio"
    ))
    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "CLICK"
    assert action.get("target") == "LOGIN_BUTTON"
    # Must NOT have targetIndex (legacy shape preserved)
    assert action.get("targetIndex") is None
    print("[PASS] test_legacy_signals_priority_preserved")

def test_empty_elements_safety():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": []
    })
    # Task that would otherwise fuzzy match if elements existed
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="add this product to my cart",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-empty"
    ))
    assert res["status"] == "success"
    action = res["action"]
    assert action["action"] == "NONE"
    assert action.get("target") is None
    assert action.get("targetIndex") is None
    print("[PASS] test_empty_elements_safety")

if __name__ == "__main__":
    print("\nRunning Milestone 15 Backend Grounding Tests...")
    test_grounded_matching_generic_button()
    test_grounded_matching_sub_threshold_fallback()
    test_legacy_signals_priority_preserved()
    test_empty_elements_safety()
    print("\nALL M15 BACKEND TESTS PASSED CLEANLY!\n")
