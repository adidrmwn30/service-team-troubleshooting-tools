/**
 * Pure Client-Side PCAP / PCAPNG & SIP/RTP Packet Capture Parser
 * Decodes standard Libpcap (.pcap) and PCAPNG (.pcapng) binary files
 * directly in memory using ArrayBuffer and DataView.
 */

export interface ParsedSdpMedia {
  mediaType: string;
  port: number;
  audioPort?: number;
  proto: string;
  codecs: string[];
  connectionIp: string;
}

export interface ParsedSipPacket {
  packetNumber: number;
  timestampSec: number;
  relativeTimeMs: number;
  srcIp: string;
  srcPort: number;
  dstIp: string;
  dstPort: number;
  methodOrResponse: string;
  statusCode?: number;
  cseq: string;
  callId: string;
  from: string;
  to: string;
  userAgent?: string;
  sdp?: ParsedSdpMedia;
  rawPayload: string;
}

export interface SipCallSession {
  callId: string;
  from: string;
  to: string;
  callerIp: string;
  calleeIp: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  status: 'COMPLETED' | 'REJECTED' | 'FAILED' | 'CANCELLED' | 'IN_PROGRESS';
  finalResponseCode?: number;
  finalResponseReason?: string;
  packets: ParsedSipPacket[];
  hasSdp: boolean;
  negotiatedCodec?: string;
  serverSoftware?: string;
}

export interface RtpStream {
  ssrc: number;
  ssrcHex: string;
  srcIp: string;
  srcPort: number;
  dstIp: string;
  dstPort: number;
  payloadType: number;
  codecName: string;
  packetCount: number;
  durationSec: number;
  lostPackets: number;
  lossPct: number;
  maxJitterMs: number;
  avgJitterMs: number;
  isOneWay: boolean;
}

export interface ParsedPcapResult {
  filename: string;
  fileSizeBytes: number;
  totalPackets: number;
  sipPacketCount: number;
  rtpPacketCount: number;
  durationSec: number;
  sessions: SipCallSession[];
  rtpStreams: RtpStream[];
  detectedIssues: {
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    suggestedAction: string;
  }[];
}

const CODEC_PAYLOAD_MAP: Record<number, string> = {
  0: 'G.711 u-law (PCMU)',
  8: 'G.711 a-law (PCMA)',
  9: 'G.722 HD',
  18: 'G.729',
  101: 'telephone-event (RFC 2833 DTMF)',
  111: 'Opus HD',
};

// ==========================================
// BINARY PCAP / PCAPNG DECODER ENGINE
// ==========================================

export function parsePcapArrayBuffer(buffer: ArrayBuffer, filename: string): ParsedPcapResult {
  const dataView = new DataView(buffer);
  if (buffer.byteLength < 24) {
    throw new Error('File is too small to be a valid PCAP file.');
  }

  const magic = dataView.getUint32(0, false);
  let isLittleEndian = true;
  let isPcapng = false;

  if (magic === 0xa1b2c3d4) {
    // Standard PCAP big-endian
    isLittleEndian = false;
  } else if (magic === 0xd4c3b2a1) {
    // Standard PCAP little-endian
    isLittleEndian = true;
  } else if (magic === 0xa1b23c4d) {
    // Nanosecond PCAP big-endian
    isLittleEndian = false;
  } else if (magic === 0x4dc3b2a1) {
    // Nanosecond PCAP little-endian
    isLittleEndian = true;
  } else if (magic === 0x0a0d0d0a) {
    // PCAPNG Section Header Block
    isPcapng = true;
  } else {
    // Fallback: If text dump or unknown format, try text fallback only for small text files (<10MB)
    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new Error('Unsupported binary capture format. File is not a valid PCAP/PCAPNG file.');
    }
    return parseTextHexDump(new TextDecoder().decode(buffer), filename, buffer.byteLength);
  }

  const rawPackets: {
    packetNumber: number;
    timestampSec: number;
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
    payload: Uint8Array;
  }[] = [];

  let packetIdx = 0;
  let linkType = 1; // Default to LINKTYPE_ETHERNET

  if (!isPcapng) {
    // Classic PCAP parsing
    linkType = dataView.getUint32(20, isLittleEndian);
    let offset = 24; // skip global header
    while (offset + 16 <= buffer.byteLength) {
      packetIdx++;
      const tsSec = dataView.getUint32(offset, isLittleEndian);
      const tsUsec = dataView.getUint32(offset + 4, isLittleEndian);
      const inclLen = dataView.getUint32(offset + 8, isLittleEndian);
      offset += 16;

      if (offset + inclLen > buffer.byteLength) break;

      const packetBytes = new Uint8Array(buffer, offset, inclLen);
      offset += inclLen;

      const parsedIpPacket = parseLinkLayerIpPacket(packetBytes, linkType);
      if (parsedIpPacket) {
        rawPackets.push({
          packetNumber: packetIdx,
          timestampSec: tsSec + tsUsec / 1000000,
          ...parsedIpPacket,
        });
      }
    }
  } else {
    // PCAPNG parsing
    let offset = 0;
    while (offset + 12 <= buffer.byteLength) {
      packetIdx++;
      const blockType = dataView.getUint32(offset, true);
      const blockTotalLen = dataView.getUint32(offset + 4, true);

      if (blockTotalLen < 12 || offset + blockTotalLen > buffer.byteLength) break;

      // Interface Description Block = 0x00000001
      if (blockType === 0x00000001 && blockTotalLen >= 16) {
        linkType = dataView.getUint16(offset + 8, true);
      }

      // Enhanced Packet Block = 0x00000006
      if (blockType === 0x00000006 && blockTotalLen >= 32) {
        const tsHigh = dataView.getUint32(offset + 12, true);
        const tsLow = dataView.getUint32(offset + 16, true);
        const capLen = dataView.getUint32(offset + 20, true);
        const timeMicro = (tsHigh * 4294967296 + tsLow) / 1000000;

        if (offset + 28 + capLen <= buffer.byteLength) {
          const packetBytes = new Uint8Array(buffer, offset + 28, capLen);
          const parsedIpPacket = parseLinkLayerIpPacket(packetBytes, linkType);
          if (parsedIpPacket) {
            rawPackets.push({
              packetNumber: packetIdx,
              timestampSec: timeMicro,
              ...parsedIpPacket,
            });
          }
        }
      }
      offset += blockTotalLen;
    }
  }

  return processExtractedPackets(rawPackets, filename, buffer.byteLength);
}

