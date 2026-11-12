import {
  parsePcapArrayBuffer,
  buildLibpcapBinary,
  createRtpPacketBytes,
} from '../modules/pcap-analyzer/services/pcapParser';
import { PCAP_SAMPLE_PRESETS } from '../modules/pcap-analyzer/services/pcapPresets';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('\n=============================================================');
console.log('🚀 RUNNING PCAP & PACKET CAPTURE PARSER TEST SUITE');
console.log('=============================================================\n');

// 1. Verify Presets Integrity
assert(PCAP_SAMPLE_PRESETS.length === 4, `All 4 preset scenarios loaded (got ${PCAP_SAMPLE_PRESETS.length})`);

// 1a. Preset 1: Clean Two-Way Call
const presetClean = PCAP_SAMPLE_PRESETS.find((p) => p.id === 'completed-clean-call')!;
assert(Boolean(presetClean), 'Clean Call preset exists');
assert(presetClean.data.totalPackets > 2000, `Clean call has > 2000 total packets (${presetClean.data.totalPackets})`);
assert(presetClean.data.sessions.length === 1, `Clean call has 1 SIP session`);
assert(presetClean.data.sessions[0].status === 'COMPLETED', `Session status is COMPLETED`);
assert(presetClean.data.sessions[0].packets.length === 7, `Session has 7 SIP messages (got ${presetClean.data.sessions[0].packets.length})`);
assert(presetClean.data.rtpStreams.length === 2, `Clean call has 2 bidirectional RTP streams`);
assert(presetClean.data.detectedIssues.length === 0, `Clean call has 0 detected issues`);

// 1b. Preset 2: One-Way Audio Defect
const presetOneWay = PCAP_SAMPLE_PRESETS.find((p) => p.id === 'one-way-audio')!;
assert(Boolean(presetOneWay), 'One-Way Audio preset exists');
assert(presetOneWay.data.rtpStreams.length === 1, `One-way audio has exactly 1 RTP stream`);
assert(presetOneWay.data.rtpStreams[0].isOneWay === true, `RTP stream is flagged as isOneWay=true`);
const oneWayIssue = presetOneWay.data.detectedIssues.find((i) => i.title.includes('One-Way Audio'));
assert(Boolean(oneWayIssue), 'One-way audio defect detected in issues');
assert(oneWayIssue?.severity === 'CRITICAL', 'One-way audio defect is CRITICAL');

// 1c. Preset 3: SIP 488 Codec Mismatch
const preset488 = PCAP_SAMPLE_PRESETS.find((p) => p.id === 'sip-488-codec-mismatch')!;
assert(Boolean(preset488), 'SIP 488 preset exists');
assert(preset488.data.sessions[0].finalResponseCode === 488, 'Session finalResponseCode is 488');
assert(preset488.data.rtpStreams.length === 0, 'No RTP streams when 488 occurs');
const codecIssue = preset488.data.detectedIssues.find((i) => i.title.includes('488') || i.title.includes('Codec'));
assert(Boolean(codecIssue), 'Codec mismatch issue identified');
assert(codecIssue?.severity === 'CRITICAL', 'Codec mismatch issue is CRITICAL');

// 1d. Preset 4: 30s Disconnection (Missing SIP ACK)
const preset30s = PCAP_SAMPLE_PRESETS.find((p) => p.id === 'ack-timeout-30s-drop')!;
assert(Boolean(preset30s), 'ACK Timeout preset exists');
const ackIssue = preset30s.data.detectedIssues.find((i) => i.title.includes('30-Second') || i.title.includes('ACK'));
assert(Boolean(ackIssue), 'Missing ACK issue identified');
assert(ackIssue?.severity === 'CRITICAL', 'Missing ACK issue is CRITICAL');

// 2. Real Binary Libpcap Generation & Parser Execution
console.log('\n--- Testing Real Binary Libpcap Byte Parser ---');

