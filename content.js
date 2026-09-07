/**
 * content.js - Content script injected into web pages
 * Milestones 1–6: Page metadata capture, local PII redaction, and safe whitelisted execution (CLICK, SCROLL).
 */

// Explicit, local whitelist mappings for permitted actions.
// Security: Restricts execution strictly to known targets and prevents arbitrary code injection.
const ACTION_TARGET_MAP = {
  "SUBMIT_BUTTON": "#submit-button",
  "LOGIN_BUTTON": "#login-button",
  "NEXT_BUTTON": "#next-button",
  "SEARCH_INPUT": "#search-input"
};

const SCROLL_TARGET_MAP = {
  "PAGE": "window"
};

// Hardcoded safe numeric boundaries for SCROLL actions
const MIN_SCROLL_AMOUNT = 0;
const MAX_SCROLL_AMOUNT = 2000;

/**
 * Milestone 14: Assigns safe pre-registered semantic tags based purely on visible element type and label.
 * Local pattern-matching only; never reads or inspects .value.
 *
 * @param {string} type - UI element type ("button", "link", "input", etc.)
 * @param {string} label - Visible text or placeholder string
 * @param {Element} [el] - DOM element
 * @returns {string|null} Pre-registered semantic tag or null
 */
function getSemanticTag(type, label, el = null) {
  const normLabel = (label || "").toLowerCase();
  const elId = (el && el.id ? el.id : "").toLowerCase();
  const elName = (el && el.getAttribute ? (el.getAttribute("name") || "") : "").toLowerCase();

  if (type === "button" || type === "link") {
    if (/submit/i.test(normLabel) || /submit/i.test(elId) || /submit/i.test(elName)) {
      return "SUBMIT_BUTTON";
    }
    if (/login|sign in|log in/i.test(normLabel) || /login/i.test(elId) || /login/i.test(elName)) {
      return "LOGIN_BUTTON";
    }
    if (/next|continue|proceed/i.test(normLabel) || /next/i.test(elId) || /next/i.test(elName)) {
      return "NEXT_BUTTON";
    }
  } else if (type === "input") {
    if (/search/i.test(normLabel) || /search/i.test(elId) || /search/i.test(elName) || (el && el.type === "search")) {
      return "SEARCH_INPUT";
    }
  }
  return null;
}

/**
 * Normalizes label text for safe comparison.
 * @param {string} s
 * @returns {string}
 */
function normalizeLabel(s) {
  return (s || "").trim().toLowerCase();
}

/**
 * Checks if two element labels match with fuzzy tolerance.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function labelsMatch(a, b) {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na) || na.includes(nb) || nb.includes(na);
}

/**
 * Safely executes a permitted action on the page if explicitly whitelisted.
 *
 * @param {Object} actionPayload - { action: string, target?: string, amount?: number, targetIndex?: number, targetType?: string, targetLabel?: string, localValue?: string }
 * @returns {Object} Execution result summary
 */
