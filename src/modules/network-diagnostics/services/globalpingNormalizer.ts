import {
  DiagnosticInterpretation,
  DiagnosticResultPayload,
  DiagnosticType,
  DnsSummaryResult,
  GlobalpingProbeInfo,
  HopStatus,
  HttpSummaryResult,
  MtrSummaryResult,
  NetworkDiagnosticResult,
  NetworkProbeHop,
  PingSummaryResult,
  TracerouteSummaryResult,
} from '../types';

/**
 * Parses and extracts normalized probe location details from Globalping raw probe response.
 */
export function normalizeProbeInfo(rawProbe: any): GlobalpingProbeInfo {
  if (!rawProbe || typeof rawProbe !== 'object') {
    return {
      continent: 'Unknown',
      country: 'Unknown',
      city: 'Unknown',
    };
  }

  return {
    continent: rawProbe.continent || 'Unknown',
    region: rawProbe.region || undefined,
    country: rawProbe.country || 'Unknown',
    city: rawProbe.city || 'Unknown',
    asn: typeof rawProbe.asn === 'number' ? rawProbe.asn : undefined,
    network: rawProbe.network || undefined,
  };
}

/**
 * Calculates hop status based on latency and packet loss.
 */
function determineHopStatus(latency?: number, packetLoss?: number, timedOut: boolean = false): HopStatus {
  if (timedOut) return 'TIMEOUT';
  if (packetLoss !== undefined && packetLoss >= 50) return 'FAIL';
  if (latency !== undefined && latency > 250) return 'FAIL';
  if ((packetLoss !== undefined && packetLoss > 0) || (latency !== undefined && latency > 100)) return 'WARN';
  return 'PASS';
}

/**
 * Normalizes Globalping Ping output into PingSummaryResult.
 */
export function normalizePingResult(rawResult: any): {
  data: PingSummaryResult;
  interpretation: DiagnosticInterpretation;
} {
  const stats = rawResult?.stats || {};
  const timings = Array.isArray(rawResult?.timings) ? rawResult.timings : [];

  const packetsSent = typeof stats.total === 'number' ? stats.total : timings.length || 0;
  const packetsReceived =
    typeof stats.rcv === 'number'
      ? stats.rcv
      : typeof stats.total === 'number' && typeof stats.drop === 'number'
      ? stats.total - stats.drop
      : timings.filter((t: any) => typeof t.rtt === 'number').length;

  const packetLossPct =
    typeof stats.loss === 'number'
      ? stats.loss
      : packetsSent > 0
      ? Math.round(((packetsSent - packetsReceived) / packetsSent) * 100)
      : 0;

  const minRttMs = typeof stats.min === 'number' ? stats.min : undefined;
  const avgRttMs = typeof stats.avg === 'number' ? stats.avg : undefined;
  const maxRttMs = typeof stats.max === 'number' ? stats.max : undefined;
  const stdDevMs = typeof stats.stDev === 'number' ? stats.stDev : undefined;

  const observations: string[] = [];
  if (packetLossPct === 0 && avgRttMs !== undefined) {
    observations.push(`ICMP Ping completed successfully: 0% packet loss with ${avgRttMs}ms average RTT.`);
  } else if (packetLossPct > 0) {
    observations.push(`ICMP Ping experienced ${packetLossPct}% packet loss (${packetsReceived}/${packetsSent} packets returned).`);
  } else {
    observations.push('ICMP Ping measurement finished.');
  }

  if (avgRttMs !== undefined) {
    if (avgRttMs < 50) {
      observations.push(`RTT latency (${avgRttMs}ms) is well within optimal limits (<50ms).`);
    } else if (avgRttMs < 150) {
      observations.push(`RTT latency (${avgRttMs}ms) is acceptable for regional routing (<150ms).`);
    } else {
      observations.push(`Elevated RTT latency (${avgRttMs}ms) detected, typical for intercontinental paths.`);
    }
  }

  const voipGuardrailNotes: string[] = [
    'VOIP REALITY CHECK: ICMP Echo confirms Layer 3 IP connectivity only.',
    'It does NOT guarantee that SIP signaling (UDP/TCP 5060/5061) or RTP voice packets (UDP dynamic port range 10000-20000) will pass through intermediate NAT, stateful firewalls, or Carrier-Grade NAT (CGNAT).',
  ];

  return {
    data: {
      packetsSent,
      packetsReceived,
      packetLossPct,
      minRttMs,
      avgRttMs,
      maxRttMs,
      stdDevMs,
      rawOutput: rawResult?.rawOutput || '',
    },
    interpretation: {
      observations,
      voipGuardrailNotes,
    },
  };
}