const sipInvite = `INVITE sip:6001@10.0.0.1:5060 SIP/2.0\r
Via: SIP/2.0/UDP 192.168.1.100:5060;branch=z9hG4bK-7711\r
From: <sip:1001@10.0.0.1>;tag=src-tag-99\r
To: <sip:6001@10.0.0.1>\r
Call-ID: binary-test-call-id-998877@192.168.1.100\r
CSeq: 1 INVITE\r
Content-Type: application/sdp\r
Content-Length: 130\r
\r
v=0\r
o=user1 5365529 2353682 IN IP4 192.168.1.100\r
s=-\r
c=IN IP4 192.168.1.100\r
t=0 0\r
m=audio 16400 RTP/AVP 0 101\r
a=rtpmap:0 PCMU/8000\r
`;

const sip200Ok = `SIP/2.0 200 OK\r
Via: SIP/2.0/UDP 192.168.1.100:5060;branch=z9hG4bK-7711\r
From: <sip:1001@10.0.0.1>;tag=src-tag-99\r
To: <sip:6001@10.0.0.1>;tag=dst-tag-88\r
Call-ID: binary-test-call-id-998877@192.168.1.100\r
CSeq: 1 INVITE\r
Content-Type: application/sdp\r
Content-Length: 128\r
\r
v=0\r
o=user2 5365530 2353683 IN IP4 10.0.0.1\r
s=-\r
c=IN IP4 10.0.0.1\r
t=0 0\r
m=audio 18500 RTP/AVP 0 101\r
a=rtpmap:0 PCMU/8000\r
`;

// Build packets array: 2 SIP messages + 60 RTP audio packets
const rawPacketsToEncode: Array<{
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  payload: Uint8Array | string;
  timestampSec: number;
}> = [
  {
    srcIp: '192.168.1.100',
    dstIp: '10.0.0.1',
    srcPort: 5060,
    dstPort: 5060,
    payload: sipInvite,
    timestampSec: 100.0,
  },
  {
    srcIp: '10.0.0.1',
    dstIp: '192.168.1.100',
    srcPort: 5060,
    dstPort: 5060,
    payload: sip200Ok,
    timestampSec: 100.2,
  },
];

// Add 60 RTP packets with SSRC 0x12345678 (PCMU, 20ms cadence = 160 timestamp units)
for (let i = 0; i < 60; i++) {
  const rtpBytes = createRtpPacketBytes(0x12345678, i + 1, 1000 + i * 160, 0, 160);
  rawPacketsToEncode.push({
    srcIp: '192.168.1.100',
    dstIp: '10.0.0.1',
    srcPort: 16400,
    dstPort: 18500,
    payload: rtpBytes,
    timestampSec: 100.25 + i * 0.02,
  });
}

// Generate real binary Libpcap ArrayBuffer
const binaryPcap = buildLibpcapBinary(rawPacketsToEncode);
assert(binaryPcap.byteLength > 5000, `Generated binary PCAP buffer (${binaryPcap.byteLength} bytes)`);

// Parse the generated binary capture
const parsedResult = parsePcapArrayBuffer(binaryPcap, 'live_test.pcap');

assert(parsedResult.totalPackets === 62, `Binary parser extracted 62 total packets (got ${parsedResult.totalPackets})`);
assert(parsedResult.sipPacketCount === 2, `Extracted 2 SIP signaling packets (got ${parsedResult.sipPacketCount})`);
assert(parsedResult.sessions.length === 1, `Grouped into 1 SIP session`);

const parsedSession = parsedResult.sessions[0];
assert(parsedSession.callId.includes('binary-test-call-id'), `Extracted correct Call-ID (${parsedSession.callId})`);
assert(parsedSession.hasSdp === true, 'Parsed SDP from SIP packet');
assert(parsedSession.packets[0].sdp?.audioPort === 16400, `Extracted SDP audio port 16400`);
assert(Boolean(parsedSession.packets[0].sdp?.codecs.some((c) => c.includes('PCMU'))), `Extracted PCMU codec from SDP`);