function executeAction(actionPayload) {
  if (!actionPayload || typeof actionPayload !== "object") {
    return { executed: false, reason: "Invalid action payload" };
  }

  const { action, target, amount } = actionPayload;

  // Explicit action allowlist check: exactly {"CLICK", "SCROLL", "FILL"} permitted
  const ALLOWED_ACTIONS = new Set(["CLICK", "SCROLL", "FILL"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return {
      executed: false,
      reason: "Unsupported or unknown action/target"
    };
  }

  // 1. CLICK Action Execution (Milestone 5, 14 & 15 Generalized Grounding)
  if (action === "CLICK") {
    // Milestone 15 generalized path: payload has targetIndex + targetType + targetLabel instead of target
    if (typeof target === "undefined" && typeof actionPayload.targetIndex === "number") {
      const { targetIndex, targetType, targetLabel } = actionPayload;

      // Always re-scan the LIVE DOM at execution time — never trust a stale index/bbox
      const freshElements = extractVisualElementsWithNodes();

      // Check for stale target element
      if (typeof targetIndex === "number" && freshElements[targetIndex]) {
        const atIdx = freshElements[targetIndex];
        if (atIdx.node && !atIdx.node.isConnected) {
          return {
            executed: false,
            reason: "Stale target: element has been removed from document"
          };
        }
      }

      // Check for ambiguous target if multiple elements share identical label
      const matchingCandidates = freshElements.filter(
        (el) => el.node && el.node.isConnected && el.type === targetType && labelsMatch(el.label, targetLabel)
      );
      const exactMatches = matchingCandidates.filter(c => normalizeLabel(c.label) === normalizeLabel(targetLabel));
      if (exactMatches.length > 1 && (typeof targetIndex !== "number" || !freshElements[targetIndex] || !labelsMatch(freshElements[targetIndex].label, targetLabel))) {
        return {
          executed: false,
          reason: "Ambiguous target: multiple elements with identical label found on page"
        };
      }

      let matched = null;

      // 1) Best case: index still points at an element of matching type+label.
      if (freshElements[targetIndex]
          && freshElements[targetIndex].type === targetType
          && labelsMatch(freshElements[targetIndex].label, targetLabel)) {
        matched = freshElements[targetIndex];
      }

      // 2) Drift fallback: page changed since the perception snapshot — search by type+label only.
      if (!matched && matchingCandidates.length === 1) {
        matched = matchingCandidates[0];
      }

      if (!matched || !matched.node || !matched.node.isConnected) {
        return {
          executed: false,
          reason: "Grounded target element not found or drifted beyond safety threshold"
        };
      }

      try {
        if (matched.node.tagName && matched.node.tagName.toLowerCase() === "input") {
          matched.node.focus?.();
        }
        matched.node.click();
        return {
          executed: true,
          action: "CLICK",
          targetType,
          targetLabel,
          groundedIndex: targetIndex
        };
      } catch (err) {
        return { executed: false, reason: `Error during grounded click execution: ${err.message}` };
      }
    }

    // Existing legacy path (untouched): action.target is a string key in ACTION_TARGET_MAP.
    if (!target || !Object.prototype.hasOwnProperty.call(ACTION_TARGET_MAP, target)) {
      return {
        executed: false,
        reason: "Unsupported or unknown action/target"
      };
    }

    const selector = ACTION_TARGET_MAP[target];
    let element = document.querySelector(selector);

    // Fallback: search visible DOM elements matching the pre-registered safe semantic tag
    if (!element) {
      const candidates = document.querySelectorAll("button, a[href], input, [role='button']");
      for (const cand of candidates) {
        if (!getVisibleRect(cand)) continue;
        const candType = cand.tagName.toLowerCase() === "a" ? "link" : (cand.tagName.toLowerCase() === "input" ? "input" : "button");
        const candLabel = (cand.innerText || cand.placeholder || cand.getAttribute("aria-label") || "").trim();
        if (getSemanticTag(candType, candLabel, cand) === target) {
          element = cand;
          break;
        }
      }
    }

    if (!element) {
      return {
        executed: false,
        reason: "Element not found on page"
      };
    }

    try {
      if (element.tagName.toLowerCase() === "input") {
        element.focus();
        element.click();
      } else {
        element.click();
      }
      return {
        executed: true,
        action: "CLICK",
        target: target
      };
    } catch (err) {
      return {
        executed: false,
        reason: `Error during click execution: ${err.message}`
      };
    }
  }

  // 2. FILL Action Execution (Milestone 16 Generic Safe Form Fill)
  if (action === "FILL") {
    const { targetIndex, targetType, targetLabel } = actionPayload;
    // Protocol: value is NOT part of the message from backend; popup.js passes locally-held value via localValue
    const fillValue = actionPayload.localValue !== undefined
      ? actionPayload.localValue
      : (actionPayload.value !== undefined ? actionPayload.value : "");

    // 1. Re-scan live DOM at execution time
    const freshElements = extractVisualElementsWithNodes();

    // Check for stale target element
    if (typeof targetIndex === "number" && freshElements[targetIndex]) {
      const atIdx = freshElements[targetIndex];
      if (atIdx.node && !atIdx.node.isConnected) {
        return {
          executed: false,
          reason: "Stale target: element has been removed from document"
        };
      }
    }

    // 2. Re-ground target by targetType + label match
    const matchingCandidates = freshElements.filter(
      (el) => el.node && el.node.isConnected &&
        (el.type === targetType || ["input", "textarea", "select"].includes((el.node.tagName || "").toLowerCase())) &&
        labelsMatch(el.label, targetLabel)
    );

    // 4. Reject if ambiguous (more than one equally strong match)
    const exactMatches = matchingCandidates.filter(c => normalizeLabel(c.label) === normalizeLabel(targetLabel));
    if (exactMatches.length > 1 && (typeof targetIndex !== "number" || !freshElements[targetIndex] || !labelsMatch(freshElements[targetIndex].label, targetLabel))) {
      return {
        executed: false,
        reason: "Ambiguous target: multiple elements with identical label found on page"
      };
    }

    let matched = null;
    // Best case: targetIndex still points at matching element
    if (typeof targetIndex === "number" && freshElements[targetIndex]) {
      const cand = freshElements[targetIndex];
      if (cand.node && cand.node.isConnected && labelsMatch(cand.label, targetLabel)) {
        matched = cand;
      }
    }

    // Drift fallback: single unique candidate
    if (!matched && matchingCandidates.length === 1) {
      matched = matchingCandidates[0];
    }

    if (!matched || !matched.node || !matched.node.isConnected) {
      return {
        executed: false,
        reason: "Grounded target element not found or drifted beyond safety threshold"
      };
    }

    const el = matched.node;
    const tagName = (el.tagName || "").toLowerCase();
    const isInput = tagName === "input";
    const isTextarea = tagName === "textarea";
    const isContentEditable = el.isContentEditable || el.getAttribute("contenteditable") === "true";

    // 3. Verify matched node is an actual fillable control
    if (!isInput && !isTextarea && !isContentEditable) {
      return {
        executed: false,
        reason: "Target element is not a fillable form control"
      };
    }

    // 6. Refuse to fill sensitive credentials fields (type="password")
    if (isInput && (el.type || "").toLowerCase() === "password") {
      return {
        executed: false,
        reason: "Refused to fill sensitive credentials field (type=password)"
      };
    }

    // 5. Set value via native property setter + dispatch input/change events
    try {
      if (isInput || isTextarea) {
        const proto = isInput
          ? (typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : Object.getPrototypeOf(el))
          : (typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : Object.getPrototypeOf(el));
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(el, String(fillValue));
        } else {
          el.value = String(fillValue);
        }
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      } else if (isContentEditable) {
        el.textContent = String(fillValue);
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }

      // 7. Verify locally afterward (never return actual value string in result object)
      let verified = false;
      if (isInput || isTextarea) {
        verified = el.value === String(fillValue);
      } else if (isContentEditable) {
        verified = el.textContent === String(fillValue);
      }

      return {
        executed: true,
        action: "FILL",
        targetType: matched.type,
        targetLabel: matched.label,
        groundedIndex: typeof targetIndex === "number" ? targetIndex : freshElements.indexOf(matched),
        verified: verified
      };
    } catch (fillErr) {
      return {
        executed: false,
        reason: `Error during fill execution: ${fillErr.message}`
      };
    }
  }

  // 3. SCROLL Action Execution (Milestone 6)
  if (action === "SCROLL") {
    if (!target || !Object.prototype.hasOwnProperty.call(SCROLL_TARGET_MAP, target)) {
      return {
        executed: false,
        reason: "Unsupported or unknown action/target"
      };
    }

    // Validate that amount is numeric and falls within the hardcoded safe range
    if (typeof amount !== "number" || isNaN(amount) || amount < MIN_SCROLL_AMOUNT || amount > MAX_SCROLL_AMOUNT) {
      return {
        executed: false,
        reason: "Invalid or unsupported scroll amount"
      };
    }

    try {
      window.scrollBy({ top: amount, behavior: "smooth" });
      return {
        executed: true,
        action: "SCROLL",
        target: target,
        amount: amount
      };
    } catch (err) {
      return {
        executed: false,
        reason: `Error during scroll execution: ${err.message}`
      };
    }
  }

  // 4. Unknown / unsupported action type
  return {
    executed: false,
    reason: "Unsupported or unknown action/target"
  };
}

