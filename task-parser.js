/**
 * task-parser.js - Deterministic, bounded, local natural language task parser.
 * Runs client-side ONLY inside the extension popup.
 *
 * CRITICAL PRIVACY CONTRACT:
 * Literal FILL values extracted by this parser MUST NEVER be sent to the backend,
 * included in any network payload, or logged to network destinations.
 * Only sanitized field hints (e.g. "name", "email") and action sequence structures
 * may be transmitted to the backend gateway for grounding.
 * Extracted values are kept strictly in-memory in the popup client and passed
 * directly to content.js via local Chrome IPC at execution time only.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHTaskParser = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_SCROLL_AMOUNT = 500;

  /**
   * Cleans and normalizes task text.
   * @param {string} text
   * @returns {string}
   */
  function normalizeText(text) {
    return (text || "").trim().replace(/\s+/g, " ");
  }

  /**
   * Resolves known legacy keyword click targets.
   * @param {string} text
   * @returns {string|null}
   */
  function resolveLegacyClickTarget(text) {
    const lower = text.toLowerCase();
    if (/login|sign in|log in/i.test(lower)) return "LOGIN_BUTTON";
    if (/next|continue|proceed|step/i.test(lower)) return "NEXT_BUTTON";
    if (/submit/i.test(lower)) return "SUBMIT_BUTTON";
    if (/search|query|find input/i.test(lower)) return "SEARCH_INPUT";
    return null;
  }

  /**
   * Parses a single FILL clause into a step object.
   * Supports:
   * - "enter/type/put <val> in/into/for <field>"
   * - "<val> in/into <field>"
   * - "fill/set/enter/type/put [in/into] [the] <field> with/to/as/is/:/= <val>"
   * - "[the] <field> with/to/as/is/:/= <val>"
   *
   * @param {string} clause
   * @returns {{type: string, fieldHint: string, value: string}|null}
   */
  function parseFillClause(clause) {
    const text = (clause || "").trim();
    if (!text) return null;

    // Pattern 1: '[enter/type/put] <val> in/into/for <field>'
    const enterInMatch = text.match(/^(?:(?:enter|type|put)\s+)?(.+?)\s+in(?:to)?\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box)?$/i);
    if (enterInMatch) {
      const val = enterInMatch[1].trim();
      const field = enterInMatch[2].trim();
      if (val && field && !/^(?:the|a|an)$/i.test(val)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 2: '[fill/set/enter/type/put] [in/into] [the] <field> with/to/as/is/:/= <val>'
    // Or without leading verb: '[the] <field> with/to/as/is/:/= <val>'
    const fillAsMatch = text.match(/^(?:(?:fill|set|enter|type|put)\s+(?:in\s+|into\s+)?)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|to|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (fillAsMatch) {
      const field = fillAsMatch[1].trim();
      const val = fillAsMatch[2].trim();
      if (field && val) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    return null;
  }

  /**
   * Parses free-text user task into structured local intent.
   * Deterministic, bounded rule-based parser (no LLM, no external network).
   *
   * @param {string} rawTask
   * @returns {Object} Structured intent with sanitized plan and private local values
   */
  function parseTask(rawTask) {
    const task = normalizeText(rawTask);
    if (!task) {
      return createNoneResult("Empty task");
    }

    const lower = task.toLowerCase();

    // 1. Check for sequential clauses: e.g. "..., then ..." or "... and then ..."
    const sequentialSplit = task.split(/\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then)\s+/i);
    if (sequentialSplit.length > 1) {
      const firstPart = sequentialSplit[0].trim();
      const secondPart = sequentialSplit.slice(1).join(" then ").trim();

      const firstResult = parseTask(firstPart);
      const secondResult = parseTask(secondPart);

      if (firstResult.intent !== "NONE" && secondResult.intent !== "NONE") {
        const combinedSteps = [...firstResult.steps, ...secondResult.steps];
        return buildResultFromSteps(combinedSteps);
      }
    }

    // 2. Sequential FILL without values: "Fill the name and email, then click submit"
    const fillThenClickMatch = task.match(/^fill\s+(?:the\s+)?([a-z0-9_\-\s]+?)\s+and\s+(?:the\s+)?([a-z0-9_\-\s]+?)\s*,\s*then\s+(?:click|press)\s+(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (fillThenClickMatch) {
      const field1 = fillThenClickMatch[1].trim();
      const field2 = fillThenClickMatch[2].trim();
      const clickTarget = fillThenClickMatch[3].trim();
      return buildResultFromSteps([
        { type: "FILL", fieldHint: field1, value: "..." },
        { type: "FILL", fieldHint: field2, value: "..." },
        {
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        }
      ]);
    }

    // 3. Multi-clause split on 'and' / ',' (e.g. "fill full name as sanketh and email address as sanketh@example.com")
    const andSplit = task.split(/\s*(?:,\s*and\s+|\s+and\s+|,\s*)\s*/i);
    if (andSplit.length > 1) {
      const parsedClauses = [];
      let allValid = true;
      for (const clause of andSplit) {
        const fillStep = parseFillClause(clause);
        if (fillStep) {
          parsedClauses.push(fillStep);
        } else {
          const subTaskRes = parseTask(clause);
          if (subTaskRes.intent !== "NONE" && Array.isArray(subTaskRes.steps) && subTaskRes.steps.length > 0 && subTaskRes.steps[0].type !== "NONE") {
            parsedClauses.push(...subTaskRes.steps);
          } else {
            allValid = false;
            break;
          }
        }
      }
      if (allValid && parsedClauses.length > 1) {
        return buildResultFromSteps(parsedClauses);
      }
    }

    // 4. Single-clause FILL pattern: "fill full name as sanketh", "enter sanketh in full name", etc.
    const singleFill = parseFillClause(task);
    if (singleFill) {
      return buildResultFromSteps([singleFill]);
    }

    // 5. SCROLL intents: "scroll down", "scroll", "scroll down a bit"
    if (/^scroll(?:\s+down)?(?:\s+a\s+bit|\s+more|\s+page)?$/i.test(lower) || /^(?:view|read)\s+more$/i.test(lower)) {
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: DEFAULT_SCROLL_AMOUNT
        }
      ]);
    }

    // 6. CLICK intents: "click X", "click the X button", "press X"
    const clickMatch = task.match(/^(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (clickMatch) {
      const targetHint = clickMatch[1].trim();
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 7. Legacy standalone keyword rules: login, next, submit, search
    const legacyTarget = resolveLegacyClickTarget(lower);
    if (legacyTarget) {
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: legacyTarget.toLowerCase().replace(/_button|_input/, ""),
          legacyTarget: legacyTarget
        }
      ]);
    }

    // 8. Unsupported / ambiguous task -> fail closed with safe NONE result
    return createNoneResult("Unsupported or ambiguous task");
  }

  /**
   * Assembles a structured result from ordered steps, enforcing the privacy contract.
   * @param {Array<Object>} steps
   * @returns {Object}
   */
  function buildResultFromSteps(steps) {
    if (!steps || steps.length === 0) {
      return createNoneResult("No steps parsed");
    }

    const sanitizedPlan = [];
    const localValues = {};

    let fillStepIndex = 0;
    steps.forEach((step, idx) => {
      if (step.type === "FILL") {
        sanitizedPlan.push({
          type: "FILL",
          fieldHint: step.fieldHint
        });
        // Retain literal values strictly in local in-memory structure
        localValues[idx] = step.value;
        localValues[`fill_${fillStepIndex}`] = step.value;
        fillStepIndex++;
        const normHint = (step.fieldHint || "").toLowerCase().trim();
        if (normHint) {
          localValues[normHint] = step.value;
        }
      } else if (step.type === "CLICK") {
        sanitizedPlan.push({
          type: "CLICK",
          targetHint: step.targetHint,
          legacyTarget: step.legacyTarget || null
        });
      } else if (step.type === "SCROLL") {
        sanitizedPlan.push({
          type: "SCROLL",
          target: step.target || "PAGE",
          amount: step.amount || DEFAULT_SCROLL_AMOUNT
        });
      } else {
        sanitizedPlan.push({ type: "NONE" });
      }
    });

    const isMultiStep = steps.length > 1;
    const primaryIntent = isMultiStep
      ? "MULTI_STEP"
      : (steps[0].type || "NONE");

    return {
      intent: primaryIntent,
      steps: steps,
      sanitizedPlan: sanitizedPlan,
      localValues: localValues,
      isMultiStep: isMultiStep
    };
  }

  /**
   * Helper to create safe fallback NONE result.
   * @param {string} reason
   * @returns {Object}
   */
  function createNoneResult(reason) {
    return {
      intent: "NONE",
      reason: reason || "Unrecognized task",
      steps: [{ type: "NONE" }],
      sanitizedPlan: [{ type: "NONE" }],
      localValues: {},
      isMultiStep: false
    };
  }

  return {
    parseTask,
    resolveLegacyClickTarget,
    DEFAULT_SCROLL_AMOUNT
  };
});