/**
 * Normalizes Globalping Traceroute output into TracerouteSummaryResult.
 */
export function normalizeTracerouteResult(rawResult: any, target: string): {
  data: TracerouteSummaryResult;
  interpretation: DiagnosticInterpretation;
} {
  const destination = rawResult?.destination || target;
  const rawHops = Array.isArray(rawResult?.hops) ? rawResult.hops : [];

  const hops: NetworkProbeHop[] = rawHops.map((h: any, index: number) => {
    const hopNumber = typeof h.hop === 'number' ? h.hop : index + 1;
    const addresses: string[] = Array.isArray(h.addresses) ? h.addresses : [];
    const address = addresses[0] || h.resolvedAddress || '*';
    const hostname = h.resolvedHostname || undefined;
    const timings: Array<{ rtt: number }> = Array.isArray(h.timings) ? h.timings : [];
    const validTimings = timings.filter((t) => typeof t?.rtt === 'number');

    const latency = validTimings.length > 0
      ? Math.round((validTimings.reduce((sum, t) => sum + t.rtt, 0) / validTimings.length) * 10) / 10
      : undefined;

    const timedOut = address === '*' || validTimings.length === 0;
    const status = determineHopStatus(latency, timedOut ? 100 : 0, timedOut);

    return {
      hopNumber,
      address,
      hostname,
      latency,
      packetLoss: timedOut ? 100 : 0,
      status,
    };
  });

  const lastHop = hops[hops.length - 1];
  const destinationReached = !!lastHop && lastHop.status !== 'TIMEOUT' && (
    lastHop.address === destination ||
    lastHop.hopNumber > 0 && lastHop.status === 'PASS'
  );

  const intermediateTimeouts = hops.slice(0, -1).filter((h) => h.status === 'TIMEOUT');
  const observations: string[] = [];

  observations.push(`Traceroute traversed ${hops.length} hop(s) toward ${destination}.`);
  if (destinationReached) {
    observations.push(`Destination reached on hop ${lastHop?.hopNumber} with ${lastHop?.latency ?? 'N/A'}ms latency.`);
  } else {
    observations.push('Destination was not explicitly confirmed at final hop (possible destination firewall or TTL cap).');
  }

  let isIcmpRateLimitedSuspected = false;
  if (intermediateTimeouts.length > 0 && destinationReached) {
    isIcmpRateLimitedSuspected = true;
    const timeoutHopNums = intermediateTimeouts.map((h) => `#${h.hopNumber}`).join(', ');
    observations.push(
      `Intermediate hop(s) ${timeoutHopNums} timed out (* * *). Because subsequent hops responded normally, this represents standard router ICMP rate limiting (control plane protection), NOT downstream packet loss.`
    );
  }

  const voipGuardrailNotes: string[] = [
    'VOIP REALITY CHECK: Traceroute measures ICMP Time Exceeded responses generated by router CPUs.',
    'High latency or packet drop on intermediate hops is often caused by low-priority ICMP generation on transit routers and does NOT reflect forwarding plane performance for RTP voice media.',
  ];

  return {
    data: {
      destination,
      destinationReached,
      totalHops: hops.length,
      hops,
      rawOutput: rawResult?.rawOutput || '',
    },
    interpretation: {
      observations,
      voipGuardrailNotes,
      isIcmpRateLimitedSuspected,
    },
  };
}

/**
 * Normalizes Globalping DNS output into DnsSummaryResult.
 */