/**
 * Reusable helper to validate element visibility and obtain its bounding client rect.
 * Filters out zero-size, CSS-hidden, or off-screen elements.
 *
 * @param {Element} el - DOM element to check
 * @returns {DOMRect|null} Valid visible rect or null if element is hidden
 */
function getVisibleRect(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
    return null;
  }

  if (rect.x < -1000 || rect.y < -1000) {
    return null;
  }

  return rect;
}

/**
 * Milestone 8: Local DOM-based visual element perception (client-side only).
 */
const VISUAL_SELECTOR = "button, a[href], h1, h2, h3, h4, h5, h6, input, textarea, select, [role='button']";

/**
 * Humanizes element name attributes (e.g. "full_name" -> "Full Name", "userEmail" -> "User Email").
 * @param {string} name
 * @returns {string}
 */
function humanizeName(name) {
  if (!name) return "";
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Milestone 16: Resolves an element's visible label strictly via local DOM signals.
 * Follows strict priority order (never inspects .value):
 * 1. <label for="id"> matching element's id
 * 2. Wrapping ancestor <label>
 * 3. aria-label
 * 4. aria-labelledby (resolves referenced element(s) text)
 * 5. placeholder
 * 6. name attribute (humanized)
 * 7. Nearby preceding visible text sibling or enclosing form-group / Google Forms question container
 * 8. Fallback to existing "<type> field" behavior
 *
 * Google Forms Support:
 * Supports Google Forms /viewform public forms for Short answer (input[type="text"]) and
 * Paragraph (textarea) question types. Google Forms uses role="listitem" question containers
 * and aria-labelledby referencing heading elements (e.g. div[role="heading"]).
 * Note: Checkbox grids, file upload, and date picker widgets are not supported.
 *
 * @param {Element} el - DOM form control
 * @param {string} type - Identified element type ("input", "textarea", "select", etc.)
 * @returns {string} Extracted human-readable label
 */
function extractFormFieldLabel(el, type) {
  const tagName = (el.tagName || "").toLowerCase();
  const elId = el.id ? el.id.trim() : "";

  // 1. <label for="id"> matching element's id
  if (elId && typeof document !== "undefined" && document.querySelector) {
    try {
      const labelFor = document.querySelector(`label[for="${CSS.escape(elId)}"]`);
      if (labelFor) {
        const text = (labelFor.innerText || labelFor.textContent || "").trim();
        if (text) return text;
      }
    } catch (_) {}
  }

  // 2. Wrapping ancestor <label>
  if (el.closest) {
    const ancestorLabel = el.closest("label");
    if (ancestorLabel) {
      try {
        const clone = ancestorLabel.cloneNode(true);
        const nestedInputs = clone.querySelectorAll("input, textarea, select");
        nestedInputs.forEach(input => input.remove());
        const text = (clone.innerText || clone.textContent || "").trim();
        if (text) return text;
      } catch (_) {}
      const rawText = (ancestorLabel.innerText || ancestorLabel.textContent || "").trim();
      if (rawText) return rawText;
    }
  }

  // 3. aria-label
  if (el.getAttribute) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel.trim();
    }
  }

  // 4. aria-labelledby (resolve referenced elements)
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy && ariaLabelledBy.trim()) {
      const ids = ariaLabelledBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = (refEl.innerText || refEl.textContent || "").trim();
          if (text) parts.push(text);
        }
      }
      if (parts.length > 0) {
        return parts.join(" ");
      }
    }
  }

  // 5. placeholder
  if (el.getAttribute) {
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      return placeholder.trim();
    }
  }

  // 6. name attribute (humanized)
  if (el.getAttribute) {
    const nameAttr = el.getAttribute("name");
    if (nameAttr && nameAttr.trim()) {
      const humanized = humanizeName(nameAttr);
      if (humanized) return humanized;
    }
  }

  // 7. Nearby preceding visible text sibling or enclosing form-group / Google Forms container
  // 7a. Check Google Forms role="listitem" question container
  if (el.closest) {
    const listitem = el.closest("[role='listitem']");
    if (listitem) {
      const heading = listitem.querySelector("[role='heading'], .freebirdFormviewerComponentsQuestionBaseTitle, .M7eMe");
      if (heading) {
        const headingText = (heading.innerText || heading.textContent || "").trim();
        if (headingText) return headingText;
      }
    }
  }

  // 7b. Check preceding siblings in same parent
  let prev = el.previousElementSibling;
  while (prev) {
    const prevText = (prev.innerText || prev.textContent || "").trim();
    if (prevText && prevText.length < 100) {
      return prevText;
    }
    prev = prev.previousElementSibling;
  }

  // 7c. Check enclosing form-group container
  if (el.closest) {
    const parentGroup = el.closest(".form-group, .field-group, .form-row, div, p");
    if (parentGroup && (typeof document === "undefined" || parentGroup !== document.body)) {
      const labelLike = parentGroup.querySelector("label, .field-label, .label, span, strong, b");
      if (labelLike && labelLike !== el) {
        const text = (labelLike.innerText || labelLike.textContent || "").trim();
        if (text && text.length < 100) return text;
      }
    }
  }

  // 8. Fallback to existing "<type> field" behavior
  if (tagName === "input") {
    if (el.type === "password") {
      return "Password field";
    } else if (el.type === "email") {
      return "Email field";
    } else {
      return el.type ? `${el.type} field` : "Input field";
    }
  } else if (tagName === "textarea") {
    return "Textarea";
  } else if (tagName === "select") {
    return "Select dropdown";
  }

  return `${type} field`;
}

