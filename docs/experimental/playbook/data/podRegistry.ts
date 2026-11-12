import { PodDefinition, PodId } from '../types/playbookTypes';
import { ccbPodDefinition } from './ccbPodData';

// Placeholder definition for CPaaS & Messaging Pod
export const cpaasPodDefinition: PodDefinition = {
  id: 'cpaas',
  name: 'CPaaS & Messaging Pod',
  shortDescription: 'SMS APIs, WhatsApp Cloud API, Verification OTPs, Webhook Ingestion, SMPP Trunks',
  iconName: 'MessageSquare',
  accentColor: '#10b981',
  supportedProducts: [
    'SMS API (A2P)',
    'WhatsApp Business Platform',
    'OTP Verification Service',
    'SMPP Gateway',
    'Webhook Delivery Engine',
  ],
  workflowSteps: ccbPodDefinition.workflowSteps,
  slaTiers: ccbPodDefinition.slaTiers,
  requiredDataPoints: [
    {
      id: 'org_uuid',
      category: 'call',
      name: 'Organization UUID',
      description: 'Customer tenant UUID',
      required: true,
      example: 'd82046ca-46e3-4700-845b-78fb6e7b579f',
      extractorKey: 'orgUuid',
    },
    {
      id: 'cpaas_message_id',
      category: 'call',
      name: 'Message ID / SMS TXN',
      description: 'Platform message UUID or provider message reference',
      required: true,
      example: 'msg-9921-uuid-44',
      extractorKey: 'callTxn',
    },
    {
      id: 'cpaas_sender_id',
      category: 'call',
      name: 'Sender ID / Sender Phone',
      description: 'Registered Alpha Sender ID or sender phone number',
      required: true,
      example: 'B3ALERT / +6581234567',
      extractorKey: 'callerNumber',
    },
    {
      id: 'cpaas_recipient',
      category: 'call',
      name: 'Destination Recipient Number',
      description: 'E.164 formatted recipient phone number',
      required: true,
      example: '+6598765432',
      extractorKey: 'calleeNumber',
    },
    {
      id: 'timestamp',
      category: 'call',
      name: 'Dispatch Timestamp',
      description: 'Exact send time with timezone',
      required: true,
      example: '2026-11-09 10:30:00 SGT',
      extractorKey: 'timestamp',
    },
    {
      id: 'cpaas_dlr_status',
      category: 'call',
      name: 'Delivery Report (DLR) Status / Error Code',
      description: 'DELIVRD, UNDELIV, EXPIRED, or Telco error code',
      required: false,
      example: 'UNDELIV - Telco error 402 Barred subscriber',
      extractorKey: 'errorCode',
    },
  ],
  diagnosticMatrices: [
    {
      id: 'sms_delivery_triage',
      productName: 'SMS Delivery & DLR',
      category: 'Messaging',
      description: 'Troubleshooting SMS delivery failures, delivery latency, and telco rejections.',
      commonSymptoms: ['SMS not received by handset', 'DLR stuck in SENT state', 'Sender ID replaced by random number'],
      checklist: [
        {
          id: 'sms_1',
          step: 'Check Sender ID Pre-Registration in SSIR Registry',
          toolUsed: 'Singapore SSIR / Carrier Portal',
          expectedOutcome: 'Sender ID is approved and linked to Org Corp Pass.',
          nextStepIfFailed: 'Advise customer to complete SSIR SMS Sender ID registration with SGNIC.',
        },
        {
          id: 'sms_2',
          step: 'Inspect Upstream Aggregator DLR Response',
          toolUsed: 'Kibana SMS Aggregator Logs',
          expectedOutcome: 'Aggregator returns 200 submit_sm_resp and subsequent DLR.',
          nextStepIfFailed: 'Check carrier routing table or failover to secondary SMS route.',
        },
      ],
    },
  ],
  toolsHandbook: ccbPodDefinition.toolsHandbook,
  writingGuidelines: ccbPodDefinition.writingGuidelines,
  escalationChannels: [
    {
      role: 'CPaaS Engineering Lead',
      channel: '#pod-cpaas-leads',
      lead: 'CPaaS Pod Lead',
    },
    {
      role: 'SMS Route Ops',
      channel: '#carrier-sms-routing',
      lead: 'Messaging Ops Engineer',
    },
  ],
};

