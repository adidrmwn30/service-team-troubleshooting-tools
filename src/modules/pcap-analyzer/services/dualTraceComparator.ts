import { ParsedPcapResult, ParsedSipPacket, SipCallSession, RtpStream } from './pcapParser';

export interface PacketComparisonItem {
  packetNumberA?: number;
  packetNumberB?: number;
  methodOrResponse: string;
  statusCode?: number;
  cseq: string;
  timestampSecA?: number;
  timestampSecB?: number;
  transitDeltaMs?: number;
  status: 'DELIVERED' | 'DROPPED_AT_BOUNDARY' | 'INGRESS_ONLY' | 'SIGNIFICANT_DELAY';
  notes: string;
}

export interface MatchedSessionComparison {
  callId: string;
  sessionA?: SipCallSession;
  sessionB?: SipCallSession;
  packetComparisons: PacketComparisonItem[];
  missingPacketsInB: string[];
  missingPacketsInA: string[];
  avgTransitLatencyMs: number;
  maxTransitLatencyMs: number;
  verdict:
    | 'BOUNDARY_DROP_CONFIRMED'
    | 'TRANSIT_LATENCY_SPIKE'
    | 'CLEAN_TRANSIT'
    | 'ASYMMETRIC_ROUTE';
  faultDomain:
    | 'CUSTOMER_PREMISE_FIREWALL'
    | 'CARRIER_TRANSIT_ISP'
    | 'INTERNAL_EDGE'
    | 'NOMINAL';
  summary: string;
  actionItem: string;
}

export interface DemarcationComparisonResult {
  traceAName: string;
  traceBName: string;
  traceAPackets: number;
  traceBPackets: number;
  matchedSessions: MatchedSessionComparison[];
  totalBoundaryDrops: number;
  overallVerdict: string;
  overallFaultDomain: string;
  executiveSummary: string;
}

/**
 * Normalizes SIP method or response for loose matching across boundary captures
 */
function normalizeSipKey(pkt: ParsedSipPacket): string {
  if (pkt.statusCode) {
    return `${pkt.statusCode} ${pkt.cseq}`.trim().toLowerCase();
  }
  return `${pkt.methodOrResponse} ${pkt.cseq}`.trim().toLowerCase();
}

/**
 * Correlates and compares two packet captures taken across a network demarcation boundary
 * (e.g. Trace A on Customer LAN / Handset vs Trace B on Provider SBC / WAN).
 */
