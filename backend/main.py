"""
main.py - Minimal FastAPI backend for SIH 2026 Problem Statement SIH26171
Milestones 3–6: Receives sanitized context and computes rule-based agent decision (CLICK or SCROLL).
Milestone 13: Secure Sanitized Visual Agent Gateway (POST /api/visual-context).
"""

import os
import json
import uuid
import difflib
import re
from typing import Optional, List, Dict, Any, Tuple, Protocol
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

app = FastAPI(title="SIH26171 Agent Decision & Visual Gateway Backend")

# Configure CORS so the Chrome Extension can send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.get("/test-page.html")
async def serve_test_page():
    """Serves the test page over local HTTP for generic browser agent testing."""
    test_page_path = os.path.join(PROJECT_ROOT_DIR, "test-page.html")
    if os.path.exists(test_page_path):
        return FileResponse(test_page_path, media_type="text/html")
    raise HTTPException(status_code=404, detail="test-page.html not found")

@app.get("/demo-pages/{page_name}")
async def serve_demo_page(page_name: str):
    """Serves local demo pages for SIH cross-website judging demonstration."""
    safe_name = os.path.basename(page_name)
    demo_page_path = os.path.join(PROJECT_ROOT_DIR, "demo-pages", safe_name)
    if os.path.exists(demo_page_path):
        return FileResponse(demo_page_path, media_type="text/html")
    raise HTTPException(status_code=404, detail=f"Demo page {safe_name} not found")

# =====================================================================
# Milestones 3–6: Text-Only Sanitized Context (Preserved & Backwards-Compatible)
# =====================================================================

ALLOWED_ACTIONS = {"CLICK", "SCROLL", "FILL", "WARN", "NONE"}
FORBIDDEN_VALUE_KEYS = {"value", "fieldvalue", "field_value", "localvalue", "local_value"}

def assert_no_forbidden_value_keys(data: Any, path: str = ""):
    """
    Recursively scans payloads to ensure NO literal field values are ever transmitted.
    Fails closed with HTTP 422 if any value/fieldValue keys are found in task or context.
    """
    if isinstance(data, dict):
        for k, v in data.items():
            current_path = f"{path}.{k}" if path else k
            if k.lower() in FORBIDDEN_VALUE_KEYS:
                raise HTTPException(
                    status_code=422,
                    detail=f"Privacy violation: Forbidden key '{k}' found at '{current_path}'. Literal form values must never be transmitted."
                )
            assert_no_forbidden_value_keys(v, current_path)
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            assert_no_forbidden_value_keys(item, f"{path}[{idx}]")

# Schema for the sanitized context payload received from the extension
class PageContext(BaseModel):
    title: str
    url: str
    redactedSample: str

# Schema for structured agent decision (supports optional amount for SCROLL and grounded target metadata)
# CRITICAL PRIVACY RULE: AgentAction NEVER contains a 'value' or 'fieldValue' field anywhere.
class AgentAction(BaseModel):
    action: str
    target: Optional[str] = None
    amount: Optional[int] = None
    targetIndex: Optional[int] = None
    targetType: Optional[str] = None
    targetLabel: Optional[str] = None
    groundingScore: Optional[float] = None
    groundingMethod: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in ALLOWED_ACTIONS:
            raise ValueError(f"Action '{v}' is not supported. Allowed actions: {sorted(ALLOWED_ACTIONS)}")
        return v_upper

def decide_action(context: PageContext) -> dict:
    """
    Applies simple, explainable rule-based logic to decide an agent action.
    NOTE: Decision only — execution is strictly validated and performed client-side.
    """
    sample_text = context.redactedSample or ""
    sample_lower = sample_text.lower()

    # Rule 1: Form / submit detection -> CLICK
    if "submit" in sample_lower or "form" in sample_lower:
        return {"action": "CLICK", "target": "SUBMIT_BUTTON"}

    # Rule 2: Scroll / pagination intent -> SCROLL (Milestone 6)
    if "scroll" in sample_lower or "more" in sample_lower:
        return {"action": "SCROLL", "target": "PAGE", "amount": 500}

    # Rule 3: Sensitive field warning if redacted credentials exist
    if "[REDACTED_EMAIL]" in sample_text or "[REDACTED_PASSWORD]" in sample_text:
        return {"action": "WARN", "target": "SENSITIVE_FIELD_DETECTED"}

    # Rule 4: Default no-op
    return {"action": "NONE", "target": None}

