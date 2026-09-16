"""
test_m13.py - Direct unit test suite for Milestone 13 backend without external test runner dependencies.
Tests receive_visual_context, receive_context, privacy checks, size checks, and demo agent decisions.
"""

import asyncio
import io
import json
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from main import (
    app,
    PageContext,
    receive_context,
    receive_visual_context,
    MAX_SCREENSHOT_BYTES,
    DemoAgentProvider,
    set_active_agent_provider
)

def test_legacy_context_click():
    res = asyncio.run(receive_context(PageContext(
        title="Test Page",
        url="http://localhost/test",
        redactedSample="Please submit this contact form"
    )))
    assert res["status"] == "received"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "SUBMIT_BUTTON"
    print("[PASS] test_legacy_context_click")

def test_legacy_context_scroll():
    res = asyncio.run(receive_context(PageContext(
        title="Test Page",
        url="http://localhost/test",
        redactedSample="Scroll down to read more details"
    )))
    assert res["status"] == "received"
    assert res["action"]["action"] == "SCROLL"
    assert res["action"]["target"] == "PAGE"
    assert res["action"]["amount"] == 500
    print("[PASS] test_legacy_context_scroll")

def test_visual_context_rejects_raw_or_missing_privacy_state():
    dummy_img = UploadFile(filename="raw.png", file=io.BytesIO(b"fakebytes"))
    raw_meta = json.dumps({"privacyState": "RAW", "rawScreenshotTransmitted": True})
    
    # Case 1: privacyState is RAW
    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=dummy_img,
            task="Click submit button",
            context=json.dumps({"elements": []}),
            privacyMetadata=raw_meta,
            requestId="SIH-test-raw"
        ))
        assert False, "Should have raised HTTPException 422"
    except HTTPException as e:
        assert e.status_code == 422
        assert "Raw or unverified visual contexts are strictly prohibited" in e.detail
        print("[PASS] test_visual_context_rejects_raw_privacy_state")

    # Case 2: privacyState is missing
    missing_meta = json.dumps({"rawScreenshotTransmitted": False})
    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=UploadFile(filename="test.png", file=io.BytesIO(b"fakebytes")),
            task="Click submit button",
            context=json.dumps({"elements": []}),
            privacyMetadata=missing_meta,
            requestId="SIH-test-missing"
        ))
        assert False, "Should have raised HTTPException 422"
    except HTTPException as e:
        assert e.status_code == 422
        print("[PASS] test_visual_context_rejects_missing_privacy_state")

    # Case 3: rawScreenshotTransmitted is True even if privacyState is SANITIZED
    invalid_raw = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": True})
    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=UploadFile(filename="test.png", file=io.BytesIO(b"fakebytes")),
            task="Click submit button",
            context=json.dumps({"elements": []}),
            privacyMetadata=invalid_raw,
            requestId="SIH-test-invalid-raw"
        ))
        assert False, "Should have raised HTTPException 422"
    except HTTPException as e:
        assert e.status_code == 422
        assert "rawScreenshotTransmitted must be explicitly false" in e.detail
        print("[PASS] test_visual_context_rejects_true_raw_screenshot_transmitted")

def test_visual_context_valid_click():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": 3
    })
    context = json.dumps({
        "title": "SIH Demo Test Page",
        "url": "http://localhost:8000/test-page.html",
        "redactedSample": "Contact me at [REDACTED_EMAIL]",
        "elementCount": 4,
        "elements": [
            {"type": "button", "label": "Submit Form", "x": 100, "y": 200, "width": 80, "height": 30}
        ],
        "sensitiveRegionCount": 2,
        "ocrTextRegionCount": 10,
        "totalRedactedRegionCount": 3
    })

    set_active_agent_provider(DemoAgentProvider())
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Find the Submit button and click it",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-click-1"
    ))

    assert res["status"] == "success"
    assert res["agentMode"] == "demo"
    assert res["requestId"] == "SIH-req-click-1"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "SUBMIT_BUTTON"
    assert "reasoning" in res
    print("[PASS] test_visual_context_valid_click")

def test_visual_context_valid_scroll():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({
        "privacyState": "SANITIZED",
        "rawScreenshotTransmitted": False,
        "redactedRegionsCount": 1
    })
    context = json.dumps({
        "title": "SIH Demo Test Page",
        "url": "http://localhost:8000/test-page.html",
        "redactedSample": "Scroll down for more information",
        "elements": []
    })

    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Scroll down to explore more content",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-scroll-1"
    ))

    assert res["status"] == "success"
    assert res["action"]["action"] == "SCROLL"
    assert res["action"]["target"] == "PAGE"
    assert res["action"]["amount"] == 500
    print("[PASS] test_visual_context_valid_scroll")

def test_visual_context_rejects_oversized_payload():
    oversized_bytes = b"0" * (MAX_SCREENSHOT_BYTES + 1024)
    dummy_img = UploadFile(filename="huge.png", file=io.BytesIO(oversized_bytes))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})

    try:
        asyncio.run(receive_visual_context(
            sanitizedScreenshot=dummy_img,
            task="Click submit",
            context=json.dumps({}),
            privacyMetadata=privacy_meta,
            requestId="SIH-test-oversized"
        ))
        assert False, "Should have raised HTTPException 413"
    except HTTPException as e:
        assert e.status_code == 413
        assert "exceeds maximum permitted size" in e.detail
        print("[PASS] test_visual_context_rejects_oversized_payload")

if __name__ == "__main__":
    test_legacy_context_click()
    test_legacy_context_scroll()
    test_visual_context_rejects_raw_or_missing_privacy_state()
    test_visual_context_valid_click()
    test_visual_context_valid_scroll()
    test_visual_context_rejects_oversized_payload()
    print("\nALL BACKEND TESTS PASSED CLEANLY!")
