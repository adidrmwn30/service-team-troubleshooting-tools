import { CallQualityDiagnosticService, SAMPLE_CASES } from '../services/callQualityService';

console.log('====================================================');
console.log('🚀 RUNNING CALL QUALITY DIAGNOSTIC TEST SUITE');
console.log('====================================================\n');

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`);
    process.exit(1);
  }
}

// Test 1: User's Real Call Sequence (Mobile Answered 55s, Desktop 404 Congestion)
const reportAnswered = CallQualityDiagnosticService.diagnoseByTxn('01a180c5-4cf8-74ef-9cf2-e3bb9de3853f');
assert(reportAnswered.txnUuid === '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', 'Matches exact screenshot TXN UUID');
assert(reportAnswered.qualityAvailable === true, 'Quality is available for 55-second answered call');
assert(reportAnswered.callDurationSeconds === 55, 'Call duration is 55 seconds');
assert(reportAnswered.overallStatus === 'OPTIMAL', 'Identifies overall status as OPTIMAL');
assert(reportAnswered.termination.terminatedBy === 'CALLEE', 'Detects Callee (Mobile user) as the hangup party');
assert(reportAnswered.termination.q850CauseCode === 16, 'Maps normal End Call to Q.850 Cause 16 (Normal clearing)');

// Multi-leg Parallel Forking on Real Call
const realForkedLegs = reportAnswered.hops.filter((h) => h.isForkedBranch);
assert(realForkedLegs.length === 2, 'Identifies 2 parallel forked branches');
const realMobileFork = realForkedLegs.find((h) => h.nodeName.includes('Mobile'));
const realDesktopFork = realForkedLegs.find((h) => h.nodeName.includes('Desktop'));
assert(realMobileFork?.forkBranchOutcome === 'ANSWERED', 'Mobile marked as ANSWERED (talked for 55s)');
assert(realMobileFork?.metrics?.mos === 4.34, 'Mobile directional telemetry is populated');
assert(realDesktopFork?.forkBranchOutcome === 'CONGESTION', 'Desktop marked as CONGESTION (SIP 404)');

// Test 2: Multi-leg Parallel Forking Refusal Scenario (< 15s)
const reportRefusal = CallQualityDiagnosticService.diagnoseByTxn('call-sample-refusal-under-15s');
assert(reportRefusal.qualityAvailable === false, 'Quality is unavailable when call is under 15 seconds');
assert(reportRefusal.overallStatus === 'REFUSED', 'Identifies overall status as REFUSED');
assert(reportRefusal.culpritHop?.nodeName === 'SIP5B3 - Desktop', 'Accurately flags Callee Desktop endpoint as the culprit hop');
assert(reportRefusal.termination.terminatedBy === 'CALLEE', 'Detects Callee as the hangup/refusal party');
assert(reportRefusal.termination.q850CauseCode === 17, 'Maps SIP 486 to Q.850 Cause 17 (User Busy)');

const forkedLegs = reportRefusal.hops.filter((h) => h.isForkedBranch);
assert(forkedLegs.length === 2, 'Identifies 2 parallel forked branches in refusal scenario');
const desktopFork = forkedLegs.find((h) => h.nodeName.includes('Desktop'));
const mobileFork = forkedLegs.find((h) => h.nodeName.includes('Mobile'));
assert(desktopFork?.forkBranchOutcome === 'PRIMARY_REFUSAL', 'Desktop marked as PRIMARY_REFUSAL');
assert(mobileFork?.forkBranchOutcome === 'CANCELLED_BY_FORK', 'Mobile marked as CANCELLED_BY_FORK (sibling cancelled)');

// Test 3: One-Way Audio Detection (Feature 3)
const reportOneWay = CallQualityDiagnosticService.diagnoseByTxn('call-sample-one-way-audio');
assert(reportOneWay.overallStatus === 'DEGRADED', 'One-way audio marked DEGRADED');
const callerHop = reportOneWay.hops.find((h) => h.hopType === 'CALLER');
const calleeHop = reportOneWay.hops.find((h) => h.hopType === 'CALLEE_ENDPOINT');
assert(calleeHop?.metrics?.isOneWayAudio === true, 'One-way audio flag is true on Callee');
assert(calleeHop?.metrics?.txPacketLossPct === 100, 'Callee Tx loss is 100% (Microphone stream blocked)');
assert(calleeHop?.metrics?.rxPacketLossPct! < 1, 'Callee Rx loss is healthy (Can hear caller)');
assert(reportOneWay.termination.terminatedBy === 'CALLER', 'Caller hung up after realizing callee cannot be heard');

// Test 4: Asymmetric Wi-Fi Jitter (Tx vs Rx)
const reportJitter = CallQualityDiagnosticService.diagnoseByTxn('call-sample-wifi-jitter');
const mobileJitterHop = reportJitter.hops.find((h) => h.hopType === 'CALLEE_ENDPOINT');
assert(mobileJitterHop?.metrics?.rxPacketLossPct === 4.6, 'Downstream Rx loss detected at 4.6%');
assert(mobileJitterHop?.metrics?.txPacketLossPct === 0.3, 'Upstream Tx loss was pristine at 0.3%');
assert(reportJitter.termination.terminatedBy === 'CALLER', 'Caller hung up normally');

// Test 5: Dynamic JSON parsing
const mockJson = JSON.stringify({
  txnUuid: 'dynamic-test-txn-123',
  durationSeconds: 5.2,
  sipCode: 486,
  calleeName: 'Desk Phone 101',
});
const parsedReport = CallQualityDiagnosticService.diagnoseRawJson(mockJson);
assert(parsedReport.txnUuid === 'dynamic-test-txn-123', 'Parses dynamic raw JSON TXN');
assert(parsedReport.termination.terminatedBy === 'CALLEE', 'Identifies callee hangup from raw JSON');
assert(parsedReport.qualityAvailable === false, 'Detects <15s duration from raw JSON');

// Test 6: B3 Live UniversalEvent Payload with Caller Originator Cancel
const liveSiemSample = [
  {
    data: {
      eventName: 'callBegin',
      timestamp: 1793088708275,
      txnUuid: '01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd',
      legs: {
        'c7bfe8d8-3249-4160-8f85-692ba896acde': {
          callerId: '+6591122881',
          callerName: '91122881',
          numberEndpoint: '+6562738188',
          customHeaders: { 'X-EDGE-ORIGIN-PEER': 'SINGTEL_SFV_INBOUND' },
          type2: 'incoming',
          endpoint: 'number',
        },
      },
    },
  },
  {
    data: {
      eventName: 'connect',
      timestamp: 1793088708421,
      txnUuid: '01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd',
      legs: {
        '394d1d81-6d96-4d90-aa18-b8c538fd373c': {
          callerId: '+6591122881',
          endpoint: 'sip',
          sipEndpoint: { sipDomain: 'sip5.b3networks.com', sipUsername: 'sip54507589' },
          extension: { key: '103', label: '6273 8188', deviceType: 'IP_PHONE' },
          type2: 'incoming',
        },
      },
    },
  },
  {
    data: {
      eventName: 'vendorCDRExtra',
      timestamp: 1793088711867,
      legs: {
        'c7bfe8d8-3249-4160-8f85-692ba896acde': {
          'edge-SINGTEL_SFV_INBOUND': {
            nodename: 'awsfvedge1',
            peername: 'SINGTEL_SFV_INBOUND',
            hangup_cause: 'ORIGINATOR_CANCEL',
            disposition: 'EDGE_RECV_CANCEL',
          },
        },
      },
    },
  },
  {
    data: {
      eventName: 'callEnd',
      duration: 4000,
      timestamp: 1793088712880,
      txnUuid: '01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd',
    },
  },
];
const liveParsed = CallQualityDiagnosticService.parseSiemUniversalEvents(liveSiemSample, '01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd');
assert(liveParsed.callDurationSeconds === 4.0, 'Live universalEvent extracts 4.0s duration');
assert(liveParsed.overallStatus === 'CANCELLED', 'Identifies overallStatus as CANCELLED for early disconnect / caller abandonment');
assert(liveParsed.termination.terminatedBy === 'CALLER', 'Accurately detects Caller abandonment via ORIGINATOR_CANCEL');
assert(!liveParsed.executiveSummary.includes('(Call ended before media establishment)'), 'Executive summary does not contain duplicate repetitive text');
assert(liveParsed.hops.length >= 4, 'Constructs full hop chain (Caller -> Edge -> CPaaS -> Ext 103)');
const extHop = liveParsed.hops.find((h) => h.label.includes('103'));
assert(extHop !== undefined, 'Identifies Extension 103 IP_PHONE endpoint');
assert(extHop?.sipCode === 487, 'Extension 103 received SIP 487 (Request Terminated on cancel)');
assert(liveParsed.culpritHop === undefined, 'No culprit hop flagged when caller abandons');

// High Jitter Degradation Test Case (User's Ext 637 Desktop sample: Jitter 1858.84ms)
const highJitterSample = [
  {
    data: {
      eventName: 'callBegin',
      timestamp: 1793089000000,
      txnUuid: '01a18916-8321-7cd7-9e0c-01a6965b25ee',
      legs: {
        'caller-leg-1': {
          callerId: '+6589168321',
          callerName: '89168321',
          numberEndpoint: '+6563700000',
          type2: 'incoming',
          endpoint: 'number',
        },
      },
    },
  },
  {
    data: {
      eventName: 'connect',
      timestamp: 1793089002000,
      txnUuid: '01a18916-8321-7cd7-9e0c-01a6965b25ee',
      legs: {
        'desktop-leg-637': {
          callerId: '+6589168321',
          endpoint: 'sip',
          extension: { key: '637', label: 'Ext 637 (DESKTOP)', deviceType: 'DESKTOP' },
          sipEndpoint: { sipDomain: 'sip5.b3networks.com', sipUsername: 'sip637' },
          type2: 'incoming',
          responseCode: '200',
          status: 'ANSWERED',
          qos: {
            mos: 4.47,
            jitter: {
              loss_rate: 0.02,
              max_variance: 1858.84,
            },
          },
        },
      },
    },
  },
  {
    data: {
      eventName: 'callEnd',
      duration: 65000,
      timestamp: 1793089065000,
      txnUuid: '01a18916-8321-7cd7-9e0c-01a6965b25ee',
    },
  },
];

const parsedHighJitter = CallQualityDiagnosticService.parseSiemUniversalEvents(
  highJitterSample,
  '01a18916-8321-7cd7-9e0c-01a6965b25ee'
);

assert(parsedHighJitter.overallStatus === 'DEGRADED', 'Identifies overallStatus as DEGRADED due to 1858ms jitter');
const desktopHop = parsedHighJitter.hops.find((h) => h.label.includes('637'));
assert(desktopHop !== undefined, 'Finds Ext 637 Desktop hop');
assert(desktopHop?.status === 'FAIL', 'Ext 637 marked as FAIL due to critical jitter exceeding 40ms');
assert(desktopHop?.isCulprit === true, 'Ext 637 flagged as culprit hop');
assert(parsedHighJitter.culpritHop?.nodeName === desktopHop?.nodeName, 'culpritHop correctly points to Ext 637');
assert(parsedHighJitter.l2Details?.faultDomain === 'CUSTOMER_PREMISE_ENDPOINT', 'Fault domain isolated to CUSTOMER_PREMISE_ENDPOINT');

// ====================================================
// Test 8: Customer Reported Anomaly Correlation Suite
// ====================================================

// 8.1: ~30s Drop Correlation (Matches 31.8s NAT / SIP ACK Timeout)
const rep30sMatched = CallQualityDiagnosticService.diagnoseByTxn('call-sample-drop-at-30s', {
  preset: 'DROP_AT_30S',
});
assert(rep30sMatched.symptomCorrelation !== undefined, 'Symptom correlation is generated for ~30s drop');
assert(rep30sMatched.symptomCorrelation?.verdict === 'MATCHED_DEFECT', 'Identifies ~30s drop as MATCHED_DEFECT');
assert(
  Boolean(rep30sMatched.symptomCorrelation?.verdictBadgeLabel.includes('30s ACK/NAT TIMEOUT')),
  'Badge displays confirmed 30s ACK/NAT timeout'
);
assert(
  Boolean(
    rep30sMatched.symptomCorrelation?.customerFacingExplanation.includes('firewall') ||
    rep30sMatched.symptomCorrelation?.customerFacingExplanation.includes('acknowledgment')
  ),
  'Customer facing note explains firewall / ACK drop in English'
);

// 8.2: ~30s Drop Discrepancy (Reported ~30s on a 55s call)
const rep30sDiscrepancy = CallQualityDiagnosticService.diagnoseByTxn('01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', {
  preset: 'DROP_AT_30S',
});
assert(
  rep30sDiscrepancy.symptomCorrelation?.verdict === 'DISCREPANCY_DURATION',
  'Detects duration mismatch when customer reported ~30s drop on a 55s call'
);

// 8.3: ~15m Drop Correlation (Matches 902.5s Session-Expires RFC 4028)
const rep15mMatched = CallQualityDiagnosticService.diagnoseByTxn('call-sample-drop-at-15m', {
  preset: 'DROP_AT_15M',
});
assert(rep15mMatched.symptomCorrelation?.verdict === 'MATCHED_DEFECT', 'Identifies ~15m drop as MATCHED_DEFECT');
assert(
  Boolean(rep15mMatched.symptomCorrelation?.verdictBadgeLabel.includes('15m SESSION REFRESH')),
  'Badge displays confirmed 15m session refresh'
);

// 8.4: ~15m Drop Discrepancy (Reported ~15m on a 55s call)
const rep15mDiscrepancy = CallQualityDiagnosticService.diagnoseByTxn('01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', {
  preset: 'DROP_AT_15M',
});
assert(
  rep15mDiscrepancy.symptomCorrelation?.verdict === 'DISCREPANCY_DURATION',
  'Detects duration mismatch when customer reported ~15m drop on a 55s call'
);

// 8.5: Unexpected Mid-Call Drop Discrepancy (Customer reported drop, but CDR shows normal callee hangup)
const repNormalHangupDisc = CallQualityDiagnosticService.diagnoseByTxn('01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', {
  preset: 'MID_CALL_DROP',
});
assert(
  repNormalHangupDisc.symptomCorrelation?.verdict === 'DISCREPANCY_NORMAL_HANGUP',
  'Flags normal user hangup discrepancy when customer claims drop on normal clearing'
);
assert(
  Boolean(repNormalHangupDisc.symptomCorrelation?.verdictBadgeLabel.includes('NORMAL USER HANGUP')),
  'Badge displays DISCREPANCY: NORMAL USER HANGUP'
);

// 8.6: Call Setup Failure Correlation (Matches SIP 486 Refusal)
const repSetupMatched = CallQualityDiagnosticService.diagnoseByTxn('call-sample-refusal-under-15s', {
  preset: 'CALL_SETUP_FAILURE',
});
assert(
  repSetupMatched.symptomCorrelation?.verdict === 'MATCHED_DEFECT',
  'Confirms setup failure on SIP 486 refusal call'
);

// 8.7: One-Way Audio Correlation (Matches 100% Tx loss)
const repOneWayMatched = CallQualityDiagnosticService.diagnoseByTxn('call-sample-one-way-audio', {
  preset: 'ONE_WAY_AUDIO',
});
assert(
  repOneWayMatched.symptomCorrelation?.verdict === 'MATCHED_DEFECT',
  'Confirms one-way audio defect when Tx packet loss is 100%'
);

// 8.8: One-Way Audio Clean (Customer claimed one-way audio on pristine 55s call)
const repOneWayClean = CallQualityDiagnosticService.diagnoseByTxn('01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', {
  preset: 'ONE_WAY_AUDIO',
});
assert(
  repOneWayClean.symptomCorrelation?.verdict === 'CLEAN_NO_DEFECT',
  'Flags CLEAN_NO_DEFECT when audio is bidirectional and healthy'
);

// 8.9: Choppy / Robotic Audio (Matches 64ms Wi-Fi jitter)
const repChoppyMatched = CallQualityDiagnosticService.diagnoseByTxn('call-sample-wifi-jitter', {
  preset: 'CHOPPY_OR_ROBOTIC',
});
assert(
  repChoppyMatched.symptomCorrelation?.verdict === 'MATCHED_DEFECT',
  'Confirms audio degradation on high jitter Wi-Fi call'
);

// 8.10: Custom Free-Text Symptom Input (Customer note in English)
const repCustomDrop = CallQualityDiagnosticService.diagnoseByTxn('01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', {
  preset: 'CUSTOM',
  customDescription: 'Customer complained: "Call disconnected unexpectedly after less than a minute"',
});
assert(
  repCustomDrop.symptomCorrelation?.verdict === 'DISCREPANCY_NORMAL_HANGUP',
  'Custom note about disconnection correlates with normal hangup telemetry discrepancy'
);
assert(
  Boolean(repCustomDrop.symptomCorrelation?.reportedText.includes('Call disconnected unexpectedly')),
  'Reported text includes customer custom observation'
);

// 8.11: Dynamic Raw JSON with Symptom Correlation
const rawJsonReport = CallQualityDiagnosticService.diagnoseRawJson(
  JSON.stringify({
    txnUuid: 'json-symptom-test-001',
    durationSeconds: 31.2,
    callerHangup: false,
    sipCode: 408,
  }),
  { preset: 'DROP_AT_30S' }
);
assert(
  rawJsonReport.symptomCorrelation?.verdict === 'MATCHED_DEFECT',
  'Dynamic raw JSON correlates ~30s drop with MATCHED_DEFECT'
);

// 9. Outbound / Outgoing Call Telemetry and Hop 1 Identification Tests
console.log('\n--- Testing Outbound Call Direction & Hop 1 Identification ---');

// 9.1: Preset Outbound Sample Case
const repOutboundPreset = CallQualityDiagnosticService.diagnoseByTxn('call-sample-outbound-normal');
assert(repOutboundPreset.callDirection === 'OUTBOUND', 'Detects callDirection as OUTBOUND on sample');
assert(repOutboundPreset.hops[0].label.startsWith('Outbound Caller:'), 'Hop 1 is labeled as Outbound Caller (Agent)');
assert(repOutboundPreset.hops[0].hopType === 'CALLER', 'Hop 1 hopType is CALLER');
assert(
  Boolean(repOutboundPreset.hops[1].subLabel?.includes('Outbound Egress SBC')),
  'Hop 2 indicates Outbound Egress SBC'
);
assert(
  Boolean(repOutboundPreset.hops[2].subLabel?.includes('Outbound Dial Plan')),
  'Hop 3 indicates Outbound Dial Plan & LCR Engine'
);
assert(
  Boolean(repOutboundPreset.hops[3].label.includes('+6591234567')),
  'Hop 4 is Destination Callee (+6591234567)'
);
assert(repOutboundPreset.l2Details?.callDirection === 'OUTBOUND', 'L2 dossier records OUTBOUND direction');

// 9.2: Live SIEM UniversalEvents with Outbound/Outgoing Indicators
const liveSiemOutbound = [
  {
    data: {
      eventName: 'callBegin',
      timestamp: 1793090000000,
      txnUuid: '01a18999-outbound-test-uuid-4411aad69600',
      legs: {
        'leg-agent-orig': {
          callerId: '102',
          callerName: 'Agent Alice (Ext 102)',
          numberEndpoint: '+6568991234',
          customHeaders: {
            'X-EDGE-TERMINATING-PEER': 'SINGTEL_SFV_OUT',
          },
          type2: 'outgoing',
          direction: 'outgoing',
          endpoint: 'sip',
          sipEndpoint: { sipDomain: 'sip5.b3networks.com', sipUsername: 'agent102' },
          extension: { key: '102', label: 'Alice Ext 102', deviceType: 'WEBRTC' },
        },
      },
    },
  },
  {
    data: {
      eventName: 'vendorCDRExtra',
      timestamp: 1793090001000,
      legs: {
        'leg-agent-orig': {
          'edge-SINGTEL_SFV_OUT': {
            nodename: 'sgtelegedge1',
            peername: 'SINGTEL_SFV_OUT',
            disposition: 'ANSWERED',
          },
        },
      },
    },
  },
  {
    data: {
      eventName: 'callEnd',
      duration: 35000,
      timestamp: 1793090035000,
      txnUuid: '01a18999-outbound-test-uuid-4411aad69600',
    },
  },
];

const parsedOutbound = CallQualityDiagnosticService.parseSiemUniversalEvents(
  liveSiemOutbound,
  '01a18999-outbound-test-uuid-4411aad69600'
);
assert(parsedOutbound.callDirection === 'OUTBOUND', 'UniversalEvents parser identifies callDirection as OUTBOUND');
assert(
  parsedOutbound.hops[0].label.includes('Outbound Caller:') &&
  parsedOutbound.hops[0].label.includes('Agent Alice'),
  'Hop 1 correctly identifies Outbound Caller Agent Alice instead of Inbound'
);
assert(parsedOutbound.hops[0].hopType === 'CALLER', 'Hop 1 hopType remains CALLER for topology order');
assert(
  Boolean(parsedOutbound.hops[1].subLabel?.includes('Outbound Egress SBC')),
  'Hop 2 subLabel indicates Outbound Egress SBC'
);
assert(parsedOutbound.hops[3].label.includes('+6568991234'), 'Hop 4 identifies dialed external callee');
assert(parsedOutbound.l2Details?.callDirection === 'OUTBOUND', 'L2 Details captures OUTBOUND direction');

console.log('✅ Testing TXN 01a18556-dddd-7373-b274-6b11e4f8db5e Inbound Flow with Downstream Outgoing PBX Leg...');
const sampleInbound01a = CallQualityDiagnosticService.diagnoseByTxn(
  '01a18556-dddd-7373-b274-6b11e4f8db5e',
  undefined
);
assert(sampleInbound01a.callDirection === 'INBOUND', '01a18556 must be classified as INBOUND');
assert(
  sampleInbound01a.hops[0].label.includes('+6562619008'),
  '01a18556 Hop 1 must be true Inbound Caller +6562619008, NOT PBX extension'
);
assert(sampleInbound01a.hops[0].vendor === 'Singtel PSTN', '01a18556 Hop 1 vendor is Singtel PSTN');
assert(sampleInbound01a.hops[1].nodeName === 'awsfvstedge1', '01a18556 Hop 2 is SBC awsfvstedge1');
assert(sampleInbound01a.hops[2].hopType === 'CPAAS_CORE', '01a18556 Hop 3 is CPaaS Core Routing');
assert(
  sampleInbound01a.hops[3].label.includes('sip19547913') || sampleInbound01a.hops[3].nodeName.includes('SGUNICENTREX'),
  '01a18556 Hop 4 is customer PBX endpoint sip19547913 on SGUNICENTREX'
);
assert(sampleInbound01a.hops[3].sipCode === 480, '01a18556 Hop 4 records SIP 480');
assert(sampleInbound01a.hops[3].isCulprit === true, '01a18556 Hop 4 is marked as Culprit');
assert(sampleInbound01a.hops[3].status === 'FAIL', '01a18556 Hop 4 status is FAIL');
assert(
  Boolean(sampleInbound01a.l2Details?.vendorSummary?.includes('SGUNICENTREX')),
  '01a18556 L2 Details captures vendor summary with SGUNICENTREX'
);
assert(
  Boolean(sampleInbound01a.l2Details?.legSummaries && sampleInbound01a.l2Details.legSummaries.length >= 2),
  '01a18556 L2 Details contains per-leg forensic summaries'
);

console.log('✅ Testing parseSiemUniversalEvents with Inbound Carrier + Child Outgoing PBX Leg...');
const liveSiemMultiLegInbound = [
  {
    data: {
      eventName: 'callBegin',
      timestamp: 1793200000000,
      txnUuid: '01a18556-dddd-7373-b274-6b11e4f8db5e',
      callerId: '+6562619008',
      callee: '+6562484150',
      legs: {
        'a9426627-5757-4b06-bc16-02d0ec7615f0': {
          type2: 'incoming',
          direction: 'incoming',
          endpoint: 'carrier',
          trunk: { name: 'SINGTEL_SFV_INBOUND' },
          origination: { callerId: '+6562619008', did: '+6562484150' },
        },
        '0e877e90-44b9-4467-8cfb-69d671ee6a85': {
          type2: 'outgoing',
          direction: 'outgoing',
          endpoint: 'sip',
          terminatedPeer: 'SGUNICENTREX',
          origination: { callerId: '62484150', did: 'sip19547913' },
          sipEndpoint: { sipUsername: 'sip19547913' },
        },
      },
    },
  },
  {
    data: {
      eventName: 'vendorCDRExtra',
      timestamp: 1793200001000,
      legs: {
        'a9426627-5757-4b06-bc16-02d0ec7615f0': {
          'edge-SINGTEL': {
            nodename: 'awsfvstedge1',
            peername: 'SINGTEL_SFV_INBOUND',
            disposition: 'ANSWERED',
          },
        },
        '0e877e90-44b9-4467-8cfb-69d671ee6a85': {
          'edge-SGUNICENTREX': {
            nodename: 'SGUNICENTREX',
            peername: 'SGUNICENTREX',
            disposition: 'BUSIED_OUT',
          },
        },
      },
    },
  },
  {
    data: {
      eventName: 'legEnded',
      timestamp: 1793200003000,
      legUuid: '0e877e90-44b9-4467-8cfb-69d671ee6a85',
      sipCode: 480,
      sipReason: 'Signaling Terminated',
      hangupReason: '480 Signaling Terminated',
    },
  },
  {
    data: {
      eventName: 'callEnd',
      timestamp: 1793200004000,
      txnUuid: '01a18556-dddd-7373-b274-6b11e4f8db5e',
      sipCode: 480,
      sipReason: 'Signaling Terminated',
    },
  },
];

const parsedMultiLeg = CallQualityDiagnosticService.parseSiemUniversalEvents(
  liveSiemMultiLegInbound,
  '01a18556-dddd-7373-b274-6b11e4f8db5e'
);
assert(parsedMultiLeg.callDirection === 'INBOUND', 'Multi-leg with carrier ingress must remain INBOUND despite outgoing branch');
assert(parsedMultiLeg.hops[0].label.includes('+6562619008'), 'Parsed multi-leg Hop 1 caller must be +6562619008');
assert(parsedMultiLeg.hops[1].nodeName === 'awsfvstedge1', 'Parsed multi-leg Hop 2 SBC is awsfvstedge1');
assert(parsedMultiLeg.hops[3].label.includes('sip19547913'), 'Parsed multi-leg Hop 4 is sip19547913');
assert(parsedMultiLeg.hops[3].isCulprit === true, 'Parsed multi-leg Hop 4 is Culprit due to SIP 480');
assert(parsedMultiLeg.hops[3].sipCode === 480, 'Parsed multi-leg Hop 4 has SIP 480');
assert(parsedMultiLeg.hops[3].vendor === 'SGUNICENTREX', 'Parsed multi-leg Hop 4 vendor is SGUNICENTREX');
assert(Boolean(parsedMultiLeg.l2Details?.legSummaries && parsedMultiLeg.l2Details.legSummaries.length >= 2), 'Parsed multi-leg generated leg summaries');

console.log('✅ Testing parseSiemUniversalEvents with Agent Outbound Call (sip91611167 via WDFVEDGE1_OUTBOUND to +6560404221)...');
const liveSiemRealOutbound = [
  {
    data: {
      eventName: 'callBegin',
      timestamp: 1793260000000,
      txnUuid: '01a18999-outbound-agent-sip-call-4411aad69600',
      callerId: 'sip91611167',
      callee: '+6560404221',
      legs: {
        'leg-agent-sip91611167': {
          callerId: 'sip91611167',
          caller: 'sip91611167',
          endpoint: 'sip',
          vendor: 'SIP583',
          direction: 'incoming',
          type2: 'incoming',
          customHeaders: {
            'X-EDGE-ORIGIN-PEER': 'WDFVEDGE1_OUTBOUND',
          },
          qos: { mos: 4.5, rxPacketLossPct: 0, txPacketLossPct: 0, jitterMs: 0 },
        },
        '22d9ba76-6395-430d-8cfc-da70409b045e': {
          legUuid: '22d9ba76-6395-430d-8cfc-da70409b045e',
          callee: '+6560404221',
          numberEndpoint: '+6560404221',
          vendor: 'SINGTEL',
          direction: 'outgoing',
          type2: 'outgoing',
          customHeaders: {
            'X-EDGE-TERMINATING-PEER': 'SINGTEL',
          },
          'edge-SINGTEL': {
            nodename: 'wdfvedge1',
            peername: 'SINGTEL',
            sip_resp_code: '200',
            disposition: 'ANSWERED',
          },
          status: 'ANSWERED',
          responseCode: '200',
          duration: 14000,
          qos: { mos: 4.5, rxPacketLossPct: 0, txPacketLossPct: 0, jitterMs: 0 },
        },
      },
    },
  },
  {
    data: {
      eventName: 'callEnd',
      timestamp: 1793260014000,
      txnUuid: '01a18999-outbound-agent-sip-call-4411aad69600',
      duration: 14000,
      sipCode: 200,
      sipReason: 'NORMAL_CLEARING',
    },
  },
];

const parsedRealOutbound = CallQualityDiagnosticService.parseSiemUniversalEvents(
  liveSiemRealOutbound,
  '01a18999-outbound-agent-sip-call-4411aad69600'
);

assert(parsedRealOutbound.callDirection === 'OUTBOUND', 'Outbound call from sip91611167 must be detected as OUTBOUND, not INBOUND');
assert(parsedRealOutbound.hops[0].label === 'Outbound Caller: sip91611167', 'Hop 1 label must be Outbound Caller: sip91611167');
assert(parsedRealOutbound.hops[0].hopType === 'CALLER', 'Hop 1 hopType must be CALLER');
assert(parsedRealOutbound.hops[0].legDirection === 'OUTGOING', 'Hop 1 legDirection must be OUTGOING');
assert(Boolean(parsedRealOutbound.hops[1].subLabel?.includes('Outbound Egress SBC')), 'Hop 2 subLabel must indicate Outbound Egress SBC');
assert(Boolean(parsedRealOutbound.hops[1].subLabel?.includes('WDFVEDGE1_OUTBOUND')), 'Hop 2 subLabel must reference WDFVEDGE1_OUTBOUND');
assert(Boolean(parsedRealOutbound.hops[2].subLabel?.includes('Outbound Dial Plan')), 'Hop 3 subLabel must reference Outbound Dial Plan');
assert(parsedRealOutbound.hops[3].label.includes('+6560404221'), 'Hop 4 label must reference +6560404221');
assert(parsedRealOutbound.hops[3].hopType === 'CALLEE_ENDPOINT', 'Hop 4 hopType must be CALLEE_ENDPOINT');
assert(parsedRealOutbound.l2Details?.callDirection === 'OUTBOUND', 'L2 Details callDirection must be OUTBOUND');

console.log('✅ Testing SIEM payload with top-level direction: "inbound" overridden by agent SIP caller and outbound peer...');
const liveSiemWithIngressSocketInbound = [
  {
    data: {
      eventName: 'callBegin',
      direction: 'inbound', // Socket-level ingress direction often logged by B3
      callerId: 'sip91611167',
      callee: '+6560404221',
      legs: {
        'leg-agent-sip91611167': {
          callerId: 'sip91611167',
          vendor: 'SIP583',
          direction: 'incoming',
          customHeaders: {
            'X-EDGE-ORIGIN-PEER': 'WDFVEDGE1_OUTBOUND',
          },
          qos: { mos: 4.5, rxPacketLossPct: 0, txPacketLossPct: 0, jitterMs: 0 },
        },
        '22d9ba76-6395-430d-8cfc-da70409b045e': {
          legUuid: '22d9ba76-6395-430d-8cfc-da70409b045e',
          callee: '+6560404221',
          vendor: 'SINGTEL',
          direction: 'outgoing',
          customHeaders: {
            'X-EDGE-TERMINATING-PEER': 'SINGTEL',
          },
          'edge-SINGTEL': {
            nodename: 'wdfvedge1',
            peername: 'SINGTEL',
            sip_resp_code: '200',
            disposition: 'ANSWERED',
          },
          status: 'ANSWERED',
          responseCode: '200',
          duration: 14000,
          qos: { mos: 4.5, rxPacketLossPct: 0, txPacketLossPct: 0, jitterMs: 0 },
        },
      },
    },
  },
  {
    data: {
      eventName: 'callEnd',
      direction: 'inbound',
      duration: 14000,
      sipCode: 200,
      sipReason: 'NORMAL_CLEARING',
    },
  },
];

const parsedIngressInbound = CallQualityDiagnosticService.parseSiemUniversalEvents(
  liveSiemWithIngressSocketInbound,
  '01a18999-outbound-agent-socket-inbound'
);

assert(parsedIngressInbound.callDirection === 'OUTBOUND', 'Must be detected as OUTBOUND despite deceptive direction: "inbound"');
assert(parsedIngressInbound.hops[0].label === 'Outbound Caller: sip91611167', 'Hop 1 label must be Outbound Caller: sip91611167');
assert(Boolean(parsedIngressInbound.hops[0].subLabel?.includes('WDFVEDGE1_OUTBOUND')), 'Hop 1 subLabel must reference WDFVEDGE1_OUTBOUND');
assert(parsedIngressInbound.hops[0].legDirection === 'OUTGOING', 'Hop 1 legDirection must be OUTGOING');
assert(Boolean(parsedIngressInbound.hops[1].subLabel?.includes('Outbound Egress SBC')), 'Hop 2 subLabel must indicate Outbound Egress SBC');
assert(Boolean(parsedIngressInbound.hops[3].label.includes('+6560404221')), 'Hop 4 must reference external callee +6560404221');

console.log('\n--- Testing Deterministic Anomaly Simulation Presets (UUID & Slug Lookups) ---');
// Verify each anomaly preset can be resolved directly by its TXN UUID
const presetsToVerify = [
  { uuid: '01a18556-dddd-7373-b274-6b11e4f8db5e', expectedStatus: 'REFUSED', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: '01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd', expectedStatus: 'OPTIMAL', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f', expectedStatus: 'OPTIMAL', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: 'outbound-01a2b3c4-9876-4321-abcd-ef0123456789', expectedStatus: 'OPTIMAL', expectedDirection: 'OUTBOUND', expectedHop1Role: 'CALLER' },
  { uuid: 'e9921c44-3312-4aa1-9f90-112233445566', expectedStatus: 'REFUSED', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: '88cc4411-90ef-4122-bc33-556677889900', expectedStatus: 'DEGRADED', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: '7b889a12-11c3-4d22-b5e8-99e21f45612a', expectedStatus: 'DEGRADED', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: 'f4b10030-99aa-44bb-88cc-303030303030', expectedStatus: 'FAILED', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
  { uuid: 'f4b10015-88bb-44cc-99dd-151515151515', expectedStatus: 'FAILED', expectedDirection: 'INBOUND', expectedHop1Role: 'CALLER' },
];

for (const p of presetsToVerify) {
  const rep = CallQualityDiagnosticService.diagnoseByTxn(p.uuid);
  assert(rep.txnUuid === p.uuid, `Preset ${p.uuid} preserves exact txnUuid`);
  assert(rep.overallStatus === p.expectedStatus, `Preset ${p.uuid} matches expected overallStatus ${p.expectedStatus}`);
  assert(rep.callDirection === p.expectedDirection, `Preset ${p.uuid} matches expected callDirection ${p.expectedDirection}`);
  assert(rep.hops.length >= 4, `Preset ${p.uuid} contains at least 4 topology hops`);
  assert(rep.hops[0].hopType === p.expectedHop1Role, `Preset ${p.uuid} hop 1 is ${p.expectedHop1Role}`);
  assert(Boolean(rep.hops[0].vendor), `Preset ${p.uuid} hop 1 includes vendor attribute`);
  assert(Boolean(rep.l2Details?.vendorSummary), `Preset ${p.uuid} l2Details includes vendorSummary`);
  assert(Boolean(rep.l2Details?.legSummaries && rep.l2Details.legSummaries.length > 0), `Preset ${p.uuid} includes forensic legSummaries`);
}

console.log('\n====================================================');
console.log('📊 CALL QUALITY TESTS: ALL PASSED');
console.log('====================================================\n');
