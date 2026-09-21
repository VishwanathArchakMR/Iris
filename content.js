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
 * Trims punctuation, colons, asterisks, and excessive whitespace.
 * @param {string} s
 * @returns {string}
 */
function normalizeLabel(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[:*#_\-\/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
 * Task 1: High-DPI, Zoom, and Scroll Drift Coordinate Normalizer.
 * Maps raw screenshot coordinates from captureVisibleTab to layout viewport pixels.
 *
 * @param {number} rawX - Captured pixel X coordinate
 * @param {number} rawY - Captured pixel Y coordinate
 * @param {number} capturedWidth - Width of the captured screenshot buffer
 * @param {number} capturedHeight - Height of the captured screenshot buffer
 * @returns {{ clientX: number, clientY: number }} Layout viewport coordinates
 */
function normalizeScreenshotCoordinates(rawX, rawY, capturedWidth, capturedHeight) {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  
  // Derive viewport-relative dimensions
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
  
  // Scale from captured image buffer dimensions to layout viewport pixels
  const capW = capturedWidth || (viewportWidth * dpr);
  const capH = capturedHeight || (viewportHeight * dpr);
  const scaleX = viewportWidth / (capW / dpr);
  const scaleY = viewportHeight / (capH / dpr);
  
  const clientX = (rawX * scaleX) / dpr;
  const clientY = (rawY * scaleY) / dpr;
  
  return { clientX, clientY };
}

/**
 * Task 2: Robust Synthetic Typing for Modern Frameworks (React 16+, Vue, Angular, Svelte).
 * Focuses element, selects existing content, sets value via native property setter,
 * and dispatches the full lifecycle of events (focus, keydown, input, keyup, change, blur).
 *
 * @param {HTMLElement} element - Target input or textarea element
 * @param {string} text - Text value to type
 */
function simulateFrameworkCompatibleTyping(element, text) {
  if (!element) return;
  if (typeof element.focus === "function") {
    element.focus();
  }

  // Clear existing content
  if (typeof element.select === "function") {
    try { element.select(); } catch (_) {}
  }

  // Access the native prototype setter to bypass React 16+ value tracking
  const prototype = Object.getPrototypeOf(element);
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set 
    || (typeof window !== "undefined" && window.HTMLInputElement && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set)
    || (typeof window !== "undefined" && window.HTMLTextAreaElement && Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set);

  if (nativeSetter) {
    nativeSetter.call(element, text);
  } else {
    element.value = text;
  }

  // Dispatch full lifecycle events
  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  if (typeof Event !== "undefined") {
    element.dispatchEvent(new Event("focus", eventOptions));
  }
  if (typeof KeyboardEvent !== "undefined") {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Unidentified", ...eventOptions }));
  } else if (typeof Event !== "undefined") {
    element.dispatchEvent(new Event("keydown", eventOptions));
  }
  if (typeof InputEvent !== "undefined") {
    element.dispatchEvent(new InputEvent("input", { data: text, inputType: "insertText", ...eventOptions }));
  } else if (typeof Event !== "undefined") {
    element.dispatchEvent(new Event("input", eventOptions));
  }
  if (typeof KeyboardEvent !== "undefined") {
    element.dispatchEvent(new KeyboardEvent("keyup", { key: "Unidentified", ...eventOptions }));
  } else if (typeof Event !== "undefined") {
    element.dispatchEvent(new Event("keyup", eventOptions));
  }
  if (typeof Event !== "undefined") {
    element.dispatchEvent(new Event("change", eventOptions));
    element.dispatchEvent(new Event("blur", eventOptions));
  }
}

/**
 * Task 2: Robust Synthetic Click Simulation firing the complete pointer event sequence.
 * Dispatches pointerover -> pointerenter -> pointerdown -> mousedown -> focus -> pointerup -> mouseup -> click.
 *
 * @param {HTMLElement} element - Target element to click
 * @param {number} [clientX] - Viewport X coordinate
 * @param {number} [clientY] - Viewport Y coordinate
 */
function simulateHumanClick(element, clientX, clientY) {
  if (!element) return;
  let cx = clientX;
  let cy = clientY;
  if (typeof cx !== "number" || typeof cy !== "number") {
    if (typeof element.getBoundingClientRect === "function") {
      const rect = element.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    } else {
      cx = 0;
      cy = 0;
    }
  }

  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: typeof window !== "undefined" ? window : null,
    clientX: cx,
    clientY: cy,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true
  };

  if (typeof PointerEvent !== "undefined") {
    element.dispatchEvent(new PointerEvent("pointerover", init));
    element.dispatchEvent(new PointerEvent("pointerenter", init));
    element.dispatchEvent(new PointerEvent("pointerdown", init));
  }
  if (typeof MouseEvent !== "undefined") {
    element.dispatchEvent(new MouseEvent("mousedown", init));
  }
  if (typeof element.focus === "function") {
    element.focus();
  }
  if (typeof PointerEvent !== "undefined") {
    element.dispatchEvent(new PointerEvent("pointerup", init));
  }
  if (typeof MouseEvent !== "undefined") {
    element.dispatchEvent(new MouseEvent("mouseup", init));
    element.dispatchEvent(new MouseEvent("click", init));
  } else if (typeof element.click === "function") {
    element.click();
  }
}

/**
 * Safely executes a permitted action on the page if explicitly whitelisted.
 *
 * @param {Object} actionPayload - { action: string, target?: string, amount?: number, targetIndex?: number, targetType?: string, targetLabel?: string, localValue?: string, rawX?: number, rawY?: number, clientX?: number, clientY?: number, capturedWidth?: number, capturedHeight?: number }
 * @returns {Object} Execution result summary
 */
function executeAction(actionPayload) {
  if (!actionPayload || typeof actionPayload !== "object") {
    return { executed: false, reason: "Invalid action payload" };
  }

  const { action, target, amount } = actionPayload;

  // Explicit action allowlist check: {"CLICK", "SCROLL", "FILL", "FILL_FORM", "AUTOFILL", "SUBMIT", "NAVIGATE"} permitted
  const ALLOWED_ACTIONS = new Set(["CLICK", "SCROLL", "FILL", "FILL_FORM", "AUTOFILL", "SUBMIT", "NAVIGATE"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return {
      executed: false,
      reason: "Unsupported or unknown action/target"
    };
  }

  // NAVIGATE Action Execution
  if (action === "NAVIGATE") {
    const navUrl = actionPayload.value || actionPayload.target || "";
    if (navUrl && (navUrl.startsWith("http://") || navUrl.startsWith("https://") || navUrl.startsWith("/"))) {
      try {
        if (typeof window !== "undefined") {
          window.location.href = navUrl;
        }
        return { executed: true, action: "NAVIGATE", target: navUrl, verified: true };
      } catch (e) {
        return { executed: false, reason: `Navigation failed: ${e.message}` };
      }
    }
    return { executed: false, reason: "Invalid navigation URL" };
  }

  // 1. CLICK Action Execution (Milestone 5, 14 & 15 Generalized Grounding)
  if (action === "CLICK") {
    // Coordinate-based target resolution (Task 1 Normalization & elementFromPoint)
    if (typeof actionPayload.rawX === "number" && typeof actionPayload.rawY === "number") {
      const capW = actionPayload.capturedWidth || (actionPayload.capturedDimensions && actionPayload.capturedDimensions.width) || (typeof window !== "undefined" ? window.innerWidth : 1280);
      const capH = actionPayload.capturedHeight || (actionPayload.capturedDimensions && actionPayload.capturedDimensions.height) || (typeof window !== "undefined" ? window.innerHeight : 720);
      const { clientX, clientY } = normalizeScreenshotCoordinates(actionPayload.rawX, actionPayload.rawY, capW, capH);
      
      let coordElement = (typeof document !== "undefined" && typeof document.elementFromPoint === "function")
        ? document.elementFromPoint(clientX, clientY)
        : null;

      if (coordElement) {
        if (typeof coordElement.scrollIntoView === "function") {
          try {
            coordElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          } catch (_) {
            try { coordElement.scrollIntoView({ block: "center", inline: "center" }); } catch (__) {}
          }
        }
        const postRect = coordElement.getBoundingClientRect();
        const postCx = postRect.left + postRect.width / 2;
        const postCy = postRect.top + postRect.height / 2;
        simulateHumanClick(coordElement, postCx, postCy);
        return {
          executed: true,
          action: "CLICK",
          targetType: (coordElement.tagName || "element").toLowerCase(),
          targetLabel: (coordElement.innerText || coordElement.getAttribute?.("aria-label") || "point-target").slice(0, 50),
          clientX: postCx,
          clientY: postCy
        };
      }
    }

    // Direct client coordinate dispatch
    if (typeof actionPayload.clientX === "number" && typeof actionPayload.clientY === "number") {
      let coordElement = (typeof document !== "undefined" && typeof document.elementFromPoint === "function")
        ? document.elementFromPoint(actionPayload.clientX, actionPayload.clientY)
        : null;

      if (coordElement) {
        if (typeof coordElement.scrollIntoView === "function") {
          try {
            coordElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          } catch (_) {
            try { coordElement.scrollIntoView({ block: "center", inline: "center" }); } catch (__) {}
          }
        }
        const postRect = coordElement.getBoundingClientRect();
        const postCx = postRect.left + postRect.width / 2;
        const postCy = postRect.top + postRect.height / 2;
        simulateHumanClick(coordElement, postCx, postCy);
        return {
          executed: true,
          action: "CLICK",
          targetType: (coordElement.tagName || "element").toLowerCase(),
          targetLabel: (coordElement.innerText || coordElement.getAttribute?.("aria-label") || "point-target").slice(0, 50),
          clientX: postCx,
          clientY: postCy
        };
      }
    }

    // Generalized grounded path: payload has targetIndex
    if (typeof actionPayload.targetIndex === "number") {
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
        (el) => el.node && el.node.isConnected && (el.type === targetType || ["button", "link", "input", "element"].includes(el.type)) && labelsMatch(el.label, targetLabel)
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
          && freshElements[targetIndex].node
          && freshElements[targetIndex].node.isConnected
          && labelsMatch(freshElements[targetIndex].label, targetLabel)) {
        matched = freshElements[targetIndex];
      }

      // 2) Drift fallback: page changed since the perception snapshot — search by matching candidates.
      if (!matched && matchingCandidates.length === 1) {
        matched = matchingCandidates[0];
      }

      if (!matched || !matched.node || !matched.node.isConnected) {
        return {
          executed: false,
          reason: "Grounded target element not found or drifted beyond safety threshold"
        };
      }

      // Safety check: reject disabled / read-only targets
      if (matched.node.disabled || matched.node.getAttribute?.("aria-disabled") === "true") {
        return {
          executed: false,
          reason: "Target element is disabled or read-only"
        };
      }

      try {
        // Scroll target into view smoothly before dispatching actions
        if (typeof matched.node.scrollIntoView === "function") {
          try {
            matched.node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          } catch (_) {
            try { matched.node.scrollIntoView({ block: "center", inline: "center" }); } catch (__) {}
          }
        }

        // Recalculate target center coordinates post-scroll using getBoundingClientRect()
        let postCx = 0;
        let postCy = 0;
        if (typeof matched.node.getBoundingClientRect === "function") {
          const rect = matched.node.getBoundingClientRect();
          postCx = rect.left + rect.width / 2;
          postCy = rect.top + rect.height / 2;
        }

        if (matched.node.tagName && matched.node.tagName.toLowerCase() === "input") {
          matched.node.focus?.();
        }

        // Execute robust human pointer & click simulation
        simulateHumanClick(matched.node, postCx, postCy);

        return {
          executed: true,
          action: "CLICK",
          targetType: matched.type || targetType,
          targetLabel: matched.label || targetLabel,
          groundedIndex: targetIndex,
          clientX: postCx,
          clientY: postCy
        };
      } catch (err) {
        return { executed: false, reason: `Error during grounded click execution: ${err.message}` };
      }
    }

    // Existing legacy path: action.target is a string key in ACTION_TARGET_MAP.
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

    // Safety check: reject disabled legacy targets
    if (element.disabled || element.getAttribute?.("aria-disabled") === "true") {
      return {
        executed: false,
        reason: "Target element is disabled or read-only"
      };
    }

    try {
      if (typeof element.scrollIntoView === "function") {
        try {
          element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        } catch (_) {
          try { element.scrollIntoView({ block: "center", inline: "center" }); } catch (__) {}
        }
      }

      let postCx = 0;
      let postCy = 0;
      if (typeof element.getBoundingClientRect === "function") {
        const rect = element.getBoundingClientRect();
        postCx = rect.left + rect.width / 2;
        postCy = rect.top + rect.height / 2;
      }

      if (element.tagName.toLowerCase() === "input") {
        element.focus();
      }
      simulateHumanClick(element, postCx, postCy);

      return {
        executed: true,
        action: "CLICK",
        target: target,
        clientX: postCx,
        clientY: postCy
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
    const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
    const isRoleTextbox = !!(el.getAttribute && el.getAttribute("role") === "textbox");

    // 3. Verify matched node is an actual fillable control
    if (!isInput && !isTextarea && !isContentEditable && !isRoleTextbox) {
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

    // Safety check: reject disabled or read-only targets
    if (el.disabled || el.readOnly || (el.getAttribute && el.getAttribute("aria-disabled") === "true") || (el.getAttribute && el.getAttribute("readonly") !== null)) {
      return {
        executed: false,
        reason: "Target element is disabled or read-only"
      };
    }

    // Scroll element into view smoothly before typing
    if (typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch (_) {
        try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (__) {}
      }
    }

    // 5. Set value via framework-compatible typing simulation + dispatch full event lifecycle
    try {
      if (isInput || isTextarea) {
        simulateFrameworkCompatibleTyping(el, String(fillValue));
      } else if (isContentEditable || isRoleTextbox) {
        if (typeof el.focus === "function") el.focus();
        el.textContent = String(fillValue);
        const eventOptions = { bubbles: true, cancelable: true, composed: true };
        el.dispatchEvent(new Event("focus", eventOptions));
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Unidentified", ...eventOptions }));
        el.dispatchEvent(new InputEvent("input", { data: String(fillValue), inputType: "insertText", ...eventOptions }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key: "Unidentified", ...eventOptions }));
        el.dispatchEvent(new Event("change", eventOptions));
        el.dispatchEvent(new Event("blur", eventOptions));
      }

      // 7. Verify locally afterward (never return actual value string in result object)
      let verified = false;
      if (isInput || isTextarea) {
        verified = el.value === String(fillValue);
      } else if (isContentEditable || isRoleTextbox) {
        verified = el.textContent === String(fillValue) || el.innerText === String(fillValue);
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

  // 2b. FILL_FORM Action Execution (Simultaneous Whole-Form Autofill using Local Profile)
  if (action === "FILL_FORM" || action === "AUTOFILL") {
    // Standard local fallback profile for testing (replaces personal data)
    const profile = actionPayload.profile || (typeof window !== "undefined" && window.SIHFormProfile ? window.SIHFormProfile.getFormProfile() : null) || {
      fullName: "Test User",
      name: "Test User",
      email: "test@example.com",
      phone: "+1-555-0100",
      organization: "Test Organization",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      zip: "000000",
      comments: "Automated visual perception agent verification test."
    };

    const freshElements = extractVisualElementsWithNodes();
    const fieldsFilled = [];

    for (let idx = 0; idx < freshElements.length; idx++) {
      const item = freshElements[idx];
      if (!item || !item.node || !item.node.isConnected) continue;

      const el = item.node;
      const tagName = (el.tagName || "").toLowerCase();
      const elType = (el.type || "").toLowerCase();
      const isInput = tagName === "input";
      const isTextarea = tagName === "textarea";
      const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
      const isRoleTextbox = !!(el.getAttribute && el.getAttribute("role") === "textbox");

      if (!isInput && !isTextarea && !isContentEditable && !isRoleTextbox) continue;

      // Refuse sensitive password fields strictly
      if (isInput && elType === "password") continue;
      // Skip non-fillable inputs (buttons, submit, reset, hidden)
      if (isInput && ["submit", "button", "reset", "hidden", "image"].includes(elType)) continue;
      // Skip disabled or read-only controls
      if (el.disabled || el.readOnly || (el.getAttribute && el.getAttribute("aria-disabled") === "true") || (el.getAttribute && el.getAttribute("readonly") !== null)) continue;

      let fillVal = null;
      let matchedKey = null;

      if (typeof window !== "undefined" && window.SIHFormProfile && typeof window.SIHFormProfile.matchFieldToProfile === "function") {
        const matchResult = window.SIHFormProfile.matchFieldToProfile(item, profile);
        if (matchResult && matchResult.value) {
          fillVal = matchResult.value;
          matchedKey = matchResult.key;
        }
      }

      if (!fillVal) {
        const normLabel = normalizeLabel(item.label || el.placeholder || el.name || el.id || "");
        if (normLabel.includes("name")) { fillVal = profile.fullName || profile.name; matchedKey = "name"; }
        else if (normLabel.includes("email") || normLabel.includes("mail")) { fillVal = profile.email; matchedKey = "email"; }
        else if (normLabel.includes("phone") || normLabel.includes("mobile") || normLabel.includes("contact")) { fillVal = profile.phone; matchedKey = "phone"; }
        else if (normLabel.includes("org") || normLabel.includes("company")) { fillVal = profile.organization || profile.company; matchedKey = "organization"; }
        else if (normLabel.includes("address") || normLabel.includes("street")) { fillVal = profile.address || profile.street; matchedKey = "address"; }
        else if (normLabel.includes("city") || normLabel.includes("town")) { fillVal = profile.city; matchedKey = "city"; }
        else if (normLabel.includes("state") || normLabel.includes("province")) { fillVal = profile.state; matchedKey = "state"; }
        else if (normLabel.includes("zip") || normLabel.includes("postal") || normLabel.includes("pin")) { fillVal = profile.zip || profile.postalCode; matchedKey = "zip"; }
        else if (normLabel.includes("comment") || normLabel.includes("message") || normLabel.includes("feedback") || normLabel.includes("notes")) { fillVal = profile.comments || profile.message; matchedKey = "comments"; }
      }

      if (fillVal !== null && fillVal !== undefined) {
        try {
          if (typeof el.scrollIntoView === "function") {
            try { el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }); } catch (_) {}
          }

          if (isInput || isTextarea) {
            simulateFrameworkCompatibleTyping(el, String(fillVal));
          } else if (isContentEditable || isRoleTextbox) {
            if (typeof el.focus === "function") el.focus();
            el.textContent = String(fillVal);
            const eventOptions = { bubbles: true, cancelable: true, composed: true };
            el.dispatchEvent(new Event("focus", eventOptions));
            el.dispatchEvent(new KeyboardEvent("keydown", { key: "Unidentified", ...eventOptions }));
            el.dispatchEvent(new InputEvent("input", { data: String(fillVal), inputType: "insertText", ...eventOptions }));
            el.dispatchEvent(new KeyboardEvent("keyup", { key: "Unidentified", ...eventOptions }));
            el.dispatchEvent(new Event("change", eventOptions));
            el.dispatchEvent(new Event("blur", eventOptions));
          }

          let verified = false;
          if (isInput || isTextarea) {
            verified = el.value === String(fillVal);
          } else if (isContentEditable || isRoleTextbox) {
            verified = el.textContent === String(fillVal) || el.innerText === String(fillVal);
          }

          fieldsFilled.push({
            targetIndex: idx,
            targetType: item.type,
            targetLabel: item.label || el.placeholder || el.name || `Field #${idx}`,
            matchedKey: matchedKey,
            verified: verified
          });
        } catch (e) {
          console.warn("Error filling field in simultaneous pass:", e);
        }
      }
    }

    return {
      executed: fieldsFilled.length > 0,
      action: "FILL_FORM",
      fieldsFilled: fieldsFilled,
      count: fieldsFilled.length,
      verified: fieldsFilled.length > 0 && fieldsFilled.every(f => f.verified),
      simultaneous: true
    };
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

  // 4. SUBMIT Action Execution (Milestone 13 Cross-Website Robustness Patch)
  // Section 4 Submission Priority:
  // 1. associated form submission if safely available
  // 2. existing search/submit button
  // 3. keyboard Enter if current execution system safely supports it
  if (action === "SUBMIT") {
    const freshElements = extractVisualElementsWithNodes();
    let targetInput = null;

    // A. If targetIndex specified and points to a live node
    if (typeof actionPayload.targetIndex === "number" && freshElements[actionPayload.targetIndex]) {
      const cand = freshElements[actionPayload.targetIndex];
      if (cand.node && cand.node.isConnected) {
        targetInput = cand.node;
      }
    }

    // B. If document.activeElement is an input/textarea
    if (!targetInput && document.activeElement && ["input", "textarea"].includes((document.activeElement.tagName || "").toLowerCase())) {
      targetInput = document.activeElement;
    }

    // C. Search DOM for the primary search input
    if (!targetInput) {
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected) continue;
        const n = item.node;
        const tag = (n.tagName || "").toLowerCase();
        if (tag !== "input" && tag !== "textarea") continue;
        const lNorm = normalizeLabel(item.label || n.placeholder || n.name || n.id || "");
        if (lNorm.includes("search") || lNorm.includes("query") || n.type === "search" || item.semanticTag === "SEARCH_INPUT") {
          targetInput = n;
          break;
        }
      }
    }

    // Fallback: any visible text input on page
    if (!targetInput) {
      for (const item of freshElements) {
        if (!item || !item.node || !item.node.isConnected) continue;
        const n = item.node;
        if ((n.tagName || "").toLowerCase() === "input" && ["text", "search", ""].includes((n.type || "").toLowerCase()) && !n.disabled && !n.readOnly) {
          targetInput = n;
          break;
        }
      }
    }

    let submissionMethod = "none";
    let submitted = false;

    // Strategy 1: Associated form submission if safely available
    if (targetInput) {
      const form = targetInput.form || (typeof targetInput.closest === "function" ? targetInput.closest("form") : null);
      if (form) {
        try {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
            submissionMethod = "form.requestSubmit";
            submitted = true;
          } else if (typeof form.submit === "function") {
            form.submit();
            submissionMethod = "form.submit";
            submitted = true;
          }
        } catch (formErr) {
          console.warn("[SIH26171] form.requestSubmit notice:", formErr);
        }
      }
    }

    // Strategy 2: Existing search/submit button
    if (!submitted) {
      let submitBtn = null;
      if (targetInput) {
        const form = targetInput.form || (typeof targetInput.closest === "function" ? targetInput.closest("form") : null);
        if (form) {
          submitBtn = form.querySelector("button[type='submit'], input[type='submit'], button");
        }
      }
      if (!submitBtn) {
        for (const item of freshElements) {
          if (!item || !item.node || !item.node.isConnected) continue;
          const n = item.node;
          if (n.disabled || n.getAttribute?.("aria-disabled") === "true") continue;
          const lNorm = normalizeLabel(item.label || n.value || n.getAttribute?.("aria-label") || "");
          if (item.type === "button" && (lNorm.includes("search") || lNorm.includes("submit") || item.semanticTag === "SUBMIT_BUTTON")) {
            submitBtn = n;
            break;
          }
        }
      }

      if (submitBtn) {
        try {
          if (typeof submitBtn.scrollIntoView === "function") {
            try { submitBtn.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }); } catch (_) {}
          }
          let postCx = 0;
          let postCy = 0;
          if (typeof submitBtn.getBoundingClientRect === "function") {
            const rect = submitBtn.getBoundingClientRect();
            postCx = rect.left + rect.width / 2;
            postCy = rect.top + rect.height / 2;
          }
          simulateHumanClick(submitBtn, postCx, postCy);
          submissionMethod = "search_button_click";
          submitted = true;
        } catch (btnErr) {
          console.warn("[SIH26171] submit button click notice:", btnErr);
        }
      }
    }

    // Strategy 3: Keyboard Enter if current execution system safely supports it
    // Dispatch Enter on the search input to ensure SPA / dynamic handlers activate
    if (targetInput) {
      try {
        targetInput.focus?.();
        const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
        targetInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
        targetInput.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
        targetInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
        targetInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        if (!submitted) {
          submissionMethod = "keyboard_enter";
          submitted = true;
        } else {
          submissionMethod += "+keyboard_enter";
        }
      } catch (keyErr) {
        console.warn("[SIH26171] keyboard Enter dispatch notice:", keyErr);
      }
    }

    if (submitted) {
      return {
        executed: true,
        action: "SUBMIT",
        target: actionPayload.target || "search",
        targetType: "input",
        targetLabel: targetInput ? (targetInput.name || targetInput.id || "search input") : "search",
        submissionMethod: submissionMethod,
        verified: true
      };
    }

    return {
      executed: false,
      reason: "No form, submit button, or input found to submit search."
    };
  }

  // 5. Unknown / unsupported action type
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
 * Generic DOM visual perception selector.
 * Detects visible buttons, links, inputs, textareas, selects, ARIA interactive roles, and headings.
 */
const VISUAL_SELECTOR = "button, a[href], input, textarea, select, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='combobox'], [role='textbox'], [contenteditable='true'], [role='tab'], [role='menuitem'], [role='switch'], h1, h2, h3, h4, h5, h6, [tabindex]:not([tabindex='-1'])";

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
 * Checks if an extracted label is generic boilerplate rather than a meaningful semantic title.
 * @param {string} str
 * @returns {boolean}
 */
function isGenericBoilerplateLabel(str) {
  const s = (str || "").toLowerCase().trim();
  if (!s) return true;
  const boilerplateExact = new Set([
    "your answer",
    "enter your answer",
    "type your answer",
    "write a response",
    "required question",
    "this is a required question",
    "text field",
    "input field",
    "textarea",
    "*",
    "short answer text",
    "long answer text",
    "option 1",
    "untitled question"
  ]);
  if (boilerplateExact.has(s)) return true;
  if (/^(?:your\s+answer|required\s+question|\*|text\s+field|input\s+field)$/i.test(s)) return true;
  return false;
}

/**
 * Cleans extracted form field title text by stripping punctuation, colons, and asterisks.
 * @param {string} str
 * @returns {string}
 */
function cleanFieldTitle(str) {
  return (str || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s*\*+\s*$/g, "")
    .replace(/^\s*\*+\s*/g, "")
    .replace(/[:*#_\-\/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves an element's visible semantic label strictly via local DOM signals.
 * Implements strict priority order (never reads .value):
 * 1. explicitly associated <label for="id">
 * 2. wrapping ancestor <label>
 * 3. non-boilerplate aria-label
 * 4. non-boilerplate aria-labelledby (resolves referenced element(s) text)
 * 5. enclosing question container (.M7eMe, [role="heading"], .geS5n, .Qr7Oae, .form-group)
 * 6. associated visible label text (aria-describedby)
 * 7. name attribute (humanized)
 * 8. placeholder (non-boilerplate)
 * 9. title attribute
 * 10. nearby preceding visible text sibling
 * 11. type-based fallback ("<type> field")
 *
 * @param {Element} el - DOM form control
 * @param {string} type - Identified element type ("input", "textarea", "select", etc.)
 * @returns {string} Extracted human-readable label
 */
function extractFormFieldLabel(el, type) {
  const tagName = (el.tagName || "").toLowerCase();
  const elId = el.id ? el.id.trim() : "";

  // 1. Explicitly associated <label for="id">
  if (elId && typeof document !== "undefined" && document.querySelector) {
    try {
      const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(elId) : elId;
      const labelFor = document.querySelector(`label[for="${escapedId}"]`);
      if (labelFor) {
        const text = cleanFieldTitle(labelFor.innerText || labelFor.textContent || "");
        if (text && !isGenericBoilerplateLabel(text)) return text;
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
        const text = cleanFieldTitle(clone.innerText || clone.textContent || "");
        if (text && !isGenericBoilerplateLabel(text)) return text;
      } catch (_) {}
      const rawText = cleanFieldTitle(ancestorLabel.innerText || ancestorLabel.textContent || "");
      if (rawText && !isGenericBoilerplateLabel(rawText)) return rawText;
    }
  }

  // 3. aria-label (only if not generic boilerplate like "Your answer")
  if (el.getAttribute) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      const cleaned = cleanFieldTitle(ariaLabel);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 4. aria-labelledby (resolve referenced elements, filtering out boilerplate IDs/tokens)
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy && ariaLabelledBy.trim()) {
      const ids = ariaLabelledBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = cleanFieldTitle(refEl.innerText || refEl.textContent || "");
          if (text && !isGenericBoilerplateLabel(text)) {
            parts.push(text);
          }
        }
      }
      if (parts.length > 0) {
        const combined = cleanFieldTitle(parts.join(" "));
        if (combined && !isGenericBoilerplateLabel(combined)) {
          return combined;
        }
      }
    }
  }

  // 5. Enclosing Question Container (Google Forms / modern web form structures)
  // Handles: Google Forms (.Qr7Oae, .geS5n, [role="listitem"], [data-item-id])
  // Resolves: .M7eMe, [role="heading"], .exportQuestionTitle, .freebirdFormviewerComponentsQuestionBaseTitle
  if (el.closest) {
    const questionContainer = el.closest(
      "[role='listitem'], .Qr7Oae, .geS5n, [data-item-id], .freebirdFormviewerViewNumberedItemContainer, .freebirdFormviewerComponentsQuestionBaseRoot, .form-group, .field-group, .form-item, fieldset"
    );
    if (questionContainer) {
      const heading = questionContainer.querySelector(
        ".M7eMe, [role='heading'], .exportQuestionTitle, .freebirdFormviewerComponentsQuestionBaseTitle, .FmiOAc, .c2gGi, legend, label, .field-label, h1, h2, h3, h4, h5, strong, b"
      );
      if (heading && heading !== el) {
        const headingText = cleanFieldTitle(heading.innerText || heading.textContent || "");
        if (headingText && !isGenericBoilerplateLabel(headingText) && headingText.length < 100) {
          return headingText;
        }
      }
    }
  }

  // 6. Associated visible label text (aria-describedby)
  if (el.getAttribute && typeof document !== "undefined" && document.getElementById) {
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy && describedBy.trim()) {
      const ids = describedBy.trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const text = cleanFieldTitle(refEl.innerText || refEl.textContent || "");
          if (text && !isGenericBoilerplateLabel(text) && text.length < 100) {
            parts.push(text);
          }
        }
      }
      if (parts.length > 0) {
        const combined = cleanFieldTitle(parts.join(" "));
        if (combined && !isGenericBoilerplateLabel(combined)) {
          return combined;
        }
      }
    }
  }

  // 7. name attribute (humanized)
  if (el.getAttribute) {
    const nameAttr = el.getAttribute("name");
    if (nameAttr && nameAttr.trim()) {
      const humanized = humanizeName(nameAttr);
      if (humanized && !isGenericBoilerplateLabel(humanized)) return humanized;
    }
  }

  // 8. placeholder (non-boilerplate)
  if (el.getAttribute) {
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      const cleaned = cleanFieldTitle(placeholder);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 9. title attribute
  if (el.getAttribute) {
    const title = el.getAttribute("title");
    if (title && title.trim()) {
      const cleaned = cleanFieldTitle(title);
      if (cleaned && !isGenericBoilerplateLabel(cleaned)) {
        return cleaned;
      }
    }
  }

  // 10. Nearby preceding visible text sibling
  let prev = el.previousElementSibling;
  while (prev) {
    const prevText = cleanFieldTitle(prev.innerText || prev.textContent || "");
    if (prevText && !isGenericBoilerplateLabel(prevText) && prevText.length < 100) {
      return prevText;
    }
    prev = prev.previousElementSibling;
  }

  // 11. Enclosing form-group / container label fallback
  if (el.closest) {
    const parentGroup = el.closest(".form-group, .field-group, .form-row, .input-group, div, p");
    if (parentGroup && (typeof document === "undefined" || parentGroup !== document.body)) {
      const labelLike = parentGroup.querySelector("label, .field-label, .label, span, strong, b");
      if (labelLike && labelLike !== el) {
        const text = cleanFieldTitle(labelLike.innerText || labelLike.textContent || "");
        if (text && !isGenericBoilerplateLabel(text) && text.length < 100) return text;
      }
    }
  }

  // 12. Fallback to "<type> field"
  if (tagName === "input") {
    if (el.type === "password") {
      return "Password field";
    } else if (el.type === "email") {
      return "Email field";
    } else if (el.type === "checkbox") {
      return "Checkbox";
    } else if (el.type === "radio") {
      return "Radio button";
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
  if (!el) return null;
  // Milestone 18 & Task 3: Isolate agent overlay elements from visual perception
  if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']") || el.closest("#onevision-target-highlight") || el.closest("[id^='onevision-']"))) {
    return null;
  }
  if (el.id && (el.id.startsWith("sih-agent-overlay") || el.id.startsWith("onevision-"))) {
    return null;
  }

  // 1. Check layout presence and visibility
  const rect = getVisibleRect(el);
  if (!rect) {
    return null;
  }

  // 2. Identify UI element type
  const tagName = (el.tagName || "").toLowerCase();
  const elRole = el.getAttribute ? (el.getAttribute("role") || "").toLowerCase() : "";
  const isContentEditable = !!(el.isContentEditable || (el.getAttribute && el.getAttribute("contenteditable") === "true"));
  let type = "element";

  if (/^h[1-6]$/.test(tagName)) {
    type = "heading";
  } else if (tagName === "button" || elRole === "button" || (tagName === "input" && ["button", "submit", "reset"].includes(el.type))) {
    type = "button";
  } else if (tagName === "a" || elRole === "link") {
    type = "link";
  } else if (tagName === "textarea") {
    type = "textarea";
  } else if (tagName === "select" || elRole === "combobox") {
    type = "select";
  } else if (elRole === "textbox" || isContentEditable) {
    type = (el.getAttribute && el.getAttribute("aria-multiline") === "true") || tagName === "textarea" ? "textarea" : "input";
  } else if (tagName === "input") {
    if (el.type === "checkbox" || elRole === "checkbox") {
      type = "checkbox";
    } else if (el.type === "radio" || elRole === "radio") {
      type = "radio";
    } else {
      type = "input";
    }
  } else if (["checkbox", "radio", "tab", "menuitem", "switch"].includes(elRole)) {
    type = elRole;
  }

  // 3. Safe, non-sensitive label extraction
  // NOTE: Explicitly NEVER reads .value from user-entered form controls to ensure privacy preservation.
  let label = "";
  const isFormField = ["input", "textarea", "select"].includes(tagName) || elRole === "textbox" || isContentEditable;

  if (isFormField) {
    label = extractFormFieldLabel(el, type);
  } else {
    // Buttons, links, headings, interactive roles
    if (el.getAttribute && el.getAttribute("aria-label")) {
      label = el.getAttribute("aria-label").trim();
    } else if (el.getAttribute && el.getAttribute("aria-labelledby") && typeof document !== "undefined" && document.getElementById) {
      const ids = el.getAttribute("aria-labelledby").trim().split(/\s+/);
      const parts = [];
      for (const id of ids) {
        const refEl = document.getElementById(id);
        if (refEl) {
          const t = (refEl.innerText || refEl.textContent || "").trim();
          if (t) parts.push(t);
        }
      }
      if (parts.length > 0) label = parts.join(" ");
    }
    if (!label) {
      label = (el.innerText || el.textContent || "").trim();
    }
    if (!label && el.querySelector) {
      const img = el.querySelector("img[alt]");
      if (img && img.getAttribute("alt")) {
        label = img.getAttribute("alt").trim();
      }
    }
    if (!label && el.getAttribute && el.getAttribute("title")) {
      label = el.getAttribute("title").trim();
    }
    if (!label && tagName === "input" && ["button", "submit", "reset"].includes(el.type) && el.value) {
      label = String(el.value).trim();
    }
  }

  // Normalize spacing and truncate label length
  label = label.replace(/\s+/g, " ").slice(0, 60) || `${type} element`;

  const isDisabled = !!(
    el.disabled ||
    (el.getAttribute && el.getAttribute("aria-disabled") === "true") ||
    (el.classList && el.classList.contains("disabled"))
  );

  // 4. Record bounding box and metadata with safe semantic label
  const semanticTag = getSemanticTag(type, label, el);
  const descriptor = {
    type: type,
    role: elRole || (["button", "link"].includes(type) ? type : (isFormField ? "textbox" : null)),
    label: label,
    text: label,
    semanticTag: semanticTag,
    visible: true,
    enabled: !isDisabled,
    disabled: isDisabled,
    placeholder: (el.getAttribute ? el.getAttribute("placeholder") : null) || null,
    ariaLabel: (el.getAttribute ? el.getAttribute("aria-label") : null) || null,
    title: (el.getAttribute ? el.getAttribute("title") : null) || null,
    inputType: tagName === "input" ? (el.type || "text") : null,
    isInteractable: !isDisabled && ["button", "link", "input", "textarea", "select", "checkbox", "radio", "textbox"].includes(type),
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    index: typeof fieldId === "number" ? fieldId : null,
    confidence: 1.0,
    evidence: `Local DOM: tag=${tagName}, role=${elRole || "none"}, semanticTag=${semanticTag || "none"}`
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
    const isFormField = ["input", "textarea", "select"].includes(tagName) ||
      (el.getAttribute && el.getAttribute("role") === "textbox") ||
      el.isContentEditable ||
      (el.getAttribute && el.getAttribute("contenteditable") === "true");
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      item.index = visualElements.length;
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
    const isFormField = ["input", "textarea", "select"].includes(tagName) ||
      (el.getAttribute && el.getAttribute("role") === "textbox") ||
      el.isContentEditable ||
      (el.getAttribute && el.getAttribute("contenteditable") === "true");
    const fieldId = isFormField ? formFieldCounter++ : null;
    const item = classifyVisualElement(el, fieldId);
    if (item) {
      item.index = visualElementsWithNodes.length;
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
  if (!el || !el.tagName) {
    return false;
  }
  // Milestone 18 & Task 3: Isolate agent overlay elements from sensitive detection
  if (el.closest && (el.closest("#sih-agent-overlay-root") || el.closest("[id^='sih-agent-overlay']") || el.closest("#onevision-target-highlight") || el.closest("[id^='onevision-']"))) {
    return false;
  }
  if (el.id && (el.id.startsWith("sih-agent-overlay") || el.id.startsWith("onevision-"))) {
    return false;
  }
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

let currentApprovalCallback = null;

function removeInPageApprovalModal() {
  const existing = document.getElementById("sih-agent-approval-overlay");
  if (existing) {
    existing.remove();
  }
  if (currentApprovalCallback) {
    currentApprovalCallback = null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showInPageApprovalModal(actionDetails, callback) {
  removeInPageApprovalModal();
  currentApprovalCallback = callback;

  const overlay = document.createElement("div");
  overlay.id = "sih-agent-approval-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sih-approval-title");

  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(10, 15, 29, 0.75)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#ffffff",
    padding: "20px",
    boxSizing: "border-box"
  });

  const card = document.createElement("div");
  card.id = "sih-agent-approval-card";
  Object.assign(card.style, {
    backgroundColor: "#111827",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "16px",
    padding: "24px 28px",
    maxWidth: "480px",
    width: "100%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  });

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";

  const badge = document.createElement("div");
  badge.textContent = "SAFETY GATE: APPROVAL REQUIRED";
  Object.assign(badge.style, {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: "9999px",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    color: "#f87171",
    border: "1px solid rgba(239, 68, 68, 0.4)"
  });

  const riskBadge = document.createElement("div");
  riskBadge.textContent = actionDetails.risk || "HIGH RISK";
  Object.assign(riskBadge.style, {
    fontSize: "11px",
    fontWeight: "700",
    padding: "4px 10px",
    borderRadius: "9999px",
    backgroundColor: "#ef4444",
    color: "#ffffff"
  });

  header.appendChild(badge);
  header.appendChild(riskBadge);

  const title = document.createElement("h2");
  title.id = "sih-approval-title";
  title.textContent = "Agent Ready for Consequential Action";
  Object.assign(title.style, {
    margin: "0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#f3f4f6"
  });

  const body = document.createElement("div");
  Object.assign(body.style, {
    backgroundColor: "rgba(31, 41, 55, 0.6)",
    border: "1px solid rgba(75, 85, 99, 0.4)",
    borderRadius: "10px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "13px",
    lineHeight: "1.5"
  });

  const actionRow = document.createElement("div");
  actionRow.innerHTML = `<span style="color:#9ca3af;">Action: </span><strong style="color:#60a5fa;">${escapeHtml(actionDetails.action || "CLICK")} &rarr; ${escapeHtml(actionDetails.target || "Submit")}</strong>`;

  const reasonRow = document.createElement("div");
  reasonRow.innerHTML = `<span style="color:#9ca3af;">Reason: </span><span style="color:#e5e7eb;">${escapeHtml(actionDetails.reason || "This action will submit or modify state.")}</span>`;

  const contextRow = document.createElement("div");
  contextRow.innerHTML = `<span style="color:#9ca3af;">Page: </span><span style="color:#d1d5db;">${escapeHtml(document.title || window.location.hostname)}</span>`;

  body.appendChild(actionRow);
  body.appendChild(reasonRow);
  body.appendChild(contextRow);

  if (actionDetails.taskSummary) {
    const taskRow = document.createElement("div");
    taskRow.innerHTML = `<span style="color:#9ca3af;">Task: </span><span style="color:#d1d5db;">${escapeHtml(actionDetails.taskSummary)}</span>`;
    body.appendChild(taskRow);
  }

  const notice = document.createElement("p");
  notice.textContent = "This action will not execute automatically. Explicit human confirmation is required.";
  Object.assign(notice.style, {
    margin: "0",
    fontSize: "12px",
    color: "#9ca3af"
  });

  const btnContainer = document.createElement("div");
  Object.assign(btnContainer.style, {
    display: "flex",
    gap: "12px",
    marginTop: "8px"
  });

  const btnApprove = document.createElement("button");
  btnApprove.id = "sih-btn-approve";
  btnApprove.textContent = "Approve & Continue";
  Object.assign(btnApprove.style, {
    flex: "1",
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  });
  btnApprove.onmouseenter = () => { btnApprove.style.backgroundColor = "#059669"; };
  btnApprove.onmouseleave = () => { btnApprove.style.backgroundColor = "#10b981"; };

  const btnCancel = document.createElement("button");
  btnCancel.id = "sih-btn-cancel";
  btnCancel.textContent = "Cancel Execution";
  Object.assign(btnCancel.style, {
    flex: "1",
    backgroundColor: "#374151",
    color: "#e5e7eb",
    border: "1px solid #4b5563",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  });
  btnCancel.onmouseenter = () => { btnCancel.style.backgroundColor = "#4b5563"; };
  btnCancel.onmouseleave = () => { btnCancel.style.backgroundColor = "#374151"; };

  btnApprove.addEventListener("click", () => {
    removeInPageApprovalModal();
    if (callback) callback({ approved: true });
  });

  btnCancel.addEventListener("click", () => {
    removeInPageApprovalModal();
    if (callback) callback({ approved: false, cancelled: true });
  });

  btnContainer.appendChild(btnCancel);
  btnContainer.appendChild(btnApprove);

  card.appendChild(header);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(notice);
  card.appendChild(btnContainer);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// =====================================================================
// Milestone 18 & Task 3: Interactive Visual Highlighting & Human-in-the-Loop Confirmation Overlay
// Non-destructive HUD overlay (#onevision-target-highlight / #sih-agent-overlay-root)
// =====================================================================
let currentOverlayData = null;
let currentOverlayTargetNode = null;
let overlayScrollListener = null;

function ensureOverlayKeyframes() {
  if (typeof document === "undefined" || !document.head) return;
  if (!document.getElementById("onevision-overlay-styles")) {
    const style = document.createElement("style");
    style.id = "onevision-overlay-styles";
    style.textContent = `
      @keyframes onevision-target-pulse {
        0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7), inset 0 0 4px rgba(59, 130, 246, 0.3); border-color: #3b82f6; }
        50% { box-shadow: 0 0 16px 4px rgba(59, 130, 246, 0.5), inset 0 0 8px rgba(59, 130, 246, 0.4); border-color: #60a5fa; }
        100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7), inset 0 0 4px rgba(59, 130, 246, 0.3); border-color: #3b82f6; }
      }
      @keyframes onevision-exec-flash {
        0% { background-color: rgba(16, 185, 129, 0.45); box-shadow: 0 0 20px rgba(16, 185, 129, 0.8); border-color: #10b981; }
        50% { background-color: rgba(16, 185, 129, 0.25); box-shadow: 0 0 24px rgba(16, 185, 129, 0.6); border-color: #34d399; }
        100% { background-color: transparent; box-shadow: 0 0 12px rgba(16, 185, 129, 0.5); border-color: #10b981; }
      }
    `;
    document.head.appendChild(style);
  }
}

function clearAgentOverlay() {
  const existing = document.getElementById("sih-agent-overlay-root");
  if (existing) {
    existing.remove();
  }
  const onevisionExisting = document.getElementById("onevision-target-highlight");
  if (onevisionExisting) {
    onevisionExisting.remove();
  }
  currentOverlayData = null;
  currentOverlayTargetNode = null;
  if (overlayScrollListener) {
    window.removeEventListener("scroll", overlayScrollListener, true);
    window.removeEventListener("resize", overlayScrollListener, true);
    overlayScrollListener = null;
  }
}

function findOverlayTargetNode(data) {
  if (!data) return null;

  // 1. If targetIndex is provided, search freshElements
  if (typeof data.targetIndex === "number") {
    const freshElements = extractVisualElementsWithNodes();
    if (freshElements[data.targetIndex] && freshElements[data.targetIndex].node && freshElements[data.targetIndex].node.isConnected) {
      if (!data.targetLabel || labelsMatch(freshElements[data.targetIndex].label, data.targetLabel)) {
        return freshElements[data.targetIndex].node;
      }
    }
    // Search candidates by label match
    if (data.targetLabel) {
      const match = freshElements.find(el => el.node && el.node.isConnected && labelsMatch(el.label, data.targetLabel));
      if (match) return match.node;
    }
  }

  // 2. Search by targetLabel in freshElements
  if (data.targetLabel) {
    const freshElements = extractVisualElementsWithNodes();
    const match = freshElements.find(el => el.node && el.node.isConnected && labelsMatch(el.label, data.targetLabel));
    if (match) return match.node;
  }

  // 3. Search by ACTION_TARGET_MAP if target is a known string key
  if (data.target && ACTION_TARGET_MAP[data.target]) {
    const el = document.querySelector(ACTION_TARGET_MAP[data.target]);
    if (el) return el;
  }

  // 4. Fallback search by standard queries for search inputs / submit buttons
  if (data.action === "SUBMIT" || data.target === "search") {
    const searchEl = document.querySelector("input[type='search'], input[name*='search'], input[name*='q'], input[id*='search'], textarea[name*='q']");
    if (searchEl) return searchEl;
  }

  return null;
}

function getOverlayTargetRect(targetNode, fallbackBbox) {
  if (targetNode && targetNode.isConnected) {
    const r = targetNode.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) {
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      return {
        top: r.top + scrollY,
        left: r.left + scrollX,
        width: r.width,
        height: r.height,
        viewportTop: r.top,
        viewportLeft: r.left
      };
    }
  }

  if (fallbackBbox && typeof fallbackBbox.x === "number") {
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    return {
      top: fallbackBbox.y + scrollY,
      left: fallbackBbox.x + scrollX,
      width: fallbackBbox.width || 100,
      height: fallbackBbox.height || 36,
      viewportTop: fallbackBbox.y,
      viewportLeft: fallbackBbox.x
    };
  }

  return null;
}

function renderOverlayUI(data, rect) {
  if (!rect || typeof document === "undefined" || !document.body) return;
  ensureOverlayKeyframes();

  let root = document.getElementById("sih-agent-overlay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "sih-agent-overlay-root";
    root.setAttribute("data-sih-overlay", "true");
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2147483646",
      overflow: "visible"
    });
    document.body.appendChild(root);
  }

  let box = document.getElementById("sih-agent-overlay-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "sih-agent-overlay-box";
    Object.assign(box.style, {
      position: "absolute",
      pointerEvents: "none",
      borderRadius: "6px",
      transition: "border 0.2s ease, box-shadow 0.2s ease, top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease",
      boxSizing: "border-box"
    });
    root.appendChild(box);
  }

  // Task 3: #onevision-target-highlight HUD element alias with pointer-events: none
  let onevisionHighlight = document.getElementById("onevision-target-highlight");
  if (!onevisionHighlight) {
    onevisionHighlight = document.createElement("div");
    onevisionHighlight.id = "onevision-target-highlight";
    Object.assign(onevisionHighlight.style, {
      position: "absolute",
      pointerEvents: "none",
      borderRadius: "6px",
      boxSizing: "border-box",
      zIndex: "2147483646"
    });
    root.appendChild(onevisionHighlight);
  }

  let card = document.getElementById("sih-agent-overlay-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "sih-agent-overlay-card";
    Object.assign(card.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483646",
      borderRadius: "8px",
      padding: "8px 12px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      fontSize: "12px",
      lineHeight: "1.4",
      color: "#f8fafc",
      maxWidth: "340px",
      minWidth: "200px",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 0, 0, 0.3)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      transition: "background-color 0.2s ease, border-color 0.2s ease, top 0.15s ease, left 0.15s ease",
      boxSizing: "border-box"
    });
    root.appendChild(card);
  }

  const state = data.state || "GROUNDED";
  let borderColor = "#6366f1";
  let boxShadow = "0 0 12px rgba(99, 102, 241, 0.5), inset 0 0 6px rgba(99, 102, 241, 0.2)";
  let boxAnimation = "none";
  let badgeHtml = "";
  let contentHtml = "";

  const confVal = data.confidence !== undefined ? (typeof data.confidence === "number" ? data.confidence.toFixed(2) : String(data.confidence)) : "1.00";

  if (state === "EXECUTING") {
    borderColor = "#f59e0b";
    boxShadow = "0 0 16px rgba(245, 158, 11, 0.6), inset 0 0 8px rgba(245, 158, 11, 0.25)";
    boxAnimation = "none";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #fbbf24; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">EXECUTING &#x26A1;</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
    `;
  } else if (state === "VERIFIED") {
    borderColor = "#10b981";
    boxShadow = "0 0 16px rgba(16, 185, 129, 0.6), inset 0 0 8px rgba(16, 185, 129, 0.25)";
    boxAnimation = "onevision-exec-flash 0.6s ease";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #34d399; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">&#x2713; VERIFIED</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
    `;
  } else if (state === "WAITING_APPROVAL" || state === "PENDING_CONFIRMATION" || state === "APPROVAL_REQUIRED") {
    borderColor = "#3b82f6";
    boxShadow = "0 0 16px rgba(59, 130, 246, 0.6), inset 0 0 8px rgba(59, 130, 246, 0.3)";
    boxAnimation = "onevision-target-pulse 1.5s infinite";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #60a5fa; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">CONFIRMATION PENDING &bull; Conf: ${escapeHtml(confVal)}</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Reason: </span><span style="color:#93c5fd;">${escapeHtml(data.reason || "Action awaits user confirmation")}</span></div>
    `;
  } else if (state === "SAFETY_BLOCKED") {
    borderColor = "#ef4444";
    boxShadow = "0 0 16px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(239, 68, 68, 0.25)";
    boxAnimation = "none";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #f87171; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">&#x1F6E1; SAFETY BLOCKED</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Reason: </span><span style="color:#fca5a5; font-weight: 600;">${escapeHtml(data.reason || "Action blocked by safety policy")}</span></div>
      ${data.action ? `<div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#e2e8f0;">${escapeHtml(data.action)}</span></div>` : ""}
    `;
  } else {
    // GROUNDED ("AGENT TARGET")
    borderColor = "#3b82f6";
    boxShadow = "0 0 14px rgba(59, 130, 246, 0.5), inset 0 0 6px rgba(59, 130, 246, 0.2)";
    boxAnimation = "none";
    badgeHtml = `<div style="font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #60a5fa; background: rgba(59, 130, 246, 0.18); border: 1px solid rgba(59, 130, 246, 0.35); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">AGENT TARGET &bull; Conf: ${escapeHtml(confVal)}</div>`;
    contentHtml = `
      <div><span style="color:#94a3b8; font-weight: 600;">Action: </span><span style="color:#ffffff; font-weight: 700;">${escapeHtml(data.action || "CLICK")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Target: </span><span style="color:#e2e8f0;">${escapeHtml(data.targetLabel || data.target || "element")}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Confidence: </span><span style="color:#38bdf8; font-weight: 600;">${escapeHtml(confVal)}</span></div>
      <div><span style="color:#94a3b8; font-weight: 600;">Method: </span><span style="color:#a78bfa;">${escapeHtml(data.method || "local-fuzzy-match")}</span></div>
    `;
  }

  // Update box styles
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${Math.max(rect.width, 24)}px`;
  box.style.height = `${Math.max(rect.height, 24)}px`;
  box.style.border = `2px solid ${borderColor}`;
  box.style.boxShadow = boxShadow;
  box.style.animation = boxAnimation;

  // Sync onevision target highlight alias
  onevisionHighlight.style.top = `${rect.top}px`;
  onevisionHighlight.style.left = `${rect.left}px`;
  onevisionHighlight.style.width = `${Math.max(rect.width, 24)}px`;
  onevisionHighlight.style.height = `${Math.max(rect.height, 24)}px`;
  onevisionHighlight.style.border = `2px solid ${borderColor}`;
  onevisionHighlight.style.boxShadow = boxShadow;
  onevisionHighlight.style.animation = boxAnimation;

  // Update card styles and contents
  card.style.backgroundColor = "rgba(15, 23, 42, 0.94)";
  card.style.border = `1px solid ${borderColor}`;
  card.innerHTML = `${badgeHtml}${contentHtml}`;

  // Position card near box (above if space allows, otherwise below)
  const cardEstimatedHeight = (state === "GROUNDED") ? 110 : 80;
  const fitsAbove = rect.viewportTop > (cardEstimatedHeight + 16);

  let cardTop = fitsAbove ? (rect.top - cardEstimatedHeight - 8) : (rect.top + rect.height + 8);
  let cardLeft = rect.left;

  const maxLeft = (window.scrollX || 0) + (window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 800)) - 350;
  if (cardLeft > maxLeft) {
    cardLeft = Math.max(8, maxLeft);
  }

  card.style.top = `${cardTop}px`;
  card.style.left = `${Math.max(8, cardLeft)}px`;
}

function showAgentOverlay(payload) {
  currentOverlayData = payload || {};
  currentOverlayTargetNode = findOverlayTargetNode(currentOverlayData);
  const rect = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
  if (rect) {
    renderOverlayUI(currentOverlayData, rect);
  }

  if (!overlayScrollListener && typeof window !== "undefined") {
    overlayScrollListener = () => {
      if (currentOverlayData) {
        const r = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
        if (r) {
          renderOverlayUI(currentOverlayData, r);
        }
      }
    };
    window.addEventListener("scroll", overlayScrollListener, { passive: true, capture: true });
    window.addEventListener("resize", overlayScrollListener, { passive: true });
  }
}

function updateAgentOverlay(payload) {
  if (!currentOverlayData && !payload) return;
  currentOverlayData = {
    ...(currentOverlayData || {}),
    ...(payload || {})
  };
  if (!currentOverlayTargetNode) {
    currentOverlayTargetNode = findOverlayTargetNode(currentOverlayData);
  }
  const rect = getOverlayTargetRect(currentOverlayTargetNode, currentOverlayData.bbox);
  if (rect) {
    renderOverlayUI(currentOverlayData, rect);
  }
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

      // 6. Local search results state detection (Milestone 13 Cross-Website Robustness)
      const urlLower = url.toLowerCase();
      const titleLower = title.toLowerCase();
      const hasSearchUrl = urlLower.includes("/search") || urlLower.includes("?q=") || urlLower.includes("&q=") || urlLower.includes("query=") || urlLower.includes("search?");
      const hasSearchTitle = titleLower.includes("search") || titleLower.includes("results") || titleLower.includes(" - google") || titleLower.includes("at duckduckgo") || titleLower.includes("search results");
      const resultContainers = document.querySelectorAll(
        "#search, #rso, #links, .results, .search-results, [role='main'] a, .mw-search-results, .b_results"
      );
      const isSearchResults = !!(hasSearchUrl || (hasSearchTitle && resultContainers && resultContainers.length > 0));

      // 7. Send the sanitized data back to popup (never expose raw text, passwords, or input values)
      sendResponse({
        success: true,
        title,
        url,
        redactedSample,
        visualElements,
        sensitiveRegions,
        sensitiveDetectionMs,
        isSearchResults,
        searchSignals: {
          hasSearchUrl,
          hasSearchTitle,
          containerCount: resultContainers ? resultContainers.length : 0
        }
      });
      return false;
    } else if (request.action === "checkSearchResultsState") {
      const url = (window.location.href || "").toLowerCase();
      const title = (document.title || "").toLowerCase();
      const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");
      const hasSearchTitle = title.includes("search") || title.includes("results") || title.includes(" - google") || title.includes("at duckduckgo") || title.includes("search results");
      const resultContainers = document.querySelectorAll(
        "#search, #rso, #links, .results, .search-results, [role='main'] a, .mw-search-results, .b_results"
      );
      const isSearchResults = !!(hasSearchUrl || (hasSearchTitle && resultContainers && resultContainers.length > 0));
      sendResponse({
        success: true,
        isSearchResults,
        hasSearchUrl,
        hasSearchTitle,
        containerCount: resultContainers ? resultContainers.length : 0
      });
      return false;
    } else if (request.action === "executeAction") {
      // Milestones 5 & 6: Safely execute whitelisted action
      const executionResult = executeAction(request.payload);
      sendResponse({
        success: true,
        result: executionResult
      });
      return false;
    } else if (request.action === "requestHumanApproval") {
      // Safe human-in-the-loop approval modal
      showInPageApprovalModal(request.payload || {}, (response) => {
        sendResponse(response);
      });
      return true; // Keep message channel open for async user response
    } else if (request.action === "dismissHumanApproval") {
      removeInPageApprovalModal();
      sendResponse({ dismissed: true });
      return false;
    } else if (request.action === "checkPlaybackState") {
      // Fast local video playback verification
      const video = document.querySelector("video");
      const isPlaying = !!(video && !video.paused && !video.ended && video.readyState > 2);
      const currentTime = video ? video.currentTime : 0;
      sendResponse({
        success: true,
        hasVideo: !!video,
        isPlaying,
        currentTime
      });
      return false;
    } else if (request.action === "executeActionBatch") {
      // Action batching: execute multiple non-conflicting actions
      const batch = Array.isArray(request.payload) ? request.payload : [request.payload];
      const results = [];
      for (const item of batch) {
        results.push(executeAction(item));
      }
      sendResponse({
        success: true,
        results,
        executed: results.every(r => r.executed)
      });
      return false;
    } else if (request.action === "showAgentOverlay") {
      // Milestone 18: Live Explainable Agent Overlay
      showAgentOverlay(request.payload || {});
      sendResponse({ success: true });
      return false;
    } else if (request.action === "updateAgentOverlay") {
      updateAgentOverlay(request.payload || {});
      sendResponse({ success: true });
      return false;
    } else if (request.action === "clearAgentOverlay") {
      clearAgentOverlay();
      sendResponse({ success: true });
      return false;
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
    labelsMatch,
    normalizeScreenshotCoordinates,
    simulateFrameworkCompatibleTyping,
    simulateHumanClick,
    showInPageApprovalModal,
    removeInPageApprovalModal,
    showAgentOverlay,
    updateAgentOverlay,
    clearAgentOverlay
  };
}