/**
 * Shared helper to classify a single DOM element's type, label, semantic tag, and visible bounding box.
 * SECURITY: Never reads or records `.value` from any input or form control.
 *
 * @param {Element} el - DOM element
 * @param {number|null} [fieldId=null] - Stable per-scan form-field index
 * @returns {Object|null} Element descriptor or null if hidden
 */
function classifyVisualElement(el, fieldId = null) {
  // 1. Check layout presence and visibility
  const rect = getVisibleRect(el);
  if (!rect) {
    return null;
  }

  // 2. Identify UI element type
  const tagName = (el.tagName || "").toLowerCase();
  let type = "element";

  if (/^h[1-6]$/.test(tagName)) {
    type = "heading";
  } else if (tagName === "button" || (el.getAttribute && el.getAttribute("role") === "button") || (tagName === "input" && ["button", "submit", "reset"].includes(el.type))) {
    type = "button";
  } else if (tagName === "a") {
    type = "link";
  } else if (tagName === "textarea") {
    type = "textarea";
  } else if (tagName === "select") {
    type = "select";
  } else if (tagName === "input") {
    if (el.type === "checkbox") {
      type = "checkbox";
    } else if (el.type === "radio") {
      type = "radio";
    } else {
      type = "input";
    }
  }

  // 3. Safe, non-sensitive label extraction
  // NOTE: Explicitly NEVER reads .value to ensure privacy preservation.
  let label = "";
  const isFormField = ["input", "textarea", "select"].includes(tagName);

  if (isFormField) {
    label = extractFormFieldLabel(el, type);
  } else {
    label = (el.innerText || el.textContent || (el.getAttribute ? el.getAttribute("aria-label") : "") || "").trim();
  }

  // Normalize spacing and truncate label length
  label = label.replace(/\s+/g, " ").slice(0, 60) || `${type} element`;

  // 4. Record bounding box and metadata with safe semantic label
  const semanticTag = getSemanticTag(type, label, el);
  const descriptor = {
    type: type,
    label: label,
    semanticTag: semanticTag,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };

  if (isFormField && typeof fieldId === "number") {
    descriptor.fieldId = fieldId;
  }

  return descriptor;
}