// Helper to parse Link Layer (Ethernet, Raw IP, Linux SLL, Loopback) -> IPv4 -> UDP/TCP
function parseLinkLayerIpPacket(packet: Uint8Array, linkType: number = 1): {
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  payload: Uint8Array;
} | null {
  if (packet.length < 20) return null;

  let ipOffset = 0;

  // Check known link-layer encapsulations:
  if (linkType === 101 || linkType === 12 || linkType === 14 || linkType === 228) {
    // LINKTYPE_RAW: Raw IPv4 or IPv6 (starts directly with IP header)
    ipOffset = 0;
  } else if (linkType === 113) {
    // LINKTYPE_LINUX_SLL (Linux cooked v1, 16-byte link header)
    if (packet.length < 16 + 20) return null;
    const proto = (packet[14] << 8) | packet[15];
    if (proto !== 0x0800) return null; // IPv4
    ipOffset = 16;
  } else if (linkType === 276) {
    // LINKTYPE_LINUX_SLL2 (Linux cooked v2, 20-byte link header)
    if (packet.length < 20 + 20) return null;
    const proto = (packet[0] << 8) | packet[1];
    if (proto !== 0x0800) return null;
    ipOffset = 20;
  } else if (linkType === 0) {
    // LINKTYPE_NULL (BSD Loopback, 4-byte header)
    if (packet.length < 4 + 20) return null;
    ipOffset = 4;
  } else if (linkType === 1) {
    // LINKTYPE_ETHERNET (Standard 14 bytes)
    if (packet.length < 14 + 20) {
      if ((packet[0] >> 4) === 4) {
        ipOffset = 0; // Direct Raw IP fallback
      } else {
        return null;
      }
    } else {
      const etherType = (packet[12] << 8) | packet[13];
      if (etherType === 0x8100) {
        // 802.1Q VLAN Tag
        ipOffset = 18;
      } else if (etherType === 0x0800) {
        ipOffset = 14;
      } else if ((packet[0] >> 4) === 4) {
        // Fallback: Link header is absent or raw IP
        ipOffset = 0;
      } else {
        return null;
      }
    }
  } else {
    // Unknown link type: Heuristic auto-detection
    if ((packet[0] >> 4) === 4) {
      ipOffset = 0;
    } else if (packet.length >= 34 && ((packet[12] << 8) | packet[13]) === 0x0800) {
      ipOffset = 14;
    } else {
      return null;
    }
  }

  if (packet.length < ipOffset + 20) return null;

  const versionIhl = packet[ipOffset];
  if ((versionIhl >> 4) !== 4) return null; // Only IPv4 for now

  const ipHeaderLen = (versionIhl & 0x0f) * 4;
  if (ipHeaderLen < 20 || packet.length < ipOffset + ipHeaderLen) return null;
  const protocol = packet[ipOffset + 9];

  const srcIp = `${packet[ipOffset + 12]}.${packet[ipOffset + 13]}.${packet[ipOffset + 14]}.${packet[ipOffset + 15]}`;
  const dstIp = `${packet[ipOffset + 16]}.${packet[ipOffset + 17]}.${packet[ipOffset + 18]}.${packet[ipOffset + 19]}`;

  const transportOffset = ipOffset + ipHeaderLen;

  // We inspect UDP (17) and TCP (6)
  if (protocol === 17 && packet.length >= transportOffset + 8) {
    // UDP
    const srcPort = (packet[transportOffset] << 8) | packet[transportOffset + 1];
    const dstPort = (packet[transportOffset + 2] << 8) | packet[transportOffset + 3];
    const payload = packet.subarray(transportOffset + 8);
    return { srcIp, dstIp, srcPort, dstPort, payload };
  } else if (protocol === 6 && packet.length >= transportOffset + 20) {
    // TCP
    const srcPort = (packet[transportOffset] << 8) | packet[transportOffset + 1];
    const dstPort = (packet[transportOffset + 2] << 8) | packet[transportOffset + 3];
    const dataOffset = ((packet[transportOffset + 12] >> 4) & 0x0f) * 4;
    if (packet.length < transportOffset + dataOffset) return null;
    const payload = packet.subarray(transportOffset + dataOffset);
    return { srcIp, dstIp, srcPort, dstPort, payload };
  }

  return null;
}