assert(parsedResult.rtpStreams.length === 1, `Extracted 1 RTP stream (got ${parsedResult.rtpStreams.length})`);
const rtpStream = parsedResult.rtpStreams[0];
assert(rtpStream.ssrc === 0x12345678, `Extracted correct SSRC 0x12345678 (got ${rtpStream.ssrcHex})`);
assert(rtpStream.packetCount === 60, `Counted 60 RTP packets (got ${rtpStream.packetCount})`);
assert(rtpStream.lostPackets === 0, `0 lost packets in continuous sequence (got ${rtpStream.lostPackets})`);
assert(rtpStream.lossPct === 0.0, `0.0% packet loss`);
assert(rtpStream.isOneWay === true, `One-way audio flagged because reverse stream is absent`);

// 3. Error Handling Test
console.log('\n--- Testing Robustness & Error Handling ---');
try {
  const shortBuffer = new ArrayBuffer(12);
  parsePcapArrayBuffer(shortBuffer, 'too_small.pcap');
  assert(false, 'Should throw error on file too small');
} catch (e: any) {
  assert(e.message.includes('too small'), `Correctly caught small file error: "${e.message}"`);
}

// 4. SIP 404 Rejection & Asterisk PBX Header Extraction Test
console.log('\n--- Testing SIP 404 Not Found & Server Header Extraction ---');
const sipInvite404 = `INVITE sip:6564708729@35.240.164.189:33262 SIP/2.0\r
Via: SIP/2.0/UDP 172.21.66.206:40116;branch=z9hG4bK-404-branch\r
From: <sip:+6590022605@172.21.66.206>;tag=caller-tag\r
To: <sip:6564708729@35.240.164.189>\r
Call-ID: incident-404-test@172.21.66.206\r
CSeq: 101 INVITE\r
\r
`;

const sip404NotFound = `SIP/2.0 404 Not Found\r
Via: SIP/2.0/UDP 172.21.66.206:40116;branch=z9hG4bK-404-branch\r
From: <sip:+6590022605@172.21.66.206>;tag=caller-tag\r
To: <sip:6564708729@35.240.164.189>;tag=asterisk-tag\r
Call-ID: incident-404-test@172.21.66.206\r
CSeq: 101 INVITE\r
Server: Asterisk PBX certified/13.21-cert2\r
\r
`;

const binary404Pcap = buildLibpcapBinary([
  {
    srcIp: '172.21.66.206',
    dstIp: '35.240.164.189',
    srcPort: 40116,
    dstPort: 33262,
    payload: sipInvite404,
    timestampSec: 200.0,
  },
  {
    srcIp: '35.240.164.189',
    dstIp: '172.21.66.206',
    srcPort: 33262,
    dstPort: 40116,
    payload: sip404NotFound,
    timestampSec: 200.05,
  },
]);

const parsed404Result = parsePcapArrayBuffer(binary404Pcap, 'test_404.pcap');
assert(parsed404Result.sessions.length === 1, 'Grouped 404 call into 1 session');
assert(parsed404Result.sessions[0].status === 'REJECTED', 'Session status is REJECTED');
assert(parsed404Result.sessions[0].finalResponseCode === 404, 'Session finalResponseCode is 404');
assert(
  parsed404Result.sessions[0].serverSoftware?.includes('Asterisk') === true,
  `Parsed Server header: "${parsed404Result.sessions[0].serverSoftware}"`
);

const issue404 = parsed404Result.detectedIssues.find((i) => i.title.includes('404'));
assert(Boolean(issue404), 'Found SIP 404 Not Found in detected issues');
assert(issue404?.severity === 'CRITICAL', 'SIP 404 issue is CRITICAL');
assert(
  issue404?.description.includes('Asterisk PBX') === true,
  'Issue description cites Asterisk PBX terminating server'
);

// 5. Test Live User Uploaded Captures (if present in environment)
console.log('\n--- Testing User Uploaded Captures ---');
import * as fs from 'fs';
import * as path from 'path';
const userUpload404 =
  '/Users/adi/.gemini/antigravity/brain/fd0ff0e8-a949-4440-bebe-d3a81b006031/.user_uploaded/media_1793940882787_c0d21d07.pcap';