export function compareDualPcapTraces(
  traceA: ParsedPcapResult,
  traceB: ParsedPcapResult,
  labelA: string = 'Trace A (Customer Demarcation)',
  labelB: string = 'Trace B (Provider SBC Demarcation)'
): DemarcationComparisonResult {
  const matchedSessions: MatchedSessionComparison[] = [];
  let totalBoundaryDrops = 0;

  // Map sessions from Trace B by Call-ID for fast lookup
  const traceBSessionsMap = new Map<string, SipCallSession>();
  for (const sessionB of traceB.sessions) {
    traceBSessionsMap.set(sessionB.callId, sessionB);
  }

  // Iterate over sessions in Trace A and find corresponding session in Trace B
  for (const sessionA of traceA.sessions) {
    let sessionB = traceBSessionsMap.get(sessionA.callId);

    // If Call-ID doesn't match directly (e.g. B2BUA modified Call-ID), match by From & To URIs
    if (!sessionB) {
      sessionB = traceB.sessions.find(
        (sb) =>
          (sb.from === sessionA.from && sb.to === sessionA.to) ||
          (sessionA.from.includes(sb.from) || sb.from.includes(sessionA.from))
      );
    }

    if (sessionB) {
      traceBSessionsMap.delete(sessionB.callId);
    }

    const comparison = compareSingleSession(sessionA, sessionB, labelA, labelB);
    if (comparison.missingPacketsInB.length > 0 || comparison.missingPacketsInA.length > 0) {
      totalBoundaryDrops +=
        comparison.missingPacketsInB.length + comparison.missingPacketsInA.length;
    }
    matchedSessions.push(comparison);
  }

  // Handle any remaining unmatched sessions in Trace B
  traceBSessionsMap.forEach((sessionB) => {
    const comparison = compareSingleSession(undefined, sessionB, labelA, labelB);
    matchedSessions.push(comparison);
  });

  // Calculate overall verdict
  let overallVerdict = 'CLEAN_TRANSIT';
  let overallFaultDomain = 'NOMINAL';
  let executiveSummary = `Demarcation comparison between ${labelA} and ${labelB} indicates healthy, synchronized packet transmission with zero boundary drops.`;

  const dropSession = matchedSessions.find(
    (s) => s.verdict === 'BOUNDARY_DROP_CONFIRMED'
  );
  const latencySession = matchedSessions.find(
    (s) => s.verdict === 'TRANSIT_LATENCY_SPIKE'
  );

  if (dropSession) {
    overallVerdict = 'BOUNDARY_DROP_CONFIRMED';
    overallFaultDomain = dropSession.faultDomain;
    executiveSummary = `Definitive boundary drop confirmed: Packets observed in ${labelA} failed to reach ${labelB}. ${dropSession.summary}`;
  } else if (latencySession) {
    overallVerdict = 'TRANSIT_LATENCY_SPIKE';
    overallFaultDomain = latencySession.faultDomain;
    executiveSummary = `Severe packet propagation delay detected between ${labelA} and ${labelB} (Peak transit delay: ${latencySession.maxTransitLatencyMs}ms).`;
  }

  return {
    traceAName: traceA.filename || labelA,
    traceBName: traceB.filename || labelB,
    traceAPackets: traceA.totalPackets,
    traceBPackets: traceB.totalPackets,
    matchedSessions,
    totalBoundaryDrops,
    overallVerdict,
    overallFaultDomain,
    executiveSummary,
  };
}

