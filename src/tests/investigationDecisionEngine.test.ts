import assert from 'assert';
import { InvestigationDecisionEngine } from '../modules/investigation-center/services/investigationDecisionEngine';
import { InvestigationService } from '../modules/investigation-center/services/investigationService';
import {
  DecisionEngineInput,
  InvestigationCase,
} from '../modules/investigation-center/types';

console.log('\n====================================================');
console.log('🚀 RUNNING INVESTIGATION DECISION ENGINE TEST SUITE');
console.log('====================================================\n');

// Mock CallQualityReport fixture (4-hop verified call)
const mockOptimalCallReport: any = {
  txnUuid: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f',
  callDirection: 'INBOUND',
  callDurationSeconds: 55.0,
  qualityAvailable: true,
  overallStatus: 'OPTIMAL',
  termination: {
    terminatedBy: 'CALLEE',
    initiatorName: 'Callee Desktop (sip35526286)',
    sipMethod: 'SIP BYE',
    q850CauseCode: 16,
    q850ReasonText: 'Normal call clearing',
    explanation: 'Callee cleanly disconnected the call after 55 seconds of conversation.',
  },
  hops: [
    { hopIndex: 1, hopType: 'CALLER', label: 'Caller', status: 'PASS' },
    { hopIndex: 2, hopType: 'EDGE_SBC', label: 'B3 Edge SBC', status: 'PASS' },
    { hopIndex: 3, hopType: 'CPAAS_CORE', label: 'B3 CPaaS Core', status: 'PASS' },
    { hopIndex: 4, hopType: 'CALLEE_ENDPOINT', label: 'Extension 637', status: 'PASS', metrics: { mos: 4.3, rxPacketLossPct: 0, txPacketLossPct: 0, jitterMs: 8 } },
  ],
  l2Details: {
    ticketCategory: 'CALL_DISCONNECTION',
    faultDomain: 'NOMINAL',
    rootCauseTechnicalSummary: 'Normal end-call sequence by callee. No network or core defect.',
    suggestedCustomerResolution: 'User cleanly disconnected after 55s.',
  },
  recommendedAction: 'Close ticket as Non-Defect / Normal Clearing.',
};

// Base mock investigation case
function createBaseCase(overrides?: Partial<InvestigationCase>): InvestigationCase {
  return {
    id: 'INV-TEST-001',
    ticketId: 'T-1001',
    txnUuid: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f',
    customerIdentifier: 'Acme Corp SG',
    title: 'Customer reports audio cut-off',
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidenceReferences: [
      {
        id: 'ev-1',
        evidenceType: 'CALL_FORENSICS',
        source: 'B3 SIEM',
        referenceId: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f',
        timestamp: new Date().toISOString(),
        title: 'UniversalEvent Call Record',
        summary: 'SIP BYE / Q.850 16 after 55s.',
      },
    ],
    findings: [
      {
        id: 'find-1',
        category: 'SIP_SIGNALING',
        description: 'Call terminated normally via SIP BYE from Callee endpoint after 55s.',
        verifiedFact: true,
        isHypothesis: false,
      },
    ],
    rcaSummary: {
      faultDomain: 'NOMINAL',
      technicalSummary: 'Verified SIP BYE termination from endpoint with pristine RTP telemetry.',
      customerFacingSummary: 'The call was completed normally and released by your desktop endpoint.',
      actionItems: ['Provide call duration timestamp to customer.'],
    },
    ...overrides,
  };
}

let passedCount = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. High Evidence Score -> CUSTOMER_READY
runTest('High evidence score with verified findings evaluates to CUSTOMER_READY', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.ok(result.evidenceScore >= 8, `Expected score >= 8, got ${result.evidenceScore}`);
  assert.strictEqual(result.recommendedDecision, 'CUSTOMER_READY');
  assert.strictEqual(result.rootCauseConfidence, 'HIGH');
  assert.strictEqual(result.faultDomain, 'NOMINAL');
  assert.strictEqual(result.requiresHumanApproval, true);
});