@app.post("/api/context")
async def receive_context(context: PageContext):
    # Print received sanitized context for verification
    print("\n" + "=" * 60)
    print("[SERVER LOG] Received Sanitized Context (Milestone 3-6):")
    print(f"  Title          : {context.title}")
    print(f"  URL            : {context.url}")
    print("  Redacted Sample:")
    print("-" * 60)
    print(context.redactedSample)

    # Compute rule-based decision
    action = decide_action(context)
    print("-" * 60)
    if action.get("amount") is not None:
        print(f"  Agent Decision : {action['action']} -> {action['target']} (amount: {action['amount']})")
    else:
        print(f"  Agent Decision : {action['action']} -> {action['target']}")
    print("=" * 60 + "\n")

    return {
        "status": "received",
        "message": "Sanitized context received successfully",
        "action": action
    }


# =====================================================================
# Milestone 13: Secure Sanitized Visual Agent Gateway
# =====================================================================

MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024  # 15 MB defensive limit

class AgentProvider(Protocol):
    """
    Protocol definition for multimodal agent providers.
    Both cloud multimodal providers and deterministic demo providers adhere to this interface.
    """
    def propose_action(self, task: str, context: dict) -> Tuple[dict, str]:
        ...

class CloudMultimodalAgentProvider:
    """
    Future extension stub for cloud-hosted multimodal models (e.g., Gemini 1.5 Pro, Claude 3.5 Sonnet).
    
    SECURITY ARCHITECTURE:
    Any real provider's credentials/API keys must live strictly in server-side environment
    variables only, never in the Chrome extension client, and never in this codebase's source.
    
    For this SIH 2026 student prototype, cloud forwarding is not configured to guarantee
    zero external data exfiltration and avoid external API key dependencies.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def propose_action(self, task: str, context: dict) -> Tuple[dict, str]:
        raise NotImplementedError(
            "CloudMultimodalAgentProvider is an unimplemented stub for production extension. "
            "Use DemoAgentProvider for deterministic local prototype evaluation without external API keys."
        )

def _normalize(s: str) -> str:
    cleaned = (s or "").strip().lower()
    cleaned = re.sub(r"[\*:#_\-\/\\]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

SEMANTIC_SYNONYMS = {
    "name": {"name", "full name", "applicant name", "your name", "first name", "student name", "candidate name"},
    "full name": {"name", "full name", "applicant name", "your name"},
    "email": {"email", "email address", "your email", "e mail", "mail"},
    "email address": {"email", "email address", "your email", "e mail", "mail"},
    "address": {"address", "street address", "home address", "residential address", "permanent address", "postal address"},
    "street address": {"address", "street address", "home address"},
    "phone": {"phone", "phone number", "mobile", "mobile number", "contact number", "telephone"},
    "phone number": {"phone", "phone number", "mobile", "mobile number", "contact number"},
    "city": {"city", "city of residence", "town", "place"},
}

def _match_score(task_lower: str, label: str) -> float:
    """
    Deterministic local text-similarity score between the task and an element's
    visible label. Pure stdlib (difflib) — no ML, no external API, no network.
    Requires meaningful token overlap or direct substring inclusion to prevent
    spurious character-anagram false positives on completely unrelated elements.
    """
    t = _normalize(task_lower)
    l = _normalize(label)
    if not t or not l:
        return 0.0
    if t == l:
        return 1.0

    # Check pre-registered semantic synonyms (e.g. "full name" <-> "name", "street address" <-> "address")
    if t in SEMANTIC_SYNONYMS and l in SEMANTIC_SYNONYMS[t]:
        return 0.95
    if l in SEMANTIC_SYNONYMS and t in SEMANTIC_SYNONYMS[l]:
        return 0.95

    if l in t:
        return max(0.85, len(l) / len(t))
    if t in l:
        return max(0.80, len(t) / len(l))
    t_tokens = set(t.split())
    l_tokens = set(l.split())
    overlap = len(t_tokens & l_tokens)
    if overlap == 0:
        return 0.0
    overlap_ratio = overlap / max(1, len(l_tokens))
    seq_ratio = difflib.SequenceMatcher(None, t, l).ratio()
    return max(overlap_ratio, seq_ratio)

class DemoAgentProvider:
    """
    Deterministic, explainable demo agent provider for SIH 2026 Problem Statement SIH26171.
    Evaluates user task and sanitized structured context without external AI API dependencies.
    Demonstrates the end-to-end multimodal gateway contract, privacy verification, and safe execution.
    """
    def propose_action(self, task: str, context: dict) -> Tuple[dict, str]:
        task_lower = (task or "").strip().lower()
        elements = context.get("elements", [])
        redacted_sample = (context.get("redactedSample") or "").lower()
        field_plan = context.get("fieldPlan") or []

        # Signal 0: Explicit Sanitized Field Plan for Form Filling (Milestone 16 & 17)
        # Bounded deterministic grounding of sanitized field hints (no values)
        if field_plan and isinstance(field_plan, list) and len(field_plan) > 0:
            FORM_FIELD_TYPES = {"input", "textarea", "select", "checkbox", "radio", "textbox"}
            loop_step = context.get("loopStep", 1)
            step_idx = (loop_step - 1) if isinstance(loop_step, int) else 0

            # Only process if step_idx is within bounds of field_plan
            if 0 <= step_idx < len(field_plan):
                item = field_plan[step_idx]
                hint = ""
                if isinstance(item, dict):
                    hint = item.get("fieldHint") or item.get("hint") or item.get("label") or ""
                elif isinstance(item, str):
                    hint = item
                hint_lower = (hint or "").strip().lower()

                if hint_lower:
                    candidates = []
                    for i, el in enumerate(elements):
                        el_type = str(el.get("type", "")).lower()
                        if el_type not in FORM_FIELD_TYPES:
                            continue
                        if el.get("disabled") or str(el.get("aria-disabled")).lower() == "true":
                            continue
                        label_score = _match_score(hint_lower, str(el.get("label", "")))
                        placeholder_score = _match_score(hint_lower, str(el.get("placeholder", ""))) if el.get("placeholder") else 0.0
                        aria_score = _match_score(hint_lower, str(el.get("ariaLabel", ""))) if el.get("ariaLabel") else 0.0
                        title_score = _match_score(hint_lower, str(el.get("title", ""))) if el.get("title") else 0.0
                        best_score = max(label_score, placeholder_score, aria_score, title_score)
                        if best_score >= 0.35:
                            candidates.append((best_score, i, el))

                    candidates.sort(key=lambda x: x[0], reverse=True)
                    if candidates:
                        # Ambiguity check
                        if (len(candidates) > 1 and candidates[1][0] >= 0.55 and
                            abs(candidates[0][0] - candidates[1][0]) < 0.05 and
                            _normalize(candidates[0][2].get("label", "")) != _normalize(candidates[1][2].get("label", ""))):
                            return {
                                "action": "NONE",
                                "target": None,
                                "groundingScore": round(candidates[0][0], 3),
                                "groundingMethod": "ambiguity-rejection"
                            }, f"Ambiguous form field target for '{hint_lower}': multiple fields matched with similar confidence. Execution rejected for safety."

                        best_score, best_idx, el = candidates[0]
                        selected = {
                            "action": "FILL",
                            "targetIndex": best_idx,
                            "targetType": el.get("type"),
                            "targetLabel": str(el.get("label", ""))[:60],
                            "groundingScore": round(best_score, 3),
                            "groundingMethod": "local-fuzzy-match",
                        }
                        reasoning = (
                            f"Task requested form fill for '{hint}'. Local on-device grounding matched "
                            f"element #{best_idx} ({el.get('type')}: '{el.get('label')}') with score {best_score:.2f} "
                            "via deterministic difflib similarity."
                        )

                        # Build plan actions list for test assertions compatibility (test_backend_fill_action_grounding)
                        all_plan_actions = []
                        for p_item in field_plan:
                            p_hint = (p_item.get("fieldHint") or p_item.get("hint") or "") if isinstance(p_item, dict) else str(p_item)
                            p_hint_lower = p_hint.strip().lower()
                            p_cands = []
                            for pi, pel in enumerate(elements):
                                if str(pel.get("type", "")).lower() in FORM_FIELD_TYPES and not pel.get("disabled"):
                                    ps = max(_match_score(p_hint_lower, str(pel.get("label", ""))),
                                             _match_score(p_hint_lower, str(pel.get("placeholder", ""))) if pel.get("placeholder") else 0.0)
                                    if ps >= 0.35:
                                        p_cands.append((ps, pi, pel))
                            if p_cands:
                                p_cands.sort(key=lambda x: x[0], reverse=True)
                                all_plan_actions.append({
                                    "action": "FILL",
                                    "targetIndex": p_cands[0][1],
                                    "targetType": p_cands[0][2].get("type"),
                                    "targetLabel": str(p_cands[0][2].get("label", ""))[:60],
                                    "groundingScore": round(p_cands[0][0], 3),
                                    "groundingMethod": "local-fuzzy-match",
                                })
                        action_copy = dict(selected)
                        if all_plan_actions:
                            action_copy["plan"] = all_plan_actions
                        return action_copy, reasoning
                    else:
                        # CRITICAL SAFETY (Phase 7): Field could not be grounded.
                        # NEVER fall back to plan_actions[0] or another field!
                        return {
                            "action": "NONE",
                            "target": None
                        }, f"Could not safely ground form field for '{hint}'. Execution stopped to prevent filling wrong field."

        # Signal 0b: Primary Task intent — FILL / ENTER for form fields
        if any(task_lower.startswith(p) for p in ["fill ", "fill the ", "enter ", "type into ", "type in ", "type ", "put "]):
            FORM_FIELD_TYPES = {"input", "textarea", "select", "checkbox", "radio"}
            hint = task_lower
            for p in ["fill the ", "fill ", "enter the ", "enter ", "type into ", "type in ", "type ", "put "]:
                if hint.startswith(p):
                    hint = hint[len(p):]
                    break
            in_match = re.search(r"\bin(?:to)?\s+(?:the\s+)?(.+?)(?:\s+(?:field|input|box))?$", hint)
            if in_match:
                hint = in_match.group(1).strip()
            else:
                with_as_match = re.search(r"^(?:the\s+)?(.+?)\s+(?:as|with|to)\s+", hint)
                if with_as_match:
                    hint = with_as_match.group(1).strip()
                else:
                    hint = re.sub(r"\s+(?:field|input|box|area)$", "", hint).strip()

            candidates = []
            for i, el in enumerate(elements):
                el_type = str(el.get("type", "")).lower()
                if el_type not in FORM_FIELD_TYPES:
                    continue
                if el.get("disabled") or str(el.get("aria-disabled")).lower() == "true":
                    continue
                score = _match_score(hint, str(el.get("label", "")))
                placeholder_score = _match_score(hint, str(el.get("placeholder", ""))) if el.get("placeholder") else 0.0
                best_s = max(score, placeholder_score)
                if best_s >= 0.35:
                    candidates.append((best_s, i, el))

            candidates.sort(key=lambda x: x[0], reverse=True)
            if candidates:
                if (len(candidates) > 1 and candidates[1][0] >= 0.55 and
                    abs(candidates[0][0] - candidates[1][0]) < 0.05 and
                    _normalize(candidates[0][2].get("label", "")) != _normalize(candidates[1][2].get("label", ""))):
                    return {
                        "action": "NONE",
                        "target": None,
                        "groundingScore": round(candidates[0][0], 3),
                        "groundingMethod": "ambiguity-rejection"
                    }, f"Ambiguous form field target for '{hint}': multiple fields matched with similar confidence. Execution rejected for safety."

                best_score, best_idx, el = candidates[0]
                reasoning = (
                    f"Task requested form fill for '{hint}'. Local on-device grounding matched "
                    f"element #{best_idx} ({el.get('type')}: '{el.get('label')}') with score {best_score:.2f} "
                    "via deterministic difflib similarity."
                )
                return {
                    "action": "FILL",
                    "targetIndex": best_idx,
                    "targetType": el.get("type"),
                    "targetLabel": str(el.get("label", ""))[:60],
                    "groundingScore": round(best_score, 3),
                    "groundingMethod": "local-fuzzy-match",
                }, reasoning

        # Signal 1: Explicit Legacy Semantic Tag signals (Milestone 14 / Milestone 15)
        def _is_enabled(e):
            return not e.get("disabled") and str(e.get("aria-disabled", "")).lower() != "true"

        # 1a. Login
        if any(keyword in task_lower for keyword in ["login", "log in", "sign in"]):
            button_found = any(
                str(el.get("semanticTag", "")).upper() == "LOGIN_BUTTON" and _is_enabled(el)
                for el in elements
            )
            if button_found:
                reasoning = (
                    f"Task requested login ('{task}') and sanitized DOM confirmed matching LOGIN_BUTTON. "
                    "Proposing allowlisted action CLICK -> LOGIN_BUTTON."
                )
                return {"action": "CLICK", "target": "LOGIN_BUTTON"}, reasoning

        # 1b. Next / Continue
        if any(keyword in task_lower for keyword in ["next", "continue", "proceed", "step"]):
            button_found = any(
                str(el.get("semanticTag", "")).upper() == "NEXT_BUTTON" and _is_enabled(el)
                for el in elements
            )
            if button_found:
                reasoning = (
                    f"Task requested next step ('{task}') and sanitized DOM confirmed matching NEXT_BUTTON. "
                    "Proposing allowlisted action CLICK -> NEXT_BUTTON."
                )
                return {"action": "CLICK", "target": "NEXT_BUTTON"}, reasoning

        # 1c. Search Input
        if any(keyword in task_lower for keyword in ["search", "query", "find input"]):
            input_found = any(
                str(el.get("semanticTag", "")).upper() == "SEARCH_INPUT" and _is_enabled(el)
                for el in elements
            )
            if input_found:
                reasoning = (
                    f"Task requested search ('{task}') and sanitized DOM confirmed matching SEARCH_INPUT. "
                    "Proposing allowlisted action CLICK -> SEARCH_INPUT."
                )
                return {"action": "CLICK", "target": "SEARCH_INPUT"}, reasoning

        # 1d. Legacy Submit: when task is asking for submit button and exactly one matching button exists
        if any(keyword in task_lower for keyword in ["find the submit", "submit button and click", "submit form", "click submit", "submit"]):
            matching_submits = [
                el for el in elements
                if _is_enabled(el) and (
                    str(el.get("semanticTag", "")).upper() == "SUBMIT_BUTTON" or
                    (str(el.get("type", "")).lower() in {"button", "link"} and "submit" in str(el.get("label", "")).lower())
                )
            ]
            if len(matching_submits) == 1 and any(phrase in task_lower for phrase in ["find the submit button and click it", "click submit", "submit", "submit form", "submit button"]):
                reasoning = (
                    f"Task requested submit ('{task}') and sanitized DOM confirmed matching SUBMIT_BUTTON. "
                    "Proposing allowlisted action CLICK -> SUBMIT_BUTTON."
                )
                return {"action": "CLICK", "target": "SUBMIT_BUTTON"}, reasoning

        # Signal 2: SCROLL intents
        if any(keyword in task_lower for keyword in ["scroll", "scroll down"]):
            amt = 500
            amt_match = re.search(r"\b(\d+)(?:\s*(?:pixels|px))?\b", task_lower)
            if amt_match:
                parsed_amt = int(amt_match.group(1))
                amt = max(50, min(parsed_amt, 1500))
            reasoning = f"Task requested scrolling ('{task}'). Proposing allowlisted action SCROLL -> PAGE with safe bound ({amt}px)."
            return {"action": "SCROLL", "target": "PAGE", "amount": amt}, reasoning

        # Signal 3: Generalized Generic Grounding for buttons, links, and interactive elements
        ACTIONABLE_TYPES = {"button", "link", "input", "textarea", "select", "checkbox", "radio", "tab", "menuitem", "switch", "element"}
        GROUNDING_MIN_SCORE = 0.35

        # Clean search phrase
        target_query = task_lower
        for prefix in [
            "click on the button labelled ", "click the button labelled ", "click on the button labeled ", "click the button labeled ",
            "click the button named ", "click button labelled ", "click button labeled ", "click button named ",
            "click on the ", "click on ", "click the ", "click ",
            "press on the ", "press the ", "press ",
            "tap on the ", "tap the ", "tap ",
            "open the ", "open ", "navigate to ", "go to "
        ]:
            if target_query.startswith(prefix):
                target_query = target_query[len(prefix):]
                break

        target_query = re.sub(r"\s+(?:button|link|page|tab)$", "", target_query).strip()
        target_query = target_query.strip("'\"")

        candidates = []
        for i, el in enumerate(elements):
            el_type = str(el.get("type", "")).lower()
            if el_type not in ACTIONABLE_TYPES:
                continue
            if el.get("disabled") or str(el.get("aria-disabled")).lower() == "true":
                continue

            label_score = max(_match_score(target_query, str(el.get("label", ""))), _match_score(task_lower, str(el.get("label", ""))))
            title_score = _match_score(target_query, str(el.get("title", ""))) if el.get("title") else 0.0
            aria_score = _match_score(target_query, str(el.get("ariaLabel", ""))) if el.get("ariaLabel") else 0.0
            best_s = max(label_score, title_score, aria_score)
            if best_s >= GROUNDING_MIN_SCORE:
                candidates.append((best_s, i, el))

        candidates.sort(key=lambda x: x[0], reverse=True)

        if candidates:
            # Ambiguity check: if top 2 candidates are close in score with different labels
            # or both share the target query token
            if len(candidates) > 1:
                cand0_score, cand0_idx, cand0_el = candidates[0]
                cand1_score, cand1_idx, cand1_el = candidates[1]
                cand0_label_norm = _normalize(cand0_el.get("label", ""))
                cand1_label_norm = _normalize(cand1_el.get("label", ""))

                is_ambiguous = False
                if cand0_label_norm != cand1_label_norm and cand0_score >= 0.45 and cand1_score >= 0.45:
                    if abs(cand0_score - cand1_score) <= 0.12:
                        is_ambiguous = True
                    elif target_query in cand0_label_norm.split() and target_query in cand1_label_norm.split():
                        is_ambiguous = True

                if is_ambiguous:
                    top1_label = cand0_el.get("label", "")
                    top2_label = cand1_el.get("label", "")
                    return {
                        "action": "NONE",
                        "target": None,
                        "groundingScore": round(cand0_score, 3),
                        "groundingMethod": "ambiguity-rejection"
                    }, (
                        f"Ambiguous action target for '{target_query}': multiple candidate elements "
                        f"('{top1_label}' vs '{top2_label}') matched with similar confidence. "
                        "Action rejected for safety."
                    )

            best_score, best_idx, el = candidates[0]
            reasoning = (
                f"Local on-device grounding matched element #{best_idx} "
                f"({el.get('type')}: '{el.get('label')}') with score {best_score:.2f} "
                "via deterministic local text similarity (difflib — no cloud model, no API key)."
            )
            return {
                "action": "CLICK",
                "targetIndex": best_idx,
                "targetType": el.get("type", "button"),
                "targetLabel": str(el.get("label", ""))[:60],
                "groundingScore": round(best_score, 3),
                "groundingMethod": "local-fuzzy-match",
            }, reasoning

        # Signal 4: Secondary keyword matching on redactedSample (Milestones 4/6 fallback)
        # Security Invariant: Page text alone (e.g. "form" or "submit" on page) must NEVER trigger Submit
        # unless the explicit user task requested a submit/click action.
        if ("submit" in redacted_sample or "form" in redacted_sample) and any(keyword in task_lower for keyword in ["submit", "click"]):
            reasoning = (
                "Task requested submit and sanitized page text contains form/submit keywords. "
                "Proposing allowlisted action CLICK -> SUBMIT_BUTTON."
            )
            return {"action": "CLICK", "target": "SUBMIT_BUTTON"}, reasoning

        if "scroll" in redacted_sample or "more" in redacted_sample:
            reasoning = (
                "Task intent ambiguous, but sanitized page text contains scroll/more keywords. "
                "Proposing allowlisted action SCROLL -> PAGE with safe bound (500px)."
            )
            return {"action": "SCROLL", "target": "PAGE", "amount": 500}, reasoning

        if "[redacted_email]" in redacted_sample or "[redacted_password]" in redacted_sample:
            reasoning = "Sanitized page text indicates sensitive fields detected."
            return {"action": "WARN", "target": "SENSITIVE_FIELD_DETECTED"}, reasoning

        # Default fallback
        reasoning = f"No allowlisted action matched task '{task}' or sanitized page context."
        return {"action": "NONE", "target": None}, reasoning

# Active agent provider selection (default: demo provider; no external API key needed)
active_agent_provider: AgentProvider = DemoAgentProvider()

@app.post("/api/visual-context")
async def receive_visual_context(
    sanitizedScreenshot: UploadFile = File(...),
    task: str = Form(""),
    context: str = Form(...),
    privacyMetadata: str = Form(...),
    requestId: str = Form(...)
):
    """
    Milestone 13 Visual Agent Gateway Endpoint.
    Accepts ONLY:
      - sanitizedScreenshot: masked/redacted image file (the ONLY image field accepted)
      - task: user's typed goal (sanitized)
      - context: non-visual structured metadata (DOM counts, labels, bboxes, no raw values)
      - privacyMetadata: client-side privacy attestation
      - requestId: unique request identifier

    Enforces:
      1. Structural privacy contract: privacyState must be 'SANITIZED' and rawScreenshotTransmitted must be false.
      2. Defense in depth: strictly rejects any payload containing 'value' or 'fieldValue' keys with HTTP 422.
      3. Action allowlist: strictly allowlists actions in {"CLICK", "SCROLL", "FILL", "WARN", "NONE"}.
      4. In-memory processing only: screenshot is NEVER saved to disk or persistent storage.
      5. Image size cap: rejects payloads > 15MB with HTTP 413.
      6. Never logs raw image bytes or raw PII.
    """
    # 1. Validate privacyMetadata structural contract
    try:
        privacy_meta = json.loads(privacyMetadata)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid privacyMetadata JSON: {str(e)}"
        )

    privacy_state = privacy_meta.get("privacyState")
    if privacy_state != "SANITIZED":
        raise HTTPException(
            status_code=422,
            detail=(
                f"Visual context rejected: privacyState is '{privacy_state}', expected 'SANITIZED'. "
                "Raw or unverified visual contexts are strictly prohibited."
            )
        )

    raw_transmitted = privacy_meta.get("rawScreenshotTransmitted")
    if raw_transmitted is not False:
        raise HTTPException(
            status_code=422,
            detail=(
                "Visual context rejected: rawScreenshotTransmitted must be explicitly false. "
                "Only sanitized/redacted screenshots are permitted."
            )
        )

    # 2. Parse structured non-visual context and enforce no-value privacy invariant
    try:
        parsed_context = json.loads(context)
        if not isinstance(parsed_context, dict):
            parsed_context = {}
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid context JSON: {str(e)}"
        )

    # Defense in depth: strictly reject any literal form value keys in context
    assert_no_forbidden_value_keys(parsed_context, "context")

    # Defense in depth: strictly reject any literal form value keys in task
    try:
        task_json = json.loads(task)
        assert_no_forbidden_value_keys(task_json, "task")
    except Exception:
        pass

    for fk in FORBIDDEN_VALUE_KEYS:
        if f'"{fk}"' in task.lower():
            raise HTTPException(
                status_code=422,
                detail=f"Privacy violation: Forbidden key '{fk}' detected in task."
            )

    # 3. Read screenshot in memory only and enforce size limit
    screenshot_bytes = await sanitizedScreenshot.read()
    if len(screenshot_bytes) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded image exceeds maximum permitted size of {MAX_SCREENSHOT_BYTES // (1024 * 1024)}MB."
        )

    # In-memory processing ONLY: Never write to disk or persist to storage!
    # Server-side audit logging without exposing raw visual data or full image bytes
    element_count = parsed_context.get("elementCount", len(parsed_context.get("elements", [])))
    total_redacted = parsed_context.get("totalRedactedRegionCount", privacy_meta.get("redactedRegionsCount", 0))

    print("\n" + "=" * 60)
    print("[GATEWAY LOG] Received Sanitized Visual Context (Milestone 13):")
    print(f"  Request ID       : {requestId}")
    print(f"  Task             : {task}")
    print(f"  Privacy State    : {privacy_state}")
    print(f"  Raw Transmitted  : {raw_transmitted}")
    print(f"  Redacted Regions : {total_redacted}")
    print(f"  DOM Elements     : {element_count} elements")
    print(f"  Screenshot Size  : {len(screenshot_bytes)} bytes (In-Memory Processing Only)")
    print(f"  Agent Provider   : DemoAgentProvider [DEMO MODE - SIH26171]")
    print("=" * 60)

    # 4. Invoke the deterministic demo agent
    action, reasoning = active_agent_provider.propose_action(task, parsed_context)

    # Validate action against allowlist and schema
    if not isinstance(action, dict) or action.get("action") not in ALLOWED_ACTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Action '{action.get('action') if isinstance(action, dict) else action}' rejected: not in allowlist."
        )

    try:
        AgentAction(**{k: v for k, v in action.items() if k != "plan"})
    except Exception as validation_err:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid action proposed: {str(validation_err)}"
        )

    plan = action.pop("plan", None)

    print("-" * 60)
    print(f"  Agent Action     : {action.get('action')} -> {action.get('target') or action.get('targetLabel')}")
    print(f"  Reasoning        : {reasoning}")
    print("=" * 60 + "\n")

    response_payload = {
        "status": "success",
        "requestId": requestId,
        "action": action,
        "reasoning": reasoning,
        "agentMode": "demo"
    }
    if plan is not None:
        response_payload["plan"] = plan

    return response_payload