// Parse text-based capture fallback
function parseTextHexDump(text: string, filename: string, sizeBytes: number): ParsedPcapResult {
  // Try searching for SIP lines in text
  const lines = text.split('\n');
  const sipPackets: ParsedSipPacket[] = [];
  let currentRaw = '';
  let packetNum = 0;

  for (const line of lines) {
    if (
      line.startsWith('INVITE ') ||
      line.startsWith('SIP/2.0 ') ||
      line.startsWith('BYE ') ||
      line.startsWith('ACK ') ||
      line.startsWith('CANCEL ')
    ) {
      if (currentRaw.trim().length > 0) {
        packetNum++;
        const parsed = parseSipText(packetNum, packetNum * 0.1, '10.0.1.10', 5060, '10.0.1.20', 5060, currentRaw);
        if (parsed) sipPackets.push(parsed);
      }
      currentRaw = line + '\n';
    } else if (currentRaw.length > 0) {
      currentRaw += line + '\n';
    }
  }

  if (currentRaw.trim().length > 0) {
    packetNum++;
    const parsed = parseSipText(packetNum, packetNum * 0.1, '10.0.1.10', 5060, '10.0.1.20', 5060, currentRaw);
    if (parsed) sipPackets.push(parsed);
  }

  const sessions = groupSipSessions(sipPackets);
  return {
    filename,
    fileSizeBytes: sizeBytes,
    totalPackets: sipPackets.length,
    sipPacketCount: sipPackets.length,
    rtpPacketCount: 0,
    durationSec: sipPackets.length > 0 ? 5.0 : 0,
    sessions,
    rtpStreams: [],
    detectedIssues: [],
  };
}