// 2. Low Evidence Score -> CONTINUE_L2
runTest('Low evidence score with missing telemetry evaluates to CONTINUE_L2', () => {
  const emptyCase: InvestigationCase = {
    id: 'INV-EMPTY',
    title: 'Customer complaint with no logs',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidenceReferences: [],
    findings: [],
  };
  const input: DecisionEngineInput = {
    investigationCase: emptyCase,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.ok(result.evidenceScore <= 3, `Expected score <= 3, got ${result.evidenceScore}`);
  assert.strictEqual(result.recommendedDecision, 'CONTINUE_L2');
  assert.strictEqual(result.rootCauseConfidence, 'UNCONFIRMED');
  assert.ok(result.missingEvidence.length > 0, 'Expected missing evidence items');
});

// 3. Missing Evidence detection
runTest('Missing evidence properly detects missing txnUuid, SIP trace, and RTP metrics', () => {
  const partialCase = createBaseCase({ txnUuid: undefined });
  const input: DecisionEngineInput = {
    investigationCase: partialCase,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.ok(result.missingEvidence.some((m) => m.includes('Transaction UUID')));
  assert.ok(result.missingEvidence.some((m) => m.includes('SIP Signaling')));
  assert.ok(result.missingEvidence.some((m) => m.includes('4-Hop Logical Topology')));
});

// 4. Conflicting Evidence halts customer readiness
runTest('Conflicting evidence between customer report and telemetry downgrades to CONTINUE_L2', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
    hasConflictingEvidence: true,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.strictEqual(result.recommendedDecision, 'CONTINUE_L2');
  assert.strictEqual(result.rootCauseConfidence, 'LOW');
  assert.ok(result.escalationReason?.includes('Conflicting evidence'));
});

// 5. Critical Escalation Override: Core Infrastructure Failure
runTest('Core infrastructure failure overrides high evidence score to ESCALATE_L3', () => {
  const coreDefectCallReport: any = {
    ...mockOptimalCallReport,
    overallStatus: 'FAILED',
    hops: [
      { hopIndex: 1, hopType: 'CALLER', label: 'Caller', status: 'PASS' },
      { hopIndex: 2, hopType: 'EDGE_SBC', label: 'B3 Edge SBC', status: 'FAIL', isCulprit: true },
      { hopIndex: 3, hopType: 'CPAAS_CORE', label: 'B3 CPaaS Core', status: 'PASS' },
      { hopIndex: 4, hopType: 'CALLEE_ENDPOINT', label: 'Extension', status: 'PASS' },
    ],
    l2Details: {
      faultDomain: 'B3_CORE_SBC',
      rootCauseTechnicalSummary: 'Internal edge proxy crash.',
    },
  };
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: coreDefectCallReport,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.strictEqual(result.recommendedDecision, 'ESCALATE_L3');
  assert.strictEqual(result.escalationTarget, 'L3_ENGINEERING');
  assert.strictEqual(result.escalationSeverity, 'CRITICAL');
  assert.ok(result.activeTriggers.some((t) => t.type === 'CORE_INFRASTRUCTURE_FAILURE'));
});

// 6. Platform-Wide Outage Override
runTest('Suspected platform outage overrides decision to ESCALATE_L3 with CRITICAL severity', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
    isPlatformOutageSuspected: true,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.strictEqual(result.recommendedDecision, 'ESCALATE_L3');
  assert.strictEqual(result.escalationSeverity, 'CRITICAL');
  assert.strictEqual(result.escalationTarget, 'L3_ENGINEERING');
});

// 7. L2 Troubleshooting Exhausted
runTest('L2 procedures exhausted triggers ESCALATE_L3', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
    isL2Exhausted: true,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.strictEqual(result.recommendedDecision, 'ESCALATE_L3');
  assert.strictEqual(result.escalationTarget, 'L3_ENGINEERING');
  assert.ok(result.activeTriggers.some((t) => t.type === 'L2_PROCEDURES_EXHAUSTED'));
});

// 8. Privileged Access Required
runTest('Requires privileged access triggers ESCALATE_L3', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
    requiresPrivilegedAccess: true,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  assert.strictEqual(result.recommendedDecision, 'ESCALATE_L3');
  assert.strictEqual(result.escalationTarget, 'L3_ENGINEERING');
  assert.ok(result.activeTriggers.some((t) => t.type === 'PRIVILEGED_ACCESS_REQUIRED'));
});

