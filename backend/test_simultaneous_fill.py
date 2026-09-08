"""
backend/test_simultaneous_fill.py — Tests for Simultaneous Profile-Driven Form Autofill
SIH26171: On-device Visual Perception for Lightweight Browser Agents
"""

import json
import pytest
from pathlib import Path
from backend.main import DemoAgentProvider

def test_form_profile_json_structure_and_completeness():
    profile_path = Path(__file__).resolve().parent.parent / "form-profile.json"
    assert profile_path.exists(), "form-profile.json must exist in project root"
    
    with open(profile_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    required_keys = ["fullName", "email", "phone", "address", "city", "state", "zip", "comments"]
    for key in required_keys:
        assert key in data or key.lower() in data, f"Missing key '{key}' in form-profile.json"
        assert len(str(data.get(key, ""))) > 0, f"Value for '{key}' in form-profile.json must not be empty"

def test_backend_agent_handles_fill_form_task():
    provider = DemoAgentProvider()
    task = "fill the form"
    context = {
        "title": "Registration Form",
        "url": "http://localhost:8000/demo-pages/test-simultaneous-form.html",
        "elements": [
            {"type": "input", "label": "Full Name", "disabled": False},
            {"type": "input", "label": "Email Address", "disabled": False},
            {"type": "input", "label": "Phone Number", "disabled": False},
            {"type": "textarea", "label": "Comments", "disabled": False},
            {"type": "button", "label": "Submit Registration", "semanticTag": "SUBMIT_BUTTON", "disabled": False}
        ],
        "fieldPlan": [
            {"type": "FILL_FORM", "fieldHint": "all form fields", "stepId": 0}
        ],
        "loopStep": 1
    }
    
    action, reasoning = provider.propose_action(task, context)
    assert action is not None
    assert "reasoning" in locals() and len(reasoning) > 0