// Process all extracted raw packets into SIP sessions & RTP streams
function processExtractedPackets(
  rawPackets: {
    packetNumber: number;
    timestampSec: number;
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
    payload: Uint8Array;
  }[],
  filename: string,
  fileSizeBytes: number
): ParsedPcapResult {
  const sipPackets: ParsedSipPacket[] = [];
  const rtpPacketsMap: Map<
    number,
    {
      ssrc: number;
      srcIp: string;
      srcPort: number;
      dstIp: string;
      dstPort: number;
      payloadType: number;
      seqs: number[];
      timestamps: number[];
      arrivalTimes: number[];
    }
  > = new Map();

  const baseTimeSec = rawPackets.length > 0 ? rawPackets[0].timestampSec : 0;
  const lastTimeSec = rawPackets.length > 0 ? rawPackets[rawPackets.length - 1].timestampSec : 0;
  const durationSec = Math.max(0, lastTimeSec - baseTimeSec);

  const decoder = new TextDecoder('utf-8', { fatal: false });

  for (const pkt of rawPackets) {
    const relativeMs = Math.round((pkt.timestampSec - baseTimeSec) * 1000);

    // 1. Check if SIP
    // SIP methods start with: INVITE, SIP/2.0, ACK, BYE, CANCEL, REGISTER, OPTIONS, PRACK, INFO, UPDATE, NOTIFY, REFER
    const isSipPort =
      (pkt.srcPort >= 5060 && pkt.srcPort <= 5090) ||
      (pkt.dstPort >= 5060 && pkt.dstPort <= 5090) ||
      pkt.srcPort === 5061 ||
      pkt.dstPort === 5061 ||
      pkt.srcPort === 7559 ||
      pkt.dstPort === 7559;
    const isSipSignature =
      pkt.payload.length >= 7 &&
      (pkt.payload[0] === 0x49 || // I (INVITE, INFO)
        pkt.payload[0] === 0x53 || // S (SIP/2.0, SUBSCRIBE)
        pkt.payload[0] === 0x41 || // A (ACK)
        pkt.payload[0] === 0x42 || // B (BYE)
        pkt.payload[0] === 0x43 || // C (CANCEL)
        pkt.payload[0] === 0x52 || // R (REGISTER, REFER)
        pkt.payload[0] === 0x4f || // O (OPTIONS)
        pkt.payload[0] === 0x55 || // U (UPDATE)
        pkt.payload[0] === 0x50 || // P (PRACK)
        pkt.payload[0] === 0x4e);   // N (NOTIFY)

    if (isSipPort || isSipSignature) {
      const text = decoder.decode(pkt.payload);
      const parsedSip = parseSipText(
        pkt.packetNumber,
        pkt.timestampSec,
        pkt.srcIp,
        pkt.srcPort,
        pkt.dstIp,
        pkt.dstPort,
        text,
        relativeMs
      );
      if (parsedSip) {
        sipPackets.push(parsedSip);
        continue;
      }
    }

    // 2. Check if RTP
    // RTP Version = 2 (first 2 bits = 10 -> 0x80) and payload length >= 12
    if (pkt.payload.length >= 12 && (pkt.payload[0] & 0xc0) === 0x80) {
      const pt = pkt.payload[1] & 0x7f;
      // Valid audio payload types: 0 (PCMU), 8 (PCMA), 9 (G722), 18 (G729), 96-127 (Dynamic/Opus/DTMF)
      if (pt <= 34 || (pt >= 96 && pt <= 127)) {
        const seq = (pkt.payload[2] << 8) | pkt.payload[3];
        const rtpTs =
          ((pkt.payload[4] << 24) | (pkt.payload[5] << 16) | (pkt.payload[6] << 8) | pkt.payload[7]) >>> 0;
        const ssrc =
          ((pkt.payload[8] << 24) | (pkt.payload[9] << 16) | (pkt.payload[10] << 8) | pkt.payload[11]) >>> 0;

        if (!rtpPacketsMap.has(ssrc)) {
          rtpPacketsMap.set(ssrc, {
            ssrc,
            srcIp: pkt.srcIp,
            srcPort: pkt.srcPort,
            dstIp: pkt.dstIp,
            dstPort: pkt.dstPort,
            payloadType: pt,
            seqs: [],
            timestamps: [],
            arrivalTimes: [],
          });
        }

        const streamRecord = rtpPacketsMap.get(ssrc)!;
        streamRecord.seqs.push(seq);
        streamRecord.timestamps.push(rtpTs);
        streamRecord.arrivalTimes.push(pkt.timestampSec);
      }
    }
  }

  // Aggregate RTP metrics
  const rtpStreams: RtpStream[] = [];
  rtpPacketsMap.forEach((stream) => {
    const packetCount = stream.seqs.length;
    let lostPackets = 0;

    // Detect packet drops based on sequence gaps
    for (let i = 1; i < stream.seqs.length; i++) {
      const expected = (stream.seqs[i - 1] + 1) % 65536;
      const actual = stream.seqs[i];
      if (actual !== expected) {
        const gap = (actual - expected + 65536) % 65536;
        if (gap < 1000) {
          lostPackets += gap;
        }
      }
    }

    const totalExpected = packetCount + lostPackets;
    const lossPct = totalExpected > 0 ? Math.round((lostPackets / totalExpected) * 1000) / 10 : 0;

    // Compute RFC 3550 Interarrival Jitter
    let jitter = 0;
    let maxJitter = 0;
    let sumJitter = 0;

    for (let i = 1; i < stream.seqs.length; i++) {
      const arrivalDiff = stream.arrivalTimes[i] - stream.arrivalTimes[i - 1];
      const transitDiff = stream.timestamps[i] - stream.timestamps[i - 1];
      // Convert to ms (assuming 8000Hz or 48000Hz clock)
      const clockRate = stream.payloadType === 111 ? 48000 : 8000;
      const d = Math.abs(arrivalDiff * clockRate - transitDiff) / (clockRate / 1000);
      jitter += (d - jitter) / 16;
      sumJitter += jitter;
      if (jitter > maxJitter) maxJitter = jitter;
    }

    const avgJitter = packetCount > 1 ? Math.round((sumJitter / (packetCount - 1)) * 10) / 10 : 0;
    const streamDuration =
      stream.arrivalTimes.length > 1
        ? stream.arrivalTimes[stream.arrivalTimes.length - 1] - stream.arrivalTimes[0]
        : 0;

    rtpStreams.push({
      ssrc: stream.ssrc,
      ssrcHex: `0x${stream.ssrc.toString(16).toUpperCase()}`,
      srcIp: stream.srcIp,
      srcPort: stream.srcPort,
      dstIp: stream.dstIp,
      dstPort: stream.dstPort,
      payloadType: stream.payloadType,
      codecName: CODEC_PAYLOAD_MAP[stream.payloadType] || `Payload Type ${stream.payloadType}`,
      packetCount,
      durationSec: Math.round(streamDuration * 10) / 10,
      lostPackets,
      lossPct,
      maxJitterMs: Math.round(maxJitter * 10) / 10,
      avgJitterMs: avgJitter,
      isOneWay: false,
    });
  });

  // Check for One-Way Audio (if only one stream exists or one direction has 0 packets)
  if (rtpStreams.length === 1 && rtpStreams[0].packetCount > 50) {
    rtpStreams[0].isOneWay = true;
  }

  const sessions = groupSipSessions(sipPackets);
  const detectedIssues = evaluateCaptureIssues(sessions, rtpStreams);

  return {
    filename,
    fileSizeBytes,
    totalPackets: rawPackets.length,
    sipPacketCount: sipPackets.length,
    rtpPacketCount: Array.from(rtpPacketsMap.values()).reduce((acc, s) => acc + s.seqs.length, 0),
    durationSec: Math.round(durationSec * 10) / 10,
    sessions,
    rtpStreams,
    detectedIssues,
  };
}

