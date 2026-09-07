"""
main.py - Minimal FastAPI backend for SIH 2026 Problem Statement SIH26171
Milestones 3–6: Receives sanitized context and computes rule-based agent decision (CLICK or SCROLL).
Milestone 13: Secure Sanitized Visual Agent Gateway (POST /api/visual-context).
"""

import json
import uuid
import difflib
import re
from typing import Optional, List, Dict, Any, Tuple, Protocol
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
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
    return (s or "").strip().lower()

def _match_score(task_lower: str, label: str) -> float:
    """
    Deterministic local text-similarity score between the task and an element's
    visible label. Pure stdlib (difflib) — no ML, no external API, no network.
    Combines sequence-similarity with a token-overlap bonus so partial phrase
    matches (e.g. task 'add this to cart' vs label 'Add to Cart') score well.
    """
    label_norm = _normalize(label)
    if not label_norm:
        return 0.0
    seq_score = difflib.SequenceMatcher(None, task_lower, label_norm).ratio()
    task_tokens = set(task_lower.split())
    label_tokens = set(label_norm.split())
    overlap = len(task_tokens & label_tokens)
    overlap_score = overlap / max(1, len(label_tokens))
    return max(seq_score, overlap_score)

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

        # Signal 0: Explicit Sanitized Field Plan for Form Filling (Milestone 16)
        # Bounded deterministic grounding of sanitized field hints (no values)
        if field_plan and isinstance(field_plan, list):
            FORM_FIELD_TYPES = {"input", "textarea", "select"}
            plan_actions = []
            for item in field_plan:
                hint = ""
                if isinstance(item, dict):
                    hint = item.get("fieldHint") or item.get("hint") or item.get("label") or ""
                elif isinstance(item, str):
                    hint = item
                hint_lower = (hint or "").strip().lower()
                if not hint_lower:
                    continue

                best_idx, best_score = None, 0.0
                for i, el in enumerate(elements):
                    el_type = str(el.get("type", "")).lower()
                    if el_type not in FORM_FIELD_TYPES:
                        continue
                    score = _match_score(hint_lower, str(el.get("label", "")))
                    if score > best_score:
                        best_score, best_idx = score, i

                if best_idx is not None and best_score >= 0.35:
                    el = elements[best_idx]
                    plan_actions.append({
                        "action": "FILL",
                        "targetIndex": best_idx,
                        "targetType": el.get("type"),
                        "targetLabel": str(el.get("label", ""))[:60],
                        "groundingScore": round(best_score, 3),
                        "groundingMethod": "local-fuzzy-match",
                    })

            if plan_actions:
                loop_step = context.get("loopStep", 1)
                step_idx = (loop_step - 1) if isinstance(loop_step, int) else 0
                selected = plan_actions[step_idx] if 0 <= step_idx < len(plan_actions) else plan_actions[0]
                reasoning = (
                    f"Sanitized field plan resolved {len(plan_actions)} form field(s). "
                    f"Selected action for target '{selected['targetLabel']}' with score {selected['groundingScore']} "
                    "(difflib deterministic local grounding — no literal values received)."
                )
                action_copy = dict(selected)
                action_copy["plan"] = plan_actions
                return action_copy, reasoning

        # Signal 0b: Primary Task intent — FILL / ENTER for form fields
        if any(task_lower.startswith(p) for p in ["fill ", "fill the ", "enter ", "type into ", "type in ", "type "]):
            FORM_FIELD_TYPES = {"input", "textarea", "select"}
            hint = task_lower
            for p in ["fill the ", "fill ", "enter the ", "enter ", "type into ", "type in ", "type "]:
                if hint.startswith(p):
                    hint = hint[len(p):]
                    break
            hint = re.sub(r"\s+(?:field|input|box|area)$", "", hint).strip()

            best_idx, best_score = None, 0.0
            for i, el in enumerate(elements):
                el_type = str(el.get("type", "")).lower()
                if el_type not in FORM_FIELD_TYPES:
                    continue
                score = _match_score(hint, str(el.get("label", "")))
                if score > best_score:
                    best_score, best_idx = score, i

            if best_idx is not None and best_score >= 0.35:
                el = elements[best_idx]
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

        # Signal 1: Primary Task intent — Login / Sign In (Milestone 14 Semantic Tag)
        if any(keyword in task_lower for keyword in ["login", "log in", "sign in"]):
            button_found = any(
                str(el.get("semanticTag", "")).upper() == "LOGIN_BUTTON" or
                "login" in str(el.get("label", "")).lower() or
                "sign in" in str(el.get("label", "")).lower()
                for el in elements
            )
            reasoning = (
                f"Task requested login ('{task}') and sanitized DOM confirmed matching LOGIN_BUTTON. "
                "Proposing allowlisted action CLICK -> LOGIN_BUTTON."
                if button_found else
                f"Task requested login ('{task}'). Proposing allowlisted action CLICK -> LOGIN_BUTTON."
            )
            return {"action": "CLICK", "target": "LOGIN_BUTTON"}, reasoning

        # Signal 2: Primary Task intent — Next / Continue / Step (Milestone 14 Semantic Tag)
        if any(keyword in task_lower for keyword in ["next", "continue", "proceed", "step"]):
            button_found = any(
                str(el.get("semanticTag", "")).upper() == "NEXT_BUTTON" or
                "next" in str(el.get("label", "")).lower() or
                "continue" in str(el.get("label", "")).lower()
                for el in elements
            )
            reasoning = (
                f"Task requested next step ('{task}') and sanitized DOM confirmed matching NEXT_BUTTON. "
                "Proposing allowlisted action CLICK -> NEXT_BUTTON."
                if button_found else
                f"Task requested next step ('{task}'). Proposing allowlisted action CLICK -> NEXT_BUTTON."
            )
            return {"action": "CLICK", "target": "NEXT_BUTTON"}, reasoning

        # Signal 3: Primary Task intent — Search Input (Milestone 14 Semantic Tag)
        if any(keyword in task_lower for keyword in ["search", "query", "find input"]):
            input_found = any(
                str(el.get("semanticTag", "")).upper() == "SEARCH_INPUT" or
                "search" in str(el.get("label", "")).lower()
                for el in elements
            )
            reasoning = (
                f"Task requested search ('{task}') and sanitized DOM confirmed matching SEARCH_INPUT. "
                "Proposing allowlisted action CLICK -> SEARCH_INPUT."
                if input_found else
                f"Task requested search ('{task}'). Proposing allowlisted action CLICK -> SEARCH_INPUT."
            )
            return {"action": "CLICK", "target": "SEARCH_INPUT"}, reasoning

        # Signal 4: Primary Task intent — Submit / Click
        if any(keyword in task_lower for keyword in ["submit", "click", "press", "button"]):
            # Check if sanitized element summary contains a button or submit element
            button_found = any(
                str(el.get("semanticTag", "")).upper() == "SUBMIT_BUTTON" or
                str(el.get("type", "")).lower() == "button" or
                "submit" in str(el.get("label", "")).lower()
                for el in elements
            )
            reasoning = (
                f"Task requested click/submit ('{task}') and sanitized DOM confirmed matching button element. "
                "Proposing allowlisted action CLICK -> SUBMIT_BUTTON."
                if button_found else
                f"Task requested click/submit ('{task}'). Proposing allowlisted action CLICK -> SUBMIT_BUTTON."
            )
            return {"action": "CLICK", "target": "SUBMIT_BUTTON"}, reasoning

        # Signal 5: Primary Task intent — Scroll / View
        if any(keyword in task_lower for keyword in ["scroll", "down", "view", "more", "page"]):
            reasoning = (
                f"Task requested scrolling ('{task}'). "
                "Proposing allowlisted action SCROLL -> PAGE with safe bound (500px)."
            )
            return {"action": "SCROLL", "target": "PAGE", "amount": 500}, reasoning

        # Signal 3: Fall back to existing keyword matching on redactedSample (Milestone 4/6 secondary signal)
        if "submit" in redacted_sample or "form" in redacted_sample:
            reasoning = (
                "Task intent ambiguous, but sanitized page text contains form/submit keywords. "
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

        # Signal 6: Generalized perception-grounded matching (no fixed keyword list).
        # Runs only if none of the fixed-target signals above matched.
        ACTIONABLE_TYPES = {"button", "link", "input", "textarea", "select", "checkbox", "radio"}
        GROUNDING_MIN_SCORE = 0.35

        best_idx, best_score = None, 0.0
        for i, el in enumerate(elements):
            el_type = str(el.get("type", "")).lower()
            if el_type not in ACTIONABLE_TYPES:
                continue
            score = _match_score(task_lower, str(el.get("label", "")))
            if score > best_score:
                best_score, best_idx = score, i

        if best_idx is not None and best_score >= GROUNDING_MIN_SCORE:
            el = elements[best_idx]
            reasoning = (
                f"No fixed keyword rule matched task '{task}'. Local on-device grounding "
                f"matched element #{best_idx} ({el.get('type')}: '{el.get('label')}') "
                f"with score {best_score:.2f} via deterministic local text similarity "
                "(difflib — no cloud model, no API key)."
            )
            return {
                "action": "CLICK",
                "targetIndex": best_idx,
                "targetType": el.get("type"),
                "targetLabel": str(el.get("label", ""))[:60],
                "groundingScore": round(best_score, 3),
                "groundingMethod": "local-fuzzy-match",
            }, reasoning

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

