import assert from 'assert';
import { CustomerDiagnosticService } from '../modules/network-diagnostics/services/customerDiagnosticService';
import { InvestigationDecisionEngine } from '../modules/investigation-center/services/investigationDecisionEngine';
import { CustomerAgentTelemetry } from '../modules/network-diagnostics/types';
import { InvestigationCase } from '../modules/investigation-center/types';

console.log('\n=============================================================');
console.log('🚀 RUNNING CUSTOMER-SIDE DIAGNOSTIC AGENT TEST SUITE (PHASE 3)');
console.log('=============================================================\n');

// 1. Target Allowlist Enforcement
(() => {
  console.log('--- 1. Target Allowlist Enforcement ---');

  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('sip.b3networks.com'),
    true,
    'Allows sip.b3networks.com'
  );
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('rtp.b3networks.com'),
    true,
    'Allows rtp.b3networks.com'
  );
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('portal.b3networks.com'),
    true,
    'Allows portal.b3networks.com'
  );
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('stun.b3networks.com'),
    true,
    'Allows stun.b3networks.com'
  );

  // Subdomain / protocol handling
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('https://portal.b3networks.com/api'),
    true,
    'Allows URL form of portal.b3networks.com'
  );

  // Unallowed targets
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('google.com'),
    false,
    'Rejects arbitrary internet domain google.com'
  );
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('192.168.1.1'),
    false,
    'Rejects local IP address'
  );
  assert.strictEqual(
    CustomerDiagnosticService.isTargetAllowed('attacker.b3networks.com.fake.com'),
    false,
    'Rejects spoofed domain suffix'
  );

  console.log('✅ PASS: Allowlist strictly restricts client-side probes to B3 infrastructure');
})();

// 2. Pairing Session Generation
(() => {
  console.log('\n--- 2. Pairing Session Generation ---');

  const session = CustomerDiagnosticService.createPairingSession('CUST-ACME-CORP');
  assert.ok(session.sessionId.startsWith('SES-'), 'Session ID generated');
  assert.strictEqual(session.pairingCode.length, 6, 'Pairing code is 6 alphanumeric characters');
  assert.strictEqual(session.status, 'PENDING', 'Session begins in PENDING state');

  const cmd = CustomerDiagnosticService.generateRunnerCommand(session.pairingCode);
  assert.ok(cmd.includes(session.pairingCode), 'Runner command contains pairing code');
  assert.ok(cmd.includes('b3-diag.sh'), 'Runner command targets b3-diag script');

  // Lookup session
  const retrieved = CustomerDiagnosticService.getPairingSession(session.pairingCode);
  assert.ok(retrieved, 'Session successfully retrieved from memory store');
  assert.strictEqual(retrieved?.targetOrg, 'CUST-ACME-CORP');

  console.log('✅ PASS: Secure pairing code and bash command generator verified');
})();

// 3. Telemetry Simulation Presets
(() => {
  console.log('\n--- 3. Telemetry Presets Loading ---');

  const symmPreset = CustomerDiagnosticService.getSamplePreset('SYMMETRIC_NAT');
  assert.strictEqual(symmPreset.stunNat.natType, 'SYMMETRIC', 'Preset simulates Symmetric NAT');
  assert.strictEqual(symmPreset.stunNat.sipAlgStatus, 'DETECTED', 'Preset detects SIP ALG');
  assert.ok(symmPreset.recommendedCustomerActions.length >= 2, 'Provides remediation advice');

  const wifiPreset = CustomerDiagnosticService.getSamplePreset('WIFI_JITTER');
  assert.strictEqual(wifiPreset.localNetwork.adapterType, 'WIFI', 'Preset simulates Wi-Fi');
  assert.ok(wifiPreset.targetProbes.some((p) => (p.jitterMs ?? 0) > 20), 'Preset reflects high VoIP jitter');

  const wiredPreset = CustomerDiagnosticService.getSamplePreset('OPTIMAL_WIRED');
  assert.strictEqual(wiredPreset.localNetwork.adapterType, 'ETHERNET', 'Preset simulates Ethernet');
  assert.strictEqual(wiredPreset.stunNat.natType, 'FULL_CONE', 'Preset has Full Cone NAT');
  assert.strictEqual(wiredPreset.stunNat.sipAlgStatus, 'NOT_DETECTED', 'No SIP ALG present');

  console.log('✅ PASS: All 3 diagnostic telemetry presets verified');
})();

