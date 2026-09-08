/**
 * evaluation-tracker.js — Milestone Evaluation & Benchmark Telemetry Module
 * SIH26171: On-device Visual Perception for Lightweight Browser Agents
 *
 * Tracks autonomous browser agent performance, safety guarantees, and reliability metrics.
 * Critical safety metric: UNAUTHORIZED CONSEQUENTIAL ACTIONS (Target: 0).
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SIHEvaluationTracker = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createEvaluationTracker() {
    let metrics = {
      tasksAttempted: 0,
      tasksSucceeded: 0,
      actionsAttempted: 0,
      actionsExecuted: 0,
      groundingScores: [],
      verificationsAttempted: 0,
      verificationsSucceeded: 0,
      recoveryCount: 0,
      replanningCount: 0,
      latenciesMs: [],
      piiDetectionsCount: 0,
      redactionsCount: 0,
      unsafeActionAttemptsBlocked: 0,
      blockedConsequentialActions: 0,
      unauthorizedConsequentialActions: 0 // Mandatory invariant: 0
    };

    let sessionHistory = [];

    function recordTaskStart(taskId, taskDescription) {
      metrics.tasksAttempted++;
      sessionHistory.push({
        type: "TASK_START",
        taskId: taskId || "TASK-" + Date.now(),
        description: taskDescription,
        timestamp: Date.now()
      });
    }

    function recordTaskEnd(taskId, success, reason = "") {
      if (success) {
        metrics.tasksSucceeded++;
      }
      sessionHistory.push({
        type: "TASK_END",
        taskId,
        success: !!success,
        reason,
        timestamp: Date.now()
      });
    }

    function recordAction(actionData = {}) {
      metrics.actionsAttempted++;
      if (actionData.executed) {
        metrics.actionsExecuted++;
      }
      if (typeof actionData.groundingScore === "number" && !isNaN(actionData.groundingScore)) {
        metrics.groundingScores.push(actionData.groundingScore);
      }
    }

    function recordVerification(verified = false, reason = "") {
      metrics.verificationsAttempted++;
      if (verified) {
        metrics.verificationsSucceeded++;
      }
    }

    function recordRecovery(reason = "") {
      metrics.recoveryCount++;
      sessionHistory.push({
        type: "RECOVERY_EVENT",
        reason,
        timestamp: Date.now()
      });
    }

    function recordReplanning(reason = "") {
      metrics.replanningCount++;
      sessionHistory.push({
        type: "REPLANNING_EVENT",
        reason,
        timestamp: Date.now()
      });
    }

    function recordLatency(ms) {
      if (typeof ms === "number" && !isNaN(ms) && ms >= 0) {
        metrics.latenciesMs.push(Math.round(ms));
      }
    }

    function recordPiiDetection(count = 1) {
      metrics.piiDetectionsCount += Math.max(0, Number(count) || 0);
    }

    function recordRedaction(count = 1) {
      metrics.redactionsCount += Math.max(0, Number(count) || 0);
    }

    function recordBlockedUnsafeAction(action = "UNKNOWN", reason = "") {
      metrics.unsafeActionAttemptsBlocked++;
      sessionHistory.push({
        type: "UNSAFE_ACTION_BLOCKED",
        action,
        reason,
        timestamp: Date.now()
      });
    }

    function recordBlockedConsequentialAction(action = "UNKNOWN", reason = "") {
      metrics.blockedConsequentialActions++;
      sessionHistory.push({
        type: "CONSEQUENTIAL_ACTION_BLOCKED",
        action,
        reason,
        timestamp: Date.now()
      });
    }

    function recordUnauthorizedConsequentialAttempt(action = "UNKNOWN", reason = "") {
      metrics.unauthorizedConsequentialActions++;
      sessionHistory.push({
        type: "UNAUTHORIZED_CONSEQUENTIAL_ATTEMPT",
        action,
        reason,
        timestamp: Date.now()
      });
    }

    function getSummary() {
      const avgGroundingScore = metrics.groundingScores.length > 0
        ? (metrics.groundingScores.reduce((a, b) => a + b, 0) / metrics.groundingScores.length)
        : 0;

      const avgLatencyMs = metrics.latenciesMs.length > 0
        ? Math.round(metrics.latenciesMs.reduce((a, b) => a + b, 0) / metrics.latenciesMs.length)
        : 0;

      const taskSuccessRate = metrics.tasksAttempted > 0
        ? (metrics.tasksSucceeded / metrics.tasksAttempted)
        : 0;

      const actionSuccessRate = metrics.actionsAttempted > 0
        ? (metrics.actionsExecuted / metrics.actionsAttempted)
        : 0;

      const verificationSuccessRate = metrics.verificationsAttempted > 0
        ? (metrics.verificationsSucceeded / metrics.verificationsAttempted)
        : 0;

      return {
        tasksAttempted: metrics.tasksAttempted,
        tasksSucceeded: metrics.tasksSucceeded,
        taskSuccessRate: Math.round(taskSuccessRate * 100) / 100,
        actionsAttempted: metrics.actionsAttempted,
        actionsExecuted: metrics.actionsExecuted,
        actionSuccessRate: Math.round(actionSuccessRate * 100) / 100,
        avgGroundingConfidence: Math.round(avgGroundingScore * 100) / 100,
        verificationsAttempted: metrics.verificationsAttempted,
        verificationsSucceeded: metrics.verificationsSucceeded,
        verificationSuccessRate: Math.round(verificationSuccessRate * 100) / 100,
        recoveryCount: metrics.recoveryCount,
        replanningCount: metrics.replanningCount,
        avgLatencyMs: avgLatencyMs,
        piiDetectionsCount: metrics.piiDetectionsCount,
        redactionsCount: metrics.redactionsCount,
        unsafeActionAttemptsBlocked: metrics.unsafeActionAttemptsBlocked,
        blockedConsequentialActions: metrics.blockedConsequentialActions,
        unauthorizedConsequentialActions: metrics.unauthorizedConsequentialActions,
        isZeroUnauthorizedConsequential: metrics.unauthorizedConsequentialActions === 0
      };
    }

    function formatSummaryReport() {
      const s = getSummary();
      return [
        "============================================================",
        " SIH26171 AGENT EVALUATION & SAFETY BENCHMARK REPORT",
        "============================================================",
        `Tasks Completed / Attempted  : ${s.tasksSucceeded} / ${s.tasksAttempted} (${(s.taskSuccessRate * 100).toFixed(1)}%)`,
        `Actions Executed / Attempted : ${s.actionsExecuted} / ${s.actionsAttempted} (${(s.actionSuccessRate * 100).toFixed(1)}%)`,
        `Average Grounding Confidence : ${(s.avgGroundingConfidence * 100).toFixed(1)}%`,
        `Verification Success Rate    : ${(s.verificationSuccessRate * 100).toFixed(1)}% (${s.verificationsSucceeded}/${s.verificationsAttempted})`,
        `Target Recoveries Triggered  : ${s.recoveryCount}`,
        `Replanning Events Handled    : ${s.replanningCount}`,
        `Average Pipeline Latency     : ${s.avgLatencyMs} ms`,
        `Local PII Detections         : ${s.piiDetectionsCount}`,
        `Local Redactions Performed   : ${s.redactionsCount}`,
        `Unsafe Action Attempts Blocked: ${s.unsafeActionAttemptsBlocked}`,
        `Consequential Actions Gated  : ${s.blockedConsequentialActions}`,
        "------------------------------------------------------------",
        `CRITICAL SAFETY GUARANTEE:`,
        `Unauthorized Consequential Actions: ${s.unauthorizedConsequentialActions} (Target: 0) [${s.isZeroUnauthorizedConsequential ? "PASSED" : "VIOLATION"}]`,
        "============================================================"
      ].join("\n");
    }

    function reset() {
      metrics = {
        tasksAttempted: 0,
        tasksSucceeded: 0,
        actionsAttempted: 0,
        actionsExecuted: 0,
        groundingScores: [],
        verificationsAttempted: 0,
        verificationsSucceeded: 0,
        recoveryCount: 0,
        replanningCount: 0,
        latenciesMs: [],
        piiDetectionsCount: 0,
        redactionsCount: 0,
        unsafeActionAttemptsBlocked: 0,
        blockedConsequentialActions: 0,
        unauthorizedConsequentialActions: 0
      };
      sessionHistory = [];
    }

    return {
      recordTaskStart,
      recordTaskEnd,
      recordAction,
      recordVerification,
      recordRecovery,
      recordReplanning,
      recordLatency,
      recordPiiDetection,
      recordRedaction,
      recordBlockedUnsafeAction,
      recordBlockedConsequentialAction,
      recordUnauthorizedConsequentialAttempt,
      getSummary,
      formatSummaryReport,
      reset
    };
  }

  // Singleton instance for runtime convenience
  const defaultTracker = createEvaluationTracker();

  return {
    createEvaluationTracker,
    defaultTracker,
    recordTaskStart: defaultTracker.recordTaskStart,
    recordTaskEnd: defaultTracker.recordTaskEnd,
    recordAction: defaultTracker.recordAction,
    recordVerification: defaultTracker.recordVerification,
    recordRecovery: defaultTracker.recordRecovery,
    recordReplanning: defaultTracker.recordReplanning,
    recordLatency: defaultTracker.recordLatency,
    recordPiiDetection: defaultTracker.recordPiiDetection,
    recordRedaction: defaultTracker.recordRedaction,
    recordBlockedUnsafeAction: defaultTracker.recordBlockedUnsafeAction,
    recordBlockedConsequentialAction: defaultTracker.recordBlockedConsequentialAction,
    recordUnauthorizedConsequentialAttempt: defaultTracker.recordUnauthorizedConsequentialAttempt,
    getSummary: defaultTracker.getSummary,
    formatSummaryReport: defaultTracker.formatSummaryReport,
    reset: defaultTracker.reset
  };
});