const userUploadNormal =
  '/Users/adi/.gemini/antigravity/brain/fd0ff0e8-a949-4440-bebe-d3a81b006031/.user_uploaded/media_1793940882787_9d397052.pcap';

if (fs.existsSync(userUpload404)) {
  const buf = fs.readFileSync(userUpload404);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const res = parsePcapArrayBuffer(ab, 'Incoming_404Congestion.pcap');
  assert(res.sessions.length > 0, 'Parsed sessions from Incoming_404Congestion.pcap');
  assert(res.sessions[0].finalResponseCode === 404, 'User 404 PCAP has finalResponseCode 404');
  assert(res.sessions[0].status === 'REJECTED', 'User 404 PCAP session status is REJECTED');
  const user404Issue = res.detectedIssues.find((i) => i.title.includes('404'));
  assert(Boolean(user404Issue), 'Incoming_404Congestion.pcap flags CRITICAL 404 defect');
  assert(user404Issue?.severity === 'CRITICAL', 'User 404 issue severity is CRITICAL');
}

if (fs.existsSync(userUploadNormal)) {
  const buf = fs.readFileSync(userUploadNormal);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const res = parsePcapArrayBuffer(ab, 'Incoming_Normal.pcap');
  assert(res.sessions.length > 0, 'Parsed sessions from Incoming_Normal.pcap');
  assert(res.sessions[0].status === 'COMPLETED', 'User Normal PCAP session status is COMPLETED');
  assert(res.sessions[0].finalResponseCode === 200, 'User Normal PCAP has finalResponseCode 200');
  const infoNote = res.detectedIssues.find((i) => i.title.includes('Signaling-Only'));
  assert(Boolean(infoNote), 'Incoming_Normal.pcap notes signaling-only capture trace');
  assert(infoNote?.severity === 'INFO', 'Signaling-only trace is INFO severity');
}

const userUploadTeams = path.join(
  process.env.HOME || '',
  '.gemini/antigravity/brain/fd0ff0e8-a949-4440-bebe-d3a81b006031/.user_uploaded/media_1793953238235_c6edede6.pcap'
);

if (fs.existsSync(userUploadTeams)) {
  const buf = fs.readFileSync(userUploadTeams);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const res = parsePcapArrayBuffer(ab, 'Sample_TeamsDR1.pcap');
  assert(res.totalPackets === 8, `User Teams DR PCAP has 8 packets (got ${res.totalPackets})`);
  assert(res.sessions.length === 1, `User Teams DR PCAP has 1 session (got ${res.sessions.length})`);
  assert(res.sessions[0].status === 'COMPLETED', `User Teams DR session status is COMPLETED (got ${res.sessions[0].status})`);
  assert(res.sessions[0].finalResponseCode === 200, `User Teams DR finalResponseCode is 200 (got ${res.sessions[0].finalResponseCode})`);
  assert(res.sessions[0].packets.length === 8, `User Teams DR session has 8 SIP packets (got ${res.sessions[0].packets.length})`);
  assert(res.sessions[0].packets[0].methodOrResponse === 'INVITE', 'First packet is INVITE');
  assert(res.sessions[0].callId === '1d2eebcd38595796bb2e6db622cd1840', `Call-ID extracted: ${res.sessions[0].callId}`);
}

const userUploadGagal2 = path.join(
  process.env.HOME || '',
  '.gemini/antigravity/brain/fd0ff0e8-a949-4440-bebe-d3a81b006031/.user_uploaded/media_1793954341403_fe3de90a.pcap'
);