/**
 * Milestone 8 & 16: Local DOM-based visual element perception (client-side only).
 * Scans for visible buttons, links, headings, inputs, textareas, and selects.
 * Strips DOM node references for message-passing serializability.
 *
 * @returns {Array<Object>} Array of visible UI element descriptors
 */
function extractVisualElements() {
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElements = [];
  let formFieldCounter = 0;

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const isFormField = ["input", "textarea", "select"].includes(tagName);
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      visualElements.push(item);
    }
  });

  return visualElements;
}

/**
 * Milestone 15 & 16: Node-carrying visual element extraction for live DOM re-verification.
 * Keeps a reference to the live DOM node for safe in-page execution.
 *
 * @returns {Array<Object>} Array of visual element descriptors with live .node references
 */
function extractVisualElementsWithNodes() {
  const elements = document.querySelectorAll(VISUAL_SELECTOR);
  const visualElementsWithNodes = [];
  let formFieldCounter = 0;

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const isFormField = ["input", "textarea", "select"].includes(tagName);
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      visualElementsWithNodes.push({
        ...item,
        node: el
      });
    }
  });

  return visualElementsWithNodes;
}

/**
 * Milestone 11: Local DOM-attribute heuristic for sensitive input detection.
 * Checks purely input types and name/id/placeholder keywords.
 * SECURITY: Never reads or inspects `.value` of any field.
 */
