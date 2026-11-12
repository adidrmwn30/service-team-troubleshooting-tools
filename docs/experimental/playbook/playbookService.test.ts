import { ticketIntakeParser } from '../modules/playbook/services/ticketIntakeParser';
import { podRegistry } from '../modules/playbook/data/podRegistry';
import assert from 'assert';

console.log('====================================================');
console.log('🚀 RUNNING PLAYBOOK & TICKET INGESTION TEST SUITE');
console.log('====================================================');

// Test 1: Extraction of clean ticket
{
  const sampleTicket = `
Hi Support,
Customer from domain sipsg02.b3networks.com (Org: d82046ca-46e3-4700-845b-78fb6e7b579f) reported inbound call failure.
Caller: +6561234567
Callee: +6591234567
Direction: inbound
Call-ID: 1d2eebcd38595796bb2e6db622cd1840
Time: 2026-11-09 14:15:00 SGT
Error: SIP 404 Not Found
Product: Bizphone
Agent tried calling but immediately disconnected.
  `;

  const parsed = ticketIntakeParser.parseTicket(sampleTicket);

  assert.strictEqual(parsed.detectedPodId, 'ccb');
  assert.strictEqual(parsed.extractedEntities.orgUuid, 'd82046ca-46e3-4700-845b-78fb6e7b579f');
  assert.strictEqual(parsed.extractedEntities.domain, 'sipsg02.b3networks.com');
  assert.strictEqual(parsed.extractedEntities.callerNumber, '+6561234567');
  assert.strictEqual(parsed.extractedEntities.calleeNumber, '+6591234567');
  assert.strictEqual(parsed.extractedEntities.callDirection, 'inbound');
  assert.strictEqual(parsed.extractedEntities.sipCallId, '1d2eebcd38595796bb2e6db622cd1840');
  assert.strictEqual(parsed.extractedEntities.productKeyword, 'Bizphone');
  assert.ok(parsed.extractedEntities.errorCode?.includes('404'));
  assert.strictEqual(parsed.completenessScore, 100);
  assert.strictEqual(parsed.missingRequiredFields.length, 0);

  console.log('✅ PASS: Complete ticket parses all entities with 100% score');
}

// Test 2: Incomplete ticket audit & clarification generation
{
  const incompleteTicket = `
Customer cannot make call on Bizphone, please check urgently!
Number: +6591234567
Domain: test.b3networks.com
  `;

  const parsed = ticketIntakeParser.parseTicket(incompleteTicket);

  assert.strictEqual(parsed.detectedPodId, 'ccb');
  assert.ok(parsed.completenessScore < 100, `Expected score < 100, got ${parsed.completenessScore}`);
  assert.ok(parsed.missingRequiredFields.length > 0);

  // Missing fields should include Org UUID and Call TXN
  const missingIds = parsed.missingRequiredFields.map((f) => f.id);
  assert.ok(missingIds.includes('org_uuid'), 'Should flag missing Org UUID');
  assert.ok(missingIds.includes('call_txn_or_id'), 'Should flag missing Call TXN');

  // Check clarification draft
  assert.ok(parsed.clarificationDraft.includes('Organization UUID'));
  assert.ok(parsed.clarificationDraft.includes('Call TXN or SIP Call-ID'));
  assert.ok(parsed.clarificationDraft.includes('Dear Customer'));

  console.log('✅ PASS: Incomplete ticket flags missing data and creates polite clarification');
}

// Test 3: Pod classification heuristics
{
  const smsTicket = `
Client reports SMS delivery failed for OTP verification.
Sender ID: B3OTP
Recipient: +6599887766
DLR status: UNDELIV
Time: 2026-11-09 10:00:00 SGT
  `;
  const parsedSms = ticketIntakeParser.parseTicket(smsTicket);
  assert.strictEqual(parsedSms.detectedPodId, 'cpaas');
  console.log('✅ PASS: Correctly classifies CPaaS / SMS tickets');

  const billingTicket = `
Customer disputing invoice INV-2026-11-00241, claiming double charge on CDR rating.
Org: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
  `;
  const parsedBilling = ticketIntakeParser.parseTicket(billingTicket);
  assert.strictEqual(parsedBilling.detectedPodId, 'billing');
  console.log('✅ PASS: Correctly classifies Billing tickets');
}

// Test 4: Voice Quality category and questionnaire
{
  const vqTicket = `
Domain: voice.b3networks.com
Org: 11111111-2222-3333-4444-555555555555
User reports choppy audio and one-way audio when calling +6569998888.
Time: 2026-11-09 11:00:00 SGT
TXN: txn-vq-123456
  `;
  const parsedVq = ticketIntakeParser.parseTicket(vqTicket);
  assert.strictEqual(parsedVq.matchedCategory, 'voice_quality');
  assert.ok(parsedVq.clarificationDraft.includes('voice packet loss accurately'));

  const ccb = podRegistry.getPod('ccb');
  assert.ok(ccb.voiceQualityQuestions && ccb.voiceQualityQuestions.length === 9);
  assert.ok(ccb.voiceQualityQuestions[0].question.includes('consistent'));

  console.log('✅ PASS: Correctly classifies Voice Quality and attaches 9-question survey');
}

// Test 5: Escalation Markdown formatting
{
  const ticket = `
Org: d82046ca-46e3-4700-845b-78fb6e7b579f
Domain: sipsg02.b3networks.com
Caller: +6561112222
Callee: +6592223333
TXN: txn-escalate-999
Error: SIP 488 Not Acceptable Here
Product: Microsoft Teams
Time: 2026-11-09 15:00:00 SGT
  `;
  const parsed = ticketIntakeParser.parseTicket(ticket);
  const md = parsed.escalationMarkdown;

  assert.ok(md.includes('## [CCB Escalation Dossier] Microsoft Teams'));
  assert.ok(md.includes('d82046ca-46e3-4700-845b-78fb6e7b579f'));
  assert.ok(md.includes('+6561112222'));
  assert.ok(md.includes('+6592223333'));
  assert.ok(md.includes('txn-escalate-999'));
  assert.ok(md.includes('SIP 488 Not Acceptable Here'));

  console.log('✅ PASS: Escalation Markdown generator produces structured dossier');
}

// Test 6: Pod Registry integrity
{
  const allPods = podRegistry.getAllPods();
  assert.strictEqual(allPods.length, 4);
  assert.ok(allPods.some((p) => p.id === 'ccb'));
  assert.ok(allPods.some((p) => p.id === 'cpaas'));
  assert.ok(allPods.some((p) => p.id === 'carrier'));
  assert.ok(allPods.some((p) => p.id === 'billing'));

  const ccb = podRegistry.getPod('ccb');
  assert.strictEqual(ccb.workflowSteps.length, 5);
  assert.strictEqual(ccb.slaTiers.length, 4);
  assert.ok(ccb.diagnosticMatrices.length >= 5);
  assert.ok(ccb.toolsHandbook.length >= 5);

  console.log('✅ PASS: Pod registry contains all 4 pods with complete SOP datasets');
}

console.log('====================================================');
console.log('🎉 ALL PLAYBOOK & TICKET INTAKE TESTS PASSED!');
console.log('====================================================');
