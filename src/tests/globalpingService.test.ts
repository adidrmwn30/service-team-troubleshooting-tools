import assert from 'assert';
import {
  GlobalpingService,
} from '../modules/network-diagnostics/services/globalpingService';
import {
  normalizeProbeInfo,
  normalizePingResult,
  normalizeTracerouteResult,
  normalizeDnsResult,
  normalizeMtrResult,
  normalizeHttpResult,
  normalizeGlobalpingResponse,
} from '../modules/network-diagnostics/services/globalpingNormalizer';
import { NetworkDiagnosticResult } from '../modules/network-diagnostics/types';

// Mock localStorage for node test runner environment
const mockStorage: Record<string, string> = {};
(global as any).window = {
  localStorage: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
  },
};

console.log('\n====================================================');
console.log('🚀 RUNNING GLOBALPING NETWORK DIAGNOSTICS TEST SUITE');
console.log('====================================================\n');

// 1. Target Validation Tests
(() => {
  console.log('--- 1. Target Validation Tests ---');

  const emptyTest = GlobalpingService.validateTarget('', 'ping');
  assert.strictEqual(emptyTest.valid, false, 'Rejects empty target');

  const spaceTest = GlobalpingService.validateTarget('sip.b3 networks.com', 'ping');
  assert.strictEqual(spaceTest.valid, false, 'Rejects target with spaces');

  const shellInjectionTest = GlobalpingService.validateTarget('sip.b3networks.com; rm -rf /', 'ping');
  assert.strictEqual(shellInjectionTest.valid, false, 'Rejects command injection characters');

  const validDomain = GlobalpingService.validateTarget('sip.b3networks.com', 'ping');
  assert.strictEqual(validDomain.valid, true, 'Accepts valid hostname');
  assert.strictEqual(validDomain.cleanTarget, 'sip.b3networks.com');

  const validIpv4 = GlobalpingService.validateTarget('103.24.112.5', 'traceroute');
  assert.strictEqual(validIpv4.valid, true, 'Accepts valid IPv4');

  const validHttpUrl = GlobalpingService.validateTarget('https://portal.b3networks.com', 'http');
  assert.strictEqual(validHttpUrl.valid, true, 'Accepts valid HTTPS URL for HTTP diagnostic');

  const privateIpTest = GlobalpingService.validateTarget('192.168.1.1', 'ping');
  assert.strictEqual(privateIpTest.valid, false, 'Rejects RFC1918 private IP target');

  const loopbackTest = GlobalpingService.validateTarget('127.0.0.1', 'ping');
  assert.strictEqual(loopbackTest.valid, false, 'Rejects loopback IP target');

  const awsMetadataTest = GlobalpingService.validateTarget('169.254.169.254', 'http');
  assert.strictEqual(awsMetadataTest.valid, false, 'Rejects link-local cloud metadata target');

  console.log('✅ PASS: All target validation scenarios handled securely');
})();

// 2. Probe Normalization Tests
(() => {
  console.log('\n--- 2. Probe Info Normalization ---');

  const rawProbe = {
    continent: 'AS',
    region: 'South-Eastern Asia',
    country: 'SG',
    city: 'Singapore',
    asn: 13335,
    network: 'Cloudflare, Inc.',
  };

  const normalized = normalizeProbeInfo(rawProbe);
  assert.strictEqual(normalized.continent, 'AS');
  assert.strictEqual(normalized.country, 'SG');
  assert.strictEqual(normalized.city, 'Singapore');
  assert.strictEqual(normalized.asn, 13335);
  assert.strictEqual(normalized.network, 'Cloudflare, Inc.');

  const emptyProbe = normalizeProbeInfo(null);
  assert.strictEqual(emptyProbe.continent, 'Unknown');
  assert.strictEqual(emptyProbe.country, 'Unknown');

  console.log('✅ PASS: Probe metadata normalized accurately');
})();

// 3. Ping Normalization & VoIP Guardrail
(() => {
  console.log('\n--- 3. Ping Normalization & VoIP Reality Check ---');

  const rawPing = {
    rawOutput: 'PING sip.b3networks.com (103.24.112.5) 56(84) bytes of data.\n64 bytes: icmp_seq=1 ttl=58 time=1.2 ms',
    stats: {
      min: 1.1,
      avg: 1.5,
      max: 2.1,
      stDev: 0.3,
      total: 3,
      rcv: 3,
      drop: 0,
      loss: 0,
    },
    timings: [{ rtt: 1.1 }, { rtt: 1.5 }, { rtt: 2.1 }],
  };

  const { data, interpretation } = normalizePingResult(rawPing);
  assert.strictEqual(data.packetLossPct, 0);
  assert.strictEqual(data.avgRttMs, 1.5);
  assert.strictEqual(data.packetsSent, 3);
  assert.strictEqual(data.packetsReceived, 3);

  // Guardrail check: must warn that ICMP does NOT prove SIP/RTP media stability
  assert.ok(
    interpretation.voipGuardrailNotes.some((n) => n.includes('ICMP Echo confirms Layer 3 IP connectivity only')),
    'VoIP guardrail present for Ping'
  );
  assert.ok(
    interpretation.voipGuardrailNotes.some((n) => n.includes('RTP voice packets')),
    'VoIP guardrail mentions RTP media ports'
  );

  console.log('✅ PASS: Ping telemetry and VoIP reality check normalized');
})();

