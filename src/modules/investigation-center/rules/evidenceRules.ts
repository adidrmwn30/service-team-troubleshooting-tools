import {
  DecisionEngineInput,
  DimensionScore,
  EvidenceSufficiencyBreakdown,
} from '../types';
import { categorizeEvidenceScore } from './decisionThresholds';

export class EvidenceRules {
  /**
   * Evaluates the 5 evidence sufficiency dimensions based on available investigation evidence.
   */
  public static evaluateSufficiency(input: DecisionEngineInput): EvidenceSufficiencyBreakdown {
    const { investigationCase, callReport, networkDiagnostics, hasConflictingEvidence, customerTelemetry } = input;

    // 1. Evidence Quality
    let evidenceQuality: DimensionScore = 0;
    let qualityJustification = 'Missing primary telemetry (no SIEM or network trace).';

    const hasCallEvidence =
      investigationCase.evidenceReferences.some((e) => e.evidenceType === 'CALL_FORENSICS') ||
      !!callReport;
    const hasNetworkEvidence =
      investigationCase.evidenceReferences.some(
        (e) => e.evidenceType === 'GLOBAL_NETWORK' || e.evidenceType === 'CUSTOMER_NETWORK'
      ) || (networkDiagnostics && networkDiagnostics.length > 0) || !!customerTelemetry;

    if (hasCallEvidence && callReport?.hops && callReport.hops.length >= 4) {
      evidenceQuality = 2;
      qualityJustification = 'Verified primary forensic telemetry with full 4-hop call topology and SIP/RTP data.';
    } else if (hasCallEvidence && customerTelemetry) {
      evidenceQuality = 2;
      qualityJustification = 'Verified hybrid telemetry correlating call forensics and customer-side diagnostic agent.';
    } else if (customerTelemetry && (customerTelemetry.targetProbes?.length || 0) >= 2 && customerTelemetry.stunNat) {
      evidenceQuality = 2;
      qualityJustification = 'Verified customer diagnostic agent telemetry with full STUN NAT discovery and multi-target VoIP probes.';
    } else if (hasCallEvidence || hasNetworkEvidence) {
      evidenceQuality = 1;
      qualityJustification = 'Partial evidence available (call or network logs present, but lacking complete 4-hop telemetry).';
    }

    // 2. Root Cause Confidence
    let rootCauseConfidence: DimensionScore = 0;
    let confidenceJustification = 'Root cause cannot be confirmed from current evidence.';

    const verifiedFactsCount =
      investigationCase.findings?.filter((f) => f.verifiedFact).length || 0;
    const hasDefinitiveFaultDomain =
      callReport?.l2Details?.faultDomain && callReport.l2Details.faultDomain !== 'NOMINAL';
    const isNominalCall =
      callReport?.overallStatus === 'OPTIMAL' ||
      callReport?.termination?.sipMethod?.includes('BYE') ||
      callReport?.termination?.sipMethod?.includes('CANCEL');

    const customerDefectDetected =
      customerTelemetry &&
      (customerTelemetry.stunNat.natType === 'SYMMETRIC' ||
        customerTelemetry.stunNat.sipAlgStatus === 'DETECTED');

    if (hasConflictingEvidence) {
      rootCauseConfidence = 1;
      confidenceJustification = 'Partial confidence due to conflicting evidence between customer report and telemetry.';
    } else if (customerDefectDetected) {
      rootCauseConfidence = 2;
      confidenceJustification = `Verified customer-edge anomaly: ${
        customerTelemetry.stunNat.sipAlgStatus === 'DETECTED'
          ? 'SIP ALG active on router modifying SIP packets'
          : 'Symmetric NAT port-allocation mismatch causing 1-way RTP'
      }.`;
    } else if ((hasDefinitiveFaultDomain || isNominalCall) && verifiedFactsCount >= 1 && evidenceQuality === 2) {
      rootCauseConfidence = 2;
      confidenceJustification = 'Verified root cause isolated with matching SIP/RTP telemetry and verified findings.';
    } else if (verifiedFactsCount > 0 || hasCallEvidence || customerTelemetry) {
      rootCauseConfidence = 1;
      confidenceJustification = 'Plausible fault domain identified, but requires further corroboration.';
    }

    // 3. Technical Clarity
    let technicalClarity: DimensionScore = 0;
    let clarityJustification = 'Technical explanation is missing or ambiguous.';

    const hasTechnicalSummary = !!(
      investigationCase.rcaSummary?.technicalSummary ||
      callReport?.l2Details?.rootCauseTechnicalSummary ||
      (customerTelemetry && customerTelemetry.recommendedCustomerActions?.length > 0)
    );
    const hasFactsSeparation = (investigationCase.findings?.length || 0) > 0 || !!customerTelemetry;

    if (hasTechnicalSummary && hasFactsSeparation && !hasConflictingEvidence) {
      technicalClarity = 2;
      clarityJustification = 'Technical clarity verified; clear distinction between observed telemetry facts and hypotheses.';
    } else if (hasTechnicalSummary) {
      technicalClarity = 1;
      clarityJustification = 'Technical notes present, but distinction between facts and assumptions is incomplete.';
    }

    // 4. Actionability
    let actionability: DimensionScore = 0;
    let actionabilityJustification = 'No clear technical remediation or next action identified.';

    const actionItems =
      investigationCase.rcaSummary?.actionItems ||
      (callReport?.recommendedAction ? [callReport.recommendedAction] : []) ||
      (customerTelemetry?.recommendedCustomerActions || []);

    if (
      (actionItems.length > 0 && actionItems.some((a) => a.trim().length > 10)) ||
      (customerTelemetry && (customerTelemetry.recommendedCustomerActions?.length || 0) > 0)
    ) {
      actionability = 2;
      actionabilityJustification = customerTelemetry
        ? 'Concrete edge-device remediation checklist generated by Customer Diagnostic Agent.'
        : 'Concrete, verifiable next steps or customer resolution advice defined.';
    } else if (actionItems.length > 0) {
      actionability = 1;
      actionabilityJustification = 'Generic next actions suggested; specific parameters pending.';
    }

    // 5. Reproducibility
    let reproducibility: DimensionScore = 0;
    let reproJustification = 'Single unconfirmed instance with no repeatable pattern.';

    if (callReport && (callReport.callDurationSeconds > 0 || callReport.termination)) {
      reproducibility = 2;
      reproJustification = 'Deterministic call transaction recorded with full signaling timeline and Q.850 cause code.';
    } else if (customerTelemetry?.sessionId || investigationCase.txnUuid || investigationCase.ticketId) {
      reproducibility = 1;
      reproJustification = 'Transaction or diagnostic session identified, but full session reproduction or pattern analysis is in progress.';
    }

    const totalScore =
      evidenceQuality +
      rootCauseConfidence +
      technicalClarity +
      actionability +
      reproducibility;

    const scoreCategory = categorizeEvidenceScore(totalScore);

    return {
      evidenceQuality,
      rootCauseConfidence,
      technicalClarity,
      actionability,
      reproducibility,
      totalScore,
      scoreCategory,
      justifications: {
        evidenceQuality: qualityJustification,
        rootCauseConfidence: confidenceJustification,
        technicalClarity: clarityJustification,
        actionability: actionabilityJustification,
        reproducibility: reproJustification,
      },
    };
  }