// 4. Telemetry Validation and JSON Parsing
(() => {
  console.log('\n--- 4. Telemetry JSON Parsing & Schema Validation ---');

  let parseError = false;
  try {
    CustomerDiagnosticService.importTelemetryJson('{ not valid json }');
  } catch {
    parseError = true;
  }
  assert.strictEqual(parseError, true, 'Rejects malformed JSON syntax');

  let missingFieldError = false;
  try {
    CustomerDiagnosticService.importTelemetryJson(JSON.stringify({ sessionId: '123' }));
  } catch {
    missingFieldError = true;
  }
  assert.strictEqual(missingFieldError, true, 'Rejects payload missing stunNat and localNetwork');

  const validSample = CustomerDiagnosticService.getSamplePreset('SYMMETRIC_NAT');
  const validParsed = CustomerDiagnosticService.importTelemetryJson(JSON.stringify(validSample));
  assert.ok(validParsed, 'Telemetry object present');
  assert.strictEqual(validParsed.stunNat.natType, 'SYMMETRIC');

  console.log('✅ PASS: Robust JSON schema and structural validation confirmed');
})();

// 5. Result Normalization
(() => {
  console.log('\n--- 5. Normalization to NetworkDiagnosticResult ---');

  const telemetry = CustomerDiagnosticService.getSamplePreset('SYMMETRIC_NAT');
  const result = CustomerDiagnosticService.normalizeCustomerTelemetry(telemetry);

  assert.strictEqual(result.source, 'customer-agent', 'Source tagged as customer-agent');
  assert.strictEqual(result.diagnosticType, 'ping', 'Diagnostic type tagged');
  assert.strictEqual(result.status, 'failed', 'Critical defect flags status failed');
  assert.ok(
    result.results?.type === 'traceroute' && result.results.data.hops.length >= 4,
    'Constructs topology hops'
  );

  const hasSipAlgNote = result.interpretation?.observations?.some((o) => o.includes('SIP ALG'));
  assert.ok(hasSipAlgNote, 'Observations note SIP ALG presence');

  const hasNatNote = result.interpretation?.voipGuardrailNotes?.some((n) => n.includes('SYMMETRIC NAT'));
  assert.ok(hasNatNote, 'VoIP guardrail notes include Symmetric NAT warning');

  console.log('✅ PASS: Telemetry accurately mapped to unified NetworkDiagnosticResult model');
})();

// 6. Decision Engine Integration with Customer Telemetry
(() => {
  console.log('\n--- 6. Investigation Decision Engine & Telemetry Integration ---');

  const telemetry = CustomerDiagnosticService.getSamplePreset('SYMMETRIC_NAT');
  const sampleCase: InvestigationCase = {
    id: 'CASE-TEST-001',
    ticketId: 'TCK-88219',
    txnUuid: 'TXN-9941',
    title: 'Customer Reports 1-Way Audio and Call Drops',
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidenceReferences: [
      {
        id: 'EV-01',
        evidenceType: 'CUSTOMER_NETWORK',
        source: 'Customer Diagnostic Agent',
        referenceId: telemetry.sessionId,
        timestamp: new Date().toISOString(),
        title: 'Customer Agent Telemetry',
      },
    ],
    findings: [
      {
        id: 'F-01',
        category: 'ENDPOINT_NAT',
        description: 'SIP ALG active on router, dropping ACK packets after 32 seconds',
        verifiedFact: true,
        isHypothesis: false,
      },
    ],
    rcaSummary: {
      technicalSummary: 'Customer gateway has SIP ALG enabled and Symmetric NAT.',
      customerFacingSummary: 'Edge network router altered SIP packets, leading to call termination.',
      actionItems: ['Disable SIP ALG in customer router admin console.'],
      faultDomain: 'CUSTOMER_PREMISE_ENDPOINT',
    },
  };

  const decision = InvestigationDecisionEngine.evaluateInvestigation({
    investigationCase: sampleCase,
    customerTelemetry: telemetry,
  });

  assert.ok(decision.evidenceScore >= 8, `Score ${decision.evidenceScore} >= 8`);
  assert.strictEqual(decision.recommendedDecision, 'CUSTOMER_READY', 'Ready for customer notification');
  assert.strictEqual(decision.faultDomain, 'CUSTOMER_PREMISE_ENDPOINT', 'Isolated to customer premise');
  assert.ok(
    decision.safetyNotes.some((n) => n.includes('SIP ALG')),
    'Includes actionable SIP ALG safety advice'
  );

  // Test Carrier Hold Rule
  const carrierPendingDecision = InvestigationDecisionEngine.evaluateInvestigation({
    investigationCase: sampleCase,
    customerTelemetry: telemetry,
    externalCarrierPending: true,
  });

  assert.strictEqual(
    carrierPendingDecision.recommendedDecision,
    'CONTINUE_L2',
    'Carrier pending prevents premature CUSTOMER_READY'
  );
  assert.strictEqual(
    carrierPendingDecision.escalationTarget,
    'CARRIER_EXTERNAL',
    'Escalation target set to CARRIER_EXTERNAL'
  );

  console.log('✅ PASS: Decision engine properly correlates customer telemetry and respects carrier hold');
})();

console.log('\n=============================================================');
console.log('🎉 ALL CUSTOMER DIAGNOSTIC AGENT TESTS PASSED SUCCESSFULLY!');
console.log('=============================================================\n');