// Parse text string into structured SIP packet
function parseSipText(
  packetNumber: number,
  timestampSec: number,
  srcIp: string,
  srcPort: number,
  dstIp: string,
  dstPort: number,
  text: string,
  relativeTimeMs: number = 0
): ParsedSipPacket | null {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();
  let methodOrResponse = firstLine;
  let statusCode: number | undefined;

  if (firstLine.startsWith('SIP/2.0 ')) {
    const parts = firstLine.split(' ');
    if (parts.length >= 2) {
      statusCode = parseInt(parts[1], 10);
      methodOrResponse = parts.slice(1).join(' ');
    }
  } else {
    const parts = firstLine.split(' ');
    if (parts.length >= 1) {
      methodOrResponse = parts[0];
    }
  }

  let cseq = '';
  let callId = '';
  let from = '';
  let to = '';
  let userAgent = '';
  let inSdp = false;
  let sdpMedia: ParsedSdpMedia | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      inSdp = true;
      continue;
    }

    if (!inSdp) {
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('call-id:') || lower.startsWith('i:')) {
        callId = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      } else if (lower.startsWith('cseq:')) {
        cseq = trimmed.substring(5).trim();
      } else if (lower.startsWith('from:') || lower.startsWith('f:')) {
        from = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      } else if (lower.startsWith('to:') || lower.startsWith('t:')) {
        to = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      } else if (lower.startsWith('user-agent:')) {
        userAgent = trimmed.substring(11).trim();
      } else if (lower.startsWith('server:')) {
        if (!userAgent) {
          userAgent = trimmed.substring(7).trim();
        }
      }
    } else {
      // Parse SDP
      if (trimmed.startsWith('m=audio ')) {
        const parts = trimmed.substring(8).split(' ');
        const port = parseInt(parts[0], 10) || 0;
        const proto = parts[1] || 'RTP/AVP';
        const codecs = parts.slice(2).map((pt) => CODEC_PAYLOAD_MAP[parseInt(pt, 10)] || `PT-${pt}`);
        sdpMedia = {
          mediaType: 'audio',
          port,
          audioPort: port,
          proto,
          codecs,
          connectionIp: srcIp,
        };
      } else if (trimmed.startsWith('c=IN IP4 ') && sdpMedia) {
        sdpMedia.connectionIp = trimmed.substring(9).trim();
      }
    }
  }

  if (!callId && !cseq && !statusCode) {
    return null;
  }

  return {
    packetNumber,
    timestampSec,
    relativeTimeMs,
    srcIp,
    srcPort,
    dstIp,
    dstPort,
    methodOrResponse,
    statusCode,
    cseq,
    callId: callId || 'unknown-call-id',
    from,
    to,
    userAgent,
    sdp: sdpMedia,
    rawPayload: text,
  };
}

// Group SIP packets by Call-ID into sessions
function groupSipSessions(packets: ParsedSipPacket[]): SipCallSession[] {
  const map: Map<string, ParsedSipPacket[]> = new Map();

  packets.forEach((p) => {
    if (!map.has(p.callId)) map.set(p.callId, []);
    map.get(p.callId)!.push(p);
  });

  const sessions: SipCallSession[] = [];

  map.forEach((callPackets, callId) => {
    const firstPkt = callPackets[0];
    const lastPkt = callPackets[callPackets.length - 1];
    const duration = Math.max(0, lastPkt.timestampSec - firstPkt.timestampSec);

    let status: SipCallSession['status'] = 'IN_PROGRESS';
    let finalCode: number | undefined;
    let finalReason: string | undefined;
    let hasSdp = false;
    let negotiatedCodec = '';

    const hasInvite = callPackets.some((p) => p.methodOrResponse === 'INVITE');
    const has200Ok = callPackets.some((p) => p.statusCode === 200 && p.cseq.includes('INVITE'));
    const hasBye = callPackets.some((p) => p.methodOrResponse === 'BYE');
    const hasCancel = callPackets.some((p) => p.methodOrResponse === 'CANCEL');
    const errorPkt = callPackets.find((p) => p.statusCode && p.statusCode >= 400);

    if (errorPkt) {
      status = 'REJECTED';
      finalCode = errorPkt.statusCode;
      finalReason = errorPkt.methodOrResponse;
    } else if (hasCancel) {
      status = 'CANCELLED';
      finalCode = 487;
      finalReason = 'Request Terminated';
    } else if (has200Ok && hasBye) {
      status = 'COMPLETED';
      finalCode = 200;
      finalReason = 'Normal Clearing (Call Ended)';
    } else if (has200Ok && !hasBye) {
      status = 'IN_PROGRESS';
      finalCode = 200;
      finalReason = 'Call Answered (Ongoing / Cut)';
    }

    // Extract SDP codec
    for (const p of callPackets) {
      if (p.sdp) {
        hasSdp = true;
        if (p.sdp.codecs.length > 0) {
          negotiatedCodec = p.sdp.codecs[0];
        }
      }
    }

    const finalRespPkt = callPackets.find((p) => p.statusCode === finalCode && p.userAgent);
    const serverSoftware = finalRespPkt?.userAgent || callPackets.slice().reverse().find((p) => p.userAgent)?.userAgent;
    const rejectingPkt = callPackets.find((p) => p.statusCode === finalCode);
    const terminatingIp = (rejectingPkt && rejectingPkt.srcIp !== firstPkt.srcIp) ? rejectingPkt.srcIp : firstPkt.dstIp;

    sessions.push({
      callId,
      from: firstPkt.from,
      to: firstPkt.to,
      callerIp: firstPkt.srcIp,
      calleeIp: terminatingIp,
      startTimeSec: firstPkt.timestampSec,
      endTimeSec: lastPkt.timestampSec,
      durationSec: Math.round(duration * 10) / 10,
      status,
      finalResponseCode: finalCode,
      finalResponseReason: finalReason,
      packets: callPackets,
      hasSdp,
      negotiatedCodec: negotiatedCodec || 'G.711 u-law',
      serverSoftware,
    });
  });

  return sessions;
}

