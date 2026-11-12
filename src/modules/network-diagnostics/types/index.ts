export type DiagnosticType = 'ping' | 'traceroute' | 'dns' | 'mtr' | 'http';

export type DiagnosticStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ProbeSource = 'globalping' | 'customer-agent';

export type HopStatus = 'PASS' | 'WARN' | 'FAIL' | 'TIMEOUT';

export interface GlobalpingProbeInfo {
  continent: string;
  region?: string;
  country: string;
  city: string;
  asn?: number;
  network?: string;
}

export interface DiagnosticInterpretation {
  /** Objective factual observations from probe telemetry */
  observations: string[];
  /** Strict L2/L3 guardrails preventing conflation of ICMP/L3 probe results with SIP/RTP media health */
  voipGuardrailNotes: string[];
  /** True when intermediate traceroute/MTR hop timeout is consistent with ICMP control-plane rate limiting */
  isIcmpRateLimitedSuspected?: boolean;
}

export interface NetworkProbeHop {
  hopNumber: number;
  address: string;
  hostname?: string;
  latency?: number;
  packetLoss?: number;
  status: HopStatus;
}

export interface PingSummaryResult {
  packetsSent: number;
  packetsReceived: number;
  packetLossPct: number;
  minRttMs?: number;
  avgRttMs?: number;
  maxRttMs?: number;
  stdDevMs?: number;
  rawOutput?: string;
}

export interface TracerouteSummaryResult {
  destination: string;
  destinationReached: boolean;
  totalHops: number;
  hops: NetworkProbeHop[];
  rawOutput?: string;
}

export interface DnsSummaryResult {
  queryType: string;
  queryTarget: string;
  statusCode?: string;
  answers: Array<{
    name: string;
    type: string;
    ttl?: number;
    value: string;
  }>;
  roundTripMs?: number;
  rawOutput?: string;
}

export interface MtrSummaryResult {
  destination: string;
  hops: NetworkProbeHop[];
  rawOutput?: string;
}

export interface HttpSummaryResult {
  statusCode: number;
  statusText?: string;
  responseTimeMs: number;
  effectiveUrl?: string;
  tlsInfo?: {
    authorized?: boolean;
    protocol?: string;
    cipher?: string;
  };
  headers?: Record<string, string>;
  rawOutput?: string;
}

export type DiagnosticResultPayload =
  | { type: 'ping'; data: PingSummaryResult }
  | { type: 'traceroute'; data: TracerouteSummaryResult }
  | { type: 'dns'; data: DnsSummaryResult }
  | { type: 'mtr'; data: MtrSummaryResult }
  | { type: 'http'; data: HttpSummaryResult }
  | { type: 'raw'; data: any };

export interface NetworkDiagnosticResult {
  id: string;
  target: string;
  diagnosticType: DiagnosticType;
  probeLocation: string;
  probeInfo?: GlobalpingProbeInfo;
  source: ProbeSource;
  status: DiagnosticStatus;
  startedAt: string;
  completedAt?: string;
  results?: DiagnosticResultPayload;
  interpretation?: DiagnosticInterpretation;
  errorMessage?: string;
  rateLimitRemaining?: number;
  customerTelemetry?: import('./customerAgent').CustomerAgentTelemetry;
}

export * from './customerAgent';
