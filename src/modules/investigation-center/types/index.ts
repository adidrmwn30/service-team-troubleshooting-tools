export type EvidenceType =
  | 'CALL_FORENSICS'
  | 'GLOBAL_NETWORK'
  | 'CUSTOMER_NETWORK'
  | 'LOG_SIEM';

export type InvestigationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface EvidenceReference {
  id: string;
  evidenceType: EvidenceType;
  source: string;
  referenceId: string;
  timestamp: string;
  title?: string;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface InvestigationFinding {
  id: string;
  category: 'SIP_SIGNALING' | 'RTP_MEDIA' | 'IP_ROUTING' | 'DNS' | 'ENDPOINT_NAT' | 'CARRIER';
  description: string;
  evidenceRefId?: string;
  verifiedFact: boolean; // Must distinguish verified fact vs hypothesis
  isHypothesis: boolean;
}

export interface RCASummary {
  faultDomain:
    | 'CARRIER_PEER'
    | 'B3_CORE_SBC'
    | 'CUSTOMER_PREMISE_ENDPOINT'
    | 'EXTERNAL_CALLER'
    | 'EXTERNAL_CALLEE'
    | 'UNDER_INVESTIGATION'
    | 'NOMINAL';
  technicalSummary: string;
  customerFacingSummary: string;
  actionItems: string[];
  preparedBy?: string;
  verifiedBy?: string;
}

export interface InvestigationCase {
  id: string;
  ticketId?: string;
  txnUuid?: string;
  customerIdentifier?: string;
  title: string;
  description?: string;
  sipDomain?: string;
  sourceIp?: string;
  destinationIp?: string;
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
  evidenceReferences: EvidenceReference[];
  findings?: InvestigationFinding[];
  rcaSummary?: RCASummary;
}

export * from './decision';
