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

    // Explicit non-fill actions must never be parsed as fill clauses
    if (/^(?:click|press|tap|open|scroll|view|navigate|go\s+to)\b/i.test(text)) {
      return null;
    }

    // Pattern 1: '[enter/type/put] <val> in/into/for <field>'
    const enterInMatch = text.match(/^(?:(?:enter|type|put)\s+)?(.+?)\s+in(?:to|for)?\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+field|\s+input|\s+box|\s+area)?$/i);
    if (enterInMatch) {
      const val = enterInMatch[1].trim();
      const field = enterInMatch[2].trim();
      if (val && field && !/^(?:the|a|an|to)$/i.test(val)) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 2a: With explicit fill verb: '[fill/set/enter/type/put] [in/into] [the] <field> with/to/as/is/:/= <val>'
    const explicitFillMatch = text.match(/^(?:fill|set|enter|type|put)\s+(?:in\s+|into\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|to|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (explicitFillMatch) {
      const field = explicitFillMatch[1].trim();
      const val = explicitFillMatch[2].trim();
      if (field && val) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    // Pattern 2b: Without leading verb: '[the] <field> with/as/is/:/= <val>' (disallows 'to' without fill verb to prevent phrase collisions)
    const implicitFillMatch = text.match(/^(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+(?:with|as|is|:=|=)\s+|\s*:\s*)(.+)$/i);
    if (implicitFillMatch) {
      const field = implicitFillMatch[1].trim();
      const val = implicitFillMatch[2].trim();
      if (field && val) {
        return { type: "FILL", fieldHint: field, value: val };
      }
    }

    return null;
  }

  /**
   * Normalizes natural language idioms, connectors, and pronoun references in task text.
   * Ensures phrases like "find [the] <target> and/then click it" are interpreted as
   * a single click intent, avoiding spurious "click it" steps.
   *
   * @param {string} rawTask
   * @returns {string}
   */
  function normalizeTaskPhrasing(rawTask) {
    let text = normalizeText(rawTask);
    if (!text) return "";

    // 1. Normalize "find/locate/search for/look for [the] <TARGET> and/then/and then click/press/tap it"
    // -> "click [the] <TARGET>"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s*(?:,\s*|\s+)(?:and\s+then\s+|and\s+|then\s+)(?:click|press|tap)\s+(?:on\s+)?it\b/gi,
      (match, target) => {
        const cleanTarget = target.trim();
        return `click ${cleanTarget}`;
      }
    );

    // 2. Normalize "find/locate/search for/look for [the] <TARGET> button/link and/then click it"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s+(?:button|link)\s*(?:,\s*|\s+)(?:and\s+then\s+|and\s+|then\s+)(?:click|press|tap)\s+(?:on\s+)?it\b/gi,
      (match, target) => {
        const cleanTarget = target.trim();
        return `click ${cleanTarget} button`;
      }
    );

    // 3. Normalize "[the] <TARGET> [button/link] and then click it" or ", then click it" when preceded by a clickable target
    text = text.replace(
      /(?:(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+button|\s+link)?))\s*(?:,\s*|\s+)(?:and\s+then\s+|and\s+|then\s+)(?:click|press|tap)\s+(?:on\s+)?it\b/gi,
      (match, target) => {
        const cleanTarget = (target || "").trim();
        if (/^(?:fill|enter|type|put|set|is|as|with|in|into|then|and)$/i.test(cleanTarget)) {
          return match;
        }
        return `click ${cleanTarget}`;
      }
    );

    return text;
  }

  /**
   * Parses free-text user task into structured local intent.
   * Deterministic, bounded rule-based parser (no LLM, no external network).
   *
   * @param {string} rawTask
   * @returns {Object} Structured intent with sanitized plan and private local values
   */
  function parseTask(rawTask) {
    const task = normalizeTaskPhrasing(rawTask);
    if (!task) {
      return createNoneResult("Empty task");
    }

    const lower = task.toLowerCase();

    // 1. Check for sequential clauses: e.g. "..., then ...", "... and then ...", "... then ..."
    const sequentialSplit = task.split(/\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then)\s+/i);
    if (sequentialSplit.length > 1) {
      const firstPart = sequentialSplit[0].trim();
      const secondPart = sequentialSplit.slice(1).join(" then ").trim();

      // Check if secondPart is just pronoun referral like "click it", "press it", "tap it"
      if (/^(?:click|press|tap)\s+(?:on\s+)?(?:it|this|that|them)$/i.test(secondPart)) {
        const firstResult = parseTask(firstPart);
        if (firstResult.intent !== "NONE" && Array.isArray(firstResult.steps) && firstResult.steps.length > 0) {
          const lastStep = firstResult.steps[firstResult.steps.length - 1];
          if (lastStep.type === "CLICK") {
            // Already specifies the click action; avoid duplicate "click it"
            return firstResult;
          }
        }
      }

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
        const trimmedClause = clause.trim();

        // Check if this clause is a pronoun referral like "click it", "then click it", "and click it"
        if (/^(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:it|this|that|them)$/i.test(trimmedClause)) {
          if (parsedClauses.length > 0) {
            const lastStep = parsedClauses[parsedClauses.length - 1];
            // If the preceding step was already a CLICK action, "click it" is redundant confirmation
            if (lastStep.type === "CLICK") {
              continue;
            }
          }
          // Standalone or unresolvable pronoun referral
          allValid = false;
          break;
        }

        const fillStep = parseFillClause(trimmedClause);
        if (fillStep) {
          parsedClauses.push(fillStep);
        } else {
          const subTaskRes = parseTask(trimmedClause);
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

    // 5. SCROLL intents:
    // 5a. Bounded numeric scroll: "scroll down 500", "scroll down 500 pixels", "scroll 300px"
    const scrollNumMatch = lower.match(/^scroll(?:\s+down)?\s+(\d+)(?:\s*(?:pixels|px))?$/i);
    if (scrollNumMatch) {
      const rawAmt = parseInt(scrollNumMatch[1], 10);
      const safeAmt = isNaN(rawAmt) ? DEFAULT_SCROLL_AMOUNT : Math.min(Math.max(rawAmt, 50), 1500);
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: safeAmt
        }
      ]);
    }

    // 5b. General scroll: "scroll down", "scroll", "scroll down a bit", "scroll to find the form"
    if (/^scroll(?:\s+down)?(?:\s+a\s+bit|\s+more|\s+page)?$/i.test(lower) || /^(?:view|read)\s+more$/i.test(lower) || /^scroll\s+to\s+/i.test(lower)) {
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: DEFAULT_SCROLL_AMOUNT
        }
      ]);
    }

    // 6. CLICK intents:
    // 6a. Explicitly labelled/named: "click the button labelled Register", "press link named Register"
    const labelledBtnMatch = task.match(/^(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?(?:button|link)\s+(?:labelled|labeled|named|with\s+text)\s+['"]?([a-zA-Z0-9_\-\s]+?)['"]?$/i);
    if (labelledBtnMatch) {
      const targetHint = labelledBtnMatch[1].trim();
      if (/^(?:it|this|that|them)$/i.test(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target 'it' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6b. Open page / navigation: "open downloads", "open the downloads page", "go to documentation"
    const openMatch = task.match(/^(?:open|navigate\s+to|go\s+to)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+page|\s+link|\s+tab)?$/i);
    if (openMatch) {
      const targetHint = openMatch[1].trim();
      if (/^(?:it|this|that|them)$/i.test(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target 'it' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6c. Standard CLICK: "click add to cart", "press submit", "click continue", "tap on search"
    const clickMatch = task.match(/^(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button|\s+link)?$/i);
    if (clickMatch) {
      const targetHint = clickMatch[1].trim();
      // Never create a standalone target named "it", "this", "that", "them"
      if (/^(?:it|this|that|them)$/i.test(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target 'it' without prior clickable context");
      }
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
      step.stepId = idx;
      if (step.type === "FILL") {
        sanitizedPlan.push({
          type: "FILL",
          fieldHint: step.fieldHint,
          stepId: idx
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
          legacyTarget: step.legacyTarget || null,
          stepId: idx
        });
      } else if (step.type === "SCROLL") {
        sanitizedPlan.push({
          type: "SCROLL",
          target: step.target || "PAGE",
          amount: step.amount || DEFAULT_SCROLL_AMOUNT,
          stepId: idx
        });
      } else {
        sanitizedPlan.push({ type: "NONE", stepId: idx });
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