// 4. Traceroute Normalization & ICMP Rate Limit Handling
(() => {
  console.log('\n--- 4. Traceroute Hop Parsing & ICMP Rate Limit Detection ---');

  const rawTrace = {
    destination: '103.24.112.5',
    hops: [
      {
        hop: 1,
        addresses: ['192.168.1.1'],
        resolvedHostname: 'gw.local',
        timings: [{ rtt: 0.8 }, { rtt: 0.9 }],
      },
      {
        hop: 2,
        addresses: [], // Asterisks / Timeout
        timings: [],
      },
      {
        hop: 3,
        addresses: ['103.24.112.5'],
        timings: [{ rtt: 12.4 }],
      },
    ],
    rawOutput: 'traceroute to 103.24.112.5',
  };

  const { data, interpretation } = normalizeTracerouteResult(rawTrace, '103.24.112.5');
  assert.strictEqual(data.totalHops, 3);
  assert.strictEqual(data.destinationReached, true);
  assert.strictEqual(data.hops[0].status, 'PASS');
  assert.strictEqual(data.hops[1].status, 'TIMEOUT');
  assert.strictEqual(data.hops[2].status, 'PASS');

  // Verify ICMP rate limit detection
  assert.strictEqual(interpretation.isIcmpRateLimitedSuspected, true);
  assert.ok(
    interpretation.observations.some((o) => o.includes('standard router ICMP rate limiting')),
    'Intermediate hop timeout accurately classified as router control-plane rate limiting'
  );
  assert.ok(
    interpretation.voipGuardrailNotes.some((n) => n.includes('does NOT reflect forwarding plane performance for RTP')),
    'Traceroute VoIP guardrail strictly preserved'
  );

  console.log('✅ PASS: Traceroute hops and intermediate ICMP throttling detected');
})();

// 5. DNS Normalization Tests
(() => {
  console.log('\n--- 5. DNS Normalization & SRV/NAPTR VoIP Guidance ---');

  const rawDns = {
    statusCode: 'NOERROR',
    statusCodeName: 'NOERROR',
    answers: [
      { name: 'sip.b3networks.com.', type: 'A', ttl: 300, value: '103.24.112.5' },
    ],
    timings: { total: 18 },
  };

  const { data, interpretation } = normalizeDnsResult(rawDns, 'sip.b3networks.com', 'A');
  assert.strictEqual(data.statusCode, 'NOERROR');
  assert.strictEqual(data.answers.length, 1);
  assert.strictEqual(data.answers[0].value, '103.24.112.5');
  assert.strictEqual(data.roundTripMs, 18);

  assert.ok(
    interpretation.voipGuardrailNotes.some((n) => n.includes('DNS SRV (_sip._udp, _sips._tcp)')),
    'VoIP guardrail instructs verifying SRV/NAPTR for SBC redundancy'
  );

  console.log('✅ PASS: DNS records normalized with SRV guidance');
})();

// 6. MTR Continuous Hop Analysis
(() => {
  console.log('\n--- 6. MTR Multi-Cycle Analysis & Loss Isolation ---');

  const rawMtr = {
    destination: '103.24.112.5',
    hops: [
      {
        hop: 1,
        address: '10.0.0.1',
        stats: { loss: 0, avg: 0.8, best: 0.6, worst: 1.2, stDev: 0.1 },
      },
      {
        hop: 2,
        address: '172.16.0.1',
        stats: { loss: 40, avg: 5.2, best: 4.8, worst: 6.1, stDev: 0.3 }, // Loss at hop 2
      },
      {
        hop: 3,
        address: '103.24.112.5',
        stats: { loss: 0, avg: 14.1, best: 13.5, worst: 15.0, stDev: 0.4 }, // 0% loss at destination!
      },
    ],
  };

  const { data, interpretation } = normalizeMtrResult(rawMtr, '103.24.112.5');
  assert.strictEqual(data.hops.length, 3);
  assert.strictEqual(data.hops[1].packetLoss, 40);
  assert.strictEqual(data.hops[2].packetLoss, 0);

  // Intermediate loss that vanishes downstream confirms ICMP throttling
  assert.strictEqual(interpretation.isIcmpRateLimitedSuspected, true);
  assert.ok(
    interpretation.observations.some((o) => o.includes('confirms ICMP throttling at Hop #2')),
    'Identified phantom loss as router ICMP CPU rate limit'
  );

  console.log('✅ PASS: MTR hop isolation and phantom loss debunking verified');
})();