if (fs.existsSync(userUploadGagal2)) {
  const buf = fs.readFileSync(userUploadGagal2);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const res = parsePcapArrayBuffer(ab, 'Incoming_Gagal_2.pcap');
  assert(res.totalPackets === 28, `Incoming_Gagal_2 has 28 packets (got ${res.totalPackets})`);
  assert(res.sessions.length === 2, `Incoming_Gagal_2 has 2 sessions (got ${res.sessions.length})`);
  assert(res.sessions[0].finalResponseCode === 401, 'Incoming_Gagal_2 session 1 final response is 401');
  assert(res.sessions[0].status === 'REJECTED', 'Incoming_Gagal_2 session 1 status is REJECTED');
  assert(res.sessions[0].serverSoftware === 'Yeastar P520', `Incoming_Gagal_2 session 1 serverSoftware is Yeastar P520 (got ${res.sessions[0].serverSoftware})`);
  const authIssue = res.detectedIssues.find((i) => i.title.includes('401'));
  assert(Boolean(authIssue), 'Incoming_Gagal_2 detects 401 Unauthorized trunk authentication failure');
  assert(authIssue?.severity === 'CRITICAL', '401 issue is CRITICAL');
}


// 6. Test Capture Readiness Auditor & Toolkit
console.log('\n--- Testing Capture Readiness Auditor ---');
import { auditCaptureReadiness, CAPTURE_RECIPES } from '../modules/pcap-analyzer/services/captureToolkit';
assert(CAPTURE_RECIPES.length >= 6, `Loaded ${CAPTURE_RECIPES.length} capture recipes`);

const pristineAudit = auditCaptureReadiness(presetClean.data);
assert(pristineAudit.hasSignaling === true, 'Pristine capture has signaling plane');
assert(pristineAudit.hasMedia === true, 'Pristine capture has media plane');
assert(pristineAudit.rtpPacketCount > 0, `Pristine capture has ${pristineAudit.rtpPacketCount} RTP packets`);
assert(pristineAudit.score >= 80, `Pristine capture scored high readiness (${pristineAudit.score}/100)`);
assert(pristineAudit.grade === 'EXCELLENT' || pristineAudit.grade === 'GOOD', `Pristine capture has grade ${pristineAudit.grade}`);

// Signaling-only trace audit check
const signalingOnlyAudit = auditCaptureReadiness(preset488.data);
assert(signalingOnlyAudit.hasSignaling === true, 'Codec rejection has signaling');
assert(signalingOnlyAudit.hasMedia === false, 'Codec rejection has no media');
assert(signalingOnlyAudit.score < 80, `Signaling-only capture scored appropriately (${signalingOnlyAudit.score}/100)`);

// 7. Test Dual-Trace Demarcation Comparison Engine
console.log('\n--- Testing Dual-Trace Demarcation Comparison Engine ---');
import { compareDualPcapTraces } from '../modules/pcap-analyzer/services/dualTraceComparator';
import { DEMARCATION_LAN_SAMPLE } from '../modules/pcap-analyzer/services/pcapPresets';

// Compare Customer LAN (Trace A, sent ACK) vs Provider SBC (Trace B, missed ACK)
const dualTraceResult = compareDualPcapTraces(
  DEMARCATION_LAN_SAMPLE,
  preset30s.data,
  'Customer LAN Handset',
  'Provider Core SBC'
);

assert(dualTraceResult.matchedSessions.length === 1, 'Correlated 1 session across dual traces');
const matchedSession = dualTraceResult.matchedSessions[0];
assert(matchedSession.verdict === 'BOUNDARY_DROP_CONFIRMED', `Dual-trace detected verdict ${matchedSession.verdict}`);
assert(matchedSession.faultDomain === 'CUSTOMER_PREMISE_FIREWALL', `Fault domain isolated to ${matchedSession.faultDomain}`);
assert(matchedSession.missingPacketsInB.some((p) => p.includes('ACK')), 'Missing ACK identified in Provider SBC trace');
assert(dualTraceResult.totalBoundaryDrops >= 1, `Total boundary drops count is ${dualTraceResult.totalBoundaryDrops}`);
assert(dualTraceResult.overallVerdict.includes('CONFIRMED'), 'Overall verdict contains CONFIRMED drop');

console.log('\n🎉 ALL PCAP PARSER & INCIDENT SCENARIO TESTS PASSED SUCCESSFULLY!\n');