const SENSITIVE_KEYWORDS = ["card", "credit", "cvv", "ssn", "phone", "password", "email"];

function isSensitiveElement(el) {
  const tagName = el.tagName.toLowerCase();
  if (tagName !== "input" && tagName !== "textarea") {
    return false;
  }

  const type = (el.type || "").toLowerCase();
  if (tagName === "input" && (type === "password" || type === "email")) {
    return true;
  }

  // Pure attribute heuristic — never reads .value
  const nameAttr = (el.getAttribute("name") || "").toLowerCase();
  const idAttr = (el.id || "").toLowerCase();
  const placeholderAttr = (el.getAttribute("placeholder") || "").toLowerCase();

  return SENSITIVE_KEYWORDS.some(kw =>
    nameAttr.includes(kw) || idAttr.includes(kw) || placeholderAttr.includes(kw)
  );
}

/**
 * Milestone 11: Extracts bounding boxes of visible sensitive elements.
 * Reuses the exact same visibility logic as M8.
 *
 * @returns {Array<Object>} Array of sensitive region bounding boxes {x, y, width, height}
 */
function extractSensitiveRegions() {
  const elements = document.querySelectorAll("input, textarea");
  const sensitiveRegions = [];

  elements.forEach((el) => {
    if (!isSensitiveElement(el)) return;
    const rect = getVisibleRect(el);
    if (!rect) return;

    sensitiveRegions.push({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });
  });

  return sensitiveRegions;
}

// Listen for messages sent from the popup
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageInfo") {
    // 1. Collect basic page metadata (Milestone 1)
    const title = document.title || "No Title Found";
    const url = window.location.href;

    // 2. Extract a small snippet of visible text (capped at 2000 characters)
    const rawVisibleText = document.body ? document.body.innerText.slice(0, 2000) : "";

    // 3. Redact any sensitive PII locally before sending back (Milestone 2)
    const redactedSample = typeof redactText === "function" 
      ? redactText(rawVisibleText) 
      : rawVisibleText;

    // 4. Local visual context perception: extract visible UI elements (Milestone 8)
    const visualElements = extractVisualElements();

    // 5. Local visual privacy: extract sensitive regions (Milestone 11)
    const tSensStart = performance.now();
    const sensitiveRegions = extractSensitiveRegions();
    const sensitiveDetectionMs = Math.round(performance.now() - tSensStart);

    // 6. Send the sanitized data back to popup (never expose raw text, passwords, or input values)
    sendResponse({
      success: true,
      title,
      url,
      redactedSample,
      visualElements,
      sensitiveRegions,
      sensitiveDetectionMs
    });
  } else if (request.action === "executeAction") {
    // Milestones 5 & 6: Safely execute whitelisted action
    const executionResult = executeAction(request.payload);
    sendResponse({
      success: true,
      result: executionResult
    });
  }

  return false;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VISUAL_SELECTOR,
    ACTION_TARGET_MAP,
    SCROLL_TARGET_MAP,
    classifyVisualElement,
    extractVisualElements,
    extractVisualElementsWithNodes,
    extractFormFieldLabel,
    humanizeName,
    executeAction,
    normalizeLabel,
    labelsMatch
  };
}
