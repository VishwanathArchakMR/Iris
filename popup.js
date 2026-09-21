/**
 * popup.js - Script for the extension popup
 * Milestones 1–12: Page metadata capture, local PII redaction, backend decision/execution,
 * local visual context (tab screenshot), local DOM perception, on-device SqueezeNet vision classification,
 * local perception fusion, local screenshot privacy redaction, and local OCR-based visual PII detection.
 * Milestone 13: Secure Sanitized Visual Agent Gateway (Task Input -> Privacy Pipeline -> Gateway -> Demo Agent -> Safe Execution).
 */

document.addEventListener("DOMContentLoaded", () => {
  // Existing Milestone 1-8 DOM elements
  const captureBtn = document.getElementById("captureBtn");
  const outputArea = document.getElementById("output");
  const sampleOutput = document.getElementById("sampleOutput");
  const backendOutput = document.getElementById("backendOutput");
  const decisionOutput = document.getElementById("decisionOutput");
  const executionOutput = document.getElementById("executionOutput");
  const visualStatus = document.getElementById("visualStatus");
  const screenshotPreview = document.getElementById("screenshotPreview");
  const elementsOutput = document.getElementById("elementsOutput");

  // Milestone 9 DOM elements for on-device Vision Classification
  const visionStatus = document.getElementById("visionStatus");
  const visionDetails = document.getElementById("visionDetails");
  const visionStatusText = document.getElementById("visionStatusText");
  const visionProvider = document.getElementById("visionProvider");
  const visionLatency = document.getElementById("visionLatency");
  const visionClassIndex = document.getElementById("visionClassIndex");
  const visionConfidence = document.getElementById("visionConfidence");
  const visionModelStatus = document.getElementById("visionModelStatus");
  const visionRuntime = document.getElementById("visionRuntime");
  const visionDetectionsCount = document.getElementById("visionDetectionsCount");
  const visionFusionStatus = document.getElementById("visionFusionStatus");
  const visionPageChangeStatus = document.getElementById("visionPageChangeStatus");

  // Milestone 11 & 12 DOM elements for Local Visual Privacy (Screenshot Redaction + OCR)
  const privacyStatus = document.getElementById("privacyStatus");
  const privacyDetails = document.getElementById("privacyDetails");
  const privacyOriginalStatus = document.getElementById("privacyOriginalStatus");
  const privacyOcrStatus = document.getElementById("privacyOcrStatus");
  const privacyRegionCount = document.getElementById("privacyRegionCount");
  const privacyOcrTextCount = document.getElementById("privacyOcrTextCount");
  const privacyOcrSensitiveCount = document.getElementById("privacyOcrSensitiveCount");
  const privacyTotalRedactedCount = document.getElementById("privacyTotalRedactedCount");
  const privacyRedactionStatus = document.getElementById("privacyRedactionStatus");
  const sanitizedScreenshotPreview = document.getElementById("sanitizedScreenshotPreview");

  // Milestone 10/11/12 DOM elements for Perception Fusion & Pipeline Timing
  const fusionStatus = document.getElementById("fusionStatus");
  const fusionDetails = document.getElementById("fusionDetails");
  const fusionElementCount = document.getElementById("fusionElementCount");
  const fusionVisionClass = document.getElementById("fusionVisionClass");
  const fusionSensitiveCount = document.getElementById("fusionSensitiveCount");
  const timingDom = document.getElementById("timingDom");
  const timingScreenshot = document.getElementById("timingScreenshot");
  const timingVision = document.getElementById("timingVision");
  const timingSensitive = document.getElementById("timingSensitive");
  const timingOcrInit = document.getElementById("timingOcrInit");
  const timingOcrInference = document.getElementById("timingOcrInference");
  const timingOcrDetection = document.getElementById("timingOcrDetection");
  const timingMerge = document.getElementById("timingMerge");
  const timingRedaction = document.getElementById("timingRedaction");
  const timingFusion = document.getElementById("timingFusion");
  const timingGateway = document.getElementById("timingGateway");

  // Milestone 13 & 14 DOM elements: Browser Agent Task Input & Status Panel
  const taskInput = document.getElementById("taskInput");
  const runAgentTaskBtn = document.getElementById("runAgentTaskBtn");
  const agentTaskText = document.getElementById("agentTaskText");
  const agentRequestId = document.getElementById("agentRequestId");
  const agentScreenshotStatus = document.getElementById("agentScreenshotStatus");
  const agentPrivacyStatus = document.getElementById("agentPrivacyStatus");
  const agentDomPiiCount = document.getElementById("agentDomPiiCount");
  const agentOcrPiiCount = document.getElementById("agentOcrPiiCount");
  const agentSensitiveCount = document.getElementById("agentSensitiveCount");
  const agentRedactionStatus = document.getElementById("agentRedactionStatus");
  const agentSanitizedStatus = document.getElementById("agentSanitizedStatus");
  const agentRawUploadStatus = document.getElementById("agentRawUploadStatus");
  const agentSanitizedUploadStatus = document.getElementById("agentSanitizedUploadStatus");
  const agentModeStatus = document.getElementById("agentModeStatus");
  const agentModeSubtext = document.getElementById("agentModeSubtext");
  const agentFallbackRow = document.getElementById("agentFallbackRow");
  const agentFallbackReasonText = document.getElementById("agentFallbackReasonText");
  const badgeGeminiReasoning = document.getElementById("badgeGeminiReasoning");
  const agentActionText = document.getElementById("agentActionText");
  const agentReasoningText = document.getElementById("agentReasoningText");
  const agentSafetyStatus = document.getElementById("agentSafetyStatus");
  const agentExecutionStatus = document.getElementById("agentExecutionStatus");
  const agentGatewayLatency = document.getElementById("agentGatewayLatency");

  // Milestone 14 DOM elements: Bounded Loop & Verification
  const agentStepText = document.getElementById("agentStepText");
  const agentVerificationText = document.getElementById("agentVerificationText");
  const agentTraceContainer = document.getElementById("agentTraceContainer");

  // Milestone 15 DOM elements: Generalized Grounding Telemetry
  const groundingMethodText = document.getElementById("groundingMethodText");
  const groundingScoreText = document.getElementById("groundingScoreText");
  const groundedElementText = document.getElementById("groundedElementText");

  // Milestone 16 DOM elements: FILL Telemetry & Privacy Indicator
  const fillStepStatus = document.getElementById("fillStepStatus");
  const fieldValuesPrivacyNotice = document.getElementById("fieldValuesPrivacyNotice");

  // Final Architecture: Local Reasoning & Safety Planner DOM Elements
  const plannerTaskUnderstanding = document.getElementById("plannerTaskUnderstanding");
  const plannerExecutionPlan = document.getElementById("plannerExecutionPlan");
  const plannerReasoningTrace = document.getElementById("plannerReasoningTrace");
  const plannerRiskBadge = document.getElementById("plannerRiskBadge");
  const plannerSafetyDecision = document.getElementById("plannerSafetyDecision");
  const plannerApprovalStatus = document.getElementById("plannerApprovalStatus");
  const popupApprovalContainer = document.getElementById("popupApprovalContainer");
  const popupApprovalAction = document.getElementById("popupApprovalAction");
  const popupApprovalReason = document.getElementById("popupApprovalReason");
  const popupBtnApprove = document.getElementById("popupBtnApprove");
  const popupBtnCancel = document.getElementById("popupBtnCancel");

  // SIH 2026 Presentation Layer Elements (Demo & Inspection Panel)
  const liveAgentStatusBadge = document.getElementById("liveAgentStatusBadge");
  const liveAgentStatusText = document.getElementById("liveAgentStatusText");
  const viewModeToggleBtn = document.getElementById("viewModeToggleBtn");
  const pipelineStepCounter = document.getElementById("pipelineStepCounter");
  const stagePerception = document.getElementById("stagePerception");
  const stagePerceptionStatus = document.getElementById("stagePerceptionStatus");
  const stageReasoning = document.getElementById("stageReasoning");
  const stageReasoningStatus = document.getElementById("stageReasoningStatus");
  const stageGrounding = document.getElementById("stageGrounding");
  const stageGroundingStatus = document.getElementById("stageGroundingStatus");
  const stageSafety = document.getElementById("stageSafety");
  const stageSafetyStatus = document.getElementById("stageSafetyStatus");
  const stageExecution = document.getElementById("stageExecution");
  const stageExecutionStatus = document.getElementById("stageExecutionStatus");
  const stageVerification = document.getElementById("stageVerification");
  const stageVerificationStatus = document.getElementById("stageVerificationStatus");

  // Current Action Card elements
  const currentActionStepBadge = document.getElementById("currentActionStepBadge");
  const cardActionType = document.getElementById("cardActionType");
  const cardActionTarget = document.getElementById("cardActionTarget");
  const cardActionValue = document.getElementById("cardActionValue");
  const cardActionGrounding = document.getElementById("cardActionGrounding");
  const cardActionRisk = document.getElementById("cardActionRisk");
  const cardActionSafety = document.getElementById("cardActionSafety");
  const cardActionStatus = document.getElementById("cardActionStatus");

  // Grounding / Element Inspection elements
  const inspectGroundingConfidenceBadge = document.getElementById("inspectGroundingConfidenceBadge");
  const inspectElementLabel = document.getElementById("inspectElementLabel");
  const inspectElementType = document.getElementById("inspectElementType");
  const inspectTargetIndex = document.getElementById("inspectTargetIndex");
  const inspectGroundingMethod = document.getElementById("inspectGroundingMethod");
  const inspectBoundingBox = document.getElementById("inspectBoundingBox");
  const inspectGroundingReason = document.getElementById("inspectGroundingReason");

  // Perception Preview metadata chips & canvas
  const previewScreenshotStatus = document.getElementById("previewScreenshotStatus");
  const previewDomCount = document.getElementById("previewDomCount");
  const previewSensitiveCount = document.getElementById("previewSensitiveCount");
  const previewRedactionStatus = document.getElementById("previewRedactionStatus");
  const perceptionCanvasOverlay = document.getElementById("perceptionCanvasOverlay");
  const traceStepCount = document.getElementById("traceStepCount");

  // Task 4: Hands-Free Voice Command
  const voiceCommandBtn = document.getElementById("voiceCommandBtn");
  const voiceStatusIndicator = document.getElementById("voiceStatusIndicator");

  // Task 5: Security Telemetry / Packet Inspection Panel
  const packetInspectionCard = document.getElementById("packetInspectionCard");
  const packetInspectionHeader = document.getElementById("packetInspectionHeader");
  const togglePacketInspectionBtn = document.getElementById("togglePacketInspectionBtn");
  const packetInspectionContent = document.getElementById("packetInspectionContent");
  const packetLocalCount = document.getElementById("packetLocalCount");
  const packetLocalElementsList = document.getElementById("packetLocalElementsList");
  const packetPayloadSize = document.getElementById("packetPayloadSize");
  const packetOutboundPayload = document.getElementById("packetOutboundPayload");
  const packetInspectionAuditStatus = document.getElementById("packetInspectionAuditStatus");

  // ReAct Task Planner & Live Chain-of-Thought
  const reactLiveThoughtText = document.getElementById("reactLiveThoughtText");
  const reactActivePlanChecklist = document.getElementById("reactActivePlanChecklist");
  const reactPlanStepCountBadge = document.getElementById("reactPlanStepCountBadge");

  // Toggle Demonstration Mode vs Detailed Diagnostics View
  if (viewModeToggleBtn) {
    viewModeToggleBtn.addEventListener("click", () => {
      const isDemo = document.body.classList.contains("mode-demo");
      if (isDemo) {
        document.body.classList.remove("mode-demo");
        viewModeToggleBtn.textContent = "Demo View";
        viewModeToggleBtn.title = "Switch back to Stage Demonstration View";
      } else {
        document.body.classList.add("mode-demo");
        viewModeToggleBtn.textContent = "Detailed View";
        viewModeToggleBtn.title = "Show Deep Diagnostic Telemetry";
      }
    });
  }

  const setLiveAgentStatus = (statusCategory, label) => {
    if (!liveAgentStatusBadge || !liveAgentStatusText) return;
    liveAgentStatusBadge.className = "live-status-badge " + (
      statusCategory === "active" ? "status-active" :
        statusCategory === "ready" ? "status-ready" :
          statusCategory === "warning" ? "status-warning" : "status-error"
    );
    liveAgentStatusText.textContent = label;
  };

  const updatePipelineStage = (stageName, state, statusText) => {
    const stageMap = {
      PERCEPTION: { el: stagePerception, textEl: stagePerceptionStatus },
      REASONING: { el: stageReasoning, textEl: stageReasoningStatus },
      GROUNDING: { el: stageGrounding, textEl: stageGroundingStatus },
      SAFETY: { el: stageSafety, textEl: stageSafetyStatus },
      EXECUTION: { el: stageExecution, textEl: stageExecutionStatus },
      VERIFICATION: { el: stageVerification, textEl: stageVerificationStatus }
    };
    const target = stageMap[stageName];
    if (!target || !target.el) return;
    target.el.className = `pipeline-stage ${state}`;
    if (target.textEl && statusText) {
      target.textEl.textContent = statusText;
    }
  };

  const resetPipelineUI = () => {
    ["PERCEPTION", "REASONING", "GROUNDING", "SAFETY", "EXECUTION", "VERIFICATION"].forEach((s) => {
      updatePipelineStage(s, "pending", "Pending");
    });
    clearBoundingBoxOnPreview();
  };

  const updateCurrentActionCard = (data) => {
    if (currentActionStepBadge && data.stepText) {
      currentActionStepBadge.textContent = data.stepText;
    }
    if (cardActionType) {
      const act = (data.action || "NONE").toUpperCase();
      cardActionType.textContent = act;
      cardActionType.className = `action-badge ${act === "FILL" ? "badge-action-fill" :
          act === "CLICK" ? "badge-action-click" :
            act === "SUBMIT" ? "badge-action-submit" : "badge-action-none"
        }`;
    }
    if (cardActionTarget) cardActionTarget.textContent = data.target || "(None)";
    if (cardActionValue) cardActionValue.textContent = data.value ? `'${data.value}'` : "-";
    if (cardActionGrounding) cardActionGrounding.textContent = data.grounding || "-";
    if (cardActionRisk) {
      cardActionRisk.textContent = data.risk || "LOW";
      const isHigh = data.risk === "HIGH" || data.risk === "CRITICAL";
      cardActionRisk.style.background = isHigh ? "#fee2e2" : (data.risk === "MEDIUM" ? "#fef3c7" : "#e0e7ff");
      cardActionRisk.style.color = isHigh ? "#b91c1c" : (data.risk === "MEDIUM" ? "#b45309" : "#3730a3");
    }
    if (cardActionSafety) {
      cardActionSafety.textContent = data.safety || "ALLOWED";
      cardActionSafety.style.color = (data.safety && data.safety.includes("BLOCKED")) ? "#dc2626" : "#15803d";
    }
    if (cardActionStatus) {
      cardActionStatus.textContent = data.status || "Ready to execute";
      cardActionStatus.style.color = (data.status && data.status.includes("VERIFIED")) ? "#15803d" : "#0f172a";
    }
  };

  const updateGroundingInspection = (data) => {
    if (inspectElementLabel) inspectElementLabel.textContent = data.element || "None";
    if (inspectElementType) inspectElementType.textContent = `${data.role || "element"} (${data.type || "unknown"})`;
    if (inspectTargetIndex) inspectTargetIndex.textContent = data.index !== undefined ? `#${data.index}` : "-";
    if (inspectGroundingMethod) inspectGroundingMethod.textContent = data.method || "-";
    if (inspectGroundingConfidenceBadge) {
      inspectGroundingConfidenceBadge.textContent = data.score !== undefined ? `Conf: ${Number(data.score).toFixed(2)}` : "Conf: -";
    }
    if (inspectBoundingBox) {
      if (data.bbox && typeof data.bbox.x === "number") {
        inspectBoundingBox.textContent = `[x: ${Math.round(data.bbox.x)}, y: ${Math.round(data.bbox.y)}, w: ${Math.round(data.bbox.width)}, h: ${Math.round(data.bbox.height)}]`;
      } else {
        inspectBoundingBox.textContent = "[x: -, y: -, w: -, h: -]";
      }
    }
    if (inspectGroundingReason) inspectGroundingReason.textContent = data.reason || "Target grounded via local perception pipeline";
  };

  const clearBoundingBoxOnPreview = () => {
    if (!perceptionCanvasOverlay) return;
    const ctx = perceptionCanvasOverlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, perceptionCanvasOverlay.width, perceptionCanvasOverlay.height);
    perceptionCanvasOverlay.style.display = "none";
  };

  const drawBoundingBoxOnPreview = (bbox, label = "") => {
    if (!perceptionCanvasOverlay || !screenshotPreview || !bbox || typeof bbox.x !== "number") {
      clearBoundingBoxOnPreview();
      return;
    }
    try {
      perceptionCanvasOverlay.width = screenshotPreview.clientWidth || 320;
      perceptionCanvasOverlay.height = screenshotPreview.clientHeight || 160;
      perceptionCanvasOverlay.style.display = "block";
      const ctx = perceptionCanvasOverlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, perceptionCanvasOverlay.width, perceptionCanvasOverlay.height);

      const origW = (latestScreenshotDims && latestScreenshotDims.width) ? latestScreenshotDims.width : (screenshotPreview.naturalWidth || 1);
      const origH = (latestScreenshotDims && latestScreenshotDims.height) ? latestScreenshotDims.height : (screenshotPreview.naturalHeight || 1);
      const scaleX = perceptionCanvasOverlay.width / origW;
      const scaleY = perceptionCanvasOverlay.height / origH;

      const bx = bbox.x * scaleX;
      const by = bbox.y * scaleY;
      const bw = Math.max(bbox.width * scaleX, 10);
      const bh = Math.max(bbox.height * scaleY, 8);

      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bw, bh);

      if (label) {
        ctx.font = "bold 9px sans-serif";
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = "#0e7490";
        ctx.fillRect(bx, Math.max(by - 14, 0), textW + 6, 13);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, bx + 3, Math.max(by - 4, 9));
      }
    } catch (e) {
      console.warn("Canvas overlay drawing error:", e);
    }
  };

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Task 4: Web Speech API Speech Recognition Initialization
   */
  function initSpeechRecognition(onResultCallback) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this Chromium build.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      const isFinal = Boolean(event.results[0] && event.results[0].isFinal);
      onResultCallback(transcript, isFinal);
    };

    return recognition;
  }

  // Voice Command Event Wiring
  let voiceRecognition = null;
  let isRecordingVoice = false;

  if (voiceCommandBtn) {
    voiceCommandBtn.addEventListener("click", () => {
      if (isRecordingVoice && voiceRecognition) {
        voiceRecognition.stop();
        return;
      }

      if (!voiceRecognition) {
        voiceRecognition = initSpeechRecognition((transcript, isFinal) => {
          if (taskInput) {
            taskInput.value = transcript;
          }
          if (isFinal) {
            if (voiceStatusIndicator) voiceStatusIndicator.style.display = "none";
            voiceCommandBtn.classList.remove("recording");
            isRecordingVoice = false;
            // Automatically submit task on final speech result
            if (runAgentTaskBtn) {
              runAgentTaskBtn.click();
            }
          }
        });

        if (voiceRecognition) {
          voiceRecognition.onstart = () => {
            isRecordingVoice = true;
            if (voiceCommandBtn) voiceCommandBtn.classList.add("recording");
            if (voiceStatusIndicator) voiceStatusIndicator.style.display = "inline-flex";
          };
          voiceRecognition.onend = () => {
            isRecordingVoice = false;
            if (voiceCommandBtn) voiceCommandBtn.classList.remove("recording");
            if (voiceStatusIndicator) voiceStatusIndicator.style.display = "none";
          };
          voiceRecognition.onerror = (e) => {
            const errType = (e && e.error) ? e.error : "speech-event";
            if (errType !== "no-speech" && errType !== "aborted") {
              console.log("[SIH26171] Voice recognition status:", errType);
            }
            isRecordingVoice = false;
            if (voiceCommandBtn) voiceCommandBtn.classList.remove("recording");
            if (voiceStatusIndicator) voiceStatusIndicator.style.display = "none";
          };
        }
      }

      if (voiceRecognition) {
        try {
          voiceRecognition.start();
        } catch (err) {
          console.warn("[SIH26171] Failed to start voice recognition:", err);
        }
      } else {
        alert("Web Speech API is not supported in this browser or extension context.");
      }
    });
  }

  /**
   * Task 5: Live Security Telemetry / Packet Inspection View
   */
  const togglePacketInspection = () => {
    if (!packetInspectionContent) return;
    const isHidden = packetInspectionContent.style.display === "none" || !packetInspectionContent.style.display;
    packetInspectionContent.style.display = isHidden ? "block" : "none";
    if (togglePacketInspectionBtn) {
      togglePacketInspectionBtn.textContent = isHidden ? "Hide" : "Show";
    }
  };

  if (togglePacketInspectionBtn) {
    togglePacketInspectionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePacketInspection();
    });
  }
  if (packetInspectionHeader) {
    packetInspectionHeader.addEventListener("click", () => {
      togglePacketInspection();
    });
  }

  function updatePacketInspectionTelemetry(localElements, outboundPayload) {
    if (packetLocalCount) {
      packetLocalCount.textContent = `${(localElements || []).length} elements`;
    }
    if (packetLocalElementsList) {
      if (localElements && localElements.length > 0) {
        packetLocalElementsList.innerHTML = localElements.slice(0, 15).map((el, i) => {
          const type = (el.type || el.tagName || "ELEMENT").toUpperCase();
          const label = el.label || el.ariaLabel || el.placeholder || el.name || "(unlabeled)";
          const isSens = el.isSensitive ? `<span style="color:#dc2626;font-weight:700;">[SENSITIVE]</span> ` : "";
          return `<div style="padding:1px 0; border-bottom:1px solid #f1f5f9;">
            ${isSens}<span style="color:#0f766e;font-weight:600;">${i + 1}.${type}</span>: ${escapeHtml(label)}
          </div>`;
        }).join("") + (localElements.length > 15 ? `<div style="color:#64748b;font-style:italic;">+${localElements.length - 15} more...</div>` : "");
      } else {
        packetLocalElementsList.innerHTML = '<div style="color:#94a3b8;font-style:italic;">No elements detected yet.</div>';
      }
    }

    if (packetOutboundPayload) {
      if (outboundPayload) {
        let jsonStr = typeof outboundPayload === "string" ? outboundPayload : JSON.stringify(outboundPayload, null, 2);
        if (packetPayloadSize) {
          const sizeKb = (new Blob([jsonStr]).size / 1024).toFixed(2);
          packetPayloadSize.textContent = `${sizeKb} KB`;
        }
        // Highlight masked attributes like [REDACTED_...], [MASKED_...], [FILTERED]
        const highlighted = escapeHtml(jsonStr).replace(/(&quot;value&quot;:\s*&quot;(\[REDACTED_[^&]+\]|\[MASKED_[^&]+\])&quot;|\[REDACTED_[^&]+\]|\[MASKED_[^&]+\])/g, '<span class="masked-attr-highlight">$1</span>');
        packetOutboundPayload.innerHTML = highlighted;
      } else {
        packetOutboundPayload.innerHTML = '<span style="color:#94a3b8;font-style:italic;">No payload sent yet.</span>';
        if (packetPayloadSize) packetPayloadSize.textContent = "0 KB";
      }
    }
  }

  /**
   * Task 1: Fetch Zero-Shot High-Level Execution Plan from Backend
   */
  const fetchZeroShotPlan = async (userPrompt) => {
    try {
      const res = await fetch("http://localhost:8000/api/plan-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: userPrompt })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.plan) && data.plan.length > 0) {
          return data.plan;
        }
      }
    } catch (e) {
      console.warn("[ZERO-SHOT PLANNER] Network call failed, using local planner:", e);
    }
    // Fallback: Local deterministic planner
    if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.planTask === "function") {
      let parsed = window.SIHTaskParser ? window.SIHTaskParser.parseTask(userPrompt) : null;
      let localPlan = window.SIHReasoningPlanner.planTask(parsed, { title: document.title, url: window.location.href });
      if (localPlan && Array.isArray(localPlan.steps) && localPlan.steps.length > 0) {
        return localPlan.steps.map((st, i) => `${i + 1}. ${st.type} -> ${st.target || st.fieldHint || "target"}`);
      }
    }
    return [
      `1. Locate interactive target for: ${userPrompt}`,
      `2. Execute action for: ${userPrompt}`,
      `3. Verify final page state`
    ];
  };

  /**
   * Task 4: Render Active Plan Checklist with Live Progress
   */
  let currentActivePlan = [];
  const renderActivePlanChecklist = (planSteps, currentStepIdx = 0) => {
    currentActivePlan = planSteps || [];
    if (!reactActivePlanChecklist) return;
    if (reactPlanStepCountBadge) {
      reactPlanStepCountBadge.textContent = `${currentActivePlan.length} Steps Planned`;
    }
    if (!currentActivePlan || currentActivePlan.length === 0) {
      reactActivePlanChecklist.innerHTML = '<div style="color:#94a3b8;font-style:italic;">No active plan yet.</div>';
      return;
    }

    reactActivePlanChecklist.innerHTML = currentActivePlan.map((stepText, idx) => {
      let icon = "⏳";
      let color = "#64748b";
      let weight = "normal";
      let bg = "transparent";

      if (idx < currentStepIdx) {
        icon = "✓";
        color = "#16a34a";
        weight = "600";
      } else if (idx === currentStepIdx) {
        icon = "➔";
        color = "#4f46e5";
        weight = "700";
        bg = "#e0e7ff";
      }

      return `<div style="padding: 2px 4px; border-radius: 4px; background: ${bg}; color: ${color}; font-weight: ${weight}; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
        <span>${icon}</span>
        <span>${escapeHtml(stepText)}</span>
      </div>`;
    }).join("");
  };

  /**
   * Task 4: Render Live Agent Thought (Internal Monologue)
   */
  const setLiveAgentThought = (thoughtText) => {
    if (!reactLiveThoughtText) return;
    reactLiveThoughtText.textContent = thoughtText ? `"${thoughtText}"` : "Evaluating perceived screen state...";
  };

  // Milestone 18: Live Explainable Agent Overlay Telemetry Helper
  const sendOverlayTelemetry = (tabId, message) => {
    if (!tabId || typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.sendMessage) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (resp) => {
          if (chrome.runtime.lastError) {
            // Suppress connection error if tab is navigating or script not yet injected
          }
          resolve(resp || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  };

  // Milestone 14 & 16 Constants (Bounded Loop with safe ceiling)
  const MAX_AGENT_STEPS = 10;
  const PIXEL_CHANGE_THRESHOLD = 30;
  const ACTION_VERIFICATION_DELAY_MS = 600;

  // Milestone 13 Cross-Website Robustness: Explicit Agent Execution States
  const AGENT_STATES = Object.freeze({
    PERCEIVE: "PERCEIVE",
    PLAN: "PLAN",
    GROUND: "GROUND",
    SAFETY: "SAFETY",
    EXECUTE: "EXECUTE",
    WAIT: "WAIT",
    REPERCEIVE: "REPERCEIVE",
    VERIFY: "VERIFY",
    CONTINUE: "CONTINUE",
    COMPLETE: "COMPLETE"
  });

  let currentAgentState = AGENT_STATES.PERCEIVE;
  const setAgentState = (newState, detail = "") => {
    currentAgentState = newState;
    console.log(`[AGENT STATE] -> ${newState}${detail ? " : " + detail : ""}`);
    if (agentExecutionStatus && detail) {
      agentExecutionStatus.textContent = `[${newState}] ${detail}`;
    }

    // Dynamic Visual Pipeline & Live Status Synchronization
    if (newState === AGENT_STATES.PERCEIVE || newState === AGENT_STATES.REPERCEIVE) {
      setLiveAgentStatus("active", "PERCEIVING");
      updatePipelineStage("PERCEPTION", "active", "Scanning DOM + OCR");
    } else if (newState === AGENT_STATES.PLAN) {
      setLiveAgentStatus("active", "REASONING");
      updatePipelineStage("PERCEPTION", "completed", "Perception fused ✓");
      updatePipelineStage("REASONING", "active", "Planning actions");
    } else if (newState === AGENT_STATES.GROUND) {
      setLiveAgentStatus("active", "GROUNDING");
      updatePipelineStage("REASONING", "completed", "Plan ready ✓");
      updatePipelineStage("GROUNDING", "active", "Matching element");
    } else if (newState === AGENT_STATES.SAFETY) {
      setLiveAgentStatus("active", "SAFETY CHECK");
      updatePipelineStage("GROUNDING", "completed", "Grounded ✓");
      updatePipelineStage("SAFETY", "active", "Validating allowlist");
    } else if (newState === AGENT_STATES.EXECUTE) {
      setLiveAgentStatus("active", "EXECUTING");
      updatePipelineStage("SAFETY", "completed", "Safety passed ✓");
      updatePipelineStage("EXECUTION", "active", "Executing action");
    } else if (newState === AGENT_STATES.WAIT) {
      setLiveAgentStatus("active", "WAITING");
      updatePipelineStage("EXECUTION", "completed", "Executed ✓");
    } else if (newState === AGENT_STATES.VERIFY) {
      setLiveAgentStatus("active", "VERIFYING");
      updatePipelineStage("VERIFICATION", "active", "Comparing screen");
    } else if (newState === AGENT_STATES.COMPLETE) {
      setLiveAgentStatus("ready", "COMPLETED");
      updatePipelineStage("VERIFICATION", "completed", "Verified ✓");
    }
  };

  // Milestone 14 Module-Level Loop & Trace State
  let previousScreenSignature = null;
  let executionTraceHistory = [];

  // State cache for current capture pass
  let latestScreenshotDataUrl = null;
  let latestScreenshotDims = { width: 0, height: 0 };
  let latestVisualElements = null;
  let latestSensitiveRegions = null;
  let latestOcrSensitiveRegions = [];
  let latestOcrWordCount = 0;
  let latestMergedRegions = null;
  let latestVisionResult = null;
  let latestFusedElements = null;
  let lastScreenSignature = null;
  let latestSanitizedDataUrl = null;
  let latestPageData = null;
  let ocrCompleted = false;
  let redactionCompleted = false;
  let redactionError = null;

  // Listeners waiting for privacy redaction pass to conclude
  let onRedactionCompleteCallbacks = [];

  const timing = {
    domExtractionMs: null,
    screenshotMs: null,
    visionInferenceMs: null,
    sensitiveRegionDetectionMs: null,
    ocrInitMs: null,
    ocrInferenceMs: null,
    ocrSensitiveDetectionMs: null,
    regionMergeMs: null,
    redactionMs: null,
    fusionMs: null,
    gatewayMs: null
  };

  // Helper to notify any waiting promises when redaction finishes
  const notifyRedactionDone = (result) => {
    const cbs = [...onRedactionCompleteCallbacks];
    onRedactionCompleteCallbacks = [];
    cbs.forEach((cb) => {
      try { cb(result); } catch (e) { console.error("Redaction callback error:", e); }
    });
  };

  // Promise hook to await completion of the local redaction pipeline
  const waitForRedaction = () => {
    if (redactionCompleted) {
      return Promise.resolve({
        success: !!latestSanitizedDataUrl,
        sanitizedScreenshotDataUrl: latestSanitizedDataUrl,
        error: redactionError
      });
    }
    return new Promise((resolve) => {
      onRedactionCompleteCallbacks.push(resolve);
    });
  };

  // Helper function to scale screenshot to 224x224 ImageData (Milestone 9)
  // Security Note: All resizing and vision inference is client-side only (never transmitted).
  const resizeScreenshotTo224 = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 224;
          canvas.height = 224;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 224, 224);
          const imageData = ctx.getImageData(0, 0, 224, 224);
          resolve(imageData);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load screenshot image for scaling"));
      };
      img.src = dataUrl;
    });
  };

  // Helper to render the fused perception summary and timing telemetry (Milestones 10, 11, 12, 13)
  const renderPerceptionSummary = () => {
    if (!fusionStatus || !fusionDetails) return;

    const t0 = performance.now();
    let fused = null;
    if (window.SIHFusion && typeof window.SIHFusion.buildLocalPerception === "function") {
      fused = window.SIHFusion.buildLocalPerception(
        latestVisualElements,
        latestVisionResult,
        timing,
        latestSensitiveRegions ? latestSensitiveRegions.length : 0,
        {
          ocrTextRegionCount: latestOcrWordCount,
          ocrSensitiveRegionCount: latestOcrSensitiveRegions.length,
          totalRedactedRegionCount: latestMergedRegions ? latestMergedRegions.length : 0
        }
      );
    }
    const t1 = performance.now();
    timing.fusionMs = Math.round(t1 - t0);

    // Update timing metrics
    if (timingDom) timingDom.textContent = timing.domExtractionMs !== null ? `${timing.domExtractionMs} ms` : "-";
    if (timingScreenshot) timingScreenshot.textContent = timing.screenshotMs !== null ? `${timing.screenshotMs} ms` : "-";
    if (timingVision) timingVision.textContent = timing.visionInferenceMs !== null ? `${timing.visionInferenceMs} ms` : "-";
    if (timingSensitive) timingSensitive.textContent = timing.sensitiveRegionDetectionMs !== null ? `${timing.sensitiveRegionDetectionMs} ms` : "-";
    if (timingOcrInit) timingOcrInit.textContent = timing.ocrInitMs !== null ? `${timing.ocrInitMs} ms` : "-";
    if (timingOcrInference) timingOcrInference.textContent = timing.ocrInferenceMs !== null ? `${timing.ocrInferenceMs} ms` : "-";
    if (timingOcrDetection) timingOcrDetection.textContent = timing.ocrSensitiveDetectionMs !== null ? `${timing.ocrSensitiveDetectionMs} ms` : "-";
    if (timingMerge) timingMerge.textContent = timing.regionMergeMs !== null ? `${timing.regionMergeMs} ms` : "-";
    if (timingRedaction) timingRedaction.textContent = timing.redactionMs !== null ? `${timing.redactionMs} ms` : "-";
    if (timingFusion) timingFusion.textContent = timing.fusionMs !== null ? `${timing.fusionMs} ms` : "-";
    if (timingGateway) timingGateway.textContent = timing.gatewayMs !== null ? `${timing.gatewayMs} ms` : "-";

    // Update fusion summary counts
    if (fused && Array.isArray(fused.fusedElements)) {
      latestFusedElements = fused.fusedElements;
    } else {
      latestFusedElements = latestVisualElements;
    }

    if (visionFusionStatus) {
      visionFusionStatus.textContent = (latestFusedElements && latestFusedElements.some(e => e.isVisualConfirmed)) ? "ACTIVE" : "DOM ACTIVE";
    }

    if (fusionElementCount) {
      fusionElementCount.textContent = latestVisualElements ? latestVisualElements.length : "-";
    }
    if (fusionVisionClass) {
      if (latestVisionResult && typeof latestVisionResult.classIndex === "number") {
        fusionVisionClass.textContent = `Class ${latestVisionResult.classIndex} (${(latestVisionResult.confidence * 100).toFixed(1)}%)`;
      } else {
        fusionVisionClass.textContent = "Pending / None";
      }
    }
    if (fusionSensitiveCount) {
      const count = latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0);
      fusionSensitiveCount.textContent = count;
    }

    if (previewDomCount) previewDomCount.textContent = `${latestVisualElements ? latestVisualElements.length : 0} elements`;
    if (previewSensitiveCount) previewSensitiveCount.textContent = String(latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0));
    if (previewRedactionStatus) previewRedactionStatus.textContent = latestSanitizedDataUrl ? "ACTIVE" : "PENDING";

    fusionStatus.textContent = "Local perception fused (on-device only)";
    fusionStatus.style.color = "#2e7d32";
    fusionDetails.style.display = "block";

    // Update telemetry panel with detected local elements
    updatePacketInspectionTelemetry(latestVisualElements, null);
  };

  // Helper function to execute local privacy redaction on the merged (DOM + OCR) regions (Milestones 11 & 12)
  // Fail-closed guarantee: Never displays or falls back to raw screenshot if final redaction throws/fails.
  const triggerRedaction = async () => {
    if (redactionCompleted || !latestScreenshotDataUrl || !latestSensitiveRegions || !ocrCompleted) {
      return;
    }
    redactionCompleted = true;

    if (privacyStatus) {
      privacyStatus.textContent = "Merging regions and redacting sensitive canvas areas...";
      privacyStatus.style.color = "#1565c0";
    }

    try {
      if (!window.SIHRedactor || typeof window.SIHRedactor.buildSanitizedScreenshot !== "function") {
        throw new Error("SIHRedactor module not loaded");
      }

      // Step 5: Region merging (DOM + OCR)
      const tMerge0 = performance.now();
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      let mergedRegions = [];

      if (typeof window.SIHRedactor.mergeSensitiveRegions === "function") {
        mergedRegions = window.SIHRedactor.mergeSensitiveRegions(
          latestSensitiveRegions,
          latestOcrSensitiveRegions,
          latestScreenshotDims.width,
          latestScreenshotDims.height,
          dpr
        );
      } else {
        // Fallback to DOM regions if merge function is absent
        mergedRegions = latestSensitiveRegions;
      }
      timing.regionMergeMs = Math.round(performance.now() - tMerge0);
      latestMergedRegions = mergedRegions;

      // Step 5.2: Build sanitized screenshot canvas copy
      const tRedact0 = performance.now();
      const redactionResult = await window.SIHRedactor.buildSanitizedScreenshot(
        latestScreenshotDataUrl,
        mergedRegions
      );
      timing.redactionMs = Math.round(performance.now() - tRedact0);

      if (redactionResult && redactionResult.success && redactionResult.sanitizedScreenshotDataUrl) {
        latestSanitizedDataUrl = redactionResult.sanitizedScreenshotDataUrl;
        redactionError = null;

        if (privacyStatus) {
          privacyStatus.textContent = "Local visual privacy redaction active";
          privacyStatus.style.color = "#2e7d32";
        }

        if (privacyOriginalStatus) privacyOriginalStatus.textContent = "CAPTURED LOCALLY";
        if (privacyOcrStatus) privacyOcrStatus.textContent = "ON DEVICE (WASM)";
        if (privacyRegionCount) privacyRegionCount.textContent = latestSensitiveRegions.length;
        if (privacyOcrTextCount) privacyOcrTextCount.textContent = latestOcrWordCount;
        if (privacyOcrSensitiveCount) privacyOcrSensitiveCount.textContent = latestOcrSensitiveRegions.length;
        if (privacyTotalRedactedCount) privacyTotalRedactedCount.textContent = mergedRegions.length;

        if (privacyRedactionStatus) {
          privacyRedactionStatus.textContent = "ACTIVE";
          privacyRedactionStatus.style.color = "#2e7d32";
        }
        if (sanitizedScreenshotPreview) {
          sanitizedScreenshotPreview.src = redactionResult.sanitizedScreenshotDataUrl;
          sanitizedScreenshotPreview.style.display = "block";
        }
        if (privacyDetails) privacyDetails.style.display = "block";

        notifyRedactionDone({
          success: true,
          sanitizedScreenshotDataUrl: latestSanitizedDataUrl
        });
      } else {
        // Fail-closed handling: Never fall back to raw screenshot
        throw new Error(redactionResult?.error || "Redaction returned empty output");
      }
    } catch (err) {
      latestSanitizedDataUrl = null;
      redactionError = err.message || String(err);
      console.error("Local screenshot redaction error:", err);

      if (privacyStatus) {
        privacyStatus.textContent = `Redaction failed: ${err.message || err}`;
        privacyStatus.style.color = "#c62828";
      }

      if (privacyOriginalStatus) privacyOriginalStatus.textContent = "CAPTURED LOCALLY";
      if (privacyOcrStatus) privacyOcrStatus.textContent = "ON DEVICE (WASM)";
      if (privacyRegionCount) privacyRegionCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
      if (privacyOcrTextCount) privacyOcrTextCount.textContent = latestOcrWordCount;
      if (privacyOcrSensitiveCount) privacyOcrSensitiveCount.textContent = latestOcrSensitiveRegions.length;
      if (privacyTotalRedactedCount) privacyTotalRedactedCount.textContent = 0;

      if (privacyRedactionStatus) {
        privacyRedactionStatus.textContent = "FAILED — sanitized screenshot withheld";
        privacyRedactionStatus.style.color = "#c62828";
      }
      if (sanitizedScreenshotPreview) {
        sanitizedScreenshotPreview.style.display = "none";
        sanitizedScreenshotPreview.src = "";
      }
      if (privacyDetails) privacyDetails.style.display = "block";

      notifyRedactionDone({
        success: false,
        sanitizedScreenshotDataUrl: null,
        error: redactionError
      });
    }

    renderPerceptionSummary();
  };

  // Helper function to run on-device OCR pipeline (Milestone 12)
  // Non-blocking: OCR failure gracefully falls back to DOM-only redaction
  const triggerOcrPipeline = async (dataUrl) => {
    ocrCompleted = false;
    latestOcrSensitiveRegions = [];
    latestOcrWordCount = 0;

    try {
      if (!window.SIHOCR || typeof window.SIHOCR.runOcr !== "function") {
        throw new Error("SIHOCR module not loaded");
      }

      const ocrResult = await window.SIHOCR.runOcr(dataUrl);

      if (ocrResult && ocrResult.success) {
        timing.ocrInitMs = ocrResult.initTimeMs;
        timing.ocrInferenceMs = ocrResult.inferenceTimeMs;
        latestOcrWordCount = (ocrResult.words || []).length;

        if (ocrResult.screenshotDimensions) {
          latestScreenshotDims = ocrResult.screenshotDimensions;
        }

        // Detect sensitive regions using M2's regex patterns
        const tDet0 = performance.now();
        if (typeof window.SIHOCR.detectSensitiveOcrRegions === "function") {
          latestOcrSensitiveRegions = window.SIHOCR.detectSensitiveOcrRegions(ocrResult);
        }
        timing.ocrSensitiveDetectionMs = Math.round(performance.now() - tDet0);
      } else {
        console.warn("OCR recognition notice:", ocrResult?.reason || "No OCR output");
        timing.ocrInitMs = ocrResult?.initTimeMs || 0;
        timing.ocrInferenceMs = ocrResult?.inferenceTimeMs || 0;
        timing.ocrSensitiveDetectionMs = 0;
      }
    } catch (ocrErr) {
      console.warn("OCR pipeline notice (falling back to DOM-only redaction):", ocrErr);
      timing.ocrInitMs = timing.ocrInitMs || 0;
      timing.ocrInferenceMs = 0;
      timing.ocrSensitiveDetectionMs = 0;
    } finally {
      ocrCompleted = true;
      // Trigger redaction once OCR settles (whether OCR succeeded or fell back)
      triggerRedaction();
    }
  };

  // Helper function to run on-device SqueezeNet vision classification (Milestone 9)
  const triggerVisionClassification = async (dataUrl) => {
    if (!visionStatus) return;

    visionStatus.textContent = "Running on-device visual perception (ONNX Runtime Web)...";
    visionStatus.style.color = "#1565c0";
    if (visionDetails) visionDetails.style.display = "none";

    try {
      if (!window.SIHVision || typeof window.SIHVision.runVisionInference !== "function") {
        throw new Error("SIHVision model runtime not loaded");
      }

      const resizedImageData = await resizeScreenshotTo224(dataUrl);

      const t0 = performance.now();
      const result = await window.SIHVision.runVisionInference(resizedImageData);
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      timing.visionInferenceMs = latencyMs;
      latestVisionResult = result;

      visionStatus.textContent = "Vision inference completed (on-device)";
      visionStatus.style.color = "#2e7d32";

      if (visionModelStatus) {
        visionModelStatus.textContent = "READY";
        visionModelStatus.style.background = "#e0f2fe";
        visionModelStatus.style.color = "#0369a1";
      }
      if (visionRuntime) visionRuntime.textContent = "ONNX Runtime Web";
      if (visionStatusText) visionStatusText.textContent = "Completed";
      if (visionProvider) visionProvider.textContent = `LOCAL (${result.executionProvider || "wasm"})`;
      if (visionLatency) visionLatency.textContent = `${latencyMs} ms`;
      if (visionClassIndex) visionClassIndex.textContent = result.classIndex;
      if (visionDetectionsCount) visionDetectionsCount.textContent = result.detections ? result.detections.length : 0;
      if (visionFusionStatus) visionFusionStatus.textContent = "ACTIVE";
      if (visionConfidence) {
        let confVal = typeof result.confidence === "number" ? result.confidence : parseFloat(result.confidence);
        if (isNaN(confVal)) confVal = 0.0;
        confVal = Math.max(0.0, Math.min(1.0, confVal));
        const pctStr = (confVal * 100).toFixed(1) + "%";
        visionConfidence.textContent = `${pctStr} (${confVal.toFixed(4)})`;
      }
      if (visionDetails) visionDetails.style.display = "block";
    } catch (err) {
      console.warn("[SIH26171][VISION] Local vision inference notice:", err.message || err);
      console.log("[SIH26171][VISION] Falling back to DOM perception");
      visionStatus.textContent = `Vision notice: ${err.message || err} (DOM perception fallback active)`;
      visionStatus.style.color = "#d97706";
      
      if (visionModelStatus) {
        visionModelStatus.textContent = "UNAVAILABLE — DOM FALLBACK";
        visionModelStatus.style.background = "#fef3c7";
        visionModelStatus.style.color = "#b45309";
      }
      if (visionStatusText) visionStatusText.textContent = "DOM Fallback";
      if (visionProvider) visionProvider.textContent = "DOM Perception (Local)";
      if (visionLatency) visionLatency.textContent = "-";
      if (visionDetectionsCount) visionDetectionsCount.textContent = "0";
      if (visionFusionStatus) visionFusionStatus.textContent = "DOM FALLBACK";
      if (visionDetails) visionDetails.style.display = "block";
      latestVisionResult = null;
    }

    renderPerceptionSummary();
  };

  // Helper to capture a screenshot data URL locally via background worker with tab/window fallback
  const captureScreenshotDataUrl = (windowId) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "captureScreenshot", windowId: typeof windowId === "number" ? windowId : null }, (res) => {
        if (!chrome.runtime.lastError && res && res.success && res.dataUrl) {
          resolve(res.dataUrl);
        } else if (typeof chrome.tabs.captureVisibleTab === "function") {
          chrome.tabs.captureVisibleTab(typeof windowId === "number" ? windowId : null, { format: "jpeg", quality: 60 }, (directUrl) => {
            if (!chrome.runtime.lastError && directUrl) {
              resolve(directUrl);
            } else {
              resolve(null);
            }
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  // Helper function to capture tab screenshot locally (Milestone 7)
  // Security Note: Screenshot is strictly local (client-side only) and NEVER sent to backend raw.
  const captureVisualContext = (targetWinId, onScreenshotReady) => {
    let winId = targetWinId;
    let callback = onScreenshotReady;
    if (typeof targetWinId === "function") {
      callback = targetWinId;
      winId = null;
    }

    if (visualStatus) {
      visualStatus.textContent = "Capturing tab screenshot locally...";
      visualStatus.style.color = "#555";
    }
    if (screenshotPreview) {
      screenshotPreview.style.display = "none";
      screenshotPreview.src = "";
    }

    if (visionStatus) {
      visionStatus.textContent = "Awaiting screenshot...";
      visionStatus.style.color = "#555";
    }
    if (visionDetails) visionDetails.style.display = "none";

    const t0 = performance.now();

    // 1. Request screenshot via background service worker with windowId
    chrome.runtime.sendMessage({ action: "captureScreenshot", windowId: typeof winId === "number" ? winId : null }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        // Fallback: Attempt capture directly if in active window context
        if (typeof chrome.tabs.captureVisibleTab === "function") {
          chrome.tabs.captureVisibleTab(typeof winId === "number" ? winId : null, { format: "jpeg", quality: 60 }, (dataUrl) => {
            const t1 = performance.now();
            timing.screenshotMs = Math.round(t1 - t0);

            if (chrome.runtime.lastError || !dataUrl) {
              const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Capture blocked";
              if (visualStatus) {
                visualStatus.textContent = `Screenshot capture failed (${err})`;
                visualStatus.style.color = "#c62828";
              }
              if (visionStatus) {
                visionStatus.textContent = "Vision classification skipped (screenshot unavailable)";
                visionStatus.style.color = "#c62828";
              }
              if (privacyStatus) {
                privacyStatus.textContent = "Redaction skipped (screenshot unavailable)";
                privacyStatus.style.color = "#c62828";
              }
              renderPerceptionSummary();
              notifyRedactionDone({ success: false, error: err });
              if (typeof callback === "function") callback(null, err);
            } else {
              if (visualStatus) {
                visualStatus.textContent = "Screenshot captured locally (client-side only)";
                visualStatus.style.color = "#2e7d32";
              }
              if (screenshotPreview) {
                screenshotPreview.src = dataUrl;
                screenshotPreview.style.display = "block";
              }
              latestScreenshotDataUrl = dataUrl;

              // Read natural dimensions
              const tempImg = new Image();
              tempImg.onload = () => {
                latestScreenshotDims = {
                  width: tempImg.naturalWidth || tempImg.width,
                  height: tempImg.naturalHeight || tempImg.height
                };
              };
              tempImg.src = dataUrl;

              // Trigger local OCR on screenshot
              triggerOcrPipeline(dataUrl);

              // Trigger on-device vision classification
              triggerVisionClassification(dataUrl);

              if (typeof callback === "function") callback(dataUrl, null);
            }
          });
          return;
        }

        const errMsg = (response && response.error) || chrome.runtime.lastError?.message || "Capture failed";
        if (visualStatus) {
          visualStatus.textContent = `Screenshot capture failed (${errMsg})`;
          visualStatus.style.color = "#c62828";
        }
        if (visionStatus) {
          visionStatus.textContent = "Vision classification skipped (screenshot unavailable)";
          visionStatus.style.color = "#c62828";
        }
        if (privacyStatus) {
          privacyStatus.textContent = "Redaction skipped (screenshot unavailable)";
          privacyStatus.style.color = "#c62828";
        }
        renderPerceptionSummary();
        notifyRedactionDone({ success: false, error: errMsg });
        if (typeof callback === "function") callback(null, errMsg);
        return;
      }

      const t1 = performance.now();
      timing.screenshotMs = Math.round(t1 - t0);

      // 2. Successful capture: render local preview, trigger OCR pipeline, and trigger vision classification
      if (visualStatus) {
        visualStatus.textContent = "Screenshot captured locally (client-side only)";
        visualStatus.style.color = "#2e7d32";
      }
      if (screenshotPreview) {
        screenshotPreview.src = response.dataUrl;
        screenshotPreview.style.display = "block";
      }
      latestScreenshotDataUrl = response.dataUrl;

      // Read natural dimensions
      const tempImg = new Image();
      tempImg.onload = () => {
        latestScreenshotDims = {
          width: tempImg.naturalWidth || tempImg.width,
          height: tempImg.naturalHeight || tempImg.height
        };
      };
      tempImg.src = response.dataUrl;

      // Milestone 9 & 14: Evaluate page change state using perceptual screen signature
      if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
        window.SIHChangeDetector.computeScreenSignature(response.dataUrl, latestVisualElements || []).then((screenSig) => {
          const changeResult = window.SIHChangeDetector.compareScreenSignatures(lastScreenSignature, screenSig);
          lastScreenSignature = screenSig;
          if (visionPageChangeStatus) {
            visionPageChangeStatus.textContent = changeResult.changed ? "CHANGED" : "STABLE";
            visionPageChangeStatus.style.color = changeResult.changed ? "#b45309" : "#1e40af";
          }
          if (window.SIHFusion && typeof window.SIHFusion.updatePerceptionState === "function") {
            window.SIHFusion.updatePerceptionState({
              pageSignature: screenSig.domSignature,
              visualSignature: screenSig.pixelHash,
              changed: changeResult.changed,
              reason: changeResult.reason
            });
          }
          console.log(`[SIH26171][VISION] Page change evaluation: ${changeResult.changeLevel} — ${changeResult.reason}`);
        }).catch((err) => console.warn("[SIH26171][VISION] Change detection notice:", err));
      }

      // Milestone 12: Trigger OCR pipeline on screenshot
      triggerOcrPipeline(response.dataUrl);

      // Milestone 9: Trigger on-device vision classification
      triggerVisionClassification(response.dataUrl);

      if (typeof onScreenshotReady === "function") onScreenshotReady(response.dataUrl, null);
    });
  };

  // Resets pipeline state for a fresh capture/agent pass
  const resetPipelineState = () => {
    latestScreenshotDataUrl = null;
    latestScreenshotDims = { width: 0, height: 0 };
    latestVisualElements = null;
    latestSensitiveRegions = null;
    latestOcrSensitiveRegions = [];
    latestOcrWordCount = 0;
    latestMergedRegions = null;
    latestVisionResult = null;
    latestFusedElements = null;
    if (window.SIHFusion && typeof window.SIHFusion.invalidatePerception === "function") {
      window.SIHFusion.invalidatePerception("Pipeline state reset for new pass");
    }
    latestSanitizedDataUrl = null;
    latestPageData = null;
    ocrCompleted = false;
    redactionCompleted = false;
    redactionError = null;
    onRedactionCompleteCallbacks = [];

    timing.domExtractionMs = null;
    timing.screenshotMs = null;
    timing.visionInferenceMs = null;
    timing.sensitiveRegionDetectionMs = null;
    timing.ocrInitMs = null;
    timing.ocrInferenceMs = null;
    timing.ocrSensitiveDetectionMs = null;
    timing.regionMergeMs = null;
    timing.redactionMs = null;
    timing.fusionMs = null;
    timing.gatewayMs = null;

    if (outputArea) outputArea.value = "Requesting page info...";
    if (sampleOutput) sampleOutput.value = "Scanning and redacting page text...";
    if (backendOutput) backendOutput.value = "Waiting for sanitized context...";
    if (decisionOutput) decisionOutput.value = "Awaiting decision...";
    if (executionOutput) executionOutput.value = "Awaiting execution...";
    if (elementsOutput) elementsOutput.value = "Scanning visible elements...";

    if (screenshotPreview) {
      screenshotPreview.style.display = "none";
      screenshotPreview.src = "";
    }
    if (sanitizedScreenshotPreview) {
      sanitizedScreenshotPreview.style.display = "none";
      sanitizedScreenshotPreview.src = "";
    }
    if (privacyDetails) privacyDetails.style.display = "none";
    if (privacyStatus) {
      privacyStatus.textContent = "Awaiting capture...";
      privacyStatus.style.color = "#555";
    }
    if (visionStatus) {
      visionStatus.textContent = "Awaiting screenshot...";
      visionStatus.style.color = "#555";
    }
    if (visionDetails) visionDetails.style.display = "none";
    if (fusionStatus) {
      fusionStatus.textContent = "Awaiting pipeline...";
      fusionStatus.style.color = "#555";
    }
    if (fusionDetails) fusionDetails.style.display = "none";
  };

  /**
   * Milestone 13: Secure Sanitized Visual Agent Gateway Upload
   *
   * SECURITY & PRIVACY CONTRACT:
   * - sanitizedScreenshotBlob MUST be a valid Blob created strictly from the client-side
   *   masked canvas output (latestSanitizedDataUrl).
   * - The raw screenshot (latestScreenshotDataUrl) is NEVER passed to this function or any network request.
   * - Must include privacyState: "SANITIZED" and rawScreenshotTransmitted: false.
   */
  const sendToVisualGateway = async (sanitizedScreenshotBlob, task, structuredContext, privacyMetadata, requestId) => {
    if (!sanitizedScreenshotBlob || !(sanitizedScreenshotBlob instanceof Blob)) {
      throw new Error("Invalid sanitized screenshot Blob: Cannot transmit to gateway.");
    }

    if (!privacyMetadata || privacyMetadata.privacyState !== "SANITIZED" || privacyMetadata.rawScreenshotTransmitted !== false) {
      throw new Error("Privacy contract violation: Only verified SANITIZED screenshots with rawScreenshotTransmitted=false may be sent.");
    }

    const formData = new FormData();
    formData.append("sanitizedScreenshot", sanitizedScreenshotBlob, "sanitized_screenshot.jpg");
    formData.append("task", task || "");
    formData.append("context", JSON.stringify(structuredContext));
    formData.append("privacyMetadata", JSON.stringify(privacyMetadata));
    formData.append("requestId", requestId);

    const tStart = performance.now();
    const res = await fetch("http://localhost:8000/api/visual-context", {
      method: "POST",
      body: formData
    });
    const tElapsed = Math.round(performance.now() - tStart);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gateway Error HTTP ${res.status}: ${errText}`);
    }

    const resJson = await res.json();
    return {
      success: true,
      data: resJson,
      latencyMs: tElapsed
    };
  };

  /**
   * Fallback to text-only sanitized pipeline (/api/context).
   * Used when redaction fails (fail-closed) or when visual gateway is offline.
   * Ensures the raw screenshot is NEVER sent under any circumstance.
   */
  const executeTextOnlyFallback = async (tab, pageData, reasonNotice = "") => {
    if (backendOutput) {
      backendOutput.value = `Fallback: Sending sanitized text-only context to /api/context...\n${reasonNotice}`;
    }
    if (decisionOutput) decisionOutput.value = "Evaluating rule-based decision (text-only fallback)...";
    if (executionOutput) executionOutput.value = "Awaiting decision from backend...";
    if (agentActionText) agentActionText.textContent = "Evaluating text-only fallback...";

    try {
      const apiRes = await fetch("http://localhost:8000/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pageData?.title || "Unknown Title",
          url: pageData?.url || "Unknown URL",
          redactedSample: pageData?.redactedSample || ""
        })
      });

      if (apiRes.ok) {
        const resJson = await apiRes.json();
        if (backendOutput) backendOutput.value = JSON.stringify(resJson, null, 2);

        if (resJson.action) {
          const targetText = resJson.action.target ? resJson.action.target : "None";
          const actionStr = (resJson.action.amount !== undefined && resJson.action.amount !== null)
            ? `${resJson.action.action} → ${targetText} (amount: ${resJson.action.amount})`
            : `${resJson.action.action} → ${targetText}`;

          if (decisionOutput) decisionOutput.value = actionStr;
          if (agentActionText) agentActionText.textContent = actionStr;
          if (agentReasoningText) {
            agentReasoningText.textContent = `Visual context unavailable — decision based on sanitized text only (${reasonNotice || "Fallback"}). Observation only: no action executed.`;
          }

          // SECURITY INVARIANT (Milestone 17 Production Hardening): OBSERVATION ≠ ACTION
          // Capture Page Info and text-only observation requests MUST NEVER automatically execute actions.
          if (executionOutput) executionOutput.value = "Observation only: Action execution withheld (Observation ≠ Action policy enforced).";
          if (agentSafetyStatus) agentSafetyStatus.textContent = "OBSERVATION ONLY (Actions disabled in Capture/Fallback mode)";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Observation Only (No browser action executed)";
        } else {
          if (decisionOutput) decisionOutput.value = "No action returned";
          if (executionOutput) executionOutput.value = "Observation only: No action payload";
          if (agentActionText) agentActionText.textContent = "No action returned";
          if (agentSafetyStatus) agentSafetyStatus.textContent = "OBSERVATION ONLY";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Observation Only";
        }
      } else {
        if (backendOutput) backendOutput.value = `Backend Error: HTTP ${apiRes.status} ${apiRes.statusText}`;
        if (decisionOutput) decisionOutput.value = "Error from backend";
        if (executionOutput) executionOutput.value = "Skipped (backend error)";
        if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (backend error)";
      }
    } catch (networkErr) {
      if (backendOutput) {
        backendOutput.value = `Backend connection failed: ${networkErr.message}\n(Ensure FastAPI is running: uvicorn main:app --reload --port 8000)`;
      }
      if (decisionOutput) decisionOutput.value = "Unavailable (backend offline)";
      if (executionOutput) executionOutput.value = "Skipped (backend offline)";
      if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (backend offline)";
    }
  };

  /**
   * Waits for a tab to finish loading and for its content script to respond with live DOM elements.
   * Handles full-page navigations, SPA changes, and delayed rendering.
   */
  const waitForTabReady = async (tabId, timeoutMs = 6000) => {
    if (!tabId) return null;
    const startTime = performance.now();
    // Brief settling period for any in-flight navigation to start
    await new Promise((r) => setTimeout(r, 250));

    while (performance.now() - startTime < timeoutMs) {
      try {
        const tabInfo = await chrome.tabs.get(tabId);
        if (tabInfo && tabInfo.status === "complete") {
          // Tab reports complete; verify content script is responsive and DOM is ready
          const pingResp = await new Promise((resolvePing) => {
            chrome.tabs.sendMessage(tabId, { action: "getPageInfo" }, (resp) => {
              if (chrome.runtime.lastError || !resp || !resp.success) {
                resolvePing(null);
              } else {
                resolvePing(resp);
              }
            });
          });

          if (pingResp && pingResp.success && Array.isArray(pingResp.visualElements) && pingResp.visualElements.length > 0) {
            // Content script is alive and has extracted live elements.
            // Small paint/layout settling delay before screenshot capture.
            await new Promise((r) => setTimeout(r, 200));
            return pingResp;
          }

          // If content script was not injected on the newly loaded page, inject it
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ["form-profile.js", "pii-detector.js", "content.js"]
            });
            await new Promise((r) => setTimeout(r, 150));
          } catch (_) { }
        }
      } catch (err) {
        // Tab may be in transit between documents
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  };

  /**
   * Bounded stabilization helper for search results and dynamic page changes.
   * Checks for URL changes, title changes, search-result containers, and content stabilization.
   */
  const waitForSearchResultsStabilization = async (tabId, timeoutMs = 5000) => {
    if (!tabId) return null;
    const startTime = performance.now();
    await new Promise((r) => setTimeout(r, 350));

    while (performance.now() - startTime < timeoutMs) {
      try {
        const tabInfo = await chrome.tabs.get(tabId);
        const url = (tabInfo?.url || "").toLowerCase();
        const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");

        const pageState = await new Promise((res) => {
          chrome.tabs.sendMessage(tabId, { action: "checkSearchResultsState" }, (resp) => {
            if (chrome.runtime.lastError || !resp) res(null);
            else res(resp);
          });
        });

        if (pageState && (pageState.isSearchResults || hasSearchUrl || pageState.hasSearchTitle)) {
          await new Promise((r) => setTimeout(r, 250)); // Layout settle
          return pageState;
        }
      } catch (_) { }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  };

  /**
   * Verifies locally whether the current page is in a search results state.
   */
  const verifySearchResultsStateLocally = async (tabId, query = "") => {
    if (!tabId) return { verified: false, reason: "No active tab" };
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      const url = (tabInfo?.url || "").toLowerCase();
      const title = (tabInfo?.title || "").toLowerCase();
      const qNorm = (query || "").toLowerCase().trim();

      const hasSearchUrl = url.includes("/search") || url.includes("?q=") || url.includes("&q=") || url.includes("query=") || url.includes("search?");
      const hasSearchTitle = title.includes("search") || title.includes("results") || (qNorm && title.includes(qNorm));

      const pageState = await new Promise((res) => {
        chrome.tabs.sendMessage(tabId, { action: "checkSearchResultsState" }, (resp) => {
          if (chrome.runtime.lastError || !resp) res(null);
          else res(resp);
        });
      });

      const isSearchState = !!(hasSearchUrl || (pageState && pageState.isSearchResults) || (hasSearchTitle && pageState && pageState.containerCount > 0));
      if (isSearchState) {
        return {
          verified: true,
          reason: hasSearchUrl ? "Search URL detected" : (hasSearchTitle ? "Search title confirmed" : "Search results containers verified")
        };
      }
    } catch (_) { }

    return {
      verified: false,
      reason: "Page is still on the initial homepage. Search results not detected."
    };
  };

  const HOMEPAGE_NAVIGATION_LABELS = new Set([
    "google apps", "sign in", "login", "gmail", "images", "privacy", "terms", "settings",
    "about", "advertising", "business", "how search works", "search settings", "advanced search",
    "history", "search help", "send feedback", "all", "maps", "news", "videos", "shopping",
    "books", "flights", "finance", "tools", "clear", "home", "search", "google search", "i'm feeling lucky"
  ]);

  const isGenericNavigationOrHomepageTarget = (label) => {
    const norm = (label || "").trim().toLowerCase();
    return HOMEPAGE_NAVIGATION_LABELS.has(norm);
  };

  /**
   * Helper to execute the core local perception pipeline (M7-M12) once.
   * Returns a promise resolving with { tab, pageData, redactionResult }.
   */
  const runLocalPipeline = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          tab = tabs && tabs[0];
        }

        if (!tab || !tab.id) {
          throw new Error("No active tab found");
        }

        if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("view-source:"))) {
          const restrictedErr = new Error("This page is restricted by the browser.");
          restrictedErr.isRestrictedPage = true;
          throw restrictedErr;
        }

        // Ensure page navigation / loading is stabilized and content script ready before perception
        await waitForTabReady(tab.id, 5000);

        // 1. Trigger local screenshot capture (M7, M9, M12) with tab windowId
        captureVisualContext(tab.windowId);

        // 2. Query DOM metadata and sensitive regions via content script (M1, M2, M8, M11)
        const tDomStart = performance.now();

        const handleDomResponse = (response) => {
          const domElapsed = Math.round(performance.now() - tDomStart);
          if (response && response.success) {
            timing.domExtractionMs = domElapsed;
            timing.sensitiveRegionDetectionMs = typeof response.sensitiveDetectionMs === "number"
              ? response.sensitiveDetectionMs
              : 0;

            latestVisualElements = response.visualElements || [];
            latestSensitiveRegions = response.sensitiveRegions || [];
            latestPageData = response;

            // Display local sanitized context
            if (outputArea) outputArea.value = `Title: ${response.title}\nURL: ${response.url}`;
            if (sampleOutput) sampleOutput.value = response.redactedSample || "(No visible text found on page)";

            // Milestone 8: Display detected visual elements locally
            if (elementsOutput) {
              if (response.visualElements && Array.isArray(response.visualElements) && response.visualElements.length > 0) {
                let elementsText = `Detected elements: ${response.visualElements.length}\n\n`;
                response.visualElements.forEach((el, index) => {
                  const typeUpper = (el.type || "ELEMENT").toUpperCase();
                  elementsText += `${index + 1}.${typeUpper} — ${el.label} [x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}]\n`;
                });
                elementsOutput.value = elementsText.trim();
              } else {
                elementsOutput.value = "No visual elements detected.";
              }
            }

            renderPerceptionSummary();

            // Trigger redaction if screenshot + OCR are already settled
            triggerRedaction();

            // Await redaction completion (M11 + M12)
            waitForRedaction().then((redactionRes) => {
              resolve({
                tab,
                pageData: response,
                redactionResult: redactionRes
              });
            });
          } else {
            reject(new Error("Failed to retrieve page info from content script"));
          }
        };

        // Send getPageInfo to content script
        chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (response) => {
          if (chrome.runtime.lastError) {
            // Dynamic injection fallback if content script not yet present
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["pii-detector.js", "content.js"]
              });

              chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  handleDomResponse(retryResponse);
                }
              });
            } catch (injectErr) {
              reject(new Error(`Script injection failed: ${injectErr.message}`));
            }
            return;
          }

          handleDomResponse(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  // Milestone 14 & Final Architecture: Render Explainable Agent Trace (Section 22) + Evaluation Telemetry (Section 23)
  const renderTraceHistory = () => {
    if (agentTraceContainer) {
      if (!executionTraceHistory || executionTraceHistory.length === 0) {
        agentTraceContainer.innerHTML = "<div style='color: #94a3b8; font-style: italic; text-align: center; padding: 8px 0;'>No trace recorded yet. Run a task to view execution timeline.</div>";
        if (traceStepCount) traceStepCount.textContent = "0 steps executed";
      } else {
        let html = "";
        if (traceStepCount) traceStepCount.textContent = `${executionTraceHistory.length} step(s) recorded`;
        executionTraceHistory.forEach((t) => {
          const execColor = t.executed ? "#166534" : (t.status === "completed" ? "#1565c0" : "#b91c1c");
          const riskColor = (t.risk === "HIGH" || t.risk === "CRITICAL") ? "#b91c1c" : ((t.risk === "MEDIUM") ? "#b45309" : "#3730a3");
          const riskBg = (t.risk === "HIGH" || t.risk === "CRITICAL") ? "#fee2e2" : ((t.risk === "MEDIUM") ? "#fef3c7" : "#e0e7ff");
          const actType = (t.action?.action || "NONE").toUpperCase();
          const actBadgeClass = actType === "FILL" ? "badge-action-fill" : (actType === "CLICK" ? "badge-action-click" : (actType === "SUBMIT" ? "badge-action-submit" : "badge-action-none"));

          html += `<div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="font-weight: 700; color: #1e40af; font-size: 11px;">STEP ${t.step} / ${t.totalSteps || 1}</span>
                <span class="action-badge ${actBadgeClass}">${escapeHtml(actType)}</span>
              </div>
              <span style="font-size: 8.5px; padding: 1px 5px; border-radius: 3px; font-weight: bold; background: ${riskBg}; color: ${riskColor};">[${t.risk || "LOW"}]</span>
            </div>
            <div style="font-size: 10.5px; color: #1e293b; margin-bottom: 2px;">
              <strong>Target:</strong> <span style="color: #0f172a; font-weight: 600;">${escapeHtml(t.action?.targetLabel || t.action?.target || "None")}</span>
              ${t.action?.value ? `<span style="color: #047857; font-family: monospace; font-weight: 600; margin-left: 4px;">(value: '${escapeHtml(t.action.value)}')</span>` : ""}
              ${t.action?.amount ? `<span style="color: #64748b; margin-left: 4px;">(${t.action.amount}px)</span>` : ""}
            </div>
            <div style="font-size: 9.5px; color: #475569; display: flex; flex-direction: column; gap: 1px; margin-top: 3px; padding-top: 3px; border-top: 1px dashed #f1f5f9;">
              <div><strong>Status:</strong> <span style="color: ${execColor}; font-weight: 700;">${escapeHtml(t.executionResult)}</span></div>
              ${t.verification ? `<div><strong>Verification:</strong> <span style="color: #15803d; font-weight: 600;">✓ ${escapeHtml(t.verification)}</span></div>` : ""}
              <details style="margin-top: 2px; font-size: 9px; color: #64748b;">
                <summary style="cursor: pointer; color: #3b82f6; font-weight: 600;">Audit &amp; Grounding Details</summary>
                <div style="padding: 4px; background: #f8fafc; border-radius: 4px; margin-top: 2px; border: 1px solid #e2e8f0; line-height: 1.35;">
                  <div>• <strong>Perception:</strong> ${escapeHtml(t.perception || "DOM perception active")}</div>
                  <div>• <strong>Grounding:</strong> ${escapeHtml(t.groundingStr || "Target matched")}</div>
                  <div>• <strong>Safety Gate:</strong> ${escapeHtml(t.safetyDecision || "ALLOWED")} (Approval: ${escapeHtml(t.humanApproval || "NOT REQUIRED")})</div>
                  ${t.recovery ? `<div style="color: #0369a1; font-weight: bold;">• <strong>Recovery:</strong> ${escapeHtml(t.recovery)}</div>` : ""}
                </div>
              </details>
            </div>
          </div>`;
        });
        agentTraceContainer.innerHTML = html;
        agentTraceContainer.scrollTop = agentTraceContainer.scrollHeight;
      }
    }

    // Update Section 23 Evaluation & Safety Benchmark Telemetry
    if (window.SIHEvaluationTracker && typeof window.SIHEvaluationTracker.getSummary === "function") {
      const summary = window.SIHEvaluationTracker.getSummary();
      const evalTasksCount = document.getElementById("evalTasksCount");
      const evalActionsCount = document.getElementById("evalActionsCount");
      const evalGroundingConf = document.getElementById("evalGroundingConf");
      const evalVerifRate = document.getElementById("evalVerifRate");
      const evalRecoveryCount = document.getElementById("evalRecoveryCount");
      const evalReplanCount = document.getElementById("evalReplanCount");
      const evalSafetyStatus = document.getElementById("evalSafetyStatus");
      const evalZeroViolationBadge = document.getElementById("evalZeroViolationBadge");

      if (evalTasksCount) evalTasksCount.textContent = `${summary.tasksSucceeded}/${summary.tasksAttempted}`;
      if (evalActionsCount) evalActionsCount.textContent = `${summary.actionsExecuted}/${summary.actionsAttempted}`;
      if (evalGroundingConf) evalGroundingConf.textContent = summary.avgGroundingConfidence ? `${(summary.avgGroundingConfidence * 100).toFixed(0)}%` : "-";
      if (evalVerifRate) evalVerifRate.textContent = summary.verificationSuccessRate ? `${(summary.verificationSuccessRate * 100).toFixed(0)}%` : "-";
      if (evalRecoveryCount) evalRecoveryCount.textContent = String(summary.recoveryCount);
      if (evalReplanCount) evalReplanCount.textContent = String(summary.replanningCount);
      if (evalSafetyStatus) {
        evalSafetyStatus.textContent = summary.isZeroUnauthorizedConsequential
          ? `PASSED (0 Violations, ${summary.blockedConsequentialActions} Gated)`
          : `VIOLATION (${summary.unauthorizedConsequentialActions} unauthorized)`;
        evalSafetyStatus.style.color = summary.isZeroUnauthorizedConsequential ? "#166534" : "#dc2626";
      }
      if (evalZeroViolationBadge) {
        evalZeroViolationBadge.textContent = `${summary.unauthorizedConsequentialActions} UNAUTHORIZED ACTIONS`;
        evalZeroViolationBadge.style.background = summary.isZeroUnauthorizedConsequential ? "#e8f5e9" : "#fee2e2";
        evalZeroViolationBadge.style.color = summary.isZeroUnauthorizedConsequential ? "#166534" : "#dc2626";
      }
    }
  };

  // =====================================================================
  // =====================================================================
  // Milestone 14, 15 & 16: Bounded Multi-Step Agent Loop with Safe Form Fill
  // Loop (up to MAX_AGENT_STEPS = 5): Observe -> Verify -> Gateway -> Execute -> Post-Verify
  // =====================================================================
  if (runAgentTaskBtn) {
    runAgentTaskBtn.addEventListener("click", async () => {
      console.log("[SIH26171] Run Agent Task clicked");
      const task = (taskInput ? taskInput.value : "").trim() || "Find the Submit button and click it.";

      // Update Browser Agent Status immediately upon click so user sees active state
      if (agentTaskText) agentTaskText.textContent = task;
      if (agentExecutionStatus) agentExecutionStatus.textContent = "Starting...";
      if (agentSafetyStatus) agentSafetyStatus.textContent = "Analyzing...";

      let currentStep = 1;
      let currentRequestId = "-";

      try {
        // Milestone 16: Local deterministic NL task parser (client-side only; values never transmitted)
        let parsedTask = null;
        if (window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
          parsedTask = window.SIHTaskParser.parseTask(task);
        }
        console.log("[SIH26171] Task parsed");

        // Final Architecture: On-Device Reasoning & Safety Planner (Deterministic, Local, Auditable)
        let reasoningPlan = null;
        if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.planTask === "function") {
          reasoningPlan = window.SIHReasoningPlanner.planTask(parsedTask, {
            title: document.title,
            url: window.location.href
          });
        }
        console.log("[SIH26171] Reasoning plan created");

        // Render transparent task understanding and structured plan in UI
        if (plannerTaskUnderstanding) {
          plannerTaskUnderstanding.textContent = reasoningPlan ? reasoningPlan.taskUnderstanding : task;
        }
        if (plannerExecutionPlan) {
          if (reasoningPlan && reasoningPlan.steps && reasoningPlan.steps.length > 0) {
            plannerExecutionPlan.innerHTML = reasoningPlan.steps.map((st, i) => {
              const riskColor = (st.risk === "HIGH" || st.risk === "CRITICAL") ? "#dc2626" : ((st.risk === "MEDIUM") ? "#d97706" : "#2563eb");
              const approvalBadge = st.requiresApproval
                ? `<span style="background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold;margin-left:4px;">APPROVAL REQ</span>`
                : `<span style="background:#f3f4f6;color:#4b5563;padding:1px 5px;border-radius:3px;font-size:9px;margin-left:4px;">AUTO</span>`;
              return `<div style="padding:2px 0;"><strong>${i + 1}.</strong> ${escapeHtml(st.type)} &rarr; <strong>${escapeHtml(st.target || st.fieldHint || "target")}</strong> <span style="color:${riskColor};font-weight:bold;font-size:10px;">[${st.risk}]</span>${approvalBadge}</div>`;
            }).join("");
          } else {
            plannerExecutionPlan.innerHTML = "<div>1. Generic Action &rarr; [LOW] (Auto)</div>";
          }
        }

        let plannerTraceList = (reasoningPlan && Array.isArray(reasoningPlan.reasoningTrace))
          ? [...reasoningPlan.reasoningTrace]
          : [];
        const appendPlannerTrace = (msg) => {
          if (!msg) return;
          plannerTraceList.push(msg);
          if (plannerReasoningTrace) {
            plannerReasoningTrace.innerHTML = plannerTraceList.map((m) => `<div>&bull; ${escapeHtml(m)}</div>`).join("");
            plannerReasoningTrace.scrollTop = plannerReasoningTrace.scrollHeight;
          }
        };
        if (plannerReasoningTrace) {
          plannerReasoningTrace.innerHTML = plannerTraceList.length > 0
            ? plannerTraceList.map((m) => `<div>&bull; ${escapeHtml(m)}</div>`).join("")
            : "<div>&bull; Task parsed and planned locally.</div>";
        }
        if (plannerRiskBadge) {
          plannerRiskBadge.textContent = "LOW";
          plannerRiskBadge.style.background = "#e0e7ff";
          plannerRiskBadge.style.color = "#3730a3";
        }
        if (plannerSafetyDecision) {
          plannerSafetyDecision.textContent = "PASSED (Safe Action)";
          plannerSafetyDecision.style.color = "#166534";
        }
        if (plannerApprovalStatus) {
          plannerApprovalStatus.textContent = "NOT REQUIRED";
          plannerApprovalStatus.style.color = "#1e1b4b";
        }
        if (popupApprovalContainer) {
          popupApprovalContainer.style.display = "none";
        }

        // Fetch Zero-Shot Plan and populate interactive checklist UI
        const zeroShotPlan = await fetchZeroShotPlan(task);
        renderActivePlanChecklist(zeroShotPlan, 0);
        setLiveAgentThought(`Analyzing user intent: "${task}" and initializing visual perception...`);

        let isPlannedTask = parsedTask && parsedTask.intent !== "NONE" && Array.isArray(parsedTask.steps) && parsedTask.steps.length > 0;
        let plannedSteps = isPlannedTask ? parsedTask.steps : null;
        let totalPlannedSteps = isPlannedTask ? Math.min(plannedSteps.length, MAX_AGENT_STEPS) : Math.max(zeroShotPlan.length, 1);
        let localValuesMap = (isPlannedTask && parsedTask.localValues) ? parsedTask.localValues : {};

        // AGENT SESSION ISOLATION (Milestone 17 Production Hardening):
        // A new task execution must NEVER inherit approval state, stale actions, or prior plan state.
        previousScreenSignature = null;
        executionTraceHistory = [];
        let lastActionKey = null;
        renderTraceHistory();
        resetPipelineUI();
        if (pipelineStepCounter) {
          pipelineStepCounter.textContent = isPlannedTask ? `Step 1 of ${totalPlannedSteps}` : `Step 1 of ${MAX_AGENT_STEPS}`;
        }
        updateCurrentActionCard({
          stepText: isPlannedTask ? `STEP 1 / ${totalPlannedSteps}` : `STEP 1 / ${MAX_AGENT_STEPS}`,
          action: "OBSERVE",
          target: task,
          value: "",
          grounding: "Local Observation",
          risk: "LOW",
          safety: "ANALYZING",
          status: "Starting agent..."
        });

        if (popupApprovalContainer) {
          popupApprovalContainer.style.display = "none";
        }

        // Ensure any lingering in-page approval modal is dismissed
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "dismissHumanApproval" }, () => {
                if (chrome.runtime.lastError) { }
              });
            }
          });
        } catch (e) { }

        if (fillStepStatus) {
          fillStepStatus.textContent = isPlannedTask && (parsedTask.intent.includes("FILL") || parsedTask.steps.some((s) => s.type === "FILL")) ? "Planning steps..." : "-";
        }
        if (fieldValuesPrivacyNotice) {
          fieldValuesPrivacyNotice.textContent = "Kept local (not sent)";
        }

        if (window.SIHEvaluationTracker && typeof window.SIHEvaluationTracker.recordTaskStart === "function") {
          window.SIHEvaluationTracker.recordTaskStart(currentRequestId, task);
        }

        while (currentStep <= (isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS)) {
          const requestId = "SIH-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          currentRequestId = requestId;
          let stepRecoveryNote = null;
          resetPipelineState();
          setAgentState(AGENT_STATES.PERCEIVE, `Observing page state for step ${currentStep}...`);

          if (pipelineStepCounter) {
            pipelineStepCounter.textContent = isPlannedTask
              ? `Step ${currentStep} of ${totalPlannedSteps}`
              : `Step ${currentStep} of ${MAX_AGENT_STEPS}`;
          }
          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: "OBSERVE",
            target: "Page DOM & Visual Context",
            value: "",
            grounding: "Perceiving...",
            risk: "LOW",
            safety: "PENDING",
            status: `Observing page state for step ${currentStep}...`
          });

          // Update step & verification indicators
          if (agentStepText) {
            agentStepText.textContent = isPlannedTask
              ? `Step ${currentStep} of ${totalPlannedSteps}`
              : `Step ${currentStep} of up to ${MAX_AGENT_STEPS}`;
          }
          if (agentVerificationText) {
            agentVerificationText.textContent = currentStep === 1
              ? "Observing initial page state..."
              : "Observing updated page state...";
            agentVerificationText.style.color = "#1565c0";
          }

          // Show task in UI (never reveals literal extracted values in status)
          if (agentTaskText) agentTaskText.textContent = task;
          if (agentRequestId) agentRequestId.textContent = requestId;
          if (agentScreenshotStatus) agentScreenshotStatus.textContent = "CAPTURING LOCALLY...";
          if (agentPrivacyStatus) agentPrivacyStatus.textContent = "ACTIVE";
          if (agentDomPiiCount) agentDomPiiCount.textContent = "Scanning...";
          if (agentOcrPiiCount) agentOcrPiiCount.textContent = "Scanning...";
          if (agentSensitiveCount) agentSensitiveCount.textContent = "Calculating...";
          if (agentRedactionStatus) agentRedactionStatus.textContent = "PROCESSING...";
          if (agentSanitizedStatus) agentSanitizedStatus.textContent = "Awaiting Redaction...";
          if (agentRawUploadStatus) {
            agentRawUploadStatus.textContent = "BLOCKED (Never transmitted)";
          }
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "AWAITING PIPELINE";
            agentSanitizedUploadStatus.style.color = "#555";
          }
          if (agentModeStatus) {
            agentModeStatus.textContent = "Awaiting Reasoning...";
            agentModeStatus.style.color = "#555";
          }
          if (agentModeSubtext) agentModeSubtext.textContent = "";
          if (agentFallbackRow) agentFallbackRow.style.display = "none";
          if (agentActionText) agentActionText.textContent = "Awaiting pipeline...";
          if (agentReasoningText) agentReasoningText.textContent = `Step ${currentStep}: Running local privacy pipeline...`;
          if (agentSafetyStatus) agentSafetyStatus.textContent = "Pending...";
          if (agentExecutionStatus) agentExecutionStatus.textContent = "Pending...";
          if (agentGatewayLatency) agentGatewayLatency.textContent = "-";
          if (groundingMethodText) groundingMethodText.textContent = "-";
          if (groundingScoreText) groundingScoreText.textContent = "-";
          if (groundedElementText) groundedElementText.textContent = "-";

          let pipelineOutput = null;
          try {
            // Step 1: Run local observation pipeline (reused once per cycle)
            console.log("[SIH26171] Perception pipeline started");
            pipelineOutput = await runLocalPipeline();
            console.log("[SIH26171] Perception pipeline completed");
          } catch (pipelineErr) {
            if (pipelineErr.isRestrictedPage) {
              if (agentSafetyStatus) agentSafetyStatus.textContent = "Browser Restricted Page";
              if (agentExecutionStatus) agentExecutionStatus.textContent = "This page is restricted by the browser.";
              if (agentReasoningText) agentReasoningText.textContent = "This page is restricted by the browser. Browser extensions cannot run on internal browser pages (chrome://, edge://, about:). Please navigate to an ordinary website or http://127.0.0.1:8000/test-page.html.";
              if (agentStepText) agentStepText.textContent = "Halted (Restricted Page)";
              if (agentVerificationText) {
                agentVerificationText.textContent = "Browser internal page policy enforced.";
                agentVerificationText.style.color = "#e65100";
              }
              if (agentSanitizedUploadStatus) {
                agentSanitizedUploadStatus.textContent = "N/A (Restricted Page)";
                agentSanitizedUploadStatus.style.color = "#777";
              }
              executionTraceHistory.push({
                step: currentStep,
                requestId,
                action: null,
                executed: false,
                status: "restricted",
                executionResult: "This page is restricted by the browser.",
                verification: "Browser internal page policy"
              });
              renderTraceHistory();
              break;
            }
            console.error("Observation pipeline error:", pipelineErr);
            if (agentReasoningText) agentReasoningText.textContent = `Pipeline Error: ${pipelineErr.message}`;
            if (agentSanitizedUploadStatus) {
              agentSanitizedUploadStatus.textContent = "ERROR (Pipeline stopped)";
              agentSanitizedUploadStatus.style.color = "#c62828";
            }
            if (agentSafetyStatus) agentSafetyStatus.textContent = "Error";
            if (agentExecutionStatus) agentExecutionStatus.textContent = "Skipped (Pipeline error)";
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: null,
              executed: false,
              status: "error",
              executionResult: `Pipeline error: ${pipelineErr.message}`,
              verification: "Pipeline observation failed"
            });
            renderTraceHistory();
            break;
          }

          const { tab: activeTab, pageData, redactionResult } = pipelineOutput;
          // Milestone 18: Clear any prior overlay when moving to next page state/step
          sendOverlayTelemetry(activeTab?.id, { action: "clearAgentOverlay" });

          // Step 2: Compute current screen signature on-device (perceptual 32x32 hash + DOM structure)
          let currentSignature = null;
          if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
            currentSignature = await window.SIHChangeDetector.computeScreenSignature(
              latestScreenshotDataUrl,
              latestVisualElements
            );
          }

          // Update panel with local perception metrics
          if (agentScreenshotStatus) agentScreenshotStatus.textContent = "CAPTURED LOCALLY (Client-Side Only)";
          if (agentDomPiiCount) agentDomPiiCount.textContent = latestSensitiveRegions ? latestSensitiveRegions.length : 0;
          if (agentOcrPiiCount) agentOcrPiiCount.textContent = latestOcrSensitiveRegions ? latestOcrSensitiveRegions.length : 0;
          if (agentSensitiveCount) agentSensitiveCount.textContent = latestMergedRegions ? latestMergedRegions.length : 0;

          if (previewDomCount) previewDomCount.textContent = `${latestVisualElements ? latestVisualElements.length : 0} elements`;
          if (previewSensitiveCount) previewSensitiveCount.textContent = String(latestMergedRegions ? latestMergedRegions.length : (latestSensitiveRegions ? latestSensitiveRegions.length : 0));
          if (previewRedactionStatus) previewRedactionStatus.textContent = (redactionResult && redactionResult.success) ? "ACTIVE" : "WITHHELD";
          updatePipelineStage("PERCEPTION", "completed", `${latestVisualElements ? latestVisualElements.length : 0} DOM items`);

          // Step 3: Verify M11/M12 redaction success (Fail-closed contract)
          if (!redactionResult || !redactionResult.success || !redactionResult.sanitizedScreenshotDataUrl) {
            console.warn("Visual privacy redaction failed. Failing closed: Falling back to text-only pipeline.");
            if (agentRedactionStatus) {
              agentRedactionStatus.textContent = "FAILED (Masking withheld for privacy)";
              agentRedactionStatus.style.color = "#c62828";
            }
            if (agentSanitizedStatus) {
              agentSanitizedStatus.textContent = "UNAVAILABLE (Fail-closed)";
              agentSanitizedStatus.style.color = "#c62828";
            }
            if (agentSanitizedUploadStatus) {
              agentSanitizedUploadStatus.textContent = "N/A (BLOCKED: Redaction failed; raw screenshot NEVER transmitted)";
              agentSanitizedUploadStatus.style.color = "#c62828";
            }
            if (agentReasoningText) {
              agentReasoningText.textContent = "Visual context unavailable (redaction failed/withheld). Falling back to text-only sanitized pipeline.";
            }

            await executeTextOnlyFallback(activeTab, pageData, "Visual redaction withheld — text-only fallback");
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: { action: "FALLBACK_TEXT_ONLY", target: "PAGE" },
              executed: true,
              status: "fallback",
              executionResult: "Executed text-only fallback",
              verification: "Fail-closed (visual upload blocked)"
            });
            renderTraceHistory();
            break;
          }

          // Redaction succeeded
          if (agentRedactionStatus) {
            agentRedactionStatus.textContent = "COMPLETE (Masked Offscreen)";
            agentRedactionStatus.style.color = "#2e7d32";
          }
          if (agentSanitizedStatus) {
            agentSanitizedStatus.textContent = "READY";
            agentSanitizedStatus.style.color = "#2e7d32";
          }
          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "TRANSMITTING (Sanitized Only)";
            agentSanitizedUploadStatus.style.color = "#1565c0";
          }

          // Step 4: Convert sanitized screenshot data URL to Blob (in-memory)
          const sanitizedBlobRes = await fetch(redactionResult.sanitizedScreenshotDataUrl);
          const sanitizedBlob = await sanitizedBlobRes.blob();

          // Step 5: Construct safe structured context and privacy metadata
          // CRITICAL PRIVACY: Never include literal values in structuredContext or fieldPlan!
          let currentStepPlan = isPlannedTask && (currentStep - 1 < plannedSteps.length)
            ? plannedSteps[currentStep - 1]
            : null;

          setAgentState(AGENT_STATES.PLAN, `Planning step ${currentStep}...`);

          if (currentStepPlan && currentStepPlan.type === "CLICK") {
            const isSearchResultSelection = !!(currentStepPlan.query || (currentStepPlan.targetHint && currentStepPlan.targetHint.includes("relevant result")));
            if (isSearchResultSelection) {
              setAgentState(AGENT_STATES.VERIFY, "Verifying search results state...");
              const searchState = await verifySearchResultsStateLocally(activeTab.id, currentStepPlan.query);
              if (!searchState.verified) {
                console.log("[SIH26171] Search results not yet stabilized, waiting briefly...");
                await waitForSearchResultsStabilization(activeTab.id, 4000);
              }
            }
          }

          let taskToSend = task;
          let stepFieldPlan = [];
          if (currentStepPlan) {
            if (currentStepPlan.type === "FILL_FORM") {
              taskToSend = "Fill form";
              stepFieldPlan = [{
                type: "FILL_FORM",
                fieldHint: currentStepPlan.fieldHint || "all form fields",
                stepId: currentStep - 1
              }];
            } else if (currentStepPlan.type === "FILL") {
              taskToSend = `Fill ${currentStepPlan.fieldHint}`;
              stepFieldPlan = [{
                type: "FILL",
                fieldHint: currentStepPlan.fieldHint,
                stepId: currentStep - 1
              }];
            } else if (currentStepPlan.type === "SUBMIT") {
              taskToSend = currentStepPlan.query
                ? `Submit search for '${currentStepPlan.query}'`
                : "Submit search";
              stepFieldPlan = [];
            } else if (currentStepPlan.type === "CLICK") {
              const isSearchResultSelection = !!(currentStepPlan.query || (currentStepPlan.targetHint && currentStepPlan.targetHint.includes("relevant result")));
              if (isSearchResultSelection && currentStepPlan.query) {
                taskToSend = `Select and click the most relevant search result for '${currentStepPlan.query}' (prefer the actual device/product, do NOT select accessories like cases, covers, or screen protectors)`;
              } else {
                taskToSend = currentStepPlan.targetHint
                  ? `Click ${currentStepPlan.targetHint}`
                  : (currentStepPlan.legacyTarget || "Click");
              }
              stepFieldPlan = [];
            } else if (currentStepPlan.type === "SCROLL") {
              taskToSend = currentStepPlan.amount
                ? `Scroll down ${currentStepPlan.amount} pixels`
                : "Scroll down";
              stepFieldPlan = [];
            }
          } else if (isPlannedTask) {
            stepFieldPlan = parsedTask.sanitizedPlan.filter((s) => s.type === "FILL" || s.type === "FILL_FORM");
          }

          const structuredContext = {
            title: pageData?.title || "",
            url: pageData?.url || "",
            redactedSample: pageData?.redactedSample || "",
            elementCount: (latestVisualElements || []).length,
            elements: (latestVisualElements || []).map((el) => ({
              type: el.type,
              label: el.label,
              semanticTag: el.semanticTag || null,
              fieldId: el.fieldId !== undefined ? el.fieldId : null,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height
            })),
            fieldPlan: stepFieldPlan,
            sceneClassification: latestVisionResult ? {
              classIndex: latestVisionResult.classIndex,
              confidence: latestVisionResult.confidence
            } : null,
            sensitiveRegionCount: latestSensitiveRegions ? latestSensitiveRegions.length : 0,
            ocrTextRegionCount: latestOcrWordCount,
            totalRedactedRegionCount: latestMergedRegions ? latestMergedRegions.length : 0,
            loopStep: currentStep
          };

          const privacyMetadata = {
            privacyState: "SANITIZED",
            rawScreenshotTransmitted: false,
            redactedRegionsCount: latestMergedRegions ? latestMergedRegions.length : 0,
            timestamp: Date.now()
          };

          // Update Packet Inspection Telemetry live before transmission
          updatePacketInspectionTelemetry(latestVisualElements, {
            task: taskToSend,
            context: structuredContext,
            privacyMetadata
          });

          // Step 6: Send ONLY sanitized screenshot + structured data to Visual Gateway
          let gatewayResult = null;
          try {
            console.log("[SIH26171] Gateway request started");
            gatewayResult = await sendToVisualGateway(
              sanitizedBlob,
              taskToSend,
              structuredContext,
              privacyMetadata,
              requestId
            );
            console.log("[SIH26171] Gateway response received");
          } catch (gwErr) {
            console.warn("Visual gateway upload error, falling back to text-only pipeline:", gwErr);
            if (agentSanitizedUploadStatus) {
              agentSanitizedUploadStatus.textContent = "GATEWAY FAILED (Falling back to text-only)";
              agentSanitizedUploadStatus.style.color = "#e65100";
            }
            if (agentReasoningText) {
              agentReasoningText.textContent = `Visual gateway call failed (${gwErr.message}). Falling back to text-only sanitized pipeline.`;
            }

            await executeTextOnlyFallback(activeTab, pageData, "Gateway error fallback");
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: null,
              executed: false,
              status: "fallback",
              executionResult: `Gateway error: ${gwErr.message}`,
              verification: "Fell back to text-only (/api/context)"
            });
            renderTraceHistory();
            break;
          }

          // Step 7: Process Visual Gateway response
          const { data, latencyMs } = gatewayResult;
          timing.gatewayMs = latencyMs;
          if (agentGatewayLatency) agentGatewayLatency.textContent = `${latencyMs} ms`;
          if (timingGateway) timingGateway.textContent = `${latencyMs} ms`;

          // Live ReAct Thought Display
          const currentThought = (data && data.action && (data.action.thought || data.action.reasoning)) || data.reasoning || "";
          setLiveAgentThought(currentThought);
          renderActivePlanChecklist(zeroShotPlan, currentStep - 1);

          if (agentSanitizedUploadStatus) {
            agentSanitizedUploadStatus.textContent = "ALLOWED (Delivered to Gateway)";
            agentSanitizedUploadStatus.style.color = "#2e7d32";
          }
          const isGeminiSuccess = data.provider === "Gemini" && !data.fallbackUsed;
          updatePipelineStage("REASONING", "completed", isGeminiSuccess ? "Gemini (Sanitized) ✓" : "Local Reasoning ✓");

          // Section AI Provider Telemetry

          const isFallback = data.fallbackUsed || data.provider === "Demo fallback" || data.providerType === "gemini-fallback";

          if (agentModeStatus) {
            if (isGeminiSuccess) {
              agentModeStatus.textContent = "AI PROVIDER: GEMINI";
              agentModeStatus.style.color = "#1565c0";
            } else if (isFallback) {
              agentModeStatus.textContent = "AI PROVIDER: DEMO FALLBACK";
              agentModeStatus.style.color = "#e65100";
            } else {
              agentModeStatus.textContent = "AI PROVIDER: DEMO (Deterministic)";
              agentModeStatus.style.color = "#0d47a1";
            }
          }

          if (agentModeSubtext) {
            if (isGeminiSuccess) {
              agentModeSubtext.textContent = "(Server-side Gemini reasoning over sanitized context; zero PII transmitted)";
            } else if (isFallback) {
              agentModeSubtext.textContent = "(Local deterministic fallback)";
            } else {
              agentModeSubtext.textContent = "(Deterministic local agent; no external AI API keys)";
            }
          }

          const agentReasoningLocation = document.getElementById("agentReasoningLocation");
          if (agentReasoningLocation) {
            if (isGeminiSuccess) {
              agentReasoningLocation.textContent = "GEMINI (Sanitized Context)";
              agentReasoningLocation.style.color = "#1565c0";
            } else if (isFallback) {
              agentReasoningLocation.textContent = "LOCAL FALLBACK";
              agentReasoningLocation.style.color = "#e65100";
            } else {
              agentReasoningLocation.textContent = "LOCAL (Deterministic)";
              agentReasoningLocation.style.color = "#2e7d32";
            }
          }

          if (agentFallbackRow && agentFallbackReasonText) {
            if (isFallback) {
              agentFallbackRow.style.display = "block";
              agentFallbackReasonText.textContent = data.fallbackReason || "Gemini API unavailable";
            } else {
              agentFallbackRow.style.display = "none";
            }
          }

          if (badgeGeminiReasoning) {
            if (isGeminiSuccess) {
              badgeGeminiReasoning.textContent = "2. GEMINI REASONING";
              badgeGeminiReasoning.style.background = "#e8eaf6";
              badgeGeminiReasoning.style.color = "#1a237e";
            } else if (isFallback) {
              badgeGeminiReasoning.textContent = "2. LOCAL FALLBACK REASONING";
              badgeGeminiReasoning.style.background = "#fff3e0";
              badgeGeminiReasoning.style.color = "#e65100";
            } else {
              badgeGeminiReasoning.textContent = "2. DEMO REASONING";
              badgeGeminiReasoning.style.background = "#ede7f6";
              badgeGeminiReasoning.style.color = "#4a148c";
            }
          }

          let agentAction = data.action;

          // FIX #2: STRICT STEP COMPATIBILITY & EXPLICIT TASK AUTHORITY
          // When a parsed task contains a current planned step, the returned agent action
          // MUST be compatible with that step. Incompatible actions from backend or page-text fallbacks
          // are discarded and replaced with local grounding for the planned step.
          setAgentState(AGENT_STATES.GROUND, "Grounding action locally...");
          if (currentStepPlan) {
            const plannedType = (currentStepPlan.type || "").toUpperCase();

            if (plannedType === "FILL_FORM") {
              agentAction = {
                action: "FILL_FORM",
                target: "all form fields",
                targetLabel: "all form fields",
                groundingMethod: "simultaneous-form-profile"
              };
            } else if (plannedType === "FILL") {
              const isCompatibleFill = agentAction && agentAction.action === "FILL" && agentAction.targetIndex !== undefined;
              // CRITICAL QUERY RULE: Authoritative explicit value extraction takes precedence
              let authoritativeVal = (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : null;
              if (!authoritativeVal && window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function") {
                authoritativeVal = window.SIHTaskParser.extractTaskQueryOrValue(task);
              }

              if (isCompatibleFill) {
                if (authoritativeVal) {
                  agentAction.value = authoritativeVal;
                } else if (!agentAction.value && currentStepPlan.value) {
                  agentAction.value = currentStepPlan.value;
                }
              }
              if (!isCompatibleFill) {
                const FORM_TYPES = new Set(["input", "textarea", "select"]);
                const normalize = (s) => (s || "").trim().toLowerCase();
                const targetHintNorm = normalize(currentStepPlan.fieldHint);

                let bestIdx = -1;
                let bestScore = 0;
                const fillCandidates = latestFusedElements || latestVisualElements || [];
                fillCandidates.forEach((el, idx) => {
                  if (!FORM_TYPES.has((el.type || "").toLowerCase())) return;
                  const labelNorm = normalize(el.label);
                  let score = 0;
                  if (labelNorm === targetHintNorm) score = 1.0;
                  else if (labelNorm.includes(targetHintNorm) || targetHintNorm.includes(labelNorm)) score = 0.8;
                  if (score > 0 && el.isVisualConfirmed) {
                    score = Math.min(1.0, score + 0.10);
                  }
                  if (score > bestScore) {
                    bestScore = score;
                    bestIdx = idx;
                  }
                });

                if (bestIdx >= 0 && bestScore >= 0.35) {
                  const matchedEl = fillCandidates[bestIdx];
                  agentAction = {
                    action: "FILL",
                    targetIndex: matchedEl.index !== undefined ? matchedEl.index : bestIdx,
                    targetType: matchedEl.type,
                    targetLabel: matchedEl.label,
                    value: authoritativeVal || currentStepPlan.value || (data.action?.value) || "",
                    groundingScore: bestScore,
                    groundingMethod: matchedEl.isVisualConfirmed ? "dom+visual-fusion" : "local-fuzzy-match"
                  };
                } else {
                  // Section 5 Bounded Recovery: Live DOM re-perception before falling back
                  const recoveryPage = await new Promise((r) => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
                        const _lastErr = chrome.runtime.lastError;
                        r(resp || null);
                      });
                    }, 250);
                  });
                  if (recoveryPage && Array.isArray(recoveryPage.visualElements)) {
                    latestVisualElements = recoveryPage.visualElements;
                    (latestVisualElements || []).forEach((el, idx) => {
                      if (!FORM_TYPES.has((el.type || "").toLowerCase())) return;
                      const labelNorm = normalize(el.label);
                      let score = 0;
                      if (labelNorm === targetHintNorm) score = 1.0;
                      else if (labelNorm.includes(targetHintNorm) || targetHintNorm.includes(labelNorm)) score = 0.8;
                      if (score > bestScore) {
                        bestScore = score;
                        bestIdx = idx;
                      }
                    });
                    if (bestIdx >= 0 && bestScore >= 0.35) {
                      const matchedEl = latestVisualElements[bestIdx];
                      stepRecoveryNote = "Recovered form field target after live DOM re-perception";
                      if (window.SIHEvaluationTracker) window.SIHEvaluationTracker.recordRecovery(stepRecoveryNote);
                      agentAction = {
                        action: "FILL",
                        targetIndex: bestIdx,
                        targetType: matchedEl.type,
                        targetLabel: matchedEl.label,
                        value: authoritativeVal || currentStepPlan.value || (data.action?.value) || "",
                        groundingScore: bestScore,
                        groundingMethod: "bounded-recovery-match"
                      };
                    }
                  }

                  if (!agentAction || agentAction.action !== "FILL") {
                    agentAction = {
                      action: "NONE",
                      target: null,
                      reason: `Could not safely ground form field '${currentStepPlan.fieldHint}' on DOM.`
                    };
                  }
                }
              }
            } else if (plannedType === "SUBMIT") {
              agentAction = {
                action: "SUBMIT",
                target: "search",
                targetType: "input",
                targetLabel: "search",
                groundingScore: 1.0,
                groundingMethod: "search-submission-rule"
              };
            } else if (plannedType === "CLICK") {
              const isSearchResultSelection = !!(currentStepPlan.query || (currentStepPlan.targetHint && (currentStepPlan.targetHint.includes("relevant result") || currentStepPlan.targetHint.includes("product") || currentStepPlan.targetHint.includes("first result"))));
              const queryNorm = (currentStepPlan.query || "").toLowerCase().trim();
              const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

              const ACCESSORY_TERMS = [
                "case", "cover", "protector", "screen protector", "tempered glass",
                "charger", "cable", "adapter", "cord", "strap", "holder", "stand",
                "pouch", "sleeve", "skin", "lens", "mount", "replacement",
                "battery pack", "power bank", "ear tips"
              ];

              let isCompatibleClick = agentAction && agentAction.action === "CLICK";
              if (isCompatibleClick && isSearchResultSelection) {
                const candLabel = (agentAction.targetLabel || agentAction.target || "").toLowerCase();
                if (isGenericNavigationOrHomepageTarget(candLabel)) {
                  isCompatibleClick = false; // Discard homepage navigation click
                }
                const candIsAccessory = ACCESSORY_TERMS.some(t => candLabel.includes(t) && !queryNorm.includes(t));
                if (candIsAccessory) {
                  // If Gemini proposed an accessory, check if an actual non-accessory product candidate exists
                  const hasActualProductCand = (latestVisualElements || []).some(el => {
                    const lNorm = (el.label || "").toLowerCase();
                    const matchesQuery = queryTokens.length > 0 && queryTokens.every(t => lNorm.includes(t));
                    const isAcc = ACCESSORY_TERMS.some(t => lNorm.includes(t) && !queryNorm.includes(t));
                    return matchesQuery && !isAcc && !isGenericNavigationOrHomepageTarget(el.label);
                  });
                  if (hasActualProductCand) {
                    isCompatibleClick = false; // Discard accessory to allow local grounding of actual device
                  }
                }
              }

              if (!isCompatibleClick || agentAction.targetIndex === undefined) {
                const normalize = (s) => (s || "").trim().toLowerCase();
                const rawHint = normalize(currentStepPlan.targetHint || currentStepPlan.legacyTarget || agentAction?.target || "").replace(/_button|_input/, "").trim();
                const cleanHint = rawHint.replace(/\s+(?:box|input|field|area|button|link)$/i, "").trim();

                const computeClickScore = (el) => {
                  if (el.disabled || String(el["aria-disabled"]).toLowerCase() === "true") return 0;
                  const elType = (el.type || "").toLowerCase();
                  if (!["button", "link", "input", "element"].includes(elType)) return 0;
                  const labelNorm = normalize(el.label);

                  if (isSearchResultSelection) {
                    // Anti-homepage filter: Never click navigation, header, or footer links
                    if (isGenericNavigationOrHomepageTarget(el.label)) return 0;
                    if (elType === "input" && (el.semanticTag === "SEARCH_INPUT" || labelNorm.includes("search"))) return 0;

                    // Product Selection Rule:
                    // Prefer actual product/device listing. Do NOT select accessories (cases, covers, screen protectors, chargers, cables)
                    // merely because they contain the product query.
                    const isAccessory = ACCESSORY_TERMS.some((term) => {
                      return labelNorm.includes(term) && !queryNorm.includes(term);
                    });

                    // Evaluate relevance against query
                    if (queryTokens.length > 0 && (elType === "link" || elType === "button" || elType === "element")) {
                      let matchCount = 0;
                      for (const t of queryTokens) {
                        if (labelNorm.includes(t)) matchCount++;
                      }
                      if (matchCount > 0) {
                        let relScore = 0.7 + (matchCount / queryTokens.length) * 0.25;
                        if (queryNorm && labelNorm.includes(queryNorm)) {
                          relScore += 0.05; // Exact query phrase bonus
                        }
                        // Penalize accessory listings heavily when seeking the actual product
                        if (isAccessory) {
                          relScore = Math.min(relScore * 0.2, 0.25);
                        }
                        return Math.min(relScore, 0.98);
                      }
                    }
                  }

                  let score = 0;
                  if (labelNorm === cleanHint || labelNorm === rawHint) {
                    score = 1.0;
                  } else if (cleanHint && (labelNorm.includes(cleanHint) || cleanHint.includes(labelNorm))) {
                    score = 0.85;
                  } else if (rawHint && (labelNorm.includes(rawHint) || rawHint.includes(labelNorm))) {
                    score = 0.8;
                  }
                  if (cleanHint === "submit" && (labelNorm.includes("submit") || labelNorm.includes("send") || el.semanticTag === "SUBMIT_BUTTON")) {
                    score = Math.max(score, 0.9);
                  }
                  if (score > 0) {
                    if (rawHint.includes("button")) {
                      if (elType === "button" || el.semanticTag?.includes("BUTTON")) score += 0.1;
                      else score *= 0.5;
                    }
                    if (rawHint.includes("box") || rawHint.includes("input") || rawHint.includes("field")) {
                      if (elType === "input" || elType === "textarea") score += 0.1;
                      else score *= 0.5;
                    }
                  }
                  return score;
                };

                let bestIdx = -1;
                let bestScore = 0;
                const clickCandidates = latestFusedElements || latestVisualElements || [];
                clickCandidates.forEach((el, idx) => {
                  let s = computeClickScore(el);
                  if (s > 0 && el.isVisualConfirmed) {
                    s = Math.min(1.0, s + 0.10);
                  }
                  if (s > bestScore) {
                    bestScore = s;
                    bestIdx = idx;
                  }
                });

                if (bestIdx >= 0 && bestScore >= 0.35) {
                  const matchedEl = clickCandidates[bestIdx];
                  agentAction = {
                    action: "CLICK",
                    target: matchedEl.label,
                    targetIndex: matchedEl.index !== undefined ? matchedEl.index : bestIdx,
                    targetType: matchedEl.type,
                    targetLabel: matchedEl.label,
                    groundingScore: bestScore,
                    groundingMethod: matchedEl.isVisualConfirmed ? "dom+visual-fusion" : "local-fuzzy-match"
                  };
                } else {
                  // Section 5 Bounded Recovery: Live DOM re-perception before falling back
                  const recoveryPage = await new Promise((r) => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
                        const _lastErr = chrome.runtime.lastError;
                        r(resp || null);
                      });
                    }, 250);
                  });
                  if (recoveryPage && Array.isArray(recoveryPage.visualElements)) {
                    latestVisualElements = recoveryPage.visualElements;
                    (latestVisualElements || []).forEach((el, idx) => {
                      const s = computeClickScore(el);
                      if (s > bestScore) {
                        bestScore = s;
                        bestIdx = idx;
                      }
                    });
                    if (bestIdx >= 0 && bestScore >= 0.35) {
                      const matchedEl = latestVisualElements[bestIdx];
                      stepRecoveryNote = "Recovered click target after live DOM re-perception";
                      if (window.SIHEvaluationTracker) window.SIHEvaluationTracker.recordRecovery(stepRecoveryNote);
                      agentAction = {
                        action: "CLICK",
                        target: matchedEl.label,
                        targetIndex: bestIdx,
                        targetType: matchedEl.type,
                        targetLabel: matchedEl.label,
                        groundingScore: bestScore,
                        groundingMethod: "bounded-recovery-match"
                      };
                    }
                  }

                  if (!agentAction || agentAction.action !== "CLICK") {
                    if (currentStepPlan.legacyTarget) {
                      agentAction = {
                        action: "CLICK",
                        target: currentStepPlan.legacyTarget,
                        groundingMethod: "keyword-rule"
                      };
                    } else {
                      agentAction = {
                        action: "NONE",
                        target: null,
                        reason: `Could not safely ground click target '${currentStepPlan.targetHint}' on DOM.`
                      };
                    }
                  }
                }
              }
            } else if (plannedType === "SCROLL") {
              if (!agentAction || agentAction.action !== "SCROLL") {
                agentAction = {
                  action: "SCROLL",
                  target: "PAGE",
                  amount: currentStepPlan.amount || 500
                };
              }
            }
          }

          const targetStr = agentAction?.target
            ? agentAction.target
            : (agentAction?.targetIndex !== undefined ? `${agentAction.targetType}: '${agentAction.targetLabel}'` : "None");
          let actionDisplay = "None";
          if (agentAction) {
            if (agentAction.action === "FILL") {
              let authoritativeVal = (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : null;
              if (!authoritativeVal && window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function") {
                authoritativeVal = window.SIHTaskParser.extractTaskQueryOrValue(task);
              }
              const fillVal = authoritativeVal || agentAction.value || "";
              if (authoritativeVal) agentAction.value = authoritativeVal;
              actionDisplay = fillVal
                ? `FILL → ${targetStr} (value: '${fillVal}')`
                : `FILL → ${targetStr}`;
            } else if (agentAction.amount !== undefined && agentAction.amount !== null) {
              actionDisplay = `${agentAction.action} → ${targetStr} (amount: ${agentAction.amount})`;
            } else {
              actionDisplay = `${agentAction.action} → ${targetStr}`;
            }
          }

          if (agentActionText) agentActionText.textContent = actionDisplay;
          if (agentReasoningText) {
            agentReasoningText.textContent = data.reasoning || (isGeminiSuccess ? "Gemini proposed action over sanitized context." : "Local deterministic decision");
          }
          if (decisionOutput) decisionOutput.value = actionDisplay;
          if (backendOutput) backendOutput.value = JSON.stringify(data, null, 2);

          // Milestone 15 & 16: Grounding UI telemetry
          if (groundingMethodText && groundingScoreText && groundedElementText) {
            if (agentAction?.targetIndex !== undefined) {
              groundingMethodText.textContent = agentAction.groundingMethod || "local-fuzzy-match";
              groundingScoreText.textContent = agentAction.groundingScore !== undefined ? String(agentAction.groundingScore) : "-";
              groundedElementText.textContent = `${agentAction.targetType}: '${agentAction.targetLabel}'`;
            } else if (agentAction?.target) {
              groundingMethodText.textContent = "keyword-rule (fixed target)";
              groundingScoreText.textContent = "-";
              groundedElementText.textContent = agentAction.target;
            } else {
              groundingMethodText.textContent = "-";
              groundingScoreText.textContent = "-";
              groundedElementText.textContent = "-";
            }
          }

          const groundedVisualEl = (agentAction?.targetIndex !== undefined && latestVisualElements)
            ? latestVisualElements[agentAction.targetIndex]
            : null;
          const bbox = groundedVisualEl
            ? { x: groundedVisualEl.x, y: groundedVisualEl.y, width: groundedVisualEl.width, height: groundedVisualEl.height }
            : null;

          updateGroundingInspection({
            element: agentAction?.targetLabel || agentAction?.target || targetStr,
            role: agentAction?.targetType || (groundedVisualEl?.type || "element"),
            type: groundedVisualEl?.type || (agentAction?.targetType || "element"),
            index: agentAction?.targetIndex,
            score: agentAction?.groundingScore !== undefined ? agentAction.groundingScore : 1.0,
            method: agentAction?.groundingMethod || (agentAction?.targetIndex !== undefined ? "local-fuzzy-match" : "keyword-rule"),
            bbox,
            reason: data.reasoning || (isGeminiSuccess ? "Gemini proposed action grounded to verified DOM element" : "Local perception grounded action to DOM element")
          });

          drawBoundingBoxOnPreview(bbox, agentAction?.targetLabel || agentAction?.target);

          // Milestone 18: Live Explainable Agent Overlay (Grounded Target on active webpage)
          if (agentAction && agentAction.action !== "NONE") {
            sendOverlayTelemetry(activeTab?.id, {
              action: "showAgentOverlay",
              payload: {
                state: "GROUNDED",
                action: agentAction.action,
                target: targetStr,
                targetLabel: agentAction.targetLabel,
                targetIndex: agentAction.targetIndex,
                targetType: agentAction.targetType,
                confidence: agentAction.groundingScore !== undefined ? agentAction.groundingScore : 1.0,
                method: agentAction.groundingMethod || (agentAction.targetIndex !== undefined ? "local-fuzzy-match" : "keyword-rule"),
                bbox
              }
            });
          }

          updatePipelineStage("GROUNDING", "completed", `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.0"})`);

          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: agentAction?.action,
            target: agentAction?.targetLabel || agentAction?.target || targetStr,
            value: agentAction?.value || "",
            grounding: `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (Score: ${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.00"})`,
            risk: "LOW",
            safety: "CHECKING...",
            status: "Evaluating safety gate..."
          });

          const stepIdentifier = currentStepPlan ? `step_${currentStep - 1}:${currentStepPlan.type}:${currentStepPlan.fieldHint || currentStepPlan.targetHint || ""}` : `step_${currentStep}`;
          const actionTargetIdentifier = agentAction?.target || (agentAction?.targetIndex !== undefined ? `#${agentAction.targetIndex}:${agentAction.targetType}:${agentAction.targetLabel}` : "");
          const actionKey = `${stepIdentifier}:${agentAction?.action}:${actionTargetIdentifier}:${agentAction?.amount || ""}`;

          // Step 8: Stall Guard (Check if identical action proposed again with no screen change)
          if (currentStep > 1 && lastActionKey === actionKey) {
            if (agentVerificationText) {
              agentVerificationText.textContent = "Stall Guard: Proposing identical action with no page change. Loop halted.";
              agentVerificationText.style.color = "#c62828";
            }
            if (agentExecutionStatus) agentExecutionStatus.textContent = "Halted: No further meaningful action possible";
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: agentAction,
              executed: false,
              status: "stalled",
              executionResult: "Halted by Stall Guard",
              verification: "No change from previous action"
            });
            renderTraceHistory();
            break;
          }

          // Step 9: If agent returns NONE or no target, terminate loop gracefully
          if (!agentAction || agentAction.action === "NONE" || (!agentAction.target && agentAction.targetIndex === undefined)) {
            if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (No-op action safely handled)";
            if (agentExecutionStatus) agentExecutionStatus.textContent = "Task complete (No further action needed)";
            if (executionOutput) executionOutput.value = "Task complete (Action is NONE)";
            if (agentVerificationText) {
              agentVerificationText.textContent = "Verification: Goal reached or no actionable target.";
              agentVerificationText.style.color = "#2e7d32";
            }

            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: agentAction,
              executed: false,
              status: "completed",
              executionResult: "Skipped (Action is NONE)",
              verification: "Goal completed"
            });
            renderTraceHistory();
            break;
          }

          // Step 10: Safe Execution via Local Allowlist in content.js (Milestones 5, 6, 14, 15, 16 & 17)
          let actionExecutionSummary = "";
          let actionExecutedSuccessfully = false;

          let executionPayload = null;
          if (agentAction.action === "FILL_FORM" || (currentStepPlan && currentStepPlan.type === "FILL_FORM")) {
            const localProf = (window.SIHFormProfile && typeof window.SIHFormProfile.getFormProfile === "function")
              ? window.SIHFormProfile.getFormProfile()
              : null;
            executionPayload = {
              action: "FILL_FORM",
              profile: localProf,
              simultaneous: true
            };
          } else if (agentAction.action === "FILL") {
            // Phase 7 Safety Guard: Never fill the wrong field
            if (currentStepPlan && currentStepPlan.type === "FILL") {
              const hintNorm = (currentStepPlan.fieldHint || "").toLowerCase().replace(/[:*_\-\/\\]+/g, " ").trim();
              const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_\-\/\\]+/g, " ").trim();
              const hintTokens = new Set(hintNorm.split(/\s+/).filter(Boolean));
              const targetTokens = new Set(targetNorm.split(/\s+/).filter(Boolean));
              let sharesToken = false;
              for (const ht of hintTokens) {
                if (targetTokens.has(ht)) { sharesToken = true; break; }
              }
              const isSynonym = (hintNorm === "name" && targetNorm.includes("name")) ||
                (hintNorm.includes("name") && targetNorm.includes("name")) ||
                (hintNorm.includes("email") && targetNorm.includes("email")) ||
                (hintNorm.includes("address") && targetNorm.includes("address")) ||
                (hintNorm.includes("phone") && targetNorm.includes("phone")) ||
                (hintNorm.includes("city") && targetNorm.includes("city"));

              if (!sharesToken && !isSynonym && !targetNorm.includes(hintNorm) && !hintNorm.includes(targetNorm)) {
                if (agentSafetyStatus) agentSafetyStatus.textContent = "SAFETY REJECT: Target Mismatch";
                if (agentExecutionStatus) agentExecutionStatus.textContent = `Halted: Grounded '${agentAction.targetLabel}' does not match requested field '${currentStepPlan.fieldHint}'`;
                // Milestone 18: Live Explainable Agent Overlay (Safety Blocked)
                sendOverlayTelemetry(activeTab?.id, {
                  action: "updateAgentOverlay",
                  payload: {
                    state: "SAFETY_BLOCKED",
                    action: agentAction.action,
                    target: targetStr,
                    reason: `Target '${agentAction.targetLabel}' does not match requested field '${currentStepPlan.fieldHint}'`
                  }
                });
                executionTraceHistory.push({
                  step: currentStep,
                  requestId,
                  action: agentAction,
                  executed: false,
                  status: "mismatch_rejected",
                  executionResult: `Rejected: Target '${agentAction.targetLabel}' does not match requested field '${currentStepPlan.fieldHint}'`,
                  verification: "Phase 7 Safety Check (Never fill wrong field)"
                });
                renderTraceHistory();
                break;
              }
            }
            // CRITICAL PRIVACY & AUTHORITATIVE EXTRACTION:
            // FILL VALUE PRIORITY for search and form fields:
            // 1. extractTaskQueryOrValue(task) / currentStepPlan.value is authoritative
            let authoritativeVal = (currentStepPlan && currentStepPlan.value) ? currentStepPlan.value : null;
            if (!authoritativeVal && window.SIHTaskParser && typeof window.SIHTaskParser.extractTaskQueryOrValue === "function") {
              authoritativeVal = window.SIHTaskParser.extractTaskQueryOrValue(task);
            }

            let localVal = authoritativeVal || "";

            // 1. Direct from currentStepPlan if this step in the plan is a FILL step with a value
            if (!localVal && currentStepPlan && currentStepPlan.type === "FILL" && currentStepPlan.value) {
              localVal = currentStepPlan.value;
            }

            // 2. Look up by step index (0-indexed) in localValuesMap
            if (!localVal && localValuesMap[currentStep - 1] !== undefined) {
              localVal = localValuesMap[currentStep - 1];
            }

            // 3. Look up by fieldHint / targetLabel match in plannedSteps
            if (!localVal && Array.isArray(plannedSteps)) {
              const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
              for (const st of plannedSteps) {
                if (st.type === "FILL" && st.value) {
                  const hintNorm = (st.fieldHint || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                  if (hintNorm && (targetNorm.includes(hintNorm) || hintNorm.includes(targetNorm))) {
                    localVal = st.value;
                    break;
                  }
                }
              }
            }

            // 4. Look up by normalized targetLabel in localValuesMap
            if (!localVal && agentAction.targetLabel) {
              const targetNorm = agentAction.targetLabel.toLowerCase().replace(/[:*_-]/g, " ").trim();
              for (const [k, v] of Object.entries(localValuesMap)) {
                const kNorm = String(k).toLowerCase().replace(/[:*_-]/g, " ").trim();
                if (kNorm && (targetNorm.includes(kNorm) || kNorm.includes(targetNorm))) {
                  localVal = v;
                  break;
                }
              }
            }

            // 5. Fallback for single-field FILL task: if exactly one fill value exists in local store
            if (!localVal && Array.isArray(plannedSteps)) {
              const fillSteps = plannedSteps.filter((s) => s.type === "FILL" && s.value);
              if (fillSteps.length === 1) {
                localVal = fillSteps[0].value;
              }
            }

            // 6. Emergency local fallback: parse directly from task text if not previously planned
            if (!localVal && window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
              const freshParsed = window.SIHTaskParser.parseTask(task);
              if (freshParsed && Array.isArray(freshParsed.steps)) {
                const fillSteps = freshParsed.steps.filter((s) => s.type === "FILL" && s.value);
                if (fillSteps.length === 1) {
                  localVal = fillSteps[0].value;
                } else if (fillSteps.length > 0) {
                  const targetNorm = (agentAction.targetLabel || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                  for (const st of fillSteps) {
                    const hintNorm = (st.fieldHint || "").toLowerCase().replace(/[:*_-]/g, " ").trim();
                    if (hintNorm && (targetNorm.includes(hintNorm) || hintNorm.includes(targetNorm))) {
                      localVal = st.value;
                      break;
                    }
                  }
                }
              }
            }

            // 7. Only use Gemini's value if no explicit task value can be safely extracted
            if (!localVal && agentAction.value) {
              localVal = agentAction.value;
            }

            // Never replace an explicit search value with target labels/placeholders/task suffixes
            if (authoritativeVal) {
              localVal = authoritativeVal;
            }

            agentAction.value = localVal;

            executionPayload = {
              action: "FILL",
              targetIndex: agentAction.targetIndex,
              targetType: agentAction.targetType || "input",
              targetLabel: agentAction.targetLabel,
              value: localVal,
              localValue: localVal
            };
          } else if (agentAction.action === "SUBMIT" || (currentStepPlan && currentStepPlan.type === "SUBMIT")) {
            executionPayload = {
              action: "SUBMIT",
              target: agentAction.target || "search",
              query: currentStepPlan ? currentStepPlan.query : null
            };
          } else if (agentAction.targetIndex !== undefined) {
            executionPayload = {
              action: "CLICK",
              targetIndex: agentAction.targetIndex,
              targetType: agentAction.targetType,
              targetLabel: agentAction.targetLabel
            };
          } else {
            executionPayload = agentAction;
          }

          // =====================================================================
          // Final Architecture: On-Device Reasoning & Safety Gate (Human Approval)
          // =====================================================================
          setAgentState(AGENT_STATES.SAFETY, "Evaluating safety gate...");
          let stepPlanForCheck = currentStepPlan || (reasoningPlan && reasoningPlan.steps ? reasoningPlan.steps[currentStep - 1] : null);

          let safetyGate = { allowed: true, requiresApproval: false, risk: "LOW", reason: "Safe action" };
          if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.evaluateSafetyGate === "function") {
            safetyGate = window.SIHReasoningPlanner.evaluateSafetyGate(
              agentAction,
              stepPlanForCheck,
              null, // No approval token prior to user prompt
              { url: activeTab?.url, title: pageData?.title, visualElements: latestVisualElements }
            );
          }

          // Preconditions check: verify dependencies (e.g. prior fields verified before Submit)
          if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.validatePreconditions === "function" && stepPlanForCheck) {
            const preCheck = window.SIHReasoningPlanner.validatePreconditions(
              stepPlanForCheck,
              executionTraceHistory,
              null
            );
            const isSatisfied = preCheck ? (preCheck.satisfied ?? preCheck.valid ?? true) : true;
            if (!isSatisfied && !safetyGate.requiresApproval && !preCheck.requiresHumanApproval) {
              safetyGate.allowed = false;
              safetyGate.reason = preCheck.reason;
              safetyGate.rejectionReason = preCheck.reason;
            }
          }

          // Update Safety UI
          if (plannerRiskBadge) {
            plannerRiskBadge.textContent = safetyGate.risk;
            plannerRiskBadge.style.background = (safetyGate.risk === "HIGH" || safetyGate.risk === "CRITICAL") ? "#fee2e2" : ((safetyGate.risk === "MEDIUM") ? "#fef3c7" : "#e0e7ff");
            plannerRiskBadge.style.color = (safetyGate.risk === "HIGH" || safetyGate.risk === "CRITICAL") ? "#b91c1c" : ((safetyGate.risk === "MEDIUM") ? "#b45309" : "#3730a3");
          }
          if (plannerSafetyDecision) {
            plannerSafetyDecision.textContent = safetyGate.allowed
              ? (safetyGate.requiresApproval ? "APPROVAL REQUIRED" : "PASSED (Safe Action)")
              : `BLOCKED: ${safetyGate.rejectionReason || safetyGate.reason}`;
            plannerSafetyDecision.style.color = safetyGate.allowed
              ? (safetyGate.requiresApproval ? "#d97706" : "#166534")
              : "#dc2626";
          }
          if (plannerApprovalStatus) {
            plannerApprovalStatus.textContent = safetyGate.requiresApproval ? "WAITING FOR USER" : "NOT REQUIRED";
            plannerApprovalStatus.style.color = safetyGate.requiresApproval ? "#dc2626" : "#1e1b4b";
          }
          if (safetyGate.allowed && !safetyGate.requiresApproval) {
            if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (Safe Action)";
          }

          updatePipelineStage(
            "SAFETY",
            safetyGate.allowed ? "completed" : "failed",
            safetyGate.allowed ? (safetyGate.requiresApproval ? "Approval required" : "Passed allowlist ✓") : "Blocked ✗"
          );

          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: agentAction?.action,
            target: agentAction?.targetLabel || agentAction?.target || targetStr,
            value: agentAction?.value || "",
            grounding: `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (Score: ${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.00"})`,
            risk: safetyGate.risk || "LOW",
            safety: safetyGate.allowed ? (safetyGate.requiresApproval ? "APPROVAL REQUIRED" : "ALLOWED") : `BLOCKED: ${safetyGate.reason}`,
            status: safetyGate.allowed ? "Ready to execute" : "Halted by safety gate"
          });

          // 1. If action requires Human Approval (Submit, Send, Delete, Purchase, etc.)
          if (safetyGate.requiresApproval) {
            appendPlannerTrace(`Consequential action '${agentAction.action} \u2192 ${targetStr}' requires explicit human approval.`);
            if (agentStepText) agentStepText.textContent = `Step ${currentStep}: WAITING FOR HUMAN APPROVAL`;
            if (agentVerificationText) {
              agentVerificationText.textContent = "Action paused: Consequential action requires explicit human approval.";
              agentVerificationText.style.color = "#e11d48";
            }
            if (plannerApprovalStatus) {
              plannerApprovalStatus.textContent = "WAITING FOR USER APPROVAL";
              plannerApprovalStatus.style.color = "#dc2626";
            }
            if (popupApprovalContainer) {
              popupApprovalContainer.style.display = "block";
              if (popupApprovalAction) popupApprovalAction.textContent = `${agentAction.action} \u2192 ${targetStr}`;
              if (popupApprovalReason) popupApprovalReason.textContent = safetyGate.reason;
            }

            // Trigger In-Page modal in active tab
            const inPageApprovalPromise = new Promise((resolve) => {
              chrome.tabs.sendMessage(
                activeTab.id,
                {
                  action: "requestHumanApproval",
                  payload: {
                    action: agentAction.action,
                    target: targetStr,
                    risk: safetyGate.risk,
                    reason: safetyGate.reason,
                    taskSummary: task
                  }
                },
                (res) => {
                  if (chrome.runtime.lastError || !res) {
                    // Tab didn't respond or message channel closed
                  } else {
                    resolve(res);
                  }
                }
              );
            });

            // Popup button listeners
            const popupApprovalPromise = new Promise((resolve) => {
              const onApprove = () => {
                cleanup();
                resolve({ approved: true });
              };
              const onCancel = () => {
                cleanup();
                resolve({ approved: false, cancelled: true });
              };
              const cleanup = () => {
                if (popupBtnApprove) popupBtnApprove.removeEventListener("click", onApprove);
                if (popupBtnCancel) popupBtnCancel.removeEventListener("click", onCancel);
              };
              if (popupBtnApprove) popupBtnApprove.addEventListener("click", onApprove);
              if (popupBtnCancel) popupBtnCancel.addEventListener("click", onCancel);
            });

            // Await genuine user approval - NO TIMEOUT, NO DEFAULT TRUE
            const userDecision = await Promise.race([
              inPageApprovalPromise,
              popupApprovalPromise
            ]);

            // Cleanup approval UI
            if (popupApprovalContainer) popupApprovalContainer.style.display = "none";
            chrome.tabs.sendMessage(activeTab.id, { action: "dismissHumanApproval" }, () => {
              if (chrome.runtime.lastError) { }
            });

            // Handle Cancellation
            if (!userDecision || !userDecision.approved) {
              appendPlannerTrace("Execution cancelled by user.");
              // Milestone 18: Live Explainable Agent Overlay (Safety Blocked / Cancelled)
              sendOverlayTelemetry(activeTab?.id, {
                action: "updateAgentOverlay",
                payload: {
                  state: "SAFETY_BLOCKED",
                  action: agentAction.action,
                  target: targetStr,
                  reason: "Execution cancelled by user"
                }
              });
              if (plannerApprovalStatus) {
                plannerApprovalStatus.textContent = "CANCELLED BY USER";
                plannerApprovalStatus.style.color = "#dc2626";
              }
              if (agentExecutionStatus) agentExecutionStatus.textContent = "Execution cancelled by user.";
              if (agentSafetyStatus) agentSafetyStatus.textContent = "CANCELLED BY USER";
              if (executionOutput) executionOutput.value = "Execution cancelled by user.";
              if (agentVerificationText) {
                agentVerificationText.textContent = "Execution cancelled by user. Page state preserved.";
                agentVerificationText.style.color = "#dc2626";
              }
              executionTraceHistory.push({
                step: currentStep,
                requestId,
                action: agentAction,
                executed: false,
                status: "cancelled_by_user",
                executionResult: "Execution cancelled by user.",
                verification: "No action performed; page preserved"
              });
              renderTraceHistory();
              break;
            }

            // User Approved - Enforce Dynamic DOM re-grounding & invalidation check
            appendPlannerTrace(`User approved ${agentAction.action} \u2192 ${targetStr}. Re-verifying target on live page.`);
            if (plannerApprovalStatus) {
              plannerApprovalStatus.textContent = "APPROVED BY USER";
              plannerApprovalStatus.style.color = "#166534";
            }

            // Dynamic DOM Re-verification: Target element must still be valid
            const freshCheckData = await new Promise((resolve) => {
              chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
                resolve(resp || null);
              });
            });

            let targetReverified = false;
            if (freshCheckData && Array.isArray(freshCheckData.visualElements)) {
              if (agentAction.targetIndex !== undefined) {
                const currentEl = freshCheckData.visualElements[agentAction.targetIndex];
                if (currentEl && currentEl.label === agentAction.targetLabel) {
                  targetReverified = true;
                } else {
                  // Re-find target in case DOM shifted slightly
                  const foundIdx = freshCheckData.visualElements.findIndex(
                    (el) => el.label === agentAction.targetLabel && el.type === agentAction.targetType
                  );
                  if (foundIdx >= 0) {
                    agentAction.targetIndex = foundIdx;
                    if (executionPayload) executionPayload.targetIndex = foundIdx;
                    targetReverified = true;
                  }
                }
              } else if (agentAction.target) {
                targetReverified = true;
              }
            } else {
              targetReverified = true;
            }

            if (!targetReverified) {
              appendPlannerTrace("Target changed or moved after approval. Safety gate re-locked.");
              if (agentSafetyStatus) agentSafetyStatus.textContent = "APPROVAL INVALIDATED: Target Drift";
              if (agentExecutionStatus) agentExecutionStatus.textContent = "Target moved or disappeared after approval. Halted.";
              executionTraceHistory.push({
                step: currentStep,
                requestId,
                action: agentAction,
                executed: false,
                status: "approval_invalidated",
                executionResult: "Target drifted after approval. Execution halted.",
                verification: "Dynamic DOM verification protected action"
              });
              renderTraceHistory();
              break;
            }

            // Re-evaluate safety gate with valid approval token
            const currentApprovalToken = {
              approved: true,
              action: agentAction.action,
              target: agentAction.targetLabel || agentAction.target || targetStr,
              pageUrl: activeTab?.url,
              timestamp: Date.now()
            };
            if (window.SIHReasoningPlanner && typeof window.SIHReasoningPlanner.evaluateSafetyGate === "function") {
              const recheckGate = window.SIHReasoningPlanner.evaluateSafetyGate(
                agentAction,
                stepPlanForCheck,
                currentApprovalToken,
                { url: activeTab?.url, title: freshCheckData?.title || pageData?.title, visualElements: freshCheckData?.visualElements }
              );
              if (!recheckGate.allowed) {
                appendPlannerTrace(`Safety Gate rejected even with approval: ${recheckGate.reason}`);
                if (agentSafetyStatus) agentSafetyStatus.textContent = `SAFETY BLOCKED: ${recheckGate.reason}`;
                if (agentExecutionStatus) agentExecutionStatus.textContent = `Halted: ${recheckGate.reason}`;
                executionTraceHistory.push({
                  step: currentStep,
                  requestId,
                  action: agentAction,
                  executed: false,
                  status: "safety_blocked",
                  executionResult: recheckGate.reason,
                  verification: "Safety gate post-approval recheck"
                });
                renderTraceHistory();
                break;
              }
            }
          } else if (!safetyGate.allowed) {
            // 2. If safety gate rejected without approval requirement (e.g. CRITICAL or invalid action)
            appendPlannerTrace(`Safety Gate rejected action: ${safetyGate.rejectionReason || safetyGate.reason}`);
            // Milestone 18: Live Explainable Agent Overlay (Safety Blocked)
            sendOverlayTelemetry(activeTab?.id, {
              action: "updateAgentOverlay",
              payload: {
                state: "SAFETY_BLOCKED",
                action: agentAction.action,
                target: targetStr,
                reason: safetyGate.rejectionReason || safetyGate.reason
              }
            });
            if (agentSafetyStatus) agentSafetyStatus.textContent = `SAFETY BLOCKED: ${safetyGate.rejectionReason || safetyGate.reason}`;
            if (agentExecutionStatus) agentExecutionStatus.textContent = `Halted by Safety Gate: ${safetyGate.reason}`;
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: agentAction,
              executed: false,
              status: "safety_blocked",
              executionResult: `Blocked by Safety Gate: ${safetyGate.reason}`,
              verification: "Safety gate policy enforcement"
            });
            renderTraceHistory();
            break;
          }

          console.log("[SIH26171] Safety validation completed");

          console.log("[SIH26171] Action execution started");
          setAgentState(AGENT_STATES.EXECUTE, `Executing ${agentAction.action}...`);
          // Milestone 18: Live Explainable Agent Overlay (Executing State)
          sendOverlayTelemetry(activeTab?.id, {
            action: "updateAgentOverlay",
            payload: {
              state: "EXECUTING",
              action: agentAction.action,
              target: targetStr
            }
          });
          if (executionOutput) executionOutput.value = "Executing action via local allowlist...";
          await new Promise((resolveExec) => {
            chrome.tabs.sendMessage(
              activeTab.id,
              { action: "executeAction", payload: executionPayload },
              (execRes) => {
                if (chrome.runtime.lastError) {
                  actionExecutionSummary = `Execution error: ${chrome.runtime.lastError.message}`;
                } else if (execRes && execRes.result) {
                  const r = execRes.result;
                  if (r.executed) {
                    actionExecutedSuccessfully = true;
                    if (r.action === "FILL_FORM") {
                      const fieldNames = (r.fieldsFilled || []).map(f => f.targetLabel || f.matchedKey).join(", ");
                      actionExecutionSummary = `Executed: FILL_FORM (Simultaneous) → Filled ${r.count} field(s) [${fieldNames}]`;
                      if (fillStepStatus) {
                        fillStepStatus.textContent = `Autofilled ${r.count} field(s) simultaneously (Verified: ${r.verified ? "OK" : "Pending"})`;
                      }
                    } else if (r.action === "FILL") {
                      actionExecutionSummary = `Executed: FILL → ${r.targetType}: '${r.targetLabel}' (index: ${r.groundedIndex}, verified: ${r.verified ? "OK" : "Pending"})`;
                      if (fillStepStatus) {
                        fillStepStatus.textContent = `Step ${currentStep} (${r.targetLabel}): OK (Verified: ${r.verified ? "OK" : "Pending"})`;
                      }
                    } else if (r.action === "SUBMIT") {
                      actionExecutionSummary = `Executed: SUBMIT → ${r.target || "search"} (method: ${r.method || "enter_key"})`;
                    } else if (r.amount !== undefined && r.amount !== null) {
                      actionExecutionSummary = `Executed: ${r.action} → ${r.target} (amount: ${r.amount})`;
                    } else {
                      actionExecutionSummary = r.target
                        ? `Executed: ${r.action} → ${r.target}`
                        : `Executed: ${r.action} → ${r.targetType}: '${r.targetLabel}' (index: ${r.groundedIndex})`;
                    }
                  } else {
                    actionExecutionSummary = `Not executed: ${r.reason}`;
                    if (fillStepStatus && (agentAction.action === "FILL" || agentAction.action === "FILL_FORM")) {
                      fillStepStatus.textContent = `Failed: ${r.reason}`;
                    }
                  }
                } else {
                  actionExecutionSummary = "No execution response received";
                }
                resolveExec();
              }
            );
          });
          console.log("[SIH26171] Action execution completed");

          if (executionOutput) executionOutput.value = actionExecutionSummary;
          if (agentExecutionStatus) agentExecutionStatus.textContent = actionExecutionSummary;

          if (!actionExecutedSuccessfully) {
            if (agentSafetyStatus) agentSafetyStatus.textContent = `REJECTED by Allowlist: ${actionExecutionSummary}`;
            executionTraceHistory.push({
              step: currentStep,
              requestId,
              action: agentAction,
              executed: false,
              status: "rejected",
              executionResult: actionExecutionSummary,
              verification: "Allowlist rejected target"
            });
            renderTraceHistory();
            break;
          }

          if (agentSafetyStatus) agentSafetyStatus.textContent = "PASSED (Allowlist Verified)";

          updatePipelineStage(
            "EXECUTION",
            actionExecutedSuccessfully ? "completed" : "failed",
            actionExecutedSuccessfully ? `${agentAction?.action} executed ✓` : "Execution failed ✗"
          );

          updateCurrentActionCard({
            stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
            action: agentAction?.action,
            target: agentAction?.targetLabel || agentAction?.target || targetStr,
            value: agentAction?.value || "",
            grounding: `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (Score: ${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.00"})`,
            risk: safetyGate.risk || "LOW",
            safety: "ALLOWED",
            status: actionExecutedSuccessfully ? "Executed (Verifying screen change...)" : "Execution failed"
          });

          if (actionExecutedSuccessfully) {
            appendPlannerTrace(`Step ${currentStep} executed: ${agentAction.action} \u2192 ${targetStr}.`);
            if (stepPlanForCheck) {
              stepPlanForCheck.completed = true;
              stepPlanForCheck.verified = true;
            }
          }

          // Step 11: Post-Action Verification via Screen-Change Detection
          // If an action could navigate or update the DOM, wait for page to stabilize
          if (agentAction.action === "SUBMIT") {
            setAgentState(AGENT_STATES.WAIT, "Waiting for search results...");
            await waitForSearchResultsStabilization(activeTab.id, 5000);
            await waitForTabReady(activeTab.id, 6000);
            setAgentState(AGENT_STATES.REPERCEIVE, "Perceiving search results...");
          } else if (agentAction.action === "CLICK" || agentAction.action === "FILL" || agentAction.action === "FILL_FORM") {
            await waitForTabReady(activeTab.id, 6000);
          } else {
            await new Promise((r) => setTimeout(r, ACTION_VERIFICATION_DELAY_MS));
          }

          setAgentState(AGENT_STATES.VERIFY, "Verifying screen change...");
          let postActionSignature = null;
          if (window.SIHChangeDetector && typeof window.SIHChangeDetector.computeScreenSignature === "function") {
            const updatedDom = await new Promise((resolveDom) => {
              chrome.tabs.sendMessage(activeTab.id, { action: "getPageInfo" }, (resp) => {
                resolveDom((resp && resp.visualElements) ? resp.visualElements : latestVisualElements);
              });
            });

            const postDataUrl = (await captureScreenshotDataUrl(activeTab.windowId)) || latestScreenshotDataUrl;

            postActionSignature = await window.SIHChangeDetector.computeScreenSignature(postDataUrl, updatedDom);
          }

          let verificationResultStr = "Verification unavailable";
          if (currentSignature && postActionSignature && window.SIHChangeDetector) {
            const changeResult = window.SIHChangeDetector.compareScreenSignatures(
              currentSignature,
              postActionSignature,
              PIXEL_CHANGE_THRESHOLD
            );
            verificationResultStr = changeResult.changed
              ? `Page changed as expected (${changeResult.reason})`
              : `No visible change detected (${changeResult.reason})`;
            if (agentVerificationText) {
              agentVerificationText.textContent = verificationResultStr;
              agentVerificationText.style.color = changeResult.changed ? "#2e7d32" : "#e65100";
            }
          }

          // Record evaluation metrics (Section 23)
          if (window.SIHEvaluationTracker) {
            window.SIHEvaluationTracker.recordAction({
              action: agentAction.action,
              target: targetStr,
              groundingScore: agentAction.groundingScore,
              executed: actionExecutedSuccessfully,
              risk: safetyGate.risk
            });
            const isCh = !!(currentSignature && postActionSignature && window.SIHChangeDetector &&
              window.SIHChangeDetector.compareScreenSignatures(currentSignature, postActionSignature, PIXEL_CHANGE_THRESHOLD).changed);
            window.SIHEvaluationTracker.recordVerification(isCh, verificationResultStr);

            updatePipelineStage(
              "VERIFICATION",
              "completed",
              isCh ? "Page changed as expected ✓" : "Page state stable ✓"
            );

            // Milestone 18: Live Explainable Agent Overlay (Verified State)
            sendOverlayTelemetry(activeTab?.id, {
              action: "updateAgentOverlay",
              payload: {
                state: "VERIFIED",
                action: agentAction?.action,
                target: targetStr
              }
            });

            updateCurrentActionCard({
              stepText: isPlannedTask ? `STEP ${currentStep} / ${totalPlannedSteps}` : `STEP ${currentStep} / ${MAX_AGENT_STEPS}`,
              action: agentAction?.action,
              target: agentAction?.targetLabel || agentAction?.target || targetStr,
              value: agentAction?.value || "",
              grounding: `${agentAction?.targetLabel || agentAction?.target || "Grounded"} (Score: ${agentAction?.groundingScore !== undefined ? agentAction.groundingScore : "1.00"})`,
              risk: safetyGate.risk || "LOW",
              safety: "ALLOWED",
              status: isCh ? "VERIFIED ✓ (Page changed as expected)" : "VERIFIED ✓ (Page state verified)"
            });
          }

          // Record explainable trace for this step (Section 22)
          executionTraceHistory.push({
            step: currentStep,
            totalSteps: isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS,
            requestId,
            agentState: currentAgentState || "VERIFY",
            action: agentAction,
            executed: true,
            status: "success",
            perception: (latestVisualElements && latestVisualElements.length > 0)
              ? `${latestVisualElements.length} visual elements perceived locally`
              : "DOM perception active",
            groundingStr: `Label='${agentAction.targetLabel || agentAction.target || "none"}', Role=${agentAction.targetType || "element"}, Conf=${agentAction.groundingScore !== undefined ? agentAction.groundingScore : 1.0}`,
            risk: safetyGate.risk || "LOW",
            safetyDecision: safetyGate.allowed ? (safetyGate.requiresApproval ? "APPROVED" : "ALLOWED") : "BLOCKED",
            humanApproval: safetyGate.requiresApproval ? "GRANTED" : "NOT REQUIRED",
            executionResult: actionExecutionSummary,
            verification: verificationResultStr,
            recovery: stepRecoveryNote
          });
          renderTraceHistory();

          // Step 12: Loop termination condition
          const executedThisStep = actionExecutedSuccessfully;
          const screenActuallyChanged = !!(currentSignature && postActionSignature && window.SIHChangeDetector &&
            window.SIHChangeDetector.compareScreenSignatures(currentSignature, postActionSignature, PIXEL_CHANGE_THRESHOLD).changed);

          // Check if explicit planned steps remain
          let hasMoreSteps = isPlannedTask && currentStep < totalPlannedSteps;

          // Generic Multi-Page / State Transition Re-evaluation:
          // If the initial plan completed (e.g. initial Click on a search engine or homepage link),
          // check if the overall user task still has unfulfilled intent (e.g. search, open product/video, play, add to cart).
          if (!hasMoreSteps && executedThisStep && (screenActuallyChanged || agentAction?.action === "CLICK") && currentStep < MAX_AGENT_STEPS) {
            // Check if user task has remaining multi-step intent not yet fulfilled
            if (window.SIHTaskParser && typeof window.SIHTaskParser.parseTask === "function") {
              const fullTaskParsed = window.SIHTaskParser.parseTask(task);
              if (fullTaskParsed && Array.isArray(fullTaskParsed.steps) && fullTaskParsed.steps.length > currentStep) {
                plannedSteps = fullTaskParsed.steps;
                totalPlannedSteps = Math.min(plannedSteps.length, MAX_AGENT_STEPS);
                isPlannedTask = true;
                if (fullTaskParsed.localValues) {
                  localValuesMap = Object.assign({}, localValuesMap, fullTaskParsed.localValues);
                }
                hasMoreSteps = currentStep < totalPlannedSteps;
                if (hasMoreSteps) {
                  appendPlannerTrace(`Page transition verified. Continuing multi-stage task (Step ${currentStep + 1} of ${totalPlannedSteps})...`);
                }
              }
            }
          }

          const shouldContinue = executedThisStep && (isPlannedTask ? hasMoreSteps : (screenActuallyChanged && currentStep < MAX_AGENT_STEPS));

          if (!shouldContinue) {
            setAgentState(AGENT_STATES.COMPLETE, `Completed at Step ${currentStep}`);
            setLiveAgentStatus("ready", "COMPLETED");
            if (pipelineStepCounter) {
              pipelineStepCounter.textContent = `Completed (${isPlannedTask ? totalPlannedSteps : currentStep} steps)`;
            }
            if (agentStepText) {
              agentStepText.textContent = `Completed at Step ${currentStep} of ${isPlannedTask ? totalPlannedSteps : MAX_AGENT_STEPS}`;
            }
            break;
          }

          setAgentState(AGENT_STATES.CONTINUE, `Proceeding to step ${currentStep + 1}...`);
          // Prepare next iteration
          previousScreenSignature = postActionSignature || currentSignature;
          lastActionKey = actionKey;
          currentStep++;
        }

        if (reasoningPlan && Array.isArray(reasoningPlan.steps) && reasoningPlan.steps.length > 0) {
          const allCompleted = reasoningPlan.steps.every((s) => s.completed || s.verified);
          if (allCompleted) {
            appendPlannerTrace("All requested form fields and actions verified. Task complete.");
          }
          if (window.SIHEvaluationTracker) {
            window.SIHEvaluationTracker.recordTaskEnd(currentRequestId, allCompleted);
          }
        } else {
          if (window.SIHEvaluationTracker) {
            window.SIHEvaluationTracker.recordTaskEnd(currentRequestId, true);
          }
        }
      } catch (err) {
        console.error("[SIH26171] Run Agent Task error:", err);
        const errMsg = (err && err.message) ? err.message : String(err);
        setLiveAgentStatus("error", "FAILED");
        updatePipelineStage("EXECUTION", "failed", "Error occurred ✗");
        updateCurrentActionCard({
          stepText: typeof currentStep !== "undefined" ? `STEP ${currentStep}` : "FAILED",
          action: "ERROR",
          target: "-",
          value: "",
          grounding: "-",
          risk: "HIGH",
          safety: "BLOCKED",
          status: `FAILED: ${errMsg}`
        });
        if (agentTaskText) agentTaskText.textContent = task;
        if (agentExecutionStatus) agentExecutionStatus.textContent = `FAILED: ${errMsg}`;
        if (agentSafetyStatus) agentSafetyStatus.textContent = "Error";
        if (agentReasoningText) agentReasoningText.textContent = `Error: ${errMsg}`;
        if (executionOutput) executionOutput.value = `FAILED: ${errMsg}`;
        if (agentVerificationText) {
          agentVerificationText.textContent = `Error: ${errMsg}`;
          agentVerificationText.style.color = "#dc2626";
        }
        executionTraceHistory.push({
          step: typeof currentStep !== "undefined" ? currentStep : 1,
          requestId: typeof currentRequestId !== "undefined" ? currentRequestId : "SIH-ERR",
          action: null,
          executed: false,
          status: "error",
          executionResult: `FAILED: ${errMsg}`,
          verification: `Error: ${errMsg}`
        });
        renderTraceHistory();
      }
    });
  }

  // =====================================================================
  // Existing Milestone 1–12 "Capture Page Info" Button Listener (Preserved)
  // Calls text-only /api/context endpoint while triggering local perception
  // =====================================================================
  captureBtn.addEventListener("click", async () => {
    resetPipelineState();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        if (outputArea) outputArea.value = "Error: No active tab found.";
        if (visualStatus) {
          visualStatus.textContent = "Screenshot capture failed (no active tab)";
          visualStatus.style.color = "#c62828";
        }
        return;
      }

      if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
        if (outputArea) {
          outputArea.value = "Cannot capture Chrome/browser system pages.\nPlease test on a standard webpage (e.g. https://example.com).";
        }
        if (visualStatus) {
          visualStatus.textContent = "Screenshot capture failed (restricted browser system page)";
          visualStatus.style.color = "#c62828";
        }
        return;
      }

      // Milestone 7: Trigger local visual context capture
      captureVisualContext();

      // Display response helper for Milestone 1-6 flow
      const displayResponse = async (data, domElapsedMs) => {
        if (data && data.success) {
          timing.domExtractionMs = domElapsedMs;
          timing.sensitiveRegionDetectionMs = typeof data.sensitiveDetectionMs === "number"
            ? data.sensitiveDetectionMs
            : 0;

          latestVisualElements = data.visualElements || [];
          latestSensitiveRegions = data.sensitiveRegions || [];
          latestPageData = data;

          triggerRedaction();

          if (outputArea) outputArea.value = `Title: ${data.title}\nURL: ${data.url}`;
          if (sampleOutput) sampleOutput.value = data.redactedSample || "(No visible text found on page)";

          if (elementsOutput) {
            if (data.visualElements && Array.isArray(data.visualElements) && data.visualElements.length > 0) {
              let elementsText = `Detected elements: ${data.visualElements.length}\n\n`;
              data.visualElements.forEach((el, index) => {
                const typeUpper = (el.type || "ELEMENT").toUpperCase();
                elementsText += `${index + 1}.${typeUpper} — ${el.label} [x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}]\n`;
              });
              elementsOutput.value = elementsText.trim();
            } else {
              elementsOutput.value = "No visual elements detected.";
            }
          }

          renderPerceptionSummary();

          // Send ONLY sanitized text data to /api/context (Milestone 3-6)
          await executeTextOnlyFallback(tab, data, "Triggered via Capture Page Info button");
        } else {
          if (outputArea) outputArea.value = "Failed to retrieve page info.";
          if (backendOutput) backendOutput.value = "Transmission skipped (no context available).";
          renderPerceptionSummary();
        }
      };

      const tDomStart = performance.now();

      chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (response) => {
        if (chrome.runtime.lastError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["pii-detector.js", "content.js"]
            });

            chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" }, async (retryResponse) => {
              const domElapsed = Math.round(performance.now() - tDomStart);
              if (chrome.runtime.lastError) {
                if (outputArea) outputArea.value = `Error: ${chrome.runtime.lastError.message}`;
              } else {
                await displayResponse(retryResponse, domElapsed);
              }
            });
          } catch (injectError) {
            if (outputArea) outputArea.value = `Error injecting scripts: ${injectError.message}`;
          }
          return;
        }

        const domElapsed = Math.round(performance.now() - tDomStart);
        await displayResponse(response, domElapsed);
      });
    } catch (err) {
      if (outputArea) outputArea.value = `Unexpected error: ${err.message}`;
      if (visualStatus) {
        visualStatus.textContent = `Screenshot capture failed (${err.message})`;
        visualStatus.style.color = "#c62828";
      }
      renderPerceptionSummary();
    }
  });
});
