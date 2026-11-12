export type HopType = 'CALLER' | 'EDGE_SBC' | 'CPAAS_CORE' | 'SIP_GATEWAY' | 'CALLEE_ENDPOINT';

export type HopVerdictLevel = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export type HangupParty = 'CALLER' | 'CALLEE' | 'SYSTEM' | 'NETWORK_ERROR';

export type ForkBranchOutcome =
  | 'ANSWERED'             // This branch picked up the call
  | 'PRIMARY_REFUSAL'      // This branch actively declined/busied out
  | 'CANCELLED_BY_FORK'    // Terminated automatically because sibling branch answered/refused
  | 'NO_ANSWER_TIMEOUT'    // Rang out until timeout
  | 'CONGESTION'           // Leg failed/unregistered (e.g. SIP 404 Congestion)
  | 'NOT_FORKED';

export type CallQualityOverallStatus =
  | 'OPTIMAL'
  | 'DEGRADED'
  | 'REFUSED'
  | 'FAILED'
  | 'CANCELLED';

export interface CallTerminationDetail {
  terminatedBy: HangupParty;
  initiatorName: string;            // e.g. "Callee Desktop Client (sip35526286)" or "Inbound Caller (+6567501331)"
  sipMethod: string;                // e.g. "BYE", "CANCEL", "486 Busy Here", "408 Timeout"
  q850CauseCode?: number;           // e.g. 16 (Normal), 17 (User Busy), 19 (No Answer)
  q850ReasonText?: string;          // e.g. "Normal call clearing", "User busy"
  explanation: string;              // Plain English explanation of the hangup sequence
}

export interface RtpQualityMetrics {
  mos?: number;                     // 1.0 - 5.0
  jitterMs?: number;                // Overall or Rx jitter
  rxJitterMs?: number;              // Downlink Jitter
  txJitterMs?: number;              // Uplink Jitter
  packetLossPct?: number;           // Overall loss %
  rxPacketLossPct?: number;         // Downstream Loss % (Audio received)
  txPacketLossPct?: number;         // Upstream Loss % (Audio transmitted)
  rttMs?: number;                   // Round Trip Time in ms
  codec?: string;                   // e.g. 'G.711u', 'G.711a', 'Opus'
  audioDirection?: 'rx' | 'tx' | 'bidirectional';
  isOneWayAudio?: boolean;          // True if audio traffic is missing in one direction
  oneWayAudioDirection?: 'CALLER_CANNOT_HEAR' | 'CALLEE_CANNOT_HEAR';
}

export interface HopDiagnostic {
  hopIndex: number;
  hopType: HopType;
  nodeName: string;
  label: string;
  subLabel?: string;
  status: HopVerdictLevel;
  isCulprit: boolean;
  legUuid?: string;
  sipCode?: number;
  sipReason?: string;
  hangupReason?: string;          // e.g. 'ORIGINATOR_CANCEL', 'Normal clearing', 'Signaling Terminated'
  hangupDisposition?: string;     // e.g. 'recv_cancel', 'EDGE_RECV_CANCEL', 'answered'
  vendor?: string;                // e.g. 'awsfvstedge1', 'SGUNICENTREX', 'SIP5B3'
  terminatedPeer?: string;        // e.g. 'SINGTEL_SFV_INBOUND', 'SGUNICENTREX', 'B3SG_OUT'
  originPeer?: string;            // e.g. 'SINGTEL_SFV_INBOUND'
  legDirection?: 'INBOUND' | 'OUTGOING' | 'OUTBOUND' | 'INTERNAL';
  metrics?: RtpQualityMetrics;
  diagnosisNotes: string[];

  // Multi-leg / Parallel Forking metadata
  isForkedBranch?: boolean;
  forkGroupId?: string;
  forkBranchOutcome?: ForkBranchOutcome;
  forkOutcomeNote?: string;
  isSignalingOnly?: boolean;
  mediaRelayNote?: string;
}

export interface L2InvestigationDetails {
  ticketCategory: string;
  faultDomain: 'CARRIER_PEER' | 'B3_CORE_SBC' | 'CUSTOMER_PREMISE_ENDPOINT' | 'EXTERNAL_CALLER' | 'EXTERNAL_CALLEE' | 'NOMINAL';
  callDirection?: 'INBOUND' | 'OUTBOUND';
  carrierPeer?: string;
  edgeGateway?: string;
  vendorSummary?: string;
  dialedDid?: string;
  callerIdentity?: string;
  calleeIdentity?: string;
  rootCauseTechnicalSummary: string;
  suggestedCustomerResolution: string;
  chronologicalEvents?: Array<{
    timestamp: number;
    relativeOffset: string;
    eventName: string;
    description: string;
    legUuid?: string;
  }>;
  legSummaries?: Array<{
    legUuid: string;
    role: string;
    vendor?: string;
    peer?: string;
    sipCode?: number;
    sipReason?: string;
    hangupReason?: string;
    outcome?: string;
  }>;
}

export interface CallQualityReport {
  txnUuid: string;
  callDirection?: 'INBOUND' | 'OUTBOUND';
  callDurationSeconds: number;
  qualityAvailable: boolean;         // False if < 15s or early refusal
  overallStatus: CallQualityOverallStatus;
  termination: CallTerminationDetail; // Who hung up the call
  culpritHop?: {
    hopIndex: number;
    nodeName: string;
    label: string;
    reason: string;
    recommendedAction: string;
  };
  executiveSummary: string;
  recommendedAction: string;
  hops: HopDiagnostic[];
  rawPayload?: any;
  l2Details?: L2InvestigationDetails;
  symptomCorrelation?: SymptomCorrelationReport;
}

export type ReportedSymptomPreset =
  | 'NONE'
  | 'CALL_SETUP_FAILURE'    // Inbound/Outbound call failed to connect / fast busy / 503 / 404
  | 'DROP_AT_30S'           // Call dropped at ~30 seconds (SIP ACK / NAT timeout)
  | 'DROP_AT_15M'           // Call dropped at ~15 minutes (SIP session-expires refresh failure)
  | 'MID_CALL_DROP'         // Unexpected mid-call drop / abrupt cut-off
  | 'ONE_WAY_AUDIO'         // One-way audio / silent stream / dead air
  | 'CHOPPY_OR_ROBOTIC'     // Choppy, robotic, or distorted voice
  | 'CUSTOM';               // User typed a custom symptom

export interface CustomerReportedAnomaly {
  preset: ReportedSymptomPreset;
  customDescription?: string;
}

export type SymptomCorrelationVerdict =
  | 'MATCHED_DEFECT'             // Telemetry proves the customer's reported symptom
  | 'DISCREPANCY_NORMAL_HANGUP'  // Customer reported drop, but telemetry shows normal user hangup
  | 'DISCREPANCY_DURATION'       // Customer reported quick drop, but call was long/successful
  | 'CLEAN_NO_DEFECT'            // Customer claimed poor quality, but metrics are pristine (MOS 4.5, 0% loss)
  | 'UNVERIFIED_CUSTOM';         // Custom note reviewed against telemetry

export interface SymptomCorrelationReport {
  reportedText: string;
  verdict: SymptomCorrelationVerdict;
  verdictBadgeLabel: string;
  verdictColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
  explanation: string;
  customerFacingExplanation: string;
}
