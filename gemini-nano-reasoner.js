/**
 * gemini-nano-reasoner.js
 * SIH26171 — On-Device Reasoning via Chrome Built-in AI (Gemini Nano / window.ai)
 *
 * PRIVACY CONTRACT: All inference occurs entirely in-browser (window.ai).
 * Zero bytes leave the machine in Offline mode.
 *
 * Exports: window.GeminiNanoReasoner
 */
(function () {
  "use strict";

  const LOG_TAG = "[SIH26171][Nano]";

  const NANO_SYSTEM_PROMPT = `You are a browser automation agent. You receive a user goal and a JSON array of visible UI elements.
Decide the single best next action and output ONLY a valid JSON object — no markdown, no extra text.

PERMITTED ACTIONS: NAVIGATE, CLICK, FILL, SUBMIT, SCROLL, NONE

RULES:
- If the user wants to open a website (youtube, amazon, etc.), use NAVIGATE with the full https:// URL.
- If the user wants to search, use FILL on the search input, then SUBMIT.
- For CLICK/FILL: set targetIndex to the element's array index (0-based).
- For FILL: set value to the exact text to type.
- For NAVIGATE: set target to the full https:// URL only.
- If unclear or no match: action = "NONE".

OUTPUT FORMAT (strict JSON only, no markdown):
{"thought":"why you chose this","action":"NAVIGATE|CLICK|FILL|SUBMIT|SCROLL|NONE","targetIndex":0,"targetLabel":"label","target":"url or label","value":"text to type or null","confidence":0.9}`;

  /**
   * Checks Chrome window.ai / Gemini Nano availability.
   * @returns {Promise<{available: boolean, status?: string, reason?: string}>}
   */
  async function checkNanoAvailability() {
    try {
      if (!window.ai || !window.ai.languageModel) {
        return {
          available: false,
          reason: "window.ai API not found — requires Chrome 128+ Dev/Canary with on-device model flags enabled"
        };
      }
      const caps = await window.ai.languageModel.capabilities();
      if (!caps || caps.available === "no") {
        return { available: false, reason: "Gemini Nano not supported or not downloaded on this device" };
      }
      return { available: true, status: caps.available }; // "readily" | "after-download"
    } catch (err) {
      return { available: false, reason: `window.ai error: ${err.message}` };
    }
  }

  let _nanoSession = null;

  /**
   * Creates (or returns cached) a Nano language model session.
   */
  async function createNanoSession(systemPrompt) {
    if (_nanoSession) return _nanoSession;
    if (!window.ai || !window.ai.languageModel) {
      throw new Error("window.ai.languageModel is not available");
    }
    console.log(`${LOG_TAG} Creating session...`);
    _nanoSession = await window.ai.languageModel.create({
      systemPrompt: systemPrompt || NANO_SYSTEM_PROMPT
    });
    console.log(`${LOG_TAG} Session ready.`);
    return _nanoSession;
  }

  /** Destroys the cached session (called on mode switch). */
  function destroyNanoSession() {
    if (_nanoSession) {
      try { _nanoSession.destroy(); } catch (_) {}
      _nanoSession = null;
    }
  }

  /** Compact element formatter — stays within Nano's ~1024 token window. */
  function _formatElements(elements, limit = 18) {
    if (!Array.isArray(elements) || !elements.length) return "[]";
    return JSON.stringify(
      elements.slice(0, limit).map((el, i) => ({
        i,
        type: el.type || el.tag || "element",
        label: (el.label || el.ariaLabel || el.placeholder || "").slice(0, 55)
      }))
    );
  }

  function _stripFences(raw) {
    return (raw || "").trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  /**
   * Main reasoning function — calls Gemini Nano with goal + elements.
   * @param {string} userGoal
   * @param {Array} sanitizedElements
   * @param {string} [planStep]
   * @returns {Promise<object>} Parsed action object
   */
  async function reasonWithNano(userGoal, sanitizedElements, planStep) {
    const check = await checkNanoAvailability();
    if (!check.available) throw new Error(`Gemini Nano unavailable: ${check.reason}`);

    const session = await createNanoSession();
    const elementsStr = _formatElements(sanitizedElements);
    const stepCtx = planStep ? `\nCurrent step: ${planStep}` : "";
    const prompt = `USER GOAL: ${userGoal}${stepCtx}\nELEMENTS:\n${elementsStr}\n\nOutput JSON only:`;

    console.log(`${LOG_TAG} Prompting Nano (${prompt.length} chars)...`);
    const t0 = performance.now();
    const raw = await session.prompt(prompt);
    const ms = Math.round(performance.now() - t0);
    console.log(`${LOG_TAG} Inference done in ${ms}ms`);

    const cleaned = _stripFences(raw);
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const m = cleaned.match(/\{[\s\S]+\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error(`Nano non-JSON response: ${cleaned.slice(0, 100)}`);
    }

    if (!parsed || !parsed.action) throw new Error("Nano response missing 'action' field");
    parsed.action = String(parsed.action).toUpperCase();
    parsed._inferenceMs = ms;
    parsed._provider = "nano";
    console.log(`${LOG_TAG} -> ${parsed.action} "${parsed.targetLabel || parsed.target}" (conf=${parsed.confidence})`);
    return parsed;
  }

  window.GeminiNanoReasoner = {
    checkNanoAvailability,
    createNanoSession,
    destroyNanoSession,
    reasonWithNano
  };

  console.log("[SIH26171] GeminiNanoReasoner ready.");
})();
