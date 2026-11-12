import {
  DecisionEngineInput,
  EscalationSeverity,
  EscalationTarget,
  EscalationTrigger,
} from '../types';

export class EscalationRules {
  /**
   * Evaluates all independent escalation triggers.
   */
  public static evaluateTriggers(input: DecisionEngineInput): EscalationTrigger[] {
    const triggers: EscalationTrigger[] = [];
    const {
      callReport,
      isL2Exhausted,
      requiresPrivilegedAccess,
      isPlatformOutageSuspected,
      externalCarrierPending,
      requiresCustomerAction,
    } = input;

    // 1. Suspected platform-wide outage (CRITICAL -> L3 Engineering)
    const isPlatformOutage =
      isPlatformOutageSuspected ||
      callReport?.overallStatus === 'FAILED' &&
        callReport?.hops?.some((h: any) => h.hopType === 'CPAAS_CORE' && h.status === 'FAIL');

    if (isPlatformOutage) {
      triggers.push({
        type: 'PLATFORM_WIDE_OUTAGE',
        name: 'Suspected Platform / Core Outage',
        severity: 'CRITICAL',
        target: 'L3_ENGINEERING',
        triggered: true,
        reason: 'Multiple services or core CPaaS routing nodes failing; widespread customer impact suspected.',
        overridesEvidenceScore: true,
      });
    }

    // 2. Confirmed core infrastructure failure (CRITICAL -> L3 Engineering)
    const isCoreFailure =
      callReport?.l2Details?.faultDomain === 'B3_CORE_SBC' &&
      callReport.hops?.some((h: any) => h.isCulprit && (h.hopType === 'EDGE_SBC' || h.hopType === 'CPAAS_CORE'));

    if (isCoreFailure) {
      triggers.push({
        type: 'CORE_INFRASTRUCTURE_FAILURE',
        name: 'B3 Core / Edge SBC Infrastructure Defect',
        severity: 'CRITICAL',
        target: 'L3_ENGINEERING',
        triggered: true,
        reason: 'Culprit node isolated to internal B3 Core SBC or signaling media relay. Requires L3 infrastructure fix.',
        overridesEvidenceScore: true,
      });
    }

    // 3. Privileged infrastructure access required (HIGH -> L3 Engineering)
    if (requiresPrivilegedAccess) {
      triggers.push({
        type: 'PRIVILEGED_ACCESS_REQUIRED',
        name: 'Privileged Infrastructure Access Required',
        severity: 'HIGH',
        target: 'L3_ENGINEERING',
        triggered: true,
        reason: 'Investigation requires direct server CLI, database modifications, or root network packet captures.',
        overridesEvidenceScore: true,
      });
    }

    // 4. L2 troubleshooting procedures exhausted (HIGH -> L3 Engineering)
    if (isL2Exhausted) {
      triggers.push({
        type: 'L2_PROCEDURES_EXHAUSTED',
        name: 'Standard L2 Procedures Exhausted',
        severity: 'HIGH',
        target: 'L3_ENGINEERING',
        triggered: true,
        reason: 'Standard L2 runbooks, session refreshes, and topology traces failed to identify or resolve the defect.',
        overridesEvidenceScore: true,
      });
    }

    // 5. Carrier / Telco External Provider Incident (Do NOT automatically escalate to L3)
    const isCarrierDomain =
      callReport?.l2Details?.faultDomain === 'CARRIER_PEER' ||
      externalCarrierPending ||
      callReport?.hops?.some((h: any) => h.isCulprit && h.hopType === 'EDGE_SBC' && h.terminatedPeer?.includes('SINGTEL'));

    if (isCarrierDomain) {
      triggers.push({
        type: 'CARRIER_TRUNK_INCIDENT',
        name: 'Upstream Carrier / Telco Interconnect Issue',
        severity: 'MEDIUM',
        target: 'CARRIER_EXTERNAL',
        triggered: true,
        reason: 'Fault domain isolated to upstream carrier trunk (e.g. Singtel SFV). Requires Carrier NOC ticket, not L3 escalation.',
        overridesEvidenceScore: false,
      });
    }

    // 6. Customer Premise / Customer IT Action
    const isCustomerDomain =
      requiresCustomerAction ||
      callReport?.l2Details?.faultDomain === 'CUSTOMER_PREMISE_ENDPOINT' ||
      callReport?.hops?.some((h: any) => h.isCulprit && h.hopType === 'CALLEE_ENDPOINT');

    if (isCustomerDomain) {
      triggers.push({
        type: 'TEAM_OWNERSHIP_MISMATCH',
        name: 'Customer-Premise Endpoint / Network Ownership',
        severity: 'LOW',
        target: 'CUSTOMER_ACTION',
        triggered: true,
        reason: 'Fault domain belongs to customer LAN, PBX refusal, or local Wi-Fi degradation. Handled via Customer Guidance.',
        overridesEvidenceScore: false,
      });
    }

    return triggers;
  }
}