// Placeholder definition for Carrier Interconnect Pod
export const carrierPodDefinition: PodDefinition = {
  id: 'carrier',
  name: 'Carrier & Interconnect Pod',
  shortDescription: 'Telco SIP Trunks, PSTN Ingress/Egress, SS7/ISDN Gateways, Number Portability',
  iconName: 'Network',
  accentColor: '#8b5cf6',
  supportedProducts: [
    'Carrier SIP Trunks',
    'International Egress Routes (LCR)',
    'Local Number Portability (LNP)',
    'Emergency 995/999 Routing',
    'Carrier Ingress SBC',
  ],
  workflowSteps: ccbPodDefinition.workflowSteps,
  slaTiers: ccbPodDefinition.slaTiers,
  requiredDataPoints: ccbPodDefinition.requiredDataPoints,
  diagnosticMatrices: [
    {
      id: 'carrier_sip_trunk_triage',
      productName: 'Carrier SIP Interconnect Trunk',
      category: 'Trunks',
      description: 'Diagnosing carrier-level SIP trunk drops, circuit saturation, and ISDN Q.850 cause codes.',
      commonSymptoms: ['SIP 503 Service Unavailable from telco', 'SIP 504 Gateway Timeout', 'One-way audio across carrier boundary'],
      checklist: [
        {
          id: 'car_1',
          step: 'Inspect Carrier Boundary PCAP & Dual-Trace Demarcation',
          toolUsed: 'PCAP Analyzer -> Demarcation Engine',
          expectedOutcome: 'Confirm carrier SBC accepted INVITE and sent 180 Ringing.',
          nextStepIfFailed: 'If telco returns 503 with Cause 34 (No circuit available), activate emergency LCR failover trunk.',
        },
      ],
    },
  ],
  toolsHandbook: ccbPodDefinition.toolsHandbook,
  writingGuidelines: ccbPodDefinition.writingGuidelines,
  escalationChannels: [
    {
      role: 'Telco Ops Lead',
      channel: '#carrier-interconnect',
      lead: 'Principal Carrier Network Architect',
    },
  ],
};

// Placeholder definition for Billing Pod
export const billingPodDefinition: PodDefinition = {
  id: 'billing',
  name: 'Billing & Rating Engine Pod',
  shortDescription: 'CDR Rating, Prepaid Wallets, Postpaid Subscriptions, Tax & Invoice Reconciliation',
  iconName: 'Receipt',
  accentColor: '#f59e0b',
  supportedProducts: [
    'CDR Rating Engine',
    'Prepaid Calling Wallet',
    'Subscription Invoicing',
    'Usage Discrepancy Reconciliation',
  ],
  workflowSteps: ccbPodDefinition.workflowSteps,
  slaTiers: ccbPodDefinition.slaTiers,
  requiredDataPoints: [
    {
      id: 'org_uuid',
      category: 'billing',
      name: 'Organization UUID',
      description: 'Customer tenant UUID',
      required: true,
      example: 'd82046ca-46e3-4700-845b-78fb6e7b579f',
      extractorKey: 'orgUuid',
    },
    {
      id: 'invoice_number',
      category: 'billing',
      name: 'Invoice / CDR Transaction ID',
      description: 'Invoice number or CDR rating batch reference',
      required: true,
      example: 'INV-2026-11-00241',
    },
    {
      id: 'billing_cycle',
      category: 'billing',
      name: 'Billing Cycle / Date Range',
      description: 'Affected billing period',
      required: true,
      example: '01 Nov 2026 - 08 Nov 2026',
      extractorKey: 'timestamp',
    },
  ],
  diagnosticMatrices: [
    {
      id: 'billing_rating_triage',
      productName: 'CDR Rating Discrepancy',
      category: 'Rating',
      description: 'Resolving discrepancies between call duration and charged call credits.',
      commonSymptoms: ['Customer claims double charging', 'Call rated at higher rate per minute', 'Wallet deducted on failed call'],
      checklist: [
        {
          id: 'bill_1',
          step: 'Audit CDR Answer Duration vs Rated Duration',
          toolUsed: 'Audit App -> Universal Event Billing Block',
          expectedOutcome: 'Billed seconds match answered duration rounded up to 60s increment.',
          nextStepIfFailed: 'If rated duration > 0 on Q.850 Cause 17 (User Busy), issue credit note and report rating engine bug.',
        },
      ],
    },
  ],
  toolsHandbook: ccbPodDefinition.toolsHandbook,
  writingGuidelines: ccbPodDefinition.writingGuidelines,
  escalationChannels: [
    {
      role: 'Billing Engineering Lead',
      channel: '#pod-billing-leads',
      lead: 'Billing Engine Lead',
    },
  ],
};

class PodRegistryManager {
  private pods: Map<PodId, PodDefinition> = new Map();
  private activePodId: PodId = 'ccb';

  constructor() {
    this.registerPod(ccbPodDefinition);
    this.registerPod(cpaasPodDefinition);
    this.registerPod(carrierPodDefinition);
    this.registerPod(billingPodDefinition);
  }

  public registerPod(pod: PodDefinition): void {
    this.pods.set(pod.id, pod);
  }

  public getPod(id: PodId): PodDefinition {
    const pod = this.pods.get(id);
    if (!pod) {
      return ccbPodDefinition;
    }
    return pod;
  }

  public getAllPods(): PodDefinition[] {
    return Array.from(this.pods.values());
  }

  public getActivePod(): PodDefinition {
    return this.getPod(this.activePodId);
  }

  public setActivePod(id: PodId): void {
    if (this.pods.has(id)) {
      this.activePodId = id;
    }
  }

  public getActivePodId(): PodId {
    return this.activePodId;
  }
}

export const podRegistry = new PodRegistryManager();