// Automated Issue Analysis Engine
function evaluateCaptureIssues(
  sessions: SipCallSession[],
  rtpStreams: RtpStream[]
): ParsedPcapResult['detectedIssues'] {
  const issues: ParsedPcapResult['detectedIssues'] = [];

  // 1. One-Way Audio
  const oneWayStream = rtpStreams.find((s) => s.isOneWay);
  if (oneWayStream) {
    issues.push({
      severity: 'CRITICAL',
      title: 'One-Way Audio Defect Confirmed',
      description: `RTP audio stream is only flowing in one direction from ${oneWayStream.srcIp}:${oneWayStream.srcPort} to ${oneWayStream.dstIp}:${oneWayStream.dstPort}. Return audio stream has 0 packets captured.`,
      suggestedAction:
        'Verify NAT port forwarding on customer premise firewall or check if customer microphone stream is blocked by local OS permissions.',
    });
  }

  // 2. High Packet Loss on RTP
  const lossyStream = rtpStreams.find((s) => s.lossPct >= 3.0);
  if (lossyStream) {
    issues.push({
      severity: 'CRITICAL',
      title: `Excessive RTP Packet Loss (${lossyStream.lossPct}%)`,
      description: `SSRC ${lossyStream.ssrcHex} suffered ${lossyStream.lostPackets} dropped packets out of ${lossyStream.packetCount} transmitted. Audio intelligibility will be severely chopped.`,
      suggestedAction:
        'Run MTR traceroute to isolate congested intermediate hops. Advise customer to switch off congested Wi-Fi to wired Ethernet.',
    });
  }

  // 3. Jitter Buffer Overrun
  const highJitterStream = rtpStreams.find((s) => s.maxJitterMs >= 40);
  if (highJitterStream) {
    issues.push({
      severity: 'WARNING',
      title: `Elevated Jitter Variance (${highJitterStream.maxJitterMs}ms)`,
      description: `RTP interarrival jitter peaked at ${highJitterStream.maxJitterMs}ms (VoIP threshold is <20ms), exceeding standard jitter buffer capacity.`,
      suggestedAction:
        'Check for local bandwidth saturation on customer gateway or enable QoS (DSCP 46 / EF) priority tagging.',
    });
  }

  // 4. SIP Error Codes, Rejections, and Session Anomalies
  for (const session of sessions) {
    const srv = session.serverSoftware || session.packets.find((p) => p.userAgent)?.userAgent || '';
    const srvTag = srv ? ` by ${srv}` : '';

    // Check for missing ACK (30-second drop)
    const has200Ok = session.packets.some((p) => p.statusCode === 200);
    const hasAck = session.packets.some((p) => p.methodOrResponse.toUpperCase().startsWith('ACK'));
    const hasBye = session.packets.some((p) => p.methodOrResponse.toUpperCase().startsWith('BYE'));

    if (has200Ok && !hasAck && (hasBye || (session.durationSec >= 25 && session.durationSec <= 35))) {
      issues.push({
        severity: 'CRITICAL',
        title: '30-Second Disconnection (Missing SIP ACK)',
        description: `Session was terminated because the initiating endpoint never returned a SIP ACK following 200 OK. SIP transaction timer B/H timed out after ~30s.`,
        suggestedAction:
          'Inspect NAT ALG or firewall stateful inspection dropping outbound ACK packets. Verify Contact header contains a reachable public IP.',
      });
    }

    if (session.finalResponseCode === 401 || session.finalResponseCode === 407) {
      issues.push({
        severity: 'CRITICAL',
        title: `SIP ${session.finalResponseCode} ${session.finalResponseCode === 407 ? 'Proxy Authentication Required' : 'Unauthorized'} (Trunk Authentication Failure / Credential Rejection)`,
        description: `Call was rejected with SIP ${session.finalResponseCode} Unauthorized${srvTag}. The terminating PBX/gateway at ${session.calleeIp} challenged the incoming INVITE for Digest authentication and rejected the credentials. Inbound trunk calls from a provider should normally be accepted based on IP authorization without challenging for SIP credentials.`,
        suggestedAction:
          `1. On terminating PBX (${srv || 'Customer PBX'}): Configure the inbound trunk as a 'Peer Trunk' or disable 'Inbound Digest Authentication' so carrier traffic is authorized via IP address whitelist.\n2. If Digest authentication is required: Verify that the SIP trunk username and password configured on the provider SBC match the credentials configured in ${srv || 'PBX'}.`,
      });
    } else if (session.finalResponseCode === 404) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 404 Not Found (Unallocated Number / Route Rejection)',
        description: `Session was rejected with SIP 404 Not Found by destination ${session.calleeIp}${srvTag}. The dialed number or extension (${session.to || 'target'}) does not exist in the receiving PBX dialplan or inbound route table.`,
        suggestedAction:
          'Verify dialed phone number/extension formatting, inspect PBX dialplan context routing, and confirm DID mapping on destination PBX.',
      });
    } else if (session.finalResponseCode === 403) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 403 Forbidden (Caller Barred / Auth Failure)',
        description: `Call was rejected with SIP 403 Forbidden${srvTag}. The remote server or SBC refused to authorize the request (e.g., domain mismatch, IP not in whitelist ACL, or caller lacks outbound dialing privileges).`,
        suggestedAction:
          'Verify SIP trunk credentials, IP whitelist ACL on destination SBC/PBX, and tenant calling privileges.',
      });
    } else if (session.finalResponseCode === 488) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 488 Not Acceptable Here (Codec / Crypto Mismatch)',
        description: `Session ${session.callId.substring(0, 16)}... was rejected because the terminating endpoint${srvTag} could not accept the offered SDP codecs or SRTP crypto suites.`,
        suggestedAction:
          'Ensure customer PBX has G.711u (PCMU) enabled as primary fallback codec.',
      });
    } else if (session.finalResponseCode === 408) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 408 Request Timeout (Endpoint Unreachable)',
        description: `Terminating endpoint ${session.calleeIp}${srvTag} failed to send a provisional or final SIP response within transaction timer T1/B.`,
        suggestedAction:
          'Inspect carrier routing or check if customer PBX IP is unreachable, firewalled, or offline.',
      });
    } else if (session.finalResponseCode === 480) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 480 Temporarily Unavailable (Endpoint Offline / Unregistered)',
        description: `The dialed extension or device at ${session.calleeIp}${srvTag} is currently unregistered or temporarily out of service.`,
        suggestedAction:
          'Confirm device SIP registration status on customer PBX and inspect local LAN connectivity for the handset.',
      });
    } else if (session.finalResponseCode === 486) {
      issues.push({
        severity: 'INFO',
        title: 'SIP 486 Busy Here (Normal Callee Rejection)',
        description: `The dialed destination rejected the call because the extension was actively engaged on another line or DND was enabled.`,
        suggestedAction:
          'Normal behavior. Advise caller that user was busy or check PBX call waiting settings.',
      });
    } else if (session.finalResponseCode === 500) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 500 Server Internal Error (PBX / Switch Crash)',
        description: `The remote server ${session.calleeIp}${srvTag} encountered an unexpected internal condition preventing it from fulfilling the request.`,
        suggestedAction:
          'Review PBX core crash dumps, Asterisk/FreeSWITCH logs, and database connectivity on the destination server.',
      });
    } else if (session.finalResponseCode === 502 || session.finalResponseCode === 504) {
      issues.push({
        severity: 'CRITICAL',
        title: `SIP ${session.finalResponseCode} Gateway Failure / Downstream Timeout`,
        description: `The gateway or proxy at ${session.calleeIp}${srvTag} encountered a downstream timeout or received an invalid response from downstream carrier network.`,
        suggestedAction:
          'Inspect interconnect IP routing and carrier trunk health between upstream proxy and downstream gateway.',
      });
    } else if (session.finalResponseCode === 503) {
      issues.push({
        severity: 'CRITICAL',
        title: 'SIP 503 Service Unavailable (Trunk Exhaustion / Overload)',
        description: `Terminating PBX or carrier at ${session.calleeIp}${srvTag} rejected the call due to temporary trunk capacity exhaustion or server overload.`,
        suggestedAction:
          'Inspect concurrent channel capacity against trunk limits, check server CPU/memory, and verify failover trunk routes.',
      });
    } else if (session.finalResponseCode === 603) {
      issues.push({
        severity: 'INFO',
        title: 'SIP 603 Decline (Call Manually Rejected)',
        description: `The callee manually declined the incoming call on their handset/client.`,
        suggestedAction:
          'Normal user interaction. Verify if the customer intended to reject the incoming call.',
      });
    } else if (session.status === 'REJECTED' || session.status === 'FAILED') {
      issues.push({
        severity: 'CRITICAL',
        title: `SIP Call Failure (${session.finalResponseCode || 'Error'}: ${session.finalResponseReason || 'Rejected'})`,
        description: `Session was terminated abnormally with status ${session.status} by ${session.calleeIp}${srvTag}.`,
        suggestedAction:
          'Inspect SIP ladder sequence and review error response headers in the raw signaling packet.',
      });
    } else if (session.status === 'CANCELLED') {
      issues.push({
        severity: 'INFO',
        title: 'SIP 487 Request Terminated (Originator Cancel / Abandonment)',
        description: `The calling party cancelled the call (sent CANCEL) before the terminating party answered.`,
        suggestedAction:
          'Normal caller behavior. Check if ring duration was excessive leading to caller abandonment.',
      });
    }
  }

  // 5. Signaling-Only Capture Check
  if (rtpStreams.length === 0 && sessions.some((s) => s.status === 'COMPLETED')) {
    issues.push({
      severity: 'INFO',
      title: 'Signaling-Only Capture (No RTP Media in Trace)',
      description:
        'The trace contains completed SIP signaling transactions without RTP media streams. This occurs when packet capture is executed on a SIP signaling proxy/SBC signaling interface where media flows out-of-band directly between endpoints.',
      suggestedAction:
        'To analyze audio quality, jitter, or MOS, capture packets on the media interface, endpoint host, or enable media anchor/RTP proxying.',
    });
  }

  return issues;
}