// 9. Carrier-Related Fault Domain does NOT falsely escalate to L3
runTest('Carrier-related fault domain targets CARRIER_EXTERNAL, not L3_ENGINEERING', () => {
  const carrierCallReport: any = {
    ...mockOptimalCallReport,
    overallStatus: 'FAILED',
    l2Details: {
      faultDomain: 'CARRIER_PEER',
      carrierPeer: 'SINGTEL_SFV_INBOUND',
      rootCauseTechnicalSummary: 'Carrier dropped call with SIP 503 from Singtel trunk.',
    },
    hops: [
      { hopIndex: 1, hopType: 'CALLER', label: 'Caller', status: 'PASS' },
      { hopIndex: 2, hopType: 'EDGE_SBC', label: 'B3 Edge SBC', status: 'FAIL', isCulprit: true, terminatedPeer: 'SINGTEL_SFV_INBOUND' },
      { hopIndex: 3, hopType: 'CPAAS_CORE', label: 'B3 CPaaS Core', status: 'PASS' },
      { hopIndex: 4, hopType: 'CALLEE_ENDPOINT', label: 'Extension', status: 'PASS' },
    ],
  };
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: carrierCallReport,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  const carrierTrigger = result.activeTriggers.find((t) => t.type === 'CARRIER_TRUNK_INCIDENT');
  assert.ok(carrierTrigger, 'Expected CARRIER_TRUNK_INCIDENT trigger');
  assert.strictEqual(carrierTrigger.target, 'CARRIER_EXTERNAL');
  assert.strictEqual(carrierTrigger.overridesEvidenceScore, false);
});

// 10. Customer-Premise Fault Domain targets CUSTOMER_ACTION
runTest('Customer premise fault domain targets CUSTOMER_ACTION with guidance', () => {
  const customerDefectReport: any = {
    ...mockOptimalCallReport,
    overallStatus: 'DEGRADED',
    hops: [
      { hopIndex: 1, hopType: 'CALLER', label: 'Caller', status: 'PASS' },
      { hopIndex: 2, hopType: 'EDGE_SBC', label: 'B3 Edge SBC', status: 'PASS' },
      { hopIndex: 3, hopType: 'CPAAS_CORE', label: 'B3 CPaaS Core', status: 'PASS' },
      { hopIndex: 4, hopType: 'CALLEE_ENDPOINT', label: 'Desktop Ext', status: 'FAIL', isCulprit: true, metrics: { jitterMs: 1858 } },
    ],
    l2Details: {
      faultDomain: 'CUSTOMER_PREMISE_ENDPOINT',
      rootCauseTechnicalSummary: 'Severe local Wi-Fi jitter on customer laptop endpoint.',
    },
  };
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: customerDefectReport,
  };
  const result = InvestigationDecisionEngine.evaluateInvestigation(input);
  const customerTrigger = result.activeTriggers.find((t) => t.type === 'TEAM_OWNERSHIP_MISMATCH');
  assert.ok(customerTrigger, 'Expected customer ownership trigger');
  assert.strictEqual(customerTrigger.target, 'CUSTOMER_ACTION');
  assert.strictEqual(result.recommendedDecision, 'CUSTOMER_READY');
  assert.ok(result.safetyNotes.some((s) => s.includes('customer premise')));
});

// 11. Report Generation: Customer Report
runTest('Customer Communication Report generates safe, professional output without speculation', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
  };
  const decision = InvestigationDecisionEngine.evaluateInvestigation(input);
  const custReport = InvestigationDecisionEngine.generateCustomerReport(decision, input);
  assert.strictEqual(custReport.ticketId, 'T-1001');
  assert.ok(custReport.observedIssue.includes('Customer reports'));
  assert.ok(custReport.verifiedFindings.length > 0);
  assert.ok(custReport.actionsTaken.length >= 3);
  assert.ok(custReport.currentStatus.includes('Ready for Customer'));
});