function compareSingleSession(
  sessionA?: SipCallSession,
  sessionB?: SipCallSession,
  labelA: string = 'Trace A',
  labelB: string = 'Trace B'
): MatchedSessionComparison {
  const callId = sessionA?.callId || sessionB?.callId || 'Unknown Call-ID';
  const packetComparisons: PacketComparisonItem[] = [];
  const missingPacketsInB: string[] = [];
  const missingPacketsInA: string[] = [];

  const packetsA = sessionA?.packets || [];
  const packetsB = sessionB?.packets || [];

  const matchedBIndices = new Set<number>();
  const latenciesMs: number[] = [];

  for (let i = 0; i < packetsA.length; i++) {
    const pktA = packetsA[i];
    const keyA = normalizeSipKey(pktA);

    // Look for matching packet in B with same key
    let matchIdx = -1;
    for (let j = 0; j < packetsB.length; j++) {
      if (!matchedBIndices.has(j)) {
        const keyB = normalizeSipKey(packetsB[j]);
        if (keyA === keyB) {
          matchIdx = j;
          break;
        }
      }
    }

    if (matchIdx !== -1) {
      matchedBIndices.add(matchIdx);
      const pktB = packetsB[matchIdx];
      const deltaMs = Math.round((pktB.timestampSec - pktA.timestampSec) * 1000);
      if (Math.abs(deltaMs) < 10000) {
        latenciesMs.push(Math.abs(deltaMs));
      }

      const isHighDelay = Math.abs(deltaMs) > 1000;
      packetComparisons.push({
        packetNumberA: pktA.packetNumber,
        packetNumberB: pktB.packetNumber,
        methodOrResponse: pktA.methodOrResponse,
        statusCode: pktA.statusCode,
        cseq: pktA.cseq,
        timestampSecA: pktA.timestampSec,
        timestampSecB: pktB.timestampSec,
        transitDeltaMs: deltaMs,
        status: isHighDelay ? 'SIGNIFICANT_DELAY' : 'DELIVERED',
        notes: isHighDelay
          ? `High transit latency: ${Math.abs(deltaMs)}ms between demarcations`
          : `Delivered across boundary (Δt: ${deltaMs}ms)`,
      });
    } else {
      // Packet present in A but missing in B
      missingPacketsInB.push(pktA.methodOrResponse);
      packetComparisons.push({
        packetNumberA: pktA.packetNumber,
        methodOrResponse: pktA.methodOrResponse,
        statusCode: pktA.statusCode,
        cseq: pktA.cseq,
        timestampSecA: pktA.timestampSec,
        status: 'DROPPED_AT_BOUNDARY',
        notes: `Observed in ${labelA} but NEVER arrived at ${labelB} (Dropped by firewall/NAT)`,
      });
    }
  }

  // Any leftover packets in B not seen in A
  for (let j = 0; j < packetsB.length; j++) {
    if (!matchedBIndices.has(j)) {
      const pktB = packetsB[j];
      missingPacketsInA.push(pktB.methodOrResponse);
      packetComparisons.push({
        packetNumberB: pktB.packetNumber,
        methodOrResponse: pktB.methodOrResponse,
        statusCode: pktB.statusCode,
        cseq: pktB.cseq,
        timestampSecB: pktB.timestampSec,
        status: 'INGRESS_ONLY',
        notes: `Received at ${labelB} but absent in ${labelA}`,
      });
    }
  }

  const avgLatency =
    latenciesMs.length > 0
      ? Math.round(latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length)
      : 0;
  const maxLatency = latenciesMs.length > 0 ? Math.max(...latenciesMs) : 0;

  // Determine Verdict
  let verdict: MatchedSessionComparison['verdict'] = 'CLEAN_TRANSIT';
  let faultDomain: MatchedSessionComparison['faultDomain'] = 'NOMINAL';
  let summary = 'Signaling and media packets crossed boundary demarcations cleanly.';
  let actionItem = 'No boundary defect detected.';

  const ackDropped = missingPacketsInB.some((m) => m.toUpperCase().startsWith('ACK'));
  const byeDropped = missingPacketsInB.some((m) => m.toUpperCase().startsWith('BYE'));

  if (ackDropped) {
    verdict = 'BOUNDARY_DROP_CONFIRMED';
    faultDomain = 'CUSTOMER_PREMISE_FIREWALL';
    summary = `CRITICAL: SIP ACK was transmitted by the endpoint (${labelA}) but was DROPPED before reaching ${labelB}. This caused the 30-second call drop.`;
    actionItem =
      'Inspect customer router / firewall stateful NAT table. Disable SIP ALG on customer gateway router.';
  } else if (missingPacketsInB.length > 0) {
    verdict = 'BOUNDARY_DROP_CONFIRMED';
    faultDomain = 'CUSTOMER_PREMISE_FIREWALL';
    summary = `Packets [${missingPacketsInB.join(
      ', '
    )}] were transmitted in ${labelA} but dropped before reaching ${labelB}.`;
    actionItem = 'Check outbound egress firewall filtering rules on customer premise network.';
  } else if (maxLatency > 1500) {
    verdict = 'TRANSIT_LATENCY_SPIKE';
    faultDomain = 'CARRIER_TRANSIT_ISP';
    summary = `Severe transit propagation delay detected across boundary (Peak latency: ${maxLatency}ms).`;
    actionItem = 'Run traceroute / MTR between customer gateway IP and SBC IP to isolate high-latency ISP hops.';
  }

  return {
    callId,
    sessionA,
    sessionB,
    packetComparisons,
    missingPacketsInB,
    missingPacketsInA,
    avgTransitLatencyMs: avgLatency,
    maxTransitLatencyMs: maxLatency,
    verdict,
    faultDomain,
    summary,
    actionItem,
  };
}