export function normalizeDnsResult(rawResult: any, target: string, queryType: string = 'A'): {
  data: DnsSummaryResult;
  interpretation: DiagnosticInterpretation;
} {
  const answers: Array<{ name: string; type: string; ttl?: number; value: string }> = [];

  if (Array.isArray(rawResult?.answers)) {
    for (const ans of rawResult.answers) {
      answers.push({
        name: ans.name || target,
        type: ans.type || queryType,
        ttl: typeof ans.ttl === 'number' ? ans.ttl : undefined,
        value: ans.value || '',
      });
    }
  }

  const roundTripMs = rawResult?.timings?.total || undefined;
  const statusCode = rawResult?.statusCodeName || rawResult?.statusCode || 'UNKNOWN';

  const observations: string[] = [];
  observations.push(`DNS ${queryType} resolution for '${target}' returned status ${statusCode}.`);
  if (answers.length > 0) {
    observations.push(`Resolved ${answers.length} record(s): ${answers.map((a) => a.value).join(', ')}.`);
  } else {
    observations.push(`No answers returned for query type ${queryType}.`);
  }
  if (roundTripMs !== undefined) {
    observations.push(`Resolver lookup completed in ${roundTripMs}ms.`);
  }

  const voipGuardrailNotes: string[] = [
    'VOIP REALITY CHECK: While A/AAAA records resolve hostnames to IP addresses, enterprise SIP trunks and IP PBXs rely on DNS SRV (_sip._udp, _sips._tcp) and NAPTR records for server redundancy and port selection.',
    'If call setup fails despite A record resolution, verify that DNS SRV records point to active SBC gateways.',
  ];

  return {
    data: {
      queryType,
      queryTarget: target,
      statusCode,
      answers,
      roundTripMs,
      rawOutput: rawResult?.rawOutput || '',
    },
    interpretation: {
      observations,
      voipGuardrailNotes,
    },
  };
}

/**
 * Normalizes Globalping MTR output into MtrSummaryResult.
 */
export function normalizeMtrResult(rawResult: any, target: string): {
  data: MtrSummaryResult;
  interpretation: DiagnosticInterpretation;
} {
  const destination = rawResult?.destination || target;
  const rawHops = Array.isArray(rawResult?.hops) ? rawResult.hops : [];

  const hops: NetworkProbeHop[] = rawHops.map((h: any, index: number) => {
    const hopNumber = typeof h.hop === 'number' ? h.hop : index + 1;
    const address = h.address || '*';
    const hostname = h.resolvedHostname || undefined;
    const stats = h.stats || {};

    const packetLoss = typeof stats.loss === 'number' ? stats.loss : address === '*' ? 100 : 0;
    const latency = typeof stats.avg === 'number' ? stats.avg : undefined;
    const timedOut = address === '*' || packetLoss >= 100;

    const status = determineHopStatus(latency, packetLoss, timedOut);

    return {
      hopNumber,
      address,
      hostname,
      latency,
      packetLoss,
      status,
    };
  });

  const observations: string[] = [];
  observations.push(`MTR multi-cycle probe completed with ${hops.length} hop(s) toward ${destination}.`);

  let isIcmpRateLimitedSuspected = false;
  // Detect intermediate loss that drops to 0 at downstream hop
  for (let i = 0; i < hops.length - 1; i++) {
    const currHop = hops[i];
    const nextHop = hops[i + 1];
    if ((currHop.packetLoss ?? 0) > 20 && (nextHop.packetLoss ?? 0) < 5) {
      isIcmpRateLimitedSuspected = true;
      observations.push(
        `Hop #${currHop.hopNumber} shows ${currHop.packetLoss}% loss but Hop #${nextHop.hopNumber} shows ${nextHop.packetLoss}% loss. This confirms ICMP throttling at Hop #${currHop.hopNumber}, not real path packet loss.`
      );
    }
  }

  const finalHop = hops[hops.length - 1];
  if (finalHop && (finalHop.packetLoss ?? 0) > 0) {
    observations.push(`Final destination hop exhibits ${finalHop.packetLoss}% packet loss.`);
  }

  const voipGuardrailNotes: string[] = [
    'VOIP REALITY CHECK: True network packet loss is persistent across all downstream hops once introduced.',
    'Loss restricted to a single intermediate hop is ICMP rate limiting and does not affect forwarded voice traffic.',
  ];

  return {
    data: {
      destination,
      hops,
      rawOutput: rawResult?.rawOutput || '',
    },
    interpretation: {
      observations,
      voipGuardrailNotes,
      isIcmpRateLimitedSuspected,
    },
  };
}

/**
 * Normalizes Globalping HTTP output into HttpSummaryResult.
 */
