/**
 * reasoning-planner.js — On-Device Reasoning & Safety Planner
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents
 *
 * ARCHITECTURAL CLARIFICATION:
 * This module is a deterministic, explainable, auditable, on-device reasoning
 * and safety planning layer. It is NOT an LLM or generative AI model.
 * It provides transparent task understanding, dependency tracking, action risk
 * classification, precondition/postcondition validation, and human-in-the-loop safety gating.
 *
 * CRITICAL PRIVACY CONTRACT:
 * Plans produced or evaluated by this module contain ONLY sanitized structural intents
 * (e.g. action type, field hints, risk class, safety conditions).
 * Literal user-entered values are NEVER embedded into reasoning artifacts or network plans.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHReasoningPlanner = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Action Risk Classification Taxonomy
  const RISK_LEVELS = Object.freeze({
    LOW: "LOW",         // Local perception, scrolling, filling non-sensitive inputs
    MEDIUM: "MEDIUM",   // Navigation, opening tabs, ordinary interactive controls
    HIGH: "HIGH",       // Consequential actions: submit, delete, purchase, confirm, send
    CRITICAL: "CRITICAL" // Financial payment, account deletion, irreversible side effects
  });

  // Keywords that identify high-impact or consequential actions
  const HIGH_RISK_KEYWORDS = [
    "submit",
    "send",
    "delete",
    "remove",
    "purchase",
    "buy",
    "checkout",
    "place order",
    "confirm",
    "publish",
    "post",
    "pay",
    "transfer",
    "apply",
    "register",
    "sign up",
    "finish"
  ];

  const CRITICAL_RISK_KEYWORDS = [
    "pay now",
    "confirm payment",
    "delete account",
    "erase",
    "wipe",
    "wire transfer",
    "authorize charge"
  ];

  /**
   * Normalizes a text string for consistent comparison.
   * @param {string} str
   * @returns {string}
   */
  function normalize(str) {
    return (str || "").toLowerCase().replace(/[:*#_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
  }

  /**
   * Classifies the operational risk level of an action and its target.
   * Deterministic local classification based on action semantics and target attributes.
   *
   * @param {Object} action - { action: "CLICK"|"FILL"|"SCROLL", target?: string, targetLabel?: string, targetType?: string }
   * @param {Object} [context] - Optional page context or DOM metadata
   * @returns {{ level: string, requiresApproval: boolean, rationale: string }}
   */
  function classifyActionRisk(action, context = {}) {
    if (!action || typeof action !== "object") {
      return {
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        rationale: "Empty or unrecognized action defaults to low risk."
      };
    }

    const actionType = (action.action || "").toUpperCase();
    const targetLabel = normalize(action.targetLabel || action.target || action.targetHint || "");
    const targetType = normalize(action.targetType || "");
    const semanticTag = normalize(action.semanticTag || "");

    // 1. FILL / FILL_FORM Action: Low risk for ordinary form inputs (passwords already blocked by content script)
    if (actionType === "FILL" || actionType === "FILL_FORM") {
      return {
        risk: RISK_LEVELS.LOW,
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        reason: actionType === "FILL_FORM"
          ? "Simultaneous form autofill using local profile. Local non-consequential modification."
          : `Form fill on '${action.targetLabel || action.fieldHint || "field"}'. Local non-consequential modification.`,
        rationale: actionType === "FILL_FORM"
          ? "Simultaneous form autofill using local profile. Local non-consequential modification."
          : `Form fill on '${action.targetLabel || action.fieldHint || "field"}'. Local non-consequential modification.`
      };
    }

    // 2. SCROLL Action: Low risk bounded viewport movement
    if (actionType === "SCROLL") {
      return {
        risk: RISK_LEVELS.LOW,
        level: RISK_LEVELS.LOW,
        requiresApproval: false,
        reason: "Viewport scroll. Safe read-only inspection.",
        rationale: "Viewport scroll. Safe read-only inspection."
      };
    }

    // 3. CLICK Action: Risk depends on the semantic consequence of clicking the target
    if (actionType === "CLICK") {
      // Check for critical keywords
      for (const kw of CRITICAL_RISK_KEYWORDS) {
        if (targetLabel.includes(kw)) {
          return {
            risk: RISK_LEVELS.CRITICAL,
            level: RISK_LEVELS.CRITICAL,
            requiresApproval: true,
            reason: `Critical action detected ('${kw}'). Financial or irreversible account operation requires explicit human approval.`,
            rationale: `Critical action detected ('${kw}'). Financial or irreversible account operation requires explicit human approval.`
          };
        }
      }

      // Check for high-risk / consequential keywords
      for (const kw of HIGH_RISK_KEYWORDS) {
        if (targetLabel === kw || targetLabel.includes(kw) || semanticTag === "submit_button") {
          return {
            risk: RISK_LEVELS.HIGH,
            level: RISK_LEVELS.HIGH,
            requiresApproval: true,
            reason: `Consequential action detected ('${kw}'). This action submits or permanently modifies state and requires human approval.`,
            rationale: `Consequential action detected ('${kw}'). This action submits or permanently modifies state and requires human approval.`
          };
        }
      }

      // Medium risk: general navigation, search, adding items, toggles
      if (["link", "a"].includes(targetType) || targetLabel.includes("search") || targetLabel.includes("filter") || targetLabel.includes("cart")) {
        return {
          risk: RISK_LEVELS.MEDIUM,
          level: RISK_LEVELS.MEDIUM,
          requiresApproval: false,
          reason: `Interactive navigation/selection on '${targetLabel}'. Autonomous execution permitted.`,
          rationale: `Interactive navigation/selection on '${targetLabel}'. Autonomous execution permitted.`
        };
      }

      // Default click risk
      return {
        risk: RISK_LEVELS.MEDIUM,
        level: RISK_LEVELS.MEDIUM,
        requiresApproval: false,
        reason: `Standard click interaction on '${targetLabel || "button"}'.`,
        rationale: `Standard click interaction on '${targetLabel || "button"}'.`
      };
    }

    return {
      risk: RISK_LEVELS.LOW,
      level: RISK_LEVELS.LOW,
      requiresApproval: false,
      reason: "Action permitted under standard autonomous policy.",
      rationale: "Action permitted under standard autonomous policy."
    };
  }

  /**
   * Plans a task by transforming parsed task steps into an auditable, step-by-step reasoning plan.
   * Enforces dependencies and assigns risk classes without exposing literal form values.
   *
   * @param {Object} parsedTask - Result from SIHTaskParser.parseTask
   * @param {Object} [pageMetadata] - Current page title, URL, etc.
   * @returns {Object} Structured reasoning plan
   */
  function planTask(parsedTask, pageMetadata = {}) {
    if (!parsedTask || !Array.isArray(parsedTask.steps) || parsedTask.steps.length === 0) {
      return {
        intentSummary: "No actionable task steps parsed.",
        totalSteps: 0,
        hasHighRiskStep: false,
        steps: [],
        reasoningTrace: ["Task empty or unparseable."]
      };
    }

    const steps = [];
    const reasoningTrace = [];
    let hasHighRiskStep = false;
    let fillCount = 0;
    let clickCount = 0;

    parsedTask.steps.forEach((rawStep, idx) => {
      const stepType = (rawStep.type || "").toUpperCase();
      let riskAssessment = null;

      if (stepType === "FILL_FORM") {
        fillCount++;
        riskAssessment = classifyActionRisk({ action: "FILL_FORM", targetLabel: rawStep.fieldHint || "all form fields" });
        steps.push({
          id: idx + 1,
          stepId: idx,
          type: "FILL_FORM",
          target: "all form fields",
          fieldHint: rawStep.fieldHint || "all form fields",
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: false,
          reasoning: `Step ${idx + 1}: Simultaneously fill all matching form fields on page using local form profile data.`,
          preconditions: ["page_active"],
          postconditions: ["all_form_fields_verified_locally"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: FILL_FORM (Simultaneous Profile Autofill) [${riskAssessment.level} Risk - Autonomous]`);
      } else if (stepType === "FILL") {
        fillCount++;
        riskAssessment = classifyActionRisk({ action: "FILL", targetLabel: rawStep.fieldHint });
        steps.push({
          id: idx + 1,
          stepId: idx,
          type: "FILL",
          target: rawStep.fieldHint,
          fieldHint: rawStep.fieldHint,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: riskAssessment.requiresApproval,
          reasoning: `Step ${idx + 1}: Fill form field '${rawStep.fieldHint}'. Local value held in memory.`,
          preconditions: ["target_grounded", "target_visible", "target_not_disabled"],
          postconditions: ["field_value_verified_locally"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: FILL '${rawStep.fieldHint}' [${riskAssessment.level} Risk - Autonomous]`);
      } else if (stepType === "CLICK") {
        clickCount++;
        const targetLabel = rawStep.legacyTarget || rawStep.targetHint || "control";
        riskAssessment = classifyActionRisk({
          action: "CLICK",
          targetLabel: targetLabel,
          semanticTag: rawStep.legacyTarget
        });
        if (riskAssessment.requiresApproval) {
          hasHighRiskStep = true;
        }

        const isSubmit = targetLabel.toLowerCase().includes("submit") || rawStep.legacyTarget === "SUBMIT_BUTTON";
        const preconditions = ["target_grounded", "target_visible", "target_not_disabled"];
        if (isSubmit && fillCount > 0) {
          preconditions.unshift("all_prior_fields_verified");
        }
        if (riskAssessment.requiresApproval) {
          preconditions.push("human_approval_granted");
        }

        steps.push({
          id: idx + 1,
          stepId: idx,
          type: "CLICK",
          target: targetLabel,
          targetHint: targetLabel,
          legacyTarget: rawStep.legacyTarget || null,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: riskAssessment.requiresApproval,
          approvalPrompt: `Execute consequential action: CLICK → ${targetLabel}`,
          reasoning: riskAssessment.rationale,
          preconditions: preconditions,
          postconditions: ["page_state_verified"]
        });
        const riskLabel = riskAssessment.requiresApproval ? "HIGH Risk - Approval Required" : `${riskAssessment.level} Risk - Autonomous`;
        reasoningTrace.push(`Step ${idx + 1} planned: CLICK '${targetLabel}' [${riskLabel}]`);
      } else if (stepType === "SCROLL") {
        riskAssessment = classifyActionRisk({ action: "SCROLL" });
        steps.push({
          id: idx + 1,
          stepId: idx,
          type: "SCROLL",
          target: "PAGE",
          amount: rawStep.amount || 500,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          requiresApproval: false,
          reasoning: `Step ${idx + 1}: Viewport scroll.`,
          preconditions: ["page_active"],
          postconditions: ["scroll_position_verified"]
        });
        reasoningTrace.push(`Step ${idx + 1} planned: SCROLL [${riskAssessment.level} Risk - Autonomous]`);
      }
    });

    let intentSummary = "";
    if (fillCount > 0 && clickCount > 0) {
      intentSummary = `Composite workflow: Fill ${fillCount} form field(s) followed by ${clickCount} interactive action(s).`;
    } else if (fillCount > 0) {
      intentSummary = `Form filling task: Fill ${fillCount} field(s) locally.`;
    } else if (clickCount > 0) {
      intentSummary = `Interactive task: Execute ${clickCount} browser action(s).`;
    } else {
      intentSummary = "Read-only inspection or scrolling task.";
    }

    if (hasHighRiskStep) {
      reasoningTrace.push("Safety policy: High-impact action detected. Autonomous loop will pause for human approval.");
    }

    return {
      intentSummary: intentSummary,
      totalSteps: steps.length,
      hasHighRiskStep: hasHighRiskStep,
      steps: steps,
      reasoningTrace: reasoningTrace
    };
  }

  /**
   * Validates whether all preconditions for a step are satisfied before execution.
   * Enforces that high-impact actions like Submit require all prior fields to be verified.
   *
   * @param {Object} step - Step descriptor from planTask
   * @param {Array<Object>} completedStepsHistory - History of completed steps with their verification status
   * @param {Object} [approvalToken] - Human approval token if already granted
   * @returns {{ valid: boolean, reason: string }}
   */
  function validatePreconditions(step, completedStepsHistory = [], approvalToken = null) {
    if (!step) {
      return { valid: true, satisfied: true, reason: "No preconditions specified for step." };
    }

    // 1. Dependency check: Submit requires all prior fill operations to have succeeded and verified
    if (step.preconditions && step.preconditions.includes("all_prior_fields_verified")) {
      const failedOrUnverified = completedStepsHistory.filter(
        (prev) => prev.action && (prev.action.action === "FILL" || prev.action.action === "FILL_FORM") && !prev.verified
      );
      if (failedOrUnverified.length > 0) {
        const failedHints = failedOrUnverified.map(f => f.action.targetLabel || f.action.action || "field").join(", ");
        return {
          valid: false,
          satisfied: false,
          reason: `Precondition failed: Cannot execute '${step.targetHint || "Submit"}' because prior field(s) [${failedHints}] were not verified.`
        };
      }
    }

    // 2. Human approval check for high-risk actions
    if (step.requiresApproval) {
      if (!approvalToken || !approvalToken.approved) {
        return {
          valid: false,
          satisfied: false,
          requiresHumanApproval: true,
          reason: `Precondition paused: Consequential action '${step.targetHint || step.type}' requires explicit human approval.`
        };
      }

      // Validate that approval token matches this exact step and target
      const targetMatch = normalize(approvalToken.target) === normalize(step.targetHint || step.fieldHint || "");
      if (!targetMatch && approvalToken.stepId !== step.stepId) {
        return {
          valid: false,
          satisfied: false,
          reason: "Precondition failed: Stale or mismatched approval token."
        };
      }
    }

    return { valid: true, satisfied: true, reason: "All preconditions satisfied." };
  }

  /**
   * Local Safety Gate: Evaluates proposed action immediately before execution.
   * Ensures backend cannot bypass local safety policy or human approval.
   *
   * @param {Object} agentAction - Proposed action from backend or local planner
   * @param {Object} stepPlan - Step definition from reasoning planner
   * @param {Object} approvalState - Current in-memory approval token
   * @param {Object} pageIdentity - Current tab URL and title to detect navigation drift
   * @returns {{ allowed: boolean, requiresApproval: boolean, risk: string, reason: string }}
   */
  function evaluateSafetyGate(agentAction, stepPlan, approvalState = null, pageIdentity = {}) {
    if (!agentAction || typeof agentAction !== "object") {
      return {
        allowed: false,
        requiresApproval: false,
        risk: RISK_LEVELS.LOW,
        reason: "Invalid action object."
      };
    }

    const actionType = (agentAction.action || "").toUpperCase();
    const ALLOWED_ACTIONS = new Set(["CLICK", "SCROLL", "FILL", "NONE"]);
    if (!ALLOWED_ACTIONS.has(actionType)) {
      return {
        allowed: false,
        requiresApproval: false,
        risk: RISK_LEVELS.CRITICAL,
        reason: `Action '${actionType}' is not in the local permitted allowlist.`
      };
    }

    if (actionType === "NONE") {
      return {
        allowed: true,
        requiresApproval: false,
        risk: RISK_LEVELS.LOW,
        reason: "No-op action safely allowed."
      };
    }

    // Determine risk dynamically based on target and semantic context
    const riskAssessment = classifyActionRisk(agentAction);
    const requiresApproval = riskAssessment.requiresApproval || (stepPlan && stepPlan.requiresApproval);

    if (requiresApproval) {
      // Check if approval state is provided
      if (!approvalState || approvalState.approved === false) {
        return {
          allowed: false,
          requiresApproval: true,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          reason: `High-impact action '${actionType} \u2192 ${agentAction.targetLabel || agentAction.target || "target"}' requires explicit human approval.`
        };
      }

      // Check token expiration (> 5 minutes old)
      if (approvalState.timestamp && (Date.now() - approvalState.timestamp > 5 * 60 * 1000)) {
        return {
          allowed: false,
          requiresApproval: true,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          reason: "Prior approval expired: approval window exceeded. Fresh human approval required."
        };
      }

      // Prevent stale approval bypass: verify approval matches action, target, and page context
      const actionMatches = approvalState.action === actionType;
      const targetMatches = normalize(approvalState.target) === normalize(agentAction.targetLabel || agentAction.target || "");
      const urlMatches = !approvalState.pageUrl || !pageIdentity.url || approvalState.pageUrl === pageIdentity.url;

      if (!actionMatches || !targetMatches || !urlMatches) {
        const mismatchReason = !urlMatches
          ? "Page URL changed since approval was granted. Prior approval invalidated."
          : (!targetMatches
              ? "Action target drifted since approval was granted. Prior approval invalidated."
              : "Action type changed since approval was granted. Prior approval invalidated.");
        return {
          allowed: false,
          requiresApproval: true,
          risk: riskAssessment.risk || riskAssessment.level,
          level: riskAssessment.level,
          reason: mismatchReason
        };
      }

      return {
        allowed: true,
        requiresApproval: false,
        risk: riskAssessment.risk || riskAssessment.level,
        level: riskAssessment.level,
        reason: `High-impact action '${actionType} \u2192 ${agentAction.targetLabel || agentAction.target}' validated via explicit human approval.`
      };
    }

    // Low / Medium risk actions proceed autonomously under local safety bounds
    return {
      allowed: true,
      requiresApproval: false,
      risk: riskAssessment.level,
      reason: `Action '${actionType}' permitted under autonomous local safety policy (${riskAssessment.rationale}).`
    };
  }

  /**
   * Verifies that the expected postcondition of an action occurred.
   *
   * @param {Object} stepPlan - Step definition
   * @param {Object} executionResult - Result returned by content.js executeAction
   * @param {Object} changeResult - Result from change-detector.js
   * @returns {{ verified: boolean, reason: string }}
   */
  function verifyPostconditions(stepPlan, executionResult, changeResult = null) {
    if (!executionResult || !executionResult.executed) {
      return {
        verified: false,
        reason: executionResult?.reason || "Action was not executed."
      };
    }

    const stepType = (stepPlan?.type || executionResult.action || "").toUpperCase();

    if (stepType === "FILL") {
      const isVerifiedLocally = !!executionResult.verified;
      return {
        verified: isVerifiedLocally,
        reason: isVerifiedLocally
          ? "Input field state verified locally."
          : "Local value verification failed on target control."
      };
    }

    if (stepType === "SCROLL") {
      const scrollChanged = changeResult ? changeResult.changed : true;
      return {
        verified: scrollChanged,
        reason: scrollChanged ? "Viewport scroll verified." : "Scroll did not shift page content."
      };
    }

    if (stepType === "CLICK") {
      const pageChanged = changeResult ? changeResult.changed : true;
      return {
        verified: true,
        reason: pageChanged
          ? `Click executed and verified (${changeResult ? changeResult.reason : "state changed"}).`
          : "Click dispatched; awaiting downstream response."
      };
    }

    return { verified: true, reason: "Action completed." };
  }

  return {
    RISK_LEVELS,
    classifyActionRisk,
    planTask,
    validatePreconditions,
    evaluateSafetyGate,
    verifyPostconditions
  };
});
