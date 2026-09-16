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
    return (text || "").trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  }

  /**
   * Resolves known legacy keyword click targets.
   * @param {string} text
   * @returns {string|null}
   */
  function resolveLegacyClickTarget(text) {
    const lower = text.toLowerCase();
    if (/button/i.test(lower) && /search/i.test(lower)) return null;
    if (/cart|add to cart|bag/i.test(lower)) return "ADD_TO_CART_BUTTON";
    if (/login|sign in|log in/i.test(lower)) return "LOGIN_BUTTON";
    if (/next|continue|proceed|step/i.test(lower)) return "NEXT_BUTTON";
    if (/submit/i.test(lower)) return "SUBMIT_BUTTON";
    if (/(?:^|\s)(?:search\s+input|search\s+box|query\s+input|find\s+input)(?:$|\s)/i.test(lower)) return "SEARCH_INPUT";
    return null;
  }

  /**
   * Authoritative task search/fill query extractor.
   * Extracts clean query values (e.g. "iPhone 15", "machine learning", "wireless headphones")
   * without sentence continuation suffixes or action verbs.
   * Mirrors backend/main.py extract_task_query_or_value().
   */
  function extractTaskQueryOrValue(task) {
    if (!task || typeof task !== "string") return null;
    const taskClean = task.trim();

    // 1. Explicit fill patterns: "fill <field> as/with <val>", "enter <val> in <field>"
    const mAs = taskClean.match(/\b(?:fill|enter|type|set)\b.*?\b(?:as|with|value)\s+['"]?([^'",;]+?)['"]?(?:\s+(?:and|then)\b|[.,;!?]|$)/i);
    if (mAs) {
      const val = mAs[1].trim();
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }

    const mIn = taskClean.match(/\b(?:enter|type|put)\s+['"]?([^'",;]+?)['"]?\s+(?:in|into)\b/i);
    if (mIn) {
      const val = mIn[1].trim();
      if (val && !/^(?:the|a|an|box|input|field|button)$/i.test(val)) return val;
    }

    // 2. Search query pattern:
    // Strictly bounds the query before verbs like 'and identify', 'and find', 'and open', 'and click', 'and select', etc.
    const mSearch = taskClean.match(/(?<!\bfill\s)(?<!\benter\s)(?<!\btype\s)(?<!\bclick\s)(?<!\bfind\s)\bsearch\s+(?:for\s+)?(?!(?:the\s+)?(?:box|input|field|bar|area|button)\b)['"]?([^'",;]+?)['"]?(?:\s+(?:and\s+then|and\s+(?:identify|find|open|click|select|locate|choose)|then\s+(?:identify|find|open|click|select|locate|choose))\b|[.,;!?]|$)/i);
    if (mSearch) {
      const val = mSearch[1].trim();
      if (val && !/^(?:the|a|an|it|this|that|box|input|field|bar|area|button)$/i.test(val)) {
        return val;
      }
    }

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
   * Identifies ambiguous pronouns or referential placeholder terms that must never
   * be executed as independent click targets without contextual resolution.
   *
   * @param {string} str
   * @returns {boolean}
   */
  function isPronounOrReference(str) {
    const s = (str || "").toLowerCase().trim();
    return /^(?:it|this|that|them|that\s+button|this\s+button|the\s+button|button|that\s+link|this\s+link|the\s+link|link|the\s+above|above|the\s+field|that\s+field|this\s+field|field)$/i.test(s);
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

    // 1. Normalize "find/locate/search for/look for [the] <TARGET> and/then/and then click/press/tap/select/use it/that/this/them/that button/that link/the above"
    // -> "click [the] <TARGET>"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target) => {
        const cleanTarget = target.trim();
        return `click ${cleanTarget}`;
      }
    );

    // 2. Normalize "find/locate/search for/look for [the] <TARGET> button/link and/then click/press/tap/select/use it/that/that link/the above"
    text = text.replace(
      /\b(?:find|locate|search\s+for|look\s+for)\s+(?:the\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)\s+(?:button|link)\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target) => {
        const cleanTarget = target.trim();
        return `click ${cleanTarget} button`;
      }
    );

    // 3. Normalize "[the] <TARGET> [button/link] and then click/press/tap/select/use it" or ", then click it" when preceded by a clickable target
    text = text.replace(
      /(?:(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+button|\s+link)?))\s*(?:,\s*(?:and\s+then\s+|and\s+|then\s+)?|\s+(?:and\s+then\s+|and\s+|then\s+))(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|that|this|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field)\b/gi,
      (match, target) => {
        const cleanTarget = (target || "").trim();
        if (/^(?:fill|enter|type|put|set|is|as|with|in|into|then|and)$/i.test(cleanTarget)) {
          return match;
        }
        return `click ${cleanTarget}`;
      }
    );

    // 4. Normalize "find/locate/go to [the] search [box/input/field/area] and search for <query>" -> "fill search as <query>"
    text = text.replace(
      /\b(?:find|locate|go\s+to)\s+(?:the\s+)?(?:search\s+(?:box|input|field|area)|search)\s*(?:,\s*|\s+)(?:and\s+then\s+|and\s+|then\s+)?search\s+(?:for\s+)?((?:(?!\b(?:and|then)\b)[a-zA-Z0-9_\-\s])+?)(?=(?:,\s*|\s+)(?:and\s+(?:then\s+)?|then\s+)?(?:find|click|press|tap|submit|send)|$)/i,
      (match, query) => {
        return `fill search as ${query.trim()}`;
      }
    );

    return text;
  }

  /**
   * Section 3: Recognizes generic multi-stage search workflows.
   * Generic across all search engines and content portals without site-specific rules.
   *
   * @param {string} rawTask
   * @returns {Array<Object>|null} Ordered step descriptors or null
   */
  function parseSearchWorkflow(rawTask) {
    const text = (rawTask || "").trim().replace(/[.!?]+$/, "");
    if (!text) return null;

    // 0. Optional navigation prefix: e.g. "Open YouTube, search for...", "Go to Amazon and search for..."
    const navPrefixMatch = text.match(/^(?:open|go\s+to|navigate\s+to|launch|visit)\s+(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?=search\b)/i);
    let navTarget = null;
    let searchTaskText = text;
    if (navPrefixMatch) {
      navTarget = navPrefixMatch[1].trim();
      searchTaskText = text.substring(navPrefixMatch[0].length).trim();
    }

    // 1. Authoritative search query extraction
    const query = extractTaskQueryOrValue(searchTaskText);
    if (!query) return null;

    if (!/\bsearch\b/i.test(searchTaskText)) return null;

    const hasSearchBoxPrefix = /^(?:find|locate|go\s+to|click)\s+(?:on\s+)?(?:the\s+)?(?:search\s+(?:box|input|field|bar|area)|search)(?:\s+(?:in|on|at|of)\s+[a-zA-Z0-9_\-]+)?\b/i.test(searchTaskText);
    const productMatch = searchTaskText.match(/(?:identify|find|select|choose|open|click|view)\s+(?:on\s+)?(?:the\s+)?((?:(?:most\s+relevant|actual|first|top|selected|chosen)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content))/i);
    const hasProductOpen = !!productMatch || /\bopen\s+(?:it|that|the\s+product|the\s+result|the\s+video|the\s+item)\b/i.test(searchTaskText);
    const productTarget = productMatch ? productMatch[1].trim() : "most relevant product";

    let trailingTarget = null;
    // Trailing pattern A: "open ..., and then find the Add to Cart button, and click it"
    const trailingFindClickMatch = searchTaskText.match(/(?:open\s+(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|it)|open\s+it)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:find|locate|search\s+for)\s+(?:the\s+)?(.+?)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:it|that|this)\b/i);
    if (trailingFindClickMatch) {
      trailingTarget = trailingFindClickMatch[1].trim();
    } else {
      // Trailing pattern B: "open ..., and click [the] <TARGET> [button]"
      const trailingClickMatch = searchTaskText.match(/(?:open\s+(?:the\s+)?(?:(?:most\s+relevant|actual|first|top|selected|chosen)\s+)*(?:product|result|item|listing|video|movie|article|song|track|stream|content|it)|open\s+it)\s*(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button)?$/i);
      if (trailingClickMatch) {
        trailingTarget = trailingClickMatch[1].trim();
      } else {
        // Trailing pattern C: "and play it", "and play", "and click play"
        const trailingPlayMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:click\s+(?:on\s+)?(?:the\s+)?play(?:\s+button|\s+icon)?|play\s+(?:it|the\s+video|that|this)?|start\s+(?:playing|the\s+video)?)\b/i);
        if (trailingPlayMatch) {
          trailingTarget = "play";
        } else {
          // Trailing pattern D: "and add it to the cart", "and add to cart"
          const trailingAddToCartMatch = searchTaskText.match(/(?:,\s*|\s+)(?:and\s+)?(?:then\s+)?(?:add\s+(?:it\s+)?to\s+(?:the\s+)?cart|click\s+(?:on\s+)?(?:the\s+)?add\s+to\s+cart(?:\s+button)?)\b/i);
          if (trailingAddToCartMatch) {
            trailingTarget = "Add to Cart button";
          }
        }
      }
    }

    const steps = [];

    // Step 0: Initial navigation step if specified (e.g. "Open YouTube")
    if (navTarget) {
      steps.push({
        type: "CLICK",
        targetHint: navTarget,
        legacyTarget: null
      });
    }

    // Step 1: Explicit search input locator if task starts with finding/locating search box AND has subsequent product selection
    if (hasSearchBoxPrefix && hasProductOpen) {
      steps.push({
        type: "CLICK",
        targetHint: "search box",
        legacyTarget: "SEARCH_INPUT"
      });
    }

    // Step 2: Fill search input with the authoritative clean query
    steps.push({
      type: "FILL",
      fieldHint: "search",
      value: query
    });

    // Step 3: Submit search
    steps.push({
      type: "SUBMIT",
      targetHint: "search",
      query: query
    });

    // Step 4: Product / search result selection
    if (hasProductOpen) {
      steps.push({
        type: "CLICK",
        targetHint: productTarget,
        query: query,
        isProductSelection: true
      });
    }

    // Step 5: Trailing action (e.g. "find the Add to Cart button, and click it", "play it")
    if (trailingTarget) {
      const cleanTrailing = trailingTarget.trim();
      steps.push({
        type: "CLICK",
        targetHint: cleanTrailing,
        legacyTarget: resolveLegacyClickTarget(cleanTrailing)
      });
    }

    return steps.length > 0 ? steps : null;
  }

  /**
   * Parses free-text user task into structured local intent.
   * Deterministic, bounded rule-based parser (no LLM, no external network).
   *
   * @param {string} rawTask
   * @returns {Object} Structured intent with sanitized plan and private local values
   */
  function parseTask(rawTask) {
    if (!rawTask || !rawTask.trim()) {
      return createNoneResult("Empty task");
    }

    // Section 3: Recognize generic search workflows first
    // Multi-page / repeated search workflow check:
    // If the task contains multiple sequential search intents across navigation (e.g. Google -> open YouTube -> search on YouTube),
    // parse each stage independently and concatenate their steps in order.
    const searchOccurrences = (rawTask.match(/\bsearch\b/gi) || []).length;
    if (searchOccurrences >= 2) {
      const multiSearchSplitPattern = /(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+after\s+opening\s+(?:it|the\s+result|the\s+product|that|the\s+video|the\s+item))\s+(?=(?:find|locate|go\s+to|click|search|on\b|in\b))/i;
      const searchParts = rawTask.trim().split(multiSearchSplitPattern);
      if (searchParts.length > 1 && searchParts.every((p) => /\bsearch\b/i.test(p))) {
        let combinedSteps = [];
        let allValid = true;
        for (const part of searchParts) {
          const stageSteps = parseSearchWorkflow(part.trim());
          if (stageSteps && stageSteps.length > 0) {
            combinedSteps = combinedSteps.concat(stageSteps);
          } else {
            allValid = false;
            break;
          }
        }
        if (allValid && combinedSteps.length > 0) {
          return buildResultFromSteps(combinedSteps);
        }
      }
    }

    const searchWorkflowSteps = parseSearchWorkflow(rawTask);
    if (searchWorkflowSteps && searchWorkflowSteps.length > 0) {
      return buildResultFromSteps(searchWorkflowSteps);
    }

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

      // Check if secondPart is just pronoun referral like "click it", "press it", "tap it", "select it", "use that button"
      if (isPronounOrReference(secondPart) || /^(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(secondPart)) {
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

    // 2. Whole form filling with profile: "fill the form", "autofill form", "fill all details", "fill form simultaneously"
    const wholeFormMatch = task.match(/^(?:fill|autofill|complete|populate)\s+(?:the\s+|this\s+|all\s+|out\s+the\s+)?(?:form|details|fields|profile|registration\s+form|contact\s+form|simple\s+form)(?:\s+simultaneously|\s+all\s+at\s+once)?$/i);
    if (wholeFormMatch) {
      return buildResultFromSteps([
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        }
      ]);
    }

    // 2b. Whole form fill then click: "fill the form, then click submit", "fill form and submit"
    const wholeFormThenClickMatch = task.match(/^(?:fill|autofill|complete)\s+(?:the\s+|this\s+|all\s+|out\s+the\s+)?(?:form|details|fields|profile)\s*(?:,\s*then|\s+then|\s*;\s*then|\s*,\s*and\s+then|\s+and\s+then|\s+and)\s+(?:click|press|tap|submit|send)\s+(?:on\s+)?(?:the\s+)?([a-z0-9_\-\s]+?)(?:\s+button)?$/i);
    if (wholeFormThenClickMatch) {
      const clickTarget = wholeFormThenClickMatch[1].trim();
      return buildResultFromSteps([
        {
          type: "FILL_FORM",
          fieldHint: "all form fields",
          profileSource: "form-profile.json",
          simultaneous: true
        },
        {
          type: "CLICK",
          targetHint: clickTarget,
          legacyTarget: resolveLegacyClickTarget(clickTarget)
        }
      ]);
    }

    // 2c. Sequential FILL without values: "Fill the name and email, then click submit"
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

        // Check if this clause is a pronoun referral like "click it", "then click it", "and click it", "select it"
        if (isPronounOrReference(trimmedClause) || /^(?:and\s+)?(?:then\s+)?(?:click|press|tap|select|use)\s+(?:on\s+)?(?:it|this|that|them|that\s+button|this\s+button|that\s+link|this\s+link|the\s+above|above|the\s+field|that\s+field|this\s+field|the\s+button|button|the\s+link|link)$/i.test(trimmedClause)) {
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

    // 5b. General scroll: "scroll down", "scroll", "scroll down the page", "scroll down a bit", "scroll to find the form"
    if (/^scroll(?:\s+down|\s+up)?(?:\s+a\s+bit|\s+more|\s+the\s+page|\s+page)?$/i.test(lower) || /^(?:view|read)\s+more$/i.test(lower) || /^scroll\s+to\s+/i.test(lower)) {
      return buildResultFromSteps([
        {
          type: "SCROLL",
          target: "PAGE",
          amount: DEFAULT_SCROLL_AMOUNT
        }
      ]);
    }

    // 5c. SEARCH intents: "search for <query>", "search <query>"
    const searchIntentMatch = task.match(/^search(?:\s+for)?\s+['"]?([^'"]+?)['"]?$/i);
    if (searchIntentMatch) {
      const query = searchIntentMatch[1].trim();
      if (query && !/^(?:the|a|an|input|box|field|button|it|that|this|them)$/i.test(query)) {
        return buildResultFromSteps([
          {
            type: "FILL",
            fieldHint: "search",
            value: query
          }
        ]);
      }
    }

    // 6. CLICK intents:
    // 6a. Explicitly labelled/named: "click the button labelled Register", "press link named Register"
    const labelledBtnMatch = task.match(/^(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?(?:button|link)\s+(?:labelled|labeled|named|with\s+text)\s+['"]?([a-zA-Z0-9_\-\s]+?)['"]?$/i);
    if (labelledBtnMatch) {
      const targetHint = labelledBtnMatch[1].trim();
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
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
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
      }
      return buildResultFromSteps([
        {
          type: "CLICK",
          targetHint: targetHint,
          legacyTarget: resolveLegacyClickTarget(targetHint)
        }
      ]);
    }

    // 6c. Standard CLICK / FIND: "click add to cart", "find english", "press submit", "click continue", "tap on search"
    const clickMatch = task.match(/^(?:click|press|tap|find|locate)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button|\s+link)?$/i);
    if (clickMatch) {
      const targetHint = clickMatch[1].trim();
      // Never create a standalone target named "it", "this", "that", "them", "the button", "the above", etc.
      if (isPronounOrReference(targetHint)) {
        return createNoneResult("Cannot resolve pronoun target '" + targetHint + "' without prior clickable context");
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
      if (step.type === "FILL_FORM") {
        sanitizedPlan.push({
          type: "FILL_FORM",
          fieldHint: step.fieldHint || "all form fields",
          stepId: idx
        });
        localValues[idx] = "[FORM_PROFILE_DATA]";
        localValues["form_profile"] = step.profileSource || "form-profile.json";
        localValues["simultaneous"] = true;
      } else if (step.type === "FILL") {
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
      } else if (step.type === "SUBMIT") {
        sanitizedPlan.push({
          type: "SUBMIT",
          targetHint: step.targetHint || "search",
          stepId: idx
        });
        if (step.query) {
          localValues["search_query"] = step.query;
          localValues[idx] = step.query;
        }
      } else if (step.type === "CLICK") {
        sanitizedPlan.push({
          type: "CLICK",
          targetHint: step.targetHint,
          legacyTarget: step.legacyTarget || null,
          stepId: idx
        });
        if (step.query) {
          localValues["search_query"] = step.query;
        }
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
    extractTaskQueryOrValue,
    resolveLegacyClickTarget,
    DEFAULT_SCROLL_AMOUNT
  };
});
