export type PodId = 'ccb' | 'cpaas' | 'carrier' | 'billing';

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  title: string;
  targetDuration: string;
  description: string;
  actions: string[];
  responsibilities: {
    l1Support: string;
    l2Support: string;
    engineering?: string;
  };
  tips?: string[];
}

export type SlaSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';

export interface SlaTier {
  severity: SlaSeverity;
  name: string;
  targetResolutionHours: {
    enterprise: number;
    standard: number;
  };
  description: string;
  criteria: string[];
  escalationChannel: string;
  notificationRules: string[];
}

export type DataPointCategory =
  | 'call'
  | 'voice_quality'
  | 'app_issue'
  | 'auth'
  | 'fax'
  | 'dnc'
  | 'billing'
  | 'invoice';

export interface RequiredDataPoint {
  id: string;
  category: DataPointCategory;
  name: string;
  description: string;
  required: boolean;
  example: string;
  extractorKey?: keyof IngestedTicket['extractedEntities'];
}

export interface VoiceQualityQuestion {
  id: string;
  number: number;
  question: string;
  whyNeeded: string;
  options?: string[];
}

export interface ProductChecklistItem {
  id: string;
  step: string;
  toolUsed: string;
  expectedOutcome: string;
  nextStepIfFailed: string;
}

export interface ProductDiagnosticMatrix {
  id: string;
  productName: string;
  category: string;
  description: string;
  commonSymptoms: string[];
  checklist: ProductChecklistItem[];
  suggestedAction?: {
    label: string;
    targetTab: 'analyzer' | 'pcap' | 'forensics';
    params?: Record<string, string>;
  };
}

export interface ToolReference {
  id: string;
  name: string;
  category: 'observability' | 'provisioning' | 'browser' | 'telemetry' | 'network';
  description: string;
  urlOrPath?: string;
  keyMetricsOrCommands: string[];
  stepByStepInstructions: string[];
}

export interface PodDefinition {
  id: PodId;
  name: string;
  shortDescription: string;
  iconName: string;
  accentColor: string;
  supportedProducts: string[];
  workflowSteps: WorkflowStep[];
  slaTiers: SlaTier[];
  requiredDataPoints: RequiredDataPoint[];
  voiceQualityQuestions?: VoiceQualityQuestion[];
  diagnosticMatrices: ProductDiagnosticMatrix[];
  toolsHandbook: ToolReference[];
  writingGuidelines: {
    principles: string[];
    dos: string[];
    donts: string[];
  };
  escalationChannels: {
    role: string;
    channel: string;
    lead: string;
  }[];
}

export interface ExtractedTicketEntities {
  orgUuid?: string;
  domain?: string;
  callerNumber?: string;
  calleeNumber?: string;
  callTxn?: string;
  sipCallId?: string;
  timestamp?: string;
  callDirection?: 'inbound' | 'outbound' | 'internal' | 'forwarding';
  errorCode?: string;
  productKeyword?: string;
  symptomSummary?: string;
}

export interface IngestedTicket {
  id: string;
  rawInput: string;
  detectedPodId: PodId;
  extractedEntities: ExtractedTicketEntities;
  matchedCategory: DataPointCategory;
  completenessScore: number; // 0 - 100
  missingRequiredFields: RequiredDataPoint[];
  providedFields: RequiredDataPoint[];
  clarificationDraft: string;
  escalationMarkdown: string;
  timestamp: string;
}