// 7. HTTP & TLS Response Normalization
(() => {
  console.log('\n--- 7. HTTP / TLS Probe Normalization ---');

  const rawHttp = {
    statusCode: 200,
    statusText: 'OK',
    resolvedAddress: '103.24.112.5',
    timings: { total: 142, dns: 12, tcp: 24, tls: 52, download: 54 },
    tls: { authorized: true, protocol: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384' },
    headers: { server: 'nginx', 'content-type': 'application/json' },
  };

  const { data, interpretation } = normalizeHttpResult(rawHttp, 'https://portal.b3networks.com');
  assert.strictEqual(data.statusCode, 200);
  assert.strictEqual(data.responseTimeMs, 142);
  assert.strictEqual(data.tlsInfo?.protocol, 'TLSv1.3');
  assert.strictEqual(data.tlsInfo?.authorized, true);

  assert.ok(
    interpretation.voipGuardrailNotes.some((n) => n.includes('It does NOT test SIP UDP listener sockets')),
    'VoIP guardrail reminds that HTTP does not test SIP UDP/RTP'
  );

  console.log('✅ PASS: HTTP & TLS metrics normalized with protocol guardrails');
})();

// 8. End-to-End Master Normalizer
(() => {
  console.log('\n--- 8. Master Response Normalizer ---');

  const rawApiResponse = {
    id: 'test-measurement-123',
    status: 'finished',
    results: [
      {
        probe: {
          continent: 'AS',
          country: 'SG',
          city: 'Singapore',
          asn: 13335,
          network: 'Cloudflare',
        },
        result: {
          status: 'finished',
          stats: { avg: 2.4, loss: 0, min: 1.9, max: 3.1, total: 3, rcv: 3 },
          timings: [{ rtt: 1.9 }, { rtt: 2.4 }, { rtt: 3.1 }],
        },
      },
    ],
  };

  const normalized = normalizeGlobalpingResponse(rawApiResponse, {
    id: 'test-measurement-123',
    target: 'sip.b3networks.com',
    type: 'ping',
    probeLocation: 'Singapore (SG)',
    startedAt: new Date().toISOString(),
  });

  assert.strictEqual(normalized.id, 'test-measurement-123');
  assert.strictEqual(normalized.status, 'completed');
  assert.strictEqual(normalized.probeInfo?.country, 'SG');
  assert.strictEqual(normalized.probeInfo?.city, 'Singapore');
  assert.strictEqual(normalized.results?.type, 'ping');

  console.log('✅ PASS: Master response normalizer assembled complete NetworkDiagnosticResult');
})();

// 9. Measurement History Persistence Tests
(() => {
  console.log('\n--- 9. History Storage Persistence ---');

  GlobalpingService.clearHistory();
  assert.strictEqual(GlobalpingService.getHistory().length, 0, 'History starts empty after clear');

  const sampleResult: NetworkDiagnosticResult = {
    id: 'hist-1',
    target: 'sip.b3networks.com',
    diagnosticType: 'ping',
    probeLocation: 'Singapore (SG)',
    source: 'globalping',
    status: 'completed',
    startedAt: new Date().toISOString(),
  };

  GlobalpingService.saveToHistory(sampleResult);
  assert.strictEqual(GlobalpingService.getHistory().length, 1);
  assert.strictEqual(GlobalpingService.getHistory()[0].id, 'hist-1');

  // Add second item
  const sampleResult2: NetworkDiagnosticResult = {
    id: 'hist-2',
    target: '1.1.1.1',
    diagnosticType: 'traceroute',
    probeLocation: 'Tokyo (JP)',
    source: 'globalping',
    status: 'completed',
    startedAt: new Date().toISOString(),
  };

  GlobalpingService.saveToHistory(sampleResult2);
  const currentHistory = GlobalpingService.getHistory();
  assert.strictEqual(currentHistory.length, 2);
  assert.strictEqual(currentHistory[0].id, 'hist-2', 'Most recent item is prepended');

  // Delete single item
  GlobalpingService.deleteHistoryItem('hist-1');
  const afterDelete = GlobalpingService.getHistory();
  assert.strictEqual(afterDelete.length, 1);
  assert.strictEqual(afterDelete[0].id, 'hist-2');

  // Clear all
  GlobalpingService.clearHistory();
  assert.strictEqual(GlobalpingService.getHistory().length, 0);

  console.log('✅ PASS: History persistence, ordering, and deletion work cleanly');
})();

console.log('\n====================================================');
console.log('📊 GLOBALPING DIAGNOSTICS TESTS: ALL PASSED');
console.log('====================================================\n');
