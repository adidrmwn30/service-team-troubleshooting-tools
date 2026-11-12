import {
  InvestigationCase,
  EvidenceReference,
  InvestigationFinding,
  RCASummary,
} from '../types';
import { CallQualityReport } from '../../../types/callQuality';
import { NetworkDiagnosticResult } from '../../network-diagnostics/types';

export const SAMPLE_INVESTIGATIONS: InvestigationCase[] = [
  {
    id: 'INV-2026-0814',
    ticketId: 'T-90412',
    txnUuid: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f',
    customerIdentifier: 'FinTech Global SG (Org: fc312420)',
    title: 'Customer reports 30s call audio drop on Extension 637',
    description:
      'Customer reported that incoming calls through DID +6567501331 drop abruptly after ~30 seconds when answered by desk agent.',
    sipDomain: 'sip.b3networks.com',
    sourceIp: '103.24.112.5',
    destinationIp: '165.225.114.18',
    status: 'IN_PROGRESS',
    createdAt: '2026-11-04T10:15:00Z',
    updatedAt: '2026-11-04T11:30:00Z',
    evidenceReferences: [
      {
        id: 'ev-call-01',
        evidenceType: 'CALL_FORENSICS',
        source: 'B3 SIEM UniversalEvent',
        referenceId: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f',
        timestamp: '2026-11-04T10:18:22Z',
        title: 'Call Transaction 01a180c5 (VoIP Forensic)',
        summary: 'SIP BYE received from Callee Desktop (sip35526286). Duration: 55s. MOS: 4.3 (Optimal). Normal call clearing.',
      },
      {
        id: 'ev-net-01',
        evidenceType: 'GLOBAL_NETWORK',
        source: 'Globalping.io Probe',
        referenceId: 'gp-sg-sin01-traceroute',
        timestamp: '2026-11-04T10:25:00Z',
        title: 'Traceroute from Singapore Probe to 165.225.114.18',
        summary: '8 hops to customer gateway. RTT avg 12ms. No edge packet loss observed.',
      },
    ],
    findings: [
      {
        id: 'find-01',
        category: 'SIP_SIGNALING',
        description: 'Call actually lasted 55 seconds (not 30 seconds as claimed). Terminated by Callee Desktop via standard SIP BYE.',
        evidenceRefId: 'ev-call-01',
        verifiedFact: true,
        isHypothesis: false,
      },
      {
        id: 'find-02',
        category: 'RTP_MEDIA',
        description: 'RTP telemetry indicates bidirectional audio flow with Rx Loss 0.0% and Tx Loss 0.0% until normal BYE termination.',
        evidenceRefId: 'ev-call-01',
        verifiedFact: true,
        isHypothesis: false,
      },
      {
        id: 'find-03',
        category: 'ENDPOINT_NAT',
        description: 'Customer claims a 30s timeout; however, telemetry confirms normal session clearing with no SIP ACK timeout.',
        verifiedFact: false,
        isHypothesis: true,
      },
    ],
    rcaSummary: {
      faultDomain: 'NOMINAL',
      technicalSummary:
        'Forensic analysis of B3 SIEM event 01a180c5 contradicts customer report of a 30s network drop. The call was answered on Extension 637 (sip35526286), sustained active audio for 55.0s, and was cleanly released by the callee endpoint with SIP BYE / Q.850 Cause 16 (Normal clearing). No packet loss or B3 edge failure detected.',
      customerFacingSummary:
        'Our call records show the call connected normally and lasted for 55 seconds before being disconnected from your desktop extension. Audio quality was optimal throughout.',
      actionItems: [
        'Present call duration and termination record to customer.',
        'Request specific call sample if another transaction experienced the reported issue.',
      ],
      preparedBy: 'L2 Support Engineer',
      verifiedBy: 'Service Operations Lead',
    },
  },
];

export class InvestigationService {
  private static investigations: InvestigationCase[] = [...SAMPLE_INVESTIGATIONS];

  public static getAllInvestigations(): InvestigationCase[] {
    return [...this.investigations];
  }

  public static getInvestigationById(id: string): InvestigationCase | undefined {
    return this.investigations.find((inv) => inv.id === id);
  }

