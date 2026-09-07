"""
test_m14.py - Unit test suite for Milestone 14 backend semantic target resolution and visual gateway.
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
    DemoAgentProvider
)

def test_semantic_resolution_login():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Log In", "semanticTag": "LOGIN_BUTTON"}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Click the login button to enter account",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-login"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "LOGIN_BUTTON"
    print("[PASS] test_semantic_resolution_login")

def test_semantic_resolution_next():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Next Step", "semanticTag": "NEXT_BUTTON"}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Continue to the next step",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-next"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "NEXT_BUTTON"
    print("[PASS] test_semantic_resolution_next")

def test_semantic_resolution_search():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "input", "label": "Search knowledge base", "semanticTag": "SEARCH_INPUT"}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Search the knowledge base",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-search"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "SEARCH_INPUT"
    print("[PASS] test_semantic_resolution_search")

def test_semantic_resolution_submit():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({
        "elements": [
            {"type": "button", "label": "Submit Form", "semanticTag": "SUBMIT_BUTTON"}
        ]
    })
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Find the Submit button and click it",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-submit"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "SUBMIT_BUTTON"
    print("[PASS] test_semantic_resolution_submit")

def test_semantic_resolution_scroll():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({"elements": []})
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Scroll down to explore content",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-scroll"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "SCROLL"
    assert res["action"]["target"] == "PAGE"
    assert res["action"]["amount"] == 500
    print("[PASS] test_semantic_resolution_scroll")

def test_unsupported_task_returns_none():
    dummy_img = UploadFile(filename="sanitized.jpg", file=io.BytesIO(b"dummyimagebytes"))
    privacy_meta = json.dumps({"privacyState": "SANITIZED", "rawScreenshotTransmitted": False})
    context = json.dumps({"elements": []})
    res = asyncio.run(receive_visual_context(
        sanitizedScreenshot=dummy_img,
        task="Order a pizza to the moon",
        context=context,
        privacyMetadata=privacy_meta,
        requestId="SIH-req-none"
    ))
    assert res["status"] == "success"
    assert res["action"]["action"] == "NONE"
    assert res["action"]["target"] is None
    print("[PASS] test_unsupported_task_returns_none")

def test_legacy_context_regression():
    res = asyncio.run(receive_context(PageContext(
        title="Test Page",
        url="http://localhost/test",
        redactedSample="Please submit this contact form"
    )))
    assert res["status"] == "received"
    assert res["action"]["action"] == "CLICK"
    assert res["action"]["target"] == "SUBMIT_BUTTON"
    print("[PASS] test_legacy_context_regression")

if __name__ == "__main__":
    test_semantic_resolution_login()
    test_semantic_resolution_next()
    test_semantic_resolution_search()
    test_semantic_resolution_submit()
    test_semantic_resolution_scroll()
    test_unsupported_task_returns_none()
    test_legacy_context_regression()
    print("\nALL M14 BACKEND TESTS PASSED CLEANLY!")