export function normalizeHttpResult(rawResult: any, target: string): {
  data: HttpSummaryResult;
  interpretation: DiagnosticInterpretation;
} {
  const statusCode = typeof rawResult?.statusCode === 'number' ? rawResult.statusCode : 0;
  const statusText = rawResult?.statusText || (statusCode === 200 ? 'OK' : undefined);
  const timings = rawResult?.timings || {};
  const responseTimeMs = typeof timings.total === 'number' ? timings.total : 0;
  const tls = rawResult?.tls;

  const observations: string[] = [];
  observations.push(`HTTP probe returned HTTP ${statusCode}${statusText ? ` (${statusText})` : ''} in ${responseTimeMs}ms.`);

  if (tls) {
    observations.push(
      `TLS connection negotiated: ${tls.protocol || 'TLS'} using cipher ${tls.cipher || 'Standard'} (Certificate ${
        tls.authorized ? 'Valid' : 'Invalid/Untrusted'
      }).`
    );
  }

  if (typeof timings.dns === 'number' && typeof timings.tcp === 'number') {
    observations.push(`Breakdown: DNS ${timings.dns}ms | TCP connect ${timings.tcp}ms | TLS handshake ${timings.tls ?? 0}ms.`);
  }

  const voipGuardrailNotes: string[] = [
    'VOIP REALITY CHECK: HTTP 200 OK validates web server availability over TCP/TLS.',
    'It does NOT test SIP UDP listener sockets (port 5060), RTP media relay ports, or voice codec negotiation.',
  ];

  return {
    data: {
      statusCode,
      statusText,
      responseTimeMs,
      effectiveUrl: rawResult?.resolvedAddress || target,
      tlsInfo: tls
        ? {
            authorized: !!tls.authorized,
            protocol: tls.protocol,
            cipher: tls.cipher,
          }
        : undefined,
      headers: rawResult?.headers || undefined,
      rawOutput: rawResult?.rawOutput || '',
    },
    interpretation: {
      observations,
      voipGuardrailNotes,
    },
  };
}

/**
 * High level master normalizer mapping any Globalping measurement payload into NetworkDiagnosticResult.
 */
export function normalizeGlobalpingResponse(
  rawMeasurement: any,
  meta: {
    id: string;
    target: string;
    type: DiagnosticType;
    probeLocation: string;
    startedAt: string;
    dnsQueryType?: string;
  }
): NetworkDiagnosticResult {
  const status =
    rawMeasurement?.status === 'finished'
      ? 'completed'
      : rawMeasurement?.status === 'in-progress'
      ? 'running'
      : rawMeasurement?.status === 'failed'
      ? 'failed'
      : 'completed';

  const firstResult = rawMeasurement?.results?.[0];
  const probeInfo = normalizeProbeInfo(firstResult?.probe);
  const resultData = firstResult?.result;

  if (!resultData || status === 'failed') {
    return {
      id: meta.id,
      target: meta.target,
      diagnosticType: meta.type,
      probeLocation: meta.probeLocation,
      probeInfo,
      source: 'globalping',
      status: status === 'failed' ? 'failed' : 'running',
      startedAt: meta.startedAt,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      errorMessage: firstResult?.result?.rawOutput || rawMeasurement?.error?.message || 'Measurement did not return results.',
      interpretation: {
        observations: ['Measurement failed or did not return probe telemetry.'],
        voipGuardrailNotes: ['No Layer 3 diagnostics could be gathered from this probe vantage point.'],
      },
    };
  }

  let payload: DiagnosticResultPayload;
  let interpretation: DiagnosticInterpretation;

  switch (meta.type) {
    case 'ping': {
      const normalized = normalizePingResult(resultData);
      payload = { type: 'ping', data: normalized.data };
      interpretation = normalized.interpretation;
      break;
    }
    case 'traceroute': {
      const normalized = normalizeTracerouteResult(resultData, meta.target);
      payload = { type: 'traceroute', data: normalized.data };
      interpretation = normalized.interpretation;
      break;
    }
    case 'dns': {
      const normalized = normalizeDnsResult(resultData, meta.target, meta.dnsQueryType || 'A');
      payload = { type: 'dns', data: normalized.data };
      interpretation = normalized.interpretation;
      break;
    }
    case 'mtr': {
      const normalized = normalizeMtrResult(resultData, meta.target);
      payload = { type: 'mtr', data: normalized.data };
      interpretation = normalized.interpretation;
      break;
    }
    case 'http': {
      const normalized = normalizeHttpResult(resultData, meta.target);
      payload = { type: 'http', data: normalized.data };
      interpretation = normalized.interpretation;
      break;
    }
    default: {
      payload = { type: 'raw', data: resultData };
      interpretation = {
        observations: ['Measurement completed.'],
        voipGuardrailNotes: [],
      };
    }
  }

  return {
    id: meta.id,
    target: meta.target,
    diagnosticType: meta.type,
    probeLocation: meta.probeLocation,
    probeInfo,
    source: 'globalping',
    status: 'completed',
    startedAt: meta.startedAt,
    completedAt: new Date().toISOString(),
    results: payload,
    interpretation,
  };
}
