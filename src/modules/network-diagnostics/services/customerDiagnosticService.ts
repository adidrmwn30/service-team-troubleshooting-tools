import {
  CustomerAgentPairingSession,
  CustomerAgentTelemetry,
  DiagnosticInterpretation,
  DiagnosticType,
  NetworkDiagnosticResult,
  NetworkProbeHop,
} from '../types';

export interface CustomerAgentTargetRule {
  hostOrSubnet: string;
  allowedPorts: number[];
  allowedTypes: DiagnosticType[];
  description: string;
}

export const DEFAULT_CUSTOMER_AGENT_ALLOWLIST: CustomerAgentTargetRule[] = [
  {
    hostOrSubnet: 'sip.b3networks.com',
    allowedPorts: [5060, 5061],
    allowedTypes: ['ping', 'traceroute', 'dns'],
    description: 'B3 Primary SIP Edge SBC',
  },
  {
    hostOrSubnet: 'rtp.b3networks.com',
    allowedPorts: [10000, 20000],
    allowedTypes: ['ping', 'traceroute', 'mtr'],
    description: 'B3 Media RTP Relay Pool',
  },
  {
    hostOrSubnet: 'portal.b3networks.com',
    allowedPorts: [443],
    allowedTypes: ['http', 'dns', 'ping'],
    description: 'B3 Portal & Signaling API',
  },
  {
    hostOrSubnet: 'stun.b3networks.com',
    allowedPorts: [3478, 5349],
    allowedTypes: ['ping', 'dns'],
    description: 'B3 STUN / TURN NAT Discovery Server',
  },
  {
    hostOrSubnet: 'stun.l.google.com',
    allowedPorts: [19302],
    allowedTypes: ['ping', 'dns'],
    description: 'Public Fallback STUN Discovery Server',
  },
];

// In-memory pairing sessions
const pairingSessions = new Map<string, CustomerAgentPairingSession>();

export class CustomerDiagnosticService {
  /**
   * Validates if a target and port combination conforms to the security allowlist.
   * Arbitrary hosts or ports outside the allowlist are strictly rejected.
   */
  public static isTargetAllowed(target: string, port?: number): boolean {
    const raw = (target || '').trim().toLowerCase();
    if (!raw) return false;

    // Strip scheme, path, query, and explicit port if present
    const host = raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();
    if (!host) return false;

    return DEFAULT_CUSTOMER_AGENT_ALLOWLIST.some((rule) => {
      const matchHost = host === rule.hostOrSubnet || host.endsWith(`.${rule.hostOrSubnet}`);
      if (!matchHost) return false;
      if (port !== undefined && !rule.allowedPorts.includes(port)) return false;
      return true;
    });
  }

  /**
   * Generates a 6-character alphanumeric pairing code for customer-side execution.
   */
  public static createPairingSession(targetOrg?: string): CustomerAgentPairingSession {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour validity

    const session: CustomerAgentPairingSession = {
      pairingCode: code,
      sessionId: `SES-${Date.now()}-${code}`,
      createdAt: now.toISOString(),
      expiresAt,
      targetOrg: targetOrg || 'Enterprise Customer',
      status: 'PENDING',
    };

    pairingSessions.set(code, session);
    return session;
  }

