import {
  AuditRecord,
  CustomerReportPackage,
  DecisionEngineInput,
  DecisionEngineOutput,
  EngineerApproval,
  EvidenceSufficiencyBreakdown,
  InvestigationDecision,
  L3EscalationPackage,
} from '../types';
import { EvidenceRules } from '../rules/evidenceRules';
import { EscalationRules } from '../rules/escalationRules';

export class InvestigationDecisionEngine {
  private static auditLog: AuditRecord[] = [];

  /**
   * Deterministically evaluates an investigation against evidence sufficiency,
   * escalation rules, and technical ownership.
   */
  public static evaluateInvestigation(input: DecisionEngineInput): DecisionEngineOutput {
    const { investigationCase, callReport, hasConflictingEvidence } = input;

    // 1. Evaluate Evidence Sufficiency (Dimensions 1 - 5)
    const sufficiencyBreakdown: EvidenceSufficiencyBreakdown =
      EvidenceRules.evaluateSufficiency(input);
    const missingEvidence: string[] = EvidenceRules.identifyMissingEvidence(input);

    // 2. Evaluate Escalation Triggers
    const activeTriggers = EscalationRules.evaluateTriggers(input);

    // 3. Determine Root Cause Confidence Level
    let rootCauseConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCONFIRMED' = 'UNCONFIRMED';
    if (hasConflictingEvidence) {
      rootCauseConfidence = 'LOW';
    } else if (sufficiencyBreakdown.rootCauseConfidence === 2) {
      rootCauseConfidence = 'HIGH';
    } else if (sufficiencyBreakdown.rootCauseConfidence === 1) {
      rootCauseConfidence = 'MEDIUM';
    }

    // 4. Determine Evidence Completeness
    let evidenceCompleteness: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT' = 'INSUFFICIENT';
    if (sufficiencyBreakdown.totalScore >= 8 && missingEvidence.length === 0) {
      evidenceCompleteness = 'COMPLETE';
    } else if (sufficiencyBreakdown.totalScore >= 4) {
      evidenceCompleteness = 'PARTIAL';
    }

    // 5. Fault Domain Extraction
    let faultDomain =
      callReport?.l2Details?.faultDomain ||
      investigationCase.rcaSummary?.faultDomain ||
      'UNDER_INVESTIGATION';

    if (
      faultDomain === 'UNDER_INVESTIGATION' &&
      input.customerTelemetry &&
      (input.customerTelemetry.stunNat.natType === 'SYMMETRIC' ||
        input.customerTelemetry.stunNat.sipAlgStatus === 'DETECTED')
    ) {
      faultDomain = 'CUSTOMER_PREMISE_ENDPOINT';
    }

    // 6. Deterministic Decision Strategy
    let recommendedDecision: InvestigationDecision = 'CONTINUE_L2';
    let escalationReason: string | undefined;
    let escalationSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | undefined;
    let escalationTarget: any;
    const recommendedNextActions: string[] = [];
    const safetyNotes: string[] = [];

    // Rule A: Check for overriding L3 escalation triggers
    const l3OverridingTrigger = activeTriggers.find(
      (t) => t.target === 'L3_ENGINEERING' && t.overridesEvidenceScore
    );

    if (l3OverridingTrigger) {
      recommendedDecision = 'ESCALATE_L3';
      escalationReason = `${l3OverridingTrigger.name}: ${l3OverridingTrigger.reason}`;
      escalationSeverity = l3OverridingTrigger.severity;
      escalationTarget = 'L3_ENGINEERING';
      recommendedNextActions.push('Prepare L3 Engineering Escalation Package.');
      recommendedNextActions.push('Attach full SIEM raw universalEvent JSON and packet traces.');
      safetyNotes.push('Do not share unverified internal architecture defects directly with customer.');
    } else if (activeTriggers.some((t) => t.target === 'L3_ENGINEERING')) {
      // Non-overriding L3 trigger
      recommendedDecision = 'ESCALATE_L3';
      const t = activeTriggers.find((tr) => tr.target === 'L3_ENGINEERING')!;
      escalationReason = t.reason;
      escalationSeverity = t.severity;
      escalationTarget = 'L3_ENGINEERING';
      recommendedNextActions.push('Escalate to L3 Engineering with complete forensic summary.');
    } else if (input.externalCarrierPending) {
      // Rule B1: External carrier investigation pending - hold customer communication
      recommendedDecision = 'CONTINUE_L2';
      escalationReason = 'Awaiting upstream Carrier NOC diagnostic feedback and trunk remediation.';
      escalationSeverity = 'HIGH';
      escalationTarget = 'CARRIER_EXTERNAL';
      recommendedNextActions.push('Track Carrier NOC ticket status and MTTR SLA.');
      recommendedNextActions.push('Hold customer notification until carrier trunk restoration is confirmed.');
      safetyNotes.push('Carrier incident in progress. Do not communicate premature resolution to customer.');
    } else if (hasConflictingEvidence) {
      // Rule B2: Conflicting evidence halts customer readiness
      recommendedDecision = 'CONTINUE_L2';
      escalationReason = 'Conflicting evidence detected between customer complaint and forensic telemetry.';
      recommendedNextActions.push('Reconcile duration discrepancy with customer.');
      recommendedNextActions.push('Collect additional sample calls for the same DID or extension.');
      safetyNotes.push('Customer claims differ from telemetry logs; avoid asserting user error without polite verification.');
    } else if (sufficiencyBreakdown.totalScore >= 8) {
      // Rule C: High evidence score (8-10) -> Potentially Customer-Ready
      const hasVerifiedFindings =
        (investigationCase.findings?.filter((f) => f.verifiedFact).length || 0) > 0 ||
        !!input.customerTelemetry;

      if (hasVerifiedFindings && rootCauseConfidence !== 'UNCONFIRMED') {
        recommendedDecision = 'CUSTOMER_READY';
        recommendedNextActions.push('Generate and review Customer Communication Report.');
        recommendedNextActions.push('Deliver root cause explanation and recommended customer actions.');
      } else {
        recommendedDecision = 'CONTINUE_L2';
        recommendedNextActions.push('Formally document at least one verified telemetry finding before closing ticket.');
      }
    } else if (sufficiencyBreakdown.totalScore >= 4) {
      // Rule D: Moderate evidence (4-7)
      recommendedDecision = 'CONTINUE_L2';
      recommendedNextActions.push('Gather missing evidence items to reach diagnostic confidence.');
      if (missingEvidence.length > 0) {
        recommendedNextActions.push(`Complete: ${missingEvidence[0]}`);
      }
    } else {
      // Rule E: Low evidence (0-3)
      recommendedDecision = 'CONTINUE_L2';
      recommendedNextActions.push('Correlate B3 SIEM UniversalEvent for transaction.');
      recommendedNextActions.push('Obtain specific timestamp, dialed number, and caller extension.');
    }

    // Safety checks
    if (faultDomain === 'CARRIER_PEER') {
      safetyNotes.push(
        'Fault isolated to upstream carrier peer. Frame customer communication as an upstream telecommunications interconnect anomaly without naming internal carrier vendors.'
      );
    }
    if (faultDomain === 'CUSTOMER_PREMISE_ENDPOINT') {
      safetyNotes.push(
        'Defect isolated to customer premise (IP phone, Wi-Fi jitter, PBX refusal). Provide constructive local network remediation guidance.'
      );
    }
    if (input.customerTelemetry?.stunNat.sipAlgStatus === 'DETECTED') {
      safetyNotes.push(
        'Customer Diagnostic Agent confirmed active SIP ALG. Recommend customer network administrator disable SIP ALG on edge router.'
      );
    }
    if (input.customerTelemetry?.stunNat.natType === 'SYMMETRIC') {
      safetyNotes.push(
        'Customer Diagnostic Agent confirmed Symmetric NAT. Advise enabling STUN/TURN traversal or reserving static UDP NAT bindings.'
      );
    }

    const output: DecisionEngineOutput = {
      id: `DEC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      investigationId: investigationCase.id,
      evidenceScore: sufficiencyBreakdown.totalScore,
      evidenceCompleteness,
      rootCauseConfidence,
      faultDomain,
      recommendedDecision,
      escalationSeverity,
      escalationTarget,
      escalationReason,
      recommendedNextActions,
      missingEvidence,
      sufficiencyBreakdown,
      activeTriggers,
      requiresHumanApproval: true,
      safetyNotes,
    };

    // Store in audit record log
    this.recordAudit({
      id: `AUD-${Date.now()}`,
      assessmentTimestamp: output.timestamp,
      assessmentResult: output,
      evidenceReferences: [...investigationCase.evidenceReferences],
      decisionReason: escalationReason || `Evidence sufficiency score ${output.evidenceScore}/10 (${sufficiencyBreakdown.scoreCategory})`,
    });

    return output;
  }

  /**
   * Generates a safe, professional customer-facing report.
   * Strips internal speculation and emphasizes verified facts.
   */
  public static generateCustomerReport(
    decision: DecisionEngineOutput,
    input: DecisionEngineInput
  ): CustomerReportPackage {
    const { investigationCase, callReport } = input;
    const verifiedFindings =
      investigationCase.findings
        ?.filter((f) => f.verifiedFact)
        .map((f) => f.description) || [];

    const actionsTaken = [
      'Extracted end-to-end SIP signaling timeline and call routing states.',
      'Analyzed bidirectional RTP media stream metrics (Jitter, Packet Loss, RTT).',
      'Correlated logical call flow through voice edge gateways.',
    ];

    let customerImpact = 'Intermittent call setup or audio quality anomaly reported.';
    if (callReport?.callDurationSeconds !== undefined) {
      customerImpact = `Call duration recorded at ${callReport.callDurationSeconds}s with status ${callReport.overallStatus}.`;
    }

    let nextAction = 'No further customer action required. Ticket resolved.';
    if (decision.faultDomain === 'CUSTOMER_PREMISE_ENDPOINT') {
      nextAction = 'Please verify local network firewall NAT keep-alive and Wi-Fi stability on the reported endpoint.';
    } else if (decision.faultDomain === 'CARRIER_PEER') {
      nextAction = 'Our operations team has escalated this interconnect route with our carrier partner for investigation.';
    }

    return {
      ticketId: investigationCase.ticketId,
      observedIssue: investigationCase.title,
      verifiedFindings: verifiedFindings.length > 0 ? verifiedFindings : ['Forensic telemetry analysis complete.'],
      customerImpact,
      actionsTaken,
      currentStatus: decision.recommendedDecision === 'CUSTOMER_READY' ? 'Resolved / Ready for Customer' : 'Under Active Support Investigation',
      nextAction,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a complete, structured technical escalation dossier for L3 Engineering.
   */
  public static generateL3EscalationPackage(
    decision: DecisionEngineOutput,
    input: DecisionEngineInput
  ): L3EscalationPackage {
    const { investigationCase, callReport, troubleshootingStepsCompleted } = input;

    const sipSignaling = callReport?.termination
      ? `Method: ${callReport.termination.sipMethod} | Q.850 Cause: ${callReport.termination.q850CauseCode ?? 'N/A'} (${callReport.termination.q850ReasonText ?? 'N/A'}) | Initiator: ${callReport.termination.initiatorName}`
      : 'SIP signaling details pending raw trace correlation.';

    const rtpMetrics = callReport?.hops
      ?.filter((h: any) => h.metrics)
      .map(
        (h: any) =>
          `[Hop ${h.hopIndex} - ${h.label}]: MOS ${h.metrics?.mos ?? 'N/A'} | Rx Loss: ${h.metrics?.rxPacketLossPct ?? 0}% | Tx Loss: ${h.metrics?.txPacketLossPct ?? 0}% | Jitter: ${h.metrics?.jitterMs ?? 0}ms`
      )
      .join('\n') || 'No RTP telemetry streams available for this call leg.';

    const verifiedFacts =
      investigationCase.findings
        ?.filter((f) => f.verifiedFact)
        .map((f) => f.description) || [];

    return {
      ticketId: investigationCase.ticketId,
      txnUuid: investigationCase.txnUuid,
      customerIdentifier: investigationCase.customerIdentifier,
      timestamp: new Date().toISOString(),
      sipSignaling,
      rtpMetrics,
      networkEvidence: `${investigationCase.evidenceReferences.filter((e) => e.evidenceType === 'GLOBAL_NETWORK' || e.evidenceType === 'CUSTOMER_NETWORK').length} network probes attached.`,
      reproductionSteps: [
        'Review attached SIEM UniversalEvent JSON.',
        'Inspect hop-by-hop signaling on B3 Edge SBC awsfvedge1.',
        'Verify media relay port allocation logs.',
      ],
      troubleshootingPerformed: troubleshootingStepsCompleted || [
        'Validated 4-hop logical call topology.',
        'Checked B3 SBC edge ingress and egress legs.',
        'Reviewed customer endpoint registration state.',
      ],
      verifiedFindings: verifiedFacts,
      remainingTechnicalQuestions: [
        'Why did core SBC drop signaling ACK without retransmission?',
        'Does the internal SIP proxy require session timer tuning?',
      ],
      requestedEngineeringAssistance:
        decision.escalationReason || 'L3 review of core SBC signaling trace and media server relay allocation.',
      escalationTarget: decision.escalationTarget || 'L3_ENGINEERING',
      severity: decision.escalationSeverity || 'HIGH',
    };
  }

  /**
   * Records an assessment in the audit history.
   */
  public static recordAudit(record: AuditRecord): void {
    this.auditLog.unshift(record);
  }

  /**
   * Retrieves the audit history for an investigation.
   */
  public static getAuditHistory(investigationId?: string): AuditRecord[] {
    if (!investigationId) return [...this.auditLog];
    return this.auditLog.filter((a) => a.assessmentResult.investigationId === investigationId);
  }

  /**
   * Attaches an engineer's formal approval/override to an assessment.
   */
  public static approveAssessment(
    auditId: string,
    approval: EngineerApproval
  ): AuditRecord | undefined {
    const record = this.auditLog.find((a) => a.id === auditId);
    if (record) {
      record.engineerApproval = approval;
    }
    return record;
  }
}
