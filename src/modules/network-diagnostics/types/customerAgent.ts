import { DiagnosticType } from './index';

export type NatType =
  | 'FULL_CONE'
  | 'RESTRICTED_CONE'
  | 'PORT_RESTRICTED'
  | 'SYMMETRIC'
  | 'UNKNOWN'
  | 'NO_NAT';

export type SipAlgStatus = 'DETECTED' | 'NOT_DETECTED' | 'SUSPECTED' | 'UNKNOWN';

export type NetworkAdapterType = 'WIFI' | 'ETHERNET' | 'CELLULAR' | 'VPN' | 'UNKNOWN';

export interface LocalNetworkInfo {
  adapterType: NetworkAdapterType;
  localIp: string;
  gatewayIp?: string;
  subnetMask?: string;
  dnsServers: string[];
  mtu?: number;
  wifiSignalStrengthPct?: number;
  wifiSsid?: string;
}

export interface StunNatResult {
  natType: NatType;
  publicIp?: string;
  publicPort?: number;
  mappingPreserved: boolean;
  sipAlgStatus: SipAlgStatus;
  stunServerUsed: string;
  roundTripMs: number;
  voipImpactSummary: string;
}

export type VoipTargetRole = 'SIP_EDGE_SBC' | 'RTP_MEDIA_RELAY' | 'PORTAL_API' | 'STUN_SERVER';

export interface VoipTargetProbe {
  target: string;
  role: VoipTargetRole;
  port: number;
  protocol: 'UDP' | 'TCP' | 'TLS' | 'ICMP';
  reachability: 'REACHABLE' | 'DEGRADED' | 'UNREACHABLE';
  latencyMs?: number;
  packetLossPct?: number;
  jitterMs?: number;
  dnsResolvedIp?: string;
  dnsResolutionMs?: number;
  dnsSrvPriority?: number;
  details?: string;
}

export interface CustomerAgentTelemetry {
  agentVersion: string;
  sessionId: string;
  ticketId?: string;
  customerOrgName?: string;
  timestamp: string;
  osPlatform: 'darwin' | 'win32' | 'linux' | 'browser' | 'other';
  osVersion?: string;
  localNetwork: LocalNetworkInfo;
  stunNat: StunNatResult;
  targetProbes: VoipTargetProbe[];
  overallVoipReadiness: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL_DEFECT';
  primaryVoipDefects: string[];
  recommendedCustomerActions: string[];
  signature?: string;
}

export interface CustomerAgentPairingSession {
  pairingCode: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  targetOrg?: string;
  status: 'PENDING' | 'RECEIVED' | 'EXPIRED';
  telemetry?: CustomerAgentTelemetry;
}