  /**
   * Compiles a list of missing technical evidence elements.
   */
  public static identifyMissingEvidence(input: DecisionEngineInput): string[] {
    const missing: string[] = [];
    const { investigationCase, callReport, networkDiagnostics } = input;

    if (!investigationCase.txnUuid && !callReport?.txnUuid) {
      missing.push('Transaction UUID (txnUuid) is missing.');
    }

    if (!callReport?.termination?.sipMethod) {
      missing.push('SIP Signaling termination method & Q.850 cause code not extracted.');
    }

    if (!callReport?.hops || callReport.hops.length < 4) {
      missing.push('End-to-end 4-Hop Logical Topology telemetry is incomplete.');
    }

    if (!callReport?.qualityAvailable && (!callReport || callReport.callDurationSeconds >= 15)) {
      missing.push('Bidirectional RTP quality metrics (Jitter, Packet Loss, MOS) unavailable.');
    }

    const hasNetworkProbe =
      investigationCase.evidenceReferences.some((e) => e.evidenceType === 'GLOBAL_NETWORK') ||
      (networkDiagnostics && networkDiagnostics.length > 0);

    if (!hasNetworkProbe && callReport?.l2Details?.faultDomain === 'CARRIER_PEER') {
      missing.push('Globalping / External Network reachability probe to carrier peer not performed.');
    }

    return missing;
  }
}
