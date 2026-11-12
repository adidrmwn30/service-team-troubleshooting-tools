export interface CodecProfile {
  id: string;
  name: string;
  standard: string;
  bitrateKbps: number;
  sampleRateKhz: number;
  payloadBytesPerPacket: number;
  baseR0: number;
  defaultIe: number;
  bpl: number;
  description: string;
}

export const CODEC_PROFILES: CodecProfile[] = [
  {
    id: 'g711u',
    name: 'G.711 u-law (PCMU)',
    standard: 'ITU-T G.711',
    bitrateKbps: 64,
    sampleRateKhz: 8,
    payloadBytesPerPacket: 160,
    baseR0: 93.2,
    defaultIe: 0,
    bpl: 8.5,
    description: 'Standard PSTN/Telco codec. Uncompressed toll quality, universally supported across B3 SIP trunks.',
  },
  {
    id: 'g711a',
    name: 'G.711 a-law (PCMA)',
    standard: 'ITU-T G.711',
    bitrateKbps: 64,
    sampleRateKhz: 8,
    payloadBytesPerPacket: 160,
    baseR0: 93.2,
    defaultIe: 0,
    bpl: 8.5,
    description: 'European & international PSTN standard. Identical performance to u-law.',
  },
  {
    id: 'opus',
    name: 'Opus HD (Adaptive)',
    standard: 'IETF RFC 6716',
    bitrateKbps: 24,
    sampleRateKhz: 48,
    payloadBytesPerPacket: 60,
    baseR0: 95.0,
    defaultIe: 0,
    bpl: 16.0,
    description: 'Modern WebRTC & softphone codec with dynamic Forward Error Correction (FEC) resistant to packet loss.',
  },
  {
    id: 'g729',
    name: 'G.729A (CS-ACELP)',
    standard: 'ITU-T G.729',
    bitrateKbps: 8,
    sampleRateKhz: 8,
    payloadBytesPerPacket: 20,
    baseR0: 93.2,
    defaultIe: 10,
    bpl: 5.5,
    description: 'High-compression 8kbps codec. Highly sensitive to packet drops and jitter variance.',
  },
  {
    id: 'g722',
    name: 'G.722 Wideband HD',
    standard: 'ITU-T G.722',
    bitrateKbps: 64,
    sampleRateKhz: 16,
    payloadBytesPerPacket: 160,
    baseR0: 94.0,
    defaultIe: 0,
    bpl: 9.0,
    description: 'Wideband HD Voice standard for executive IP phones with enhanced treble and natural voice tone.',
  },
];

export interface QualityEvaluation {
  mos: number;
  rFactor: number;
  ratingLabel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNUSABLE';
  ratingColor: string;
  ratingTextColor: string;
  userExperienceEn: string;
  culpritFactor?: string;
  customerExplanationEn: string;
  singleCallBandwidthKbps: number;
}