// 12. Report Generation: L3 Escalation Package
runTest('L3 Escalation Package captures structured SIP, RTP, and technical reproduction details', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
    isL2Exhausted: true,
  };
  const decision = InvestigationDecisionEngine.evaluateInvestigation(input);
  const l3Package = InvestigationDecisionEngine.generateL3EscalationPackage(decision, input);
  assert.strictEqual(l3Package.ticketId, 'T-1001');
  assert.strictEqual(l3Package.txnUuid, '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f');
  assert.ok(l3Package.sipSignaling.includes('SIP BYE'));
  assert.ok(l3Package.rtpMetrics.includes('Hop 4'));
  assert.ok(l3Package.troubleshootingPerformed.length > 0);
  assert.strictEqual(l3Package.escalationTarget, 'L3_ENGINEERING');
});

// 13. Auditability & Engineer Approval
runTest('Audit records are persisted and engineer approvals are recorded', () => {
  const input: DecisionEngineInput = {
    investigationCase: createBaseCase(),
    callReport: mockOptimalCallReport,
  };
  const decision = InvestigationDecisionEngine.evaluateInvestigation(input);
  const history = InvestigationDecisionEngine.getAuditHistory('INV-TEST-001');
  assert.ok(history.length > 0, 'Audit history should contain records');
  const latestAudit = history[0];

  const approved = InvestigationDecisionEngine.approveAssessment(latestAudit.id, {
    approvedBy: 'Alice (L2 Senior)',
    approvedAction: 'CUSTOMER_READY',
    timestamp: new Date().toISOString(),
    notes: 'Confirmed 55s call duration with customer.',
  });

  assert.ok(approved?.engineerApproval, 'Expected approval attached');
  assert.strictEqual(approved?.engineerApproval?.approvedAction, 'CUSTOMER_READY');
  assert.strictEqual(approved?.engineerApproval?.approvedBy, 'Alice (L2 Senior)');
});

// 14. Tri-Module Synchronization: Compiling Call Forensic to Investigation Case
runTest('InvestigationService compiles Call Forensics telemetry into a complete Dossier', () => {
  const dossier = InvestigationService.compileInvestigationFromTelemetry(mockOptimalCallReport);
  assert.strictEqual(dossier.txnUuid, mockOptimalCallReport.txnUuid);
  assert.ok(dossier.ticketId, 'Expected generated ticketId');
  assert.strictEqual(dossier.status, 'IN_PROGRESS');
  assert.ok(dossier.evidenceReferences.some((e) => e.evidenceType === 'CALL_FORENSICS'));
  assert.ok(dossier.findings && dossier.findings.length >= 2);
  assert.ok(dossier.rcaSummary, 'Expected generated RCA summary');
  assert.strictEqual(dossier.rcaSummary?.faultDomain, 'NOMINAL');
});

// 15. Tri-Module Synchronization: Linking Globalping Network Probe to Dossier
runTest('InvestigationService links Globalping probe telemetry alongside Call Forensics', () => {
  const mockNetResult: any = {
    id: 'net-gp-12345',
    target: 'sip.b3networks.com',
    diagnosticType: 'ping',
    probeLocation: 'Singapore (SG)',
    source: 'globalping',
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    results: {
      type: 'ping',
      data: {
        packetsSent: 3,
        packetsReceived: 3,
        packetLossPct: 0,
        avgRttMs: 8.5,
      },
    },
  };

  const dossier = InvestigationService.compileInvestigationFromTelemetry(mockOptimalCallReport, mockNetResult);
  assert.ok(dossier.evidenceReferences.some((e) => e.evidenceType === 'CALL_FORENSICS'));
  assert.ok(dossier.evidenceReferences.some((e) => e.evidenceType === 'GLOBAL_NETWORK'));
  const netEvidence = dossier.evidenceReferences.find((e) => e.evidenceType === 'GLOBAL_NETWORK');
  assert.ok(netEvidence?.summary?.includes('Avg RTT: 8.5ms'));
  assert.ok(dossier.findings?.some((f) => f.category === 'IP_ROUTING' && f.verifiedFact));
});

console.log('\n====================================================');
console.log(`📊 DECISION ENGINE TESTS: ALL ${passedCount} PASSED`);
console.log('====================================================\n');