  public static createInvestigation(
    params: Omit<InvestigationCase, 'id' | 'createdAt' | 'updatedAt'>
  ): InvestigationCase {
    const newCase: InvestigationCase = {
      ...params,
      id: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.investigations.unshift(newCase);
    return newCase;
  }

  public static compileInvestigationFromTelemetry(
    callReport: CallQualityReport,
    networkResult?: NetworkDiagnosticResult | null
  ): InvestigationCase {
    const existingIndex = this.investigations.findIndex(
      (c) => c.txnUuid === callReport.txnUuid
    );

    const callEvidenceId = `ev-call-${callReport.txnUuid.slice(0, 8)}`;
    const networkEvidenceId = networkResult ? `ev-net-${networkResult.id.slice(0, 8)}` : undefined;

    const evidenceReferences: EvidenceReference[] = [
      {
        id: callEvidenceId,
        evidenceType: 'CALL_FORENSICS',
        source: 'B3 VoIP Forensic Engine',
        referenceId: callReport.txnUuid,
        timestamp: new Date().toISOString(),
        title: `Call Forensic: ${callReport.txnUuid.slice(0, 8)} (${callReport.overallStatus})`,
        summary: `Duration: ${callReport.callDurationSeconds}s. Terminated by: ${callReport.termination.initiatorName} via SIP ${callReport.termination.sipMethod}${
          callReport.termination.q850CauseCode ? ` (Q.850 Cause ${callReport.termination.q850CauseCode})` : ''
        }. MOS: ${callReport.hops[0]?.metrics?.mos ?? 'N/A'}. Rx Loss: ${callReport.hops[0]?.metrics?.rxPacketLossPct ?? 0}%, Tx Loss: ${callReport.hops[0]?.metrics?.txPacketLossPct ?? 0}%.`,
      },
    ];

    if (networkResult) {
      let netSummary = `Status: ${networkResult.status.toUpperCase()}. Target: ${networkResult.target}. `;
      if (networkResult.results?.type === 'ping') {
        netSummary += `Avg RTT: ${networkResult.results.data.avgRttMs?.toFixed(1) || 'N/A'}ms, Loss: ${networkResult.results.data.packetLossPct}%.`;
      } else if (networkResult.results?.type === 'traceroute') {
        netSummary += `Hops: ${networkResult.results.data.totalHops}, Reached: ${networkResult.results.data.destinationReached ? 'Yes' : 'No'}.`;
      } else if (networkResult.results?.type === 'mtr') {
        netSummary += `Hops evaluated: ${networkResult.results.data.hops.length}.`;
      } else if (networkResult.results?.type === 'dns') {
        netSummary += `Query: ${networkResult.results.data.queryType}, Answers: ${networkResult.results.data.answers.length}.`;
      } else if (networkResult.results?.type === 'http') {
        netSummary += `HTTP Status: ${networkResult.results.data.statusCode}, Time: ${networkResult.results.data.responseTimeMs}ms.`;
      }

      evidenceReferences.push({
        id: networkEvidenceId!,
        evidenceType: 'GLOBAL_NETWORK',
        source: `Globalping Probe (${networkResult.probeLocation || 'Multi-Vantage'})`,
        referenceId: networkResult.id,
        timestamp: networkResult.completedAt || new Date().toISOString(),
        title: `${networkResult.diagnosticType.toUpperCase()} Probe to ${networkResult.target}`,
        summary: netSummary,
      });
    }

    const findings: InvestigationFinding[] = [
      {
        id: `find-sip-${callReport.txnUuid.slice(0, 8)}`,
        category: 'SIP_SIGNALING',
        description: `Call session lasted ${callReport.callDurationSeconds}s, terminated by ${callReport.termination.initiatorName} using SIP ${callReport.termination.sipMethod}${
          callReport.termination.q850ReasonText ? ` (${callReport.termination.q850ReasonText})` : ''
        }.`,
        evidenceRefId: callEvidenceId,
        verifiedFact: true,
        isHypothesis: false,
      },
      {
        id: `find-rtp-${callReport.txnUuid.slice(0, 8)}`,
        category: 'RTP_MEDIA',
        description: `Voice media metrics: Overall status ${callReport.overallStatus}. MOS ${callReport.hops[0]?.metrics?.mos ?? 'N/A'}, Rx Loss ${callReport.hops[0]?.metrics?.rxPacketLossPct ?? 0}%, Tx Loss ${callReport.hops[0]?.metrics?.txPacketLossPct ?? 0}%, Jitter ${callReport.hops[0]?.metrics?.jitterMs ?? 0}ms.`,
        evidenceRefId: callEvidenceId,
        verifiedFact: true,
        isHypothesis: false,
      },
    ];

    if (networkResult) {
      findings.push({
        id: `find-net-${networkResult.id.slice(0, 8)}`,
        category: 'IP_ROUTING',
        description: `Independent Globalping probe from ${networkResult.probeLocation || 'Singapore'} to ${networkResult.target} executed with outcome: ${networkResult.status}.`,
        evidenceRefId: networkEvidenceId,
        verifiedFact: true,
        isHypothesis: false,
      });
    }

    // Hypothesis
    const suspectedDomain = callReport.l2Details?.faultDomain || (callReport.culpritHop ? callReport.culpritHop.nodeName : 'NOMINAL');
    findings.push({
      id: `find-hypo-${callReport.txnUuid.slice(0, 8)}`,
      category: 'CARRIER',
      description: `Primary fault domain isolated to [${suspectedDomain}]. Suggested action: ${callReport.recommendedAction}`,
      verifiedFact: false,
      isHypothesis: true,
    });

    const destinationIp = callReport.hops.find((h) => h.hopType === 'CALLEE_ENDPOINT')?.nodeName || '165.225.114.18';
    const sourceIp = callReport.hops.find((h) => h.hopType === 'CALLER')?.nodeName || '103.24.112.5';
    const sipDomain = callReport.hops.find((h) => h.hopType === 'EDGE_SBC')?.vendor || 'sip.b3networks.com';

    let mappedFaultDomain: RCASummary['faultDomain'] = 'NOMINAL';
    if (callReport.l2Details?.faultDomain) {
      if (callReport.l2Details.faultDomain === 'CARRIER_PEER') mappedFaultDomain = 'CARRIER_PEER';
      else if (callReport.l2Details.faultDomain === 'B3_CORE_SBC') mappedFaultDomain = 'B3_CORE_SBC';
      else if (callReport.l2Details.faultDomain === 'CUSTOMER_PREMISE_ENDPOINT') mappedFaultDomain = 'CUSTOMER_PREMISE_ENDPOINT';
      else if (callReport.l2Details.faultDomain === 'EXTERNAL_CALLER') mappedFaultDomain = 'EXTERNAL_CALLER';
      else if (callReport.l2Details.faultDomain === 'EXTERNAL_CALLEE') mappedFaultDomain = 'EXTERNAL_CALLEE';
      else mappedFaultDomain = 'NOMINAL';
    } else if (callReport.culpritHop) {
      mappedFaultDomain = 'CUSTOMER_PREMISE_ENDPOINT';
    }

    const rcaSummary: RCASummary = {
      faultDomain: mappedFaultDomain,
      technicalSummary:
        callReport.l2Details?.rootCauseTechnicalSummary ||
        `Forensic trace of TXN ${callReport.txnUuid}: Call lasted ${callReport.callDurationSeconds}s. Ended via ${callReport.termination.sipMethod} by ${callReport.termination.initiatorName}. ${callReport.executiveSummary}`,
      customerFacingSummary:
        callReport.symptomCorrelation?.customerFacingExplanation ||
        callReport.l2Details?.suggestedCustomerResolution ||
        `Our telemetry logs confirm the call connected and disconnected normally from ${callReport.termination.initiatorName}.`,
      actionItems: [
        callReport.recommendedAction || 'Share timestamp and call clearing details with customer.',
        ...(networkResult ? [`Corroborate external probe results (${networkResult.target}) with edge carrier logs.`] : []),
      ],
      preparedBy: 'L2 Support Engineer',
      verifiedBy: 'Tri-Module Auto Correlation',
    };

    if (existingIndex >= 0) {
      const existing = this.investigations[existingIndex];
      const updatedCase: InvestigationCase = {
        ...existing,
        updatedAt: new Date().toISOString(),
        evidenceReferences: [
          ...evidenceReferences,
          ...existing.evidenceReferences.filter(
            (e) => e.evidenceType !== 'CALL_FORENSICS' && e.evidenceType !== 'GLOBAL_NETWORK'
          ),
        ],
        findings,
        rcaSummary,
      };
      this.investigations[existingIndex] = updatedCase;
      return updatedCase;
    } else {
      const newCase: InvestigationCase = {
        id: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        ticketId: `T-${callReport.txnUuid.slice(0, 5).toUpperCase()}`,
        txnUuid: callReport.txnUuid,
        customerIdentifier:
          callReport.l2Details?.carrierPeer || callReport.termination.initiatorName || 'B3 Voice Customer',
        title: `VoIP Incident: ${callReport.overallStatus} (${callReport.termination.sipMethod}) - ${callReport.txnUuid.slice(0, 8)}`,
        description: `Automated dossier compiled from Call Forensics & Network Diagnostics for TXN ${callReport.txnUuid}.`,
        sipDomain,
        sourceIp,
        destinationIp,
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        evidenceReferences,
        findings,
        rcaSummary,
      };
      this.investigations.unshift(newCase);
      return newCase;
    }
  }
}