export function calculateVoipQuality(
  packetLossPct: number,
  jitterMs: number,
  oneWayLatencyMs: number,
  codecId: string = 'g711u'
): QualityEvaluation {
  const codec = CODEC_PROFILES.find((c) => c.id === codecId) || CODEC_PROFILES[0];

  // 1. Calculate effective one-way delay including jitter buffer stretch
  // Jitter buffer typically expands by 1.5x to 2x jitter + 20ms frame buffering
  const effectiveDelay = Math.max(10, oneWayLatencyMs + jitterMs * 1.5 + 20);

  // 2. Delay impairment factor (Id)
  let id = 0.024 * effectiveDelay;
  if (effectiveDelay > 177.3) {
    id += 0.11 * (effectiveDelay - 177.3);
  }

  // 3. Equipment impairment under packet loss and jitter buffer discards (Ie-eff)
  // Jitter exceeding standard 30ms buffer induces packet discards (underruns)
  const jitterDiscardPct = jitterMs > 30 ? (jitterMs - 30) * 0.08 : 0;
  const effectiveTotalLoss = Math.min(100, packetLossPct + jitterDiscardPct);

  // Formula: Ie-eff = Ie + (95 - Ie) * (P_pl / (P_pl + B_pl))
  const ieEff = codec.defaultIe + (95 - codec.defaultIe) * (effectiveTotalLoss / (effectiveTotalLoss + codec.bpl));

  // 4. Calculate R-Factor
  const rRaw = codec.baseR0 - id - ieEff;
  const rFactor = Math.max(0, Math.min(100, rRaw));

  // 5. Convert R-factor to MOS (ITU-T G.107)
  let mosRaw = 1.0;
  if (rFactor > 0 && rFactor < 100) {
    mosRaw = 1 + 0.035 * rFactor + 7e-6 * rFactor * (rFactor - 60) * (100 - rFactor);
  } else if (rFactor >= 100) {
    mosRaw = 4.5;
  }
  const mos = Math.round(Math.max(1.0, Math.min(4.5, mosRaw)) * 100) / 100;

  // 6. Classification & Humanized Descriptions
  let ratingLabel: QualityEvaluation['ratingLabel'] = 'GOOD';
  let ratingColor = 'bg-emerald-500';
  let ratingTextColor = 'text-emerald-400';
  let userExperienceEn = '';

  if (mos >= 4.15) {
    ratingLabel = 'EXCELLENT';
    ratingColor = 'bg-emerald-500';
    ratingTextColor = 'text-emerald-400';
    userExperienceEn = 'Crystal-clear, pristine audio quality. Seamless interactive conversation with zero artifacts.';
  } else if (mos >= 3.8) {
    ratingLabel = 'GOOD';
    ratingColor = 'bg-teal-500';
    ratingTextColor = 'text-teal-400';
    userExperienceEn = 'Standard toll-quality voice. Clear conversation with negligible transmission noise.';
  } else if (mos >= 3.3) {
    ratingLabel = 'FAIR';
    ratingColor = 'bg-amber-500';
    ratingTextColor = 'text-amber-400';
    userExperienceEn = 'Noticeable voice distortion or slight latency delay. Conversation is intelligible but requires occasional repetition.';
  } else if (mos >= 2.6) {
    ratingLabel = 'POOR';
    ratingColor = 'bg-orange-500';
    ratingTextColor = 'text-orange-400';
    userExperienceEn = 'Frequent audio chopping and dropped syllables. Communication is frustrating and severely degraded.';
  } else {
    ratingLabel = 'UNUSABLE';
    ratingColor = 'bg-red-500';
    ratingTextColor = 'text-red-400';
    userExperienceEn = 'Unusable voice channel. Extreme packet starvation resulting in broken speech or complete muting.';
  }

  // 7. Determine primary culprit factor
  let culpritFactor = 'Pristine Network';
  if (packetLossPct >= 3.0) {
    culpritFactor = `Packet Loss (${packetLossPct.toFixed(1)}%)`;
  } else if (jitterMs >= 40) {
    culpritFactor = `High Jitter (${Math.round(jitterMs)}ms)`;
  } else if (oneWayLatencyMs >= 180) {
    culpritFactor = `High Latency (${Math.round(oneWayLatencyMs)}ms)`;
  } else if (packetLossPct > 0.8) {
    culpritFactor = `Elevated Packet Loss (${packetLossPct.toFixed(1)}%)`;
  } else if (jitterMs > 25) {
    culpritFactor = `Jitter Fluctuations (${Math.round(jitterMs)}ms)`;
  }

  // 8. Generate Customer Canned Explanations (Pure English)
  const lossStr = packetLossPct.toFixed(1);
  const jitterStr = Math.round(jitterMs);
  const latencyStr = Math.round(oneWayLatencyMs);

  let customerExplanationEn = '';

  if (packetLossPct >= 2.0) {
    customerExplanationEn = `Hello, our network diagnosis identified ${lossStr}% packet loss on your local Internet connection. In real-time VoIP protocols (UDP), packet loss exceeding 1.0% causes missing syllables and robotic audio artifacts because dropped voice packets cannot be retransmitted in time. We recommend switching to a wired Ethernet connection or rebooting your local router/gateway to restore stability.`;
  } else if (jitterMs >= 40) {
    customerExplanationEn = `Hello, our diagnostic telemetry shows an elevated Jitter of ${jitterStr}ms (normal VoIP threshold is below 20ms). High jitter causes jitter buffer overflow on the softphone/IP-phone, leading to audio stuttering and sudden gaps. This typically occurs over congested Wi-Fi channels or local network contention. We recommend connecting directly via a wired Ethernet cable.`;
  } else if (oneWayLatencyMs >= 200) {
    customerExplanationEn = `Hello, diagnostic results indicate elevated round-trip latency of approximately ${latencyStr}ms. This latency introduces interactive lag where parties frequently talk over each other. We advise checking the local ISP route and ensuring no third-party VPN tunnel is intercepting the voice traffic.`;
  } else if (mos >= 3.8) {
    customerExplanationEn = `Hello, based on network telemetry analysis (Packet Loss: ${lossStr}%, Jitter: ${jitterStr}ms, Latency: ${latencyStr}ms), your voice channel is operating in OPTIMAL health with a MOS score of ${mos.toFixed(2)}/5.00. Voice transmission meets all telecommunication clarity standards.`;
  } else {
    customerExplanationEn = `Hello, our diagnostic evaluation shows a MOS score of ${mos.toFixed(2)}/5.00 (Rating: ${ratingLabel}). A combination of ${lossStr}% packet loss and ${jitterStr}ms jitter is causing slight audio degradation. We recommend prioritizing voice traffic via router Quality of Service (QoS) settings.`;
  }

  // 9. Single Call Bandwidth (symmetric duplex in kbps with 40-byte IP/UDP/RTP header)
  // Packets per second = 50 (20ms ptime). Header = 40 bytes. Total per packet = (payload + 40) bytes
  // Single direction kbps = (payloadBytes + 40) * 8 * 50 / 1000. Duplex = x 2.
  const pps = 50;
  const singleDirKbps = ((codec.payloadBytesPerPacket + 40) * 8 * pps) / 1000;
  const singleCallBandwidthKbps = Math.round(singleDirKbps * 2);

  return {
    mos,
    rFactor: Math.round(rFactor * 10) / 10,
    ratingLabel,
    ratingColor,
    ratingTextColor,
    userExperienceEn,
    culpritFactor,
    customerExplanationEn,
    singleCallBandwidthKbps,
  };
}

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
  packetLoss: number;
  jitter: number;
  latency: number;
  codec: string;
  badge: string;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'pristine-fiber',
    name: 'Pristine Office Fiber (LAN)',
    description: 'Dedicated enterprise fiber connection over wired LAN.',
    packetLoss: 0.0,
    jitter: 3,
    latency: 15,
    codec: 'g711u',
    badge: 'Optimal',
  },
  {
    id: 'crowded-wifi',
    name: 'Crowded Office Wi-Fi',
    description: 'High user density on single AP with 2.4GHz RF contention.',
    packetLoss: 3.8,
    jitter: 52,
    latency: 65,
    codec: 'g711u',
    badge: 'Wi-Fi Issue',
  },
  {
    id: 'cellular-lte',
    name: 'Mobile 4G/LTE Hotspot',
    description: 'Cellular tethering hotspot with radio fading fluctuations.',
    packetLoss: 1.4,
    jitter: 32,
    latency: 85,
    codec: 'opus',
    badge: 'Mobile Data',
  },
  {
    id: 'bad-isp-congestion',
    name: 'Home ISP Bandwidth Throttled',
    description: 'Residential broadband congested by simultaneous upload/download.',
    packetLoss: 7.5,
    jitter: 85,
    latency: 160,
    codec: 'g711u',
    badge: 'Choppy Audio',
  },
  {
    id: 'international-branch',
    name: 'International Call (SG ➔ US)',
    description: 'Subsea trans-oceanic routing with high propagation delay but zero loss.',
    packetLoss: 0.2,
    jitter: 12,
    latency: 215,
    codec: 'g711a',
    badge: 'High Latency',
  },
];