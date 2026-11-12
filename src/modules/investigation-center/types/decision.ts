import { EvidenceReference, InvestigationCase, InvestigationFinding, RCASummary } from './index';
import type { CustomerAgentTelemetry } from '../../network-diagnostics/types';

export type InvestigationDecision = 'CUSTOMER_READY' | 'CONTINUE_L2' | 'ESCALATE_L3';

export type DimensionScore = 0 | 1 | 2; // 0 = Missing, 1 = Partial, 2 = Verified

export type EscalationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type EscalationTarget =
  | 'L3_ENGINEERING'
  | 'CARRIER_EXTERNAL'
  | 'CUSTOMER_ACTION'
  | 'L2_SUPPORT';

export type EscalationTriggerType =
  | 'PLATFORM_WIDE_OUTAGE'
  | 'CORE_INFRASTRUCTURE_FAILURE'
  | 'REPRODUCIBLE_APP_DEFECT'
  | 'PRIVILEGED_ACCESS_REQUIRED'
  | 'L2_PROCEDURES_EXHAUSTED'
  | 'TEAM_OWNERSHIP_MISMATCH'
  | 'CARRIER_TRUNK_INCIDENT';

export interface EvidenceSufficiencyBreakdown {
  evidenceQuality: DimensionScore;
  rootCauseConfidence: DimensionScore;
  technicalClarity: DimensionScore;
  actionability: DimensionScore;
  reproducibility: DimensionScore;
  totalScore: number; // 0 - 10
  scoreCategory: 'INSUFFICIENT' | 'CONTINUE_L2' | 'POTENTIALLY_READY';
  justifications: {
    evidenceQuality: string;
    rootCauseConfidence: string;
    technicalClarity: string;
    actionability: string;
    reproducibility: string;
  };
}

export interface EscalationTrigger {
  type: EscalationTriggerType;
  name: string;
  severity: EscalationSeverity;
  target: EscalationTarget;
  triggered: boolean;
  reason: string;
  overridesEvidenceScore: boolean;
}

export interface DecisionEngineInput {
  investigationCase: InvestigationCase;
  callReport?: any; // CallQualityReport
  networkDiagnostics?: any[]; // NetworkDiagnosticResult[]
  troubleshootingStepsCompleted?: string[];
  isL2Exhausted?: boolean;
  requiresPrivilegedAccess?: boolean;
  isPlatformOutageSuspected?: boolean;
  hasConflictingEvidence?: boolean;
  externalCarrierPending?: boolean;
  requiresCustomerAction?: boolean;
  customerTelemetry?: CustomerAgentTelemetry;
}

export interface DecisionEngineOutput {
  id: string;
  timestamp: string;
  investigationId: string;
  evidenceScore: number; // 0 - 10
  evidenceCompleteness: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
  rootCauseConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCONFIRMED';
  faultDomain: string;
  recommendedDecision: InvestigationDecision;
  escalationSeverity?: EscalationSeverity;
  escalationTarget?: EscalationTarget;
  escalationReason?: string;
  recommendedNextActions: string[];
  missingEvidence: string[];
  sufficiencyBreakdown: EvidenceSufficiencyBreakdown;
  activeTriggers: EscalationTrigger[];
  requiresHumanApproval: boolean;
  safetyNotes: string[];
}

export interface EngineerApproval {
  approvedBy: string;
  approvedAction: InvestigationDecision;
  timestamp: string;
  notes?: string;
}

export interface AuditRecord {
  id: string;
  assessmentTimestamp: string;
  assessmentResult: DecisionEngineOutput;
  evidenceReferences: EvidenceReference[];
  decisionReason: string;
  engineerApproval?: EngineerApproval;
}

export interface CustomerReportPackage {
  ticketId?: string;
  observedIssue: string;
  verifiedFindings: string[];
  customerImpact: string;
  actionsTaken: string[];
  currentStatus: string;
  nextAction: string;
  generatedAt: string;
}

export interface L3EscalationPackage {
  ticketId?: string;
  txnUuid?: string;
  customerIdentifier?: string;
  timestamp: string;
  sipSignaling: string;
  rtpMetrics: string;
  networkEvidence: string;
  reproductionSteps: string[];
  troubleshootingPerformed: string[];
  verifiedFindings: string[];
  remainingTechnicalQuestions: string[];
  requestedEngineeringAssistance: string;
  escalationTarget: EscalationTarget;
  severity: EscalationSeverity;
}