// ==========================================
// BINARY PCAP BUILDER UTILITIES
// ==========================================

export function createRtpPacketBytes(
  ssrc: number,
  sequenceNumber: number,
  timestamp: number,
  payloadType: number = 0,
  payloadSize: number = 160
): Uint8Array {
  const bytes = new Uint8Array(12 + payloadSize);
  bytes[0] = 0x80; // V=2, P=0, X=0, CC=0
  bytes[1] = payloadType & 0x7f; // M=0, PT
  bytes[2] = (sequenceNumber >> 8) & 0xff;
  bytes[3] = sequenceNumber & 0xff;
  bytes[4] = (timestamp >> 24) & 0xff;
  bytes[5] = (timestamp >> 16) & 0xff;
  bytes[6] = (timestamp >> 8) & 0xff;
  bytes[7] = timestamp & 0xff;
  bytes[8] = (ssrc >> 24) & 0xff;
  bytes[9] = (ssrc >> 16) & 0xff;
  bytes[10] = (ssrc >> 8) & 0xff;
  bytes[11] = ssrc & 0xff;
  for (let i = 12; i < bytes.length; i++) {
    bytes[i] = 0xd5; // PCMU silence
  }
  return bytes;
}

export function buildLibpcapBinary(
  packets: {
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
    payload: Uint8Array | string;
    timestampSec: number;
  }[]
): ArrayBuffer {
  let totalSize = 24;
  const encoder = new TextEncoder();
  const processedPackets = packets.map((p) => {
    const payloadBytes = typeof p.payload === 'string' ? encoder.encode(p.payload) : p.payload;
    const packetLength = 14 + 20 + 8 + payloadBytes.length;
    totalSize += 16 + packetLength;
    return { ...p, payloadBytes, packetLength };
  });

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  // Global Header (24 bytes)
  view.setUint32(0, 0xa1b2c3d4, false); // magic big-endian
  view.setUint16(4, 2, false); // version major 2
  view.setUint16(6, 4, false); // version minor 4
  view.setInt32(8, 0, false); // thiszone
  view.setUint32(12, 0, false); // sigfigs
  view.setUint32(16, 65535, false); // snaplen
  view.setUint32(20, 1, false); // LINKTYPE_ETHERNET = 1

  let offset = 24;

  const parseIp = (ipStr: string): number[] => {
    return ipStr.split('.').map((p) => parseInt(p, 10) || 0);
  };

  for (const pkt of processedPackets) {
    const sec = Math.floor(pkt.timestampSec);
    const usec = Math.floor((pkt.timestampSec - sec) * 1000000);

    // Packet Header (16 bytes)
    view.setUint32(offset, sec, false);
    view.setUint32(offset + 4, usec, false);
    view.setUint32(offset + 8, pkt.packetLength, false);
    view.setUint32(offset + 12, pkt.packetLength, false);
    offset += 16;

    // Ethernet Header (14 bytes)
    u8[offset] = 0x00; u8[offset + 1] = 0x11; u8[offset + 2] = 0x22;
    u8[offset + 3] = 0x33; u8[offset + 4] = 0x44; u8[offset + 5] = 0x55;
    u8[offset + 6] = 0x66; u8[offset + 7] = 0x77; u8[offset + 8] = 0x88;
    u8[offset + 9] = 0x99; u8[offset + 10] = 0xaa; u8[offset + 11] = 0xbb;
    view.setUint16(offset + 12, 0x0800, false); // IPv4
    offset += 14;

    // IPv4 Header (20 bytes)
    u8[offset] = 0x45;
    u8[offset + 1] = 0x00;
    view.setUint16(offset + 2, 20 + 8 + pkt.payloadBytes.length, false);
    view.setUint16(offset + 4, 0x1234, false);
    view.setUint16(offset + 6, 0x4000, false);
    u8[offset + 8] = 64;
    u8[offset + 9] = 17; // UDP
    view.setUint16(offset + 10, 0, false);
    const srcIpParts = parseIp(pkt.srcIp);
    const dstIpParts = parseIp(pkt.dstIp);
    for (let i = 0; i < 4; i++) {
      u8[offset + 12 + i] = srcIpParts[i];
      u8[offset + 16 + i] = dstIpParts[i];
    }
    offset += 20;

    // UDP Header (8 bytes)
    view.setUint16(offset, pkt.srcPort, false);
    view.setUint16(offset + 2, pkt.dstPort, false);
    view.setUint16(offset + 4, 8 + pkt.payloadBytes.length, false);
    view.setUint16(offset + 6, 0, false);
    offset += 8;

    // Payload
    u8.set(pkt.payloadBytes, offset);
    offset += pkt.payloadBytes.length;
  }

  return buffer;
}