  /**
   * Retrieves an active pairing session by code.
   */
  public static getPairingSession(pairingCode: string): CustomerAgentPairingSession | null {
    const cleanCode = (pairingCode || '').trim().toUpperCase();
    const session = pairingSessions.get(cleanCode);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = 'EXPIRED';
    }
    return session;
  }

  /**
   * Ingests telemetry received for a specific pairing session.
   */
  public static submitTelemetryForSession(
    pairingCode: string,
    telemetry: CustomerAgentTelemetry
  ): boolean {
    const session = this.getPairingSession(pairingCode);
    if (!session || session.status === 'EXPIRED') return false;

    session.telemetry = telemetry;
    session.status = 'RECEIVED';
    return true;
  }

  /**
   * Generates a shell / curl one-liner command for customer IT to run.
   */
  public static generateRunnerCommand(pairingCode: string): string {
    return `# Standalone diagnostic runner: b3-diag.sh (Session: ${pairingCode})\n# Telemetry is posted directly to your local L2 workbench session`;
  }

  /**
   * Parses and validates raw JSON customer telemetry.
   */
  public static importTelemetryJson(rawJson: string): CustomerAgentTelemetry {
    if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
      throw new Error('Telemetry JSON string cannot be empty.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err: any) {
      throw new Error(`Invalid JSON syntax: ${err.message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Telemetry payload must be an object.');
    }

    if (!parsed.sessionId || !parsed.localNetwork || !parsed.stunNat) {
      throw new Error(
        'Incompatible telemetry format: missing required fields (sessionId, localNetwork, or stunNat).'
      );
    }

    return parsed as CustomerAgentTelemetry;
  }

  /**
   * Normalizes CustomerAgentTelemetry into standard NetworkDiagnosticResult.
   */
  public static normalizeCustomerTelemetry(
    telemetry: CustomerAgentTelemetry
  ): NetworkDiagnosticResult {
    const { localNetwork, stunNat, targetProbes } = telemetry;
    const observations: string[] = [];
    const voipGuardrailNotes: string[] = [];

    // Local Interface observations
    observations.push(
      `Endpoint Interface: ${localNetwork.adapterType} (${localNetwork.localIp || 'LAN'}).`
    );
    if (localNetwork.adapterType === 'WIFI') {
      const signal = localNetwork.wifiSignalStrengthPct ?? 'N/A';
      observations.push(
        `Wi-Fi Network: SSID "${localNetwork.wifiSsid || 'Unknown'}" with signal strength ${signal}%.`
      );
      if (typeof signal === 'number' && signal < 50) {
        observations.push(
          'WARNING: Weak Wi-Fi signal (<50%) correlates with RF packet loss and packet bursts.'
        );
      }
    }

    // NAT & STUN observations
    observations.push(
      `NAT Classification: ${stunNat.natType} (Discovered via ${stunNat.stunServerUsed || 'STUN'} in ${stunNat.roundTripMs}ms).`
    );

    if (stunNat.natType === 'SYMMETRIC') {
      observations.push(
        'CRITICAL VOIP DEFECT: Symmetric NAT detected. External firewall dynamically changes the translated UDP port for each different target socket.'
      );
      voipGuardrailNotes.push(
        'SYMMETRIC NAT IMPACT: Directly causes one-way audio or no-audio when B3 SBC sends audio to the initial mapped port. Endpoints require STUN/TURN traversal or port reservation.'
      );
    }

    if (stunNat.sipAlgStatus === 'DETECTED') {
      observations.push(
        'CRITICAL FIREWALL ANOMALY: SIP ALG (Application Layer Gateway) is actively modifying SIP signaling headers.'
      );
      voipGuardrailNotes.push(
        'SIP ALG IMPACT: Routers rewriting Call-ID, Via, or SDP contact addresses often drop ACK packets after 30 seconds, causing abrupt call terminations. Must be disabled in router settings.'
      );
    }

    // Target probes
    const sbcProbe = targetProbes.find((p) => p.role === 'SIP_EDGE_SBC');
    if (sbcProbe) {
      observations.push(
        `SIP Edge SBC (${sbcProbe.target}): ${sbcProbe.reachability} (${sbcProbe.latencyMs ?? 'N/A'}ms RTT, ${sbcProbe.packetLossPct ?? 0}% loss).`
      );
    }

    const rtpProbe = targetProbes.find((p) => p.role === 'RTP_MEDIA_RELAY');
    if (rtpProbe) {
      observations.push(
        `RTP Media Relay (${rtpProbe.target}): ${rtpProbe.reachability} (${rtpProbe.latencyMs ?? 'N/A'}ms RTT, ${rtpProbe.packetLossPct ?? 0}% loss, ${rtpProbe.jitterMs ?? 0}ms jitter).`
      );
      if ((rtpProbe.jitterMs ?? 0) > 30) {
        voipGuardrailNotes.push(
          `HIGH LOCAL JITTER: UDP jitter (${rtpProbe.jitterMs}ms) exceeds the ITU-T G.114 standard limit (30ms), leading to buffer underruns and robotic speech.`
        );
      }
    }

    // Construct hops for topology representation
    const hops: NetworkProbeHop[] = [
      {
        hopNumber: 1,
        address: localNetwork.localIp || '192.168.1.100',
        hostname: `${localNetwork.adapterType}_ENDPOINT`,
        latency: 0,
        packetLoss: 0,
        status: 'PASS',
      },
      {
        hopNumber: 2,
        address: localNetwork.gatewayIp || '192.168.1.1',
        hostname: 'DEFAULT_GATEWAY',
        latency: localNetwork.adapterType === 'WIFI' ? 4 : 1,
        packetLoss: 0,
        status: 'PASS',
      },
      {
        hopNumber: 3,
        address: stunNat.publicIp || 'NAT_FIREWALL',
        hostname: `${stunNat.natType}_NAT`,
        latency: 5,
        packetLoss: stunNat.natType === 'SYMMETRIC' ? 10 : 0,
        status: stunNat.natType === 'SYMMETRIC' ? 'WARN' : 'PASS',
      },
      {
        hopNumber: 4,
        address: sbcProbe?.target || 'sip.b3networks.com',
        hostname: 'B3_SIP_EDGE_SBC',
        latency: sbcProbe?.latencyMs ?? 18,
        packetLoss: sbcProbe?.packetLossPct ?? 0,
        status: (sbcProbe?.packetLossPct ?? 0) > 0 ? 'FAIL' : 'PASS',
      },
    ];

    const interpretation: DiagnosticInterpretation = {
      observations,
      voipGuardrailNotes,
    };

    return {
      id: telemetry.sessionId,
      target: sbcProbe?.target || 'sip.b3networks.com',
      diagnosticType: 'ping',
      probeLocation: `Customer Premise (${localNetwork.adapterType})`,
      source: 'customer-agent',
      status: telemetry.overallVoipReadiness === 'CRITICAL_DEFECT' ? 'failed' : 'completed',
      startedAt: telemetry.timestamp,
      completedAt: telemetry.timestamp,
      customerTelemetry: telemetry,
      results: {
        type: 'traceroute',
        data: {
          destination: sbcProbe?.target || 'sip.b3networks.com',
          destinationReached: sbcProbe?.reachability === 'REACHABLE',
          totalHops: hops.length,
          hops,
        },
      },
      interpretation,
      errorMessage:
        telemetry.overallVoipReadiness === 'CRITICAL_DEFECT'
          ? telemetry.primaryVoipDefects[0] || 'Customer-side network defect detected.'
          : undefined,
    };
  }

  /**
   * Pre-configured realistic customer-side diagnostic scenarios for testing and simulation.
   */
  public static getSamplePreset(
    preset: 'SYMMETRIC_NAT' | 'WIFI_JITTER' | 'OPTIMAL_WIRED'
  ): CustomerAgentTelemetry {
    const timestamp = new Date().toISOString();

    if (preset === 'SYMMETRIC_NAT') {
      return {
        agentVersion: '1.2.0',
        sessionId: `CAG-SYM-${Date.now()}`,
        ticketId: 'TCK-88219',
        customerOrgName: 'Acme Logistics Pte Ltd',
        timestamp,
        osPlatform: 'win32',
        osVersion: 'Windows 11 Pro 23H2',
        localNetwork: {
          adapterType: 'ETHERNET',
          localIp: '10.10.40.112',
          gatewayIp: '10.10.40.1',
          subnetMask: '255.255.255.0',
          dnsServers: ['10.10.40.1', '8.8.8.8'],
          mtu: 1500,
        },
        stunNat: {
          natType: 'SYMMETRIC',
          publicIp: '118.200.45.88',
          publicPort: 49210,
          mappingPreserved: false,
          sipAlgStatus: 'DETECTED',
          stunServerUsed: 'stun.b3networks.com:3478',
          roundTripMs: 14,
          voipImpactSummary:
            'Symmetric NAT alters public port on each new destination. SIP ALG active on Fortinet/Mikrotik gateway.',
        },
        targetProbes: [
          {
            target: 'sip.b3networks.com',
            role: 'SIP_EDGE_SBC',
            port: 5060,
            protocol: 'UDP',
            reachability: 'REACHABLE',
            latencyMs: 16,
            packetLossPct: 0,
            dnsResolvedIp: '103.24.180.20',
            dnsResolutionMs: 4,
          },
          {
            target: 'rtp.b3networks.com',
            role: 'RTP_MEDIA_RELAY',
            port: 10000,
            protocol: 'UDP',
            reachability: 'DEGRADED',
            latencyMs: 18,
            packetLossPct: 15,
            jitterMs: 12,
            details: 'Inbound RTP media dropped by symmetric NAT state table.',
          },
        ],
        overallVoipReadiness: 'CRITICAL_DEFECT',
        primaryVoipDefects: [
          'Symmetric NAT prevents stable inbound RTP audio mapping.',
          'SIP ALG detected altering SDP media attributes, causing ~30s call drop.',
        ],
        recommendedCustomerActions: [
          'Disable SIP ALG / SIP Helper on corporate firewall (FortiGate / MikroTik / Sophos).',
          'Configure UDP NAT session timeout to >= 60 seconds.',
          'Enable STUN keep-alive on desktop softphones.',
        ],
      };
    }

    if (preset === 'WIFI_JITTER') {
      return {
        agentVersion: '1.2.0',
        sessionId: `CAG-WIFI-${Date.now()}`,
        ticketId: 'TCK-99402',
        customerOrgName: 'Global Maritime Services',
        timestamp,
        osPlatform: 'darwin',
        osVersion: 'macOS 14.5 Sonoma',
        localNetwork: {
          adapterType: 'WIFI',
          localIp: '192.168.1.145',
          gatewayIp: '192.168.1.1',
          subnetMask: '255.255.255.0',
          dnsServers: ['192.168.1.1'],
          mtu: 1500,
          wifiSignalStrengthPct: 38,
          wifiSsid: 'Warehouse-5G-EXT',
        },
        stunNat: {
          natType: 'PORT_RESTRICTED',
          publicIp: '202.166.88.14',
          publicPort: 52190,
          mappingPreserved: true,
          sipAlgStatus: 'NOT_DETECTED',
          stunServerUsed: 'stun.b3networks.com:3478',
          roundTripMs: 42,
          voipImpactSummary: 'Port-restricted cone NAT with stable port binding.',
        },
        targetProbes: [
          {
            target: 'sip.b3networks.com',
            role: 'SIP_EDGE_SBC',
            port: 5060,
            protocol: 'UDP',
            reachability: 'DEGRADED',
            latencyMs: 54,
            packetLossPct: 4,
            jitterMs: 68,
            dnsResolvedIp: '103.24.180.20',
          },
          {
            target: 'rtp.b3networks.com',
            role: 'RTP_MEDIA_RELAY',
            port: 10000,
            protocol: 'UDP',
            reachability: 'DEGRADED',
            latencyMs: 62,
            packetLossPct: 6,
            jitterMs: 74,
            details: 'Severe RF interference and retransmissions on Wi-Fi link.',
          },
        ],
        overallVoipReadiness: 'DEGRADED',
        primaryVoipDefects: [
          'High Wi-Fi jitter (74ms) exceeding 30ms voice budget.',
          'Local RF packet loss (6%) causing voice chopping and robotic distortion.',
        ],
        recommendedCustomerActions: [
          'Move closer to Wi-Fi access point or switch to 5GHz band.',
          'Use wired Gigabit Ethernet cable for VoIP softphones.',
          'Enable WMM / QoS for Voice on the wireless access point.',
        ],
      };
    }

    // OPTIMAL_WIRED
    return {
      agentVersion: '1.2.0',
      sessionId: `CAG-OPT-${Date.now()}`,
      ticketId: 'TCK-77110',
      customerOrgName: 'Fintech Hub Singapore',
      timestamp,
      osPlatform: 'darwin',
      osVersion: 'macOS 15.1 Sequoia',
      localNetwork: {
        adapterType: 'ETHERNET',
        localIp: '172.16.10.45',
        gatewayIp: '172.16.10.1',
        dnsServers: ['1.1.1.1', '8.8.8.8'],
        mtu: 1500,
      },
      stunNat: {
        natType: 'FULL_CONE',
        publicIp: '103.25.100.12',
        publicPort: 34780,
        mappingPreserved: true,
        sipAlgStatus: 'NOT_DETECTED',
        stunServerUsed: 'stun.b3networks.com:3478',
        roundTripMs: 8,
        voipImpactSummary: 'Full Cone NAT. Unrestricted bi-directional UDP traffic.',
      },
      targetProbes: [
        {
          target: 'sip.b3networks.com',
          role: 'SIP_EDGE_SBC',
          port: 5060,
          protocol: 'UDP',
          reachability: 'REACHABLE',
          latencyMs: 11,
          packetLossPct: 0,
          jitterMs: 2,
        },
        {
          target: 'rtp.b3networks.com',
          role: 'RTP_MEDIA_RELAY',
          port: 10000,
          protocol: 'UDP',
          reachability: 'REACHABLE',
          latencyMs: 12,
          packetLossPct: 0,
          jitterMs: 3,
        },
      ],
      overallVoipReadiness: 'OPTIMAL',
      primaryVoipDefects: [],
      recommendedCustomerActions: ['No action required. Customer LAN and WAN routing are optimal for VoIP.'],
    };
  }

  /**
   * Dispatches a customer diagnostic task or executes a sample simulation.
   */
  public static async dispatchCustomerDiagnostic(
    _target: string,
    _type: DiagnosticType
  ): Promise<NetworkDiagnosticResult> {
    const sample = this.getSamplePreset('SYMMETRIC_NAT');
    return this.normalizeCustomerTelemetry(sample);
  }
}
