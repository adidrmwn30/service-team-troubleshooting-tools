import {
  ExtractedTicketEntities,
  IngestedTicket,
  PodDefinition,
  PodId,
  RequiredDataPoint,
  DataPointCategory,
} from '../types/playbookTypes';
import { podRegistry } from '../data/podRegistry';

export class TicketIntakeParser {
  /**
   * Main entry point to parse unstructured customer ticket text or clipboard dump.
   */
  public parseTicket(rawText: string, forcedPodId?: PodId): IngestedTicket {
    const extracted = this.extractEntities(rawText);
    const podId = forcedPodId || this.detectPod(rawText, extracted);
    const pod = podRegistry.getPod(podId);

    const category = this.detectCategory(rawText, extracted);
    const { completenessScore, missingRequiredFields, providedFields } = this.auditCompleteness(
      extracted,
      pod,
      category
    );

    const clarificationDraft = this.generateCustomerClarification(
      extracted,
      missingRequiredFields,
      category
    );

    const escalationMarkdown = this.generateEscalationMarkdown(
      extracted,
      pod,
      category,
      rawText
    );

    return {
      id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      rawInput: rawText,
      detectedPodId: podId,
      extractedEntities: extracted,
      matchedCategory: category,
      completenessScore,
      missingRequiredFields,
      providedFields,
      clarificationDraft,
      escalationMarkdown,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract key telemetry tokens using regular expressions and heuristics.
   */
  public extractEntities(text: string): ExtractedTicketEntities {
    const result: ExtractedTicketEntities = {};

    // 1. Org UUID (standard 8-4-4-4-12 hex UUID)
    const orgUuidRegex = /(?:org(?:anization)?(?:\s+id|\s+uuid)?[=:\s]+)?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const orgMatches = Array.from(text.matchAll(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi));
    
    // Check if labelled org
    const labelledOrg = text.match(/(?:org|tenant|organization)(?:\s*(?:id|uuid))?[:=\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (labelledOrg) {
      result.orgUuid = labelledOrg[1];
    } else if (orgMatches.length > 0) {
      result.orgUuid = orgMatches[0][0];
    }

    // 2. Domain (e.g. sipsg02.b3networks.com, customer.b3networks.com, or general FQDN)
    const domainMatch = text.match(/(?:domain[:=\s]+)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.b3networks\.com)/i) ||
                        text.match(/domain[:=\s]+([a-z0-9.-]+\.[a-z]{2,})/i);
    if (domainMatch) {
      result.domain = domainMatch[1].trim();
    }

    // 3. Call TXN or SIP Call-ID
    const labelledTxn = text.match(/(?:call\s*txn|txn\s*id|transaction(?:\s*id)?|call[-_]?id)[:=\s]+([a-zA-Z0-9@_.-]{8,64})/i);
    if (labelledTxn) {
      result.callTxn = labelledTxn[1].trim();
    } else if (orgMatches.length > 1) {
      // Second UUID in text is frequently the Call TXN
      result.callTxn = orgMatches[1][0];
    }

    const sipCallIdMatch = text.match(/(?:sip[._-])?call[-_]?id[:=\s]+([^\s,;]+)/i);
    if (sipCallIdMatch) {
      result.sipCallId = sipCallIdMatch[1].trim();
    }

    // 4. Direction
    if (/\b(?:inbound|incoming|in-bound)\b/i.test(text)) {
      result.callDirection = 'inbound';
    } else if (/\b(?:outbound|outgoing|out-bound)\b/i.test(text)) {
      result.callDirection = 'outbound';
    } else if (/\b(?:internal|extension to extension|ext to ext)\b/i.test(text)) {
      result.callDirection = 'internal';
    } else if (/\b(?:forwarding|forwarded|divert)\b/i.test(text)) {
      result.callDirection = 'forwarding';
    }

    // 5. Phone numbers & Extensions
    const labelledCaller = text.match(/(?:from|caller|caller\s*id|source|src|calling\s*number)[:=\s]+(\+?[0-9]{7,15}|ext(?:ension)?\s*\d{3,5}|\d{3,5})/i);
    const labelledCallee = text.match(/(?:to|callee|destination|dest|called\s*number|did)[:=\s]+(\+?[0-9]{7,15}|ext(?:ension)?\s*\d{3,5}|\d{3,5})/i);

    if (labelledCaller) {
      result.callerNumber = labelledCaller[1].trim();
    }
    if (labelledCallee) {
      result.calleeNumber = labelledCallee[1].trim();
    }

    // Fallback: search for E.164 phone numbers if not explicitly labelled
    if (!result.callerNumber || !result.calleeNumber) {
      const e164Candidates = text.match(/\+?[1-9]\d{7,14}/g);
      if (e164Candidates) {
        if (!result.callerNumber && e164Candidates[0]) {
          result.callerNumber = e164Candidates[0];
        }
        if (!result.calleeNumber && e164Candidates[1]) {
          result.calleeNumber = e164Candidates[1];
        }
      }
    }

    // 6. Timestamps (e.g. 2026-11-09 14:15:00, 09/11/2026 2:15 PM, 14:15 SGT)
    const isoTimestamp = text.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}|(?:\s+[A-Z]{3,4}))?/);
    const humanTimestamp = text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?(?:\s+[A-Z]{3,4})?/i);
    if (isoTimestamp) {
      result.timestamp = isoTimestamp[0].trim();
    } else if (humanTimestamp) {
      result.timestamp = humanTimestamp[0].trim();
    }

    // 7. Error codes (SIP 4xx/5xx/6xx, HTTP 4xx/5xx, SMPP errors)
    const sipErrorMatch = text.match(/\b(?:SIP\s*(?:status\s*)?)?([1-6]\d\d\s+[A-Za-z\s]{3,30})\b/i) ||
                          text.match(/\b(?:SIP\s*)?([4-6]\d\d)\b/i) ||
                          text.match(/\b(?:error|status)[:=\s]+([^\n,]{3,30})/i);
    if (sipErrorMatch) {
      result.errorCode = sipErrorMatch[1].trim();
    }

    // 8. Product Keyword
    const productKeywords = [
      'Bizphone',
      'Microsoft Teams',
      'Teams Direct Routing',
      'Contact Center',
      'Auto Attendant',
      'IVR',
      'Virtual Line',
      'Wallboard',
      'Fax',
      'WhatsApp',
      'SMS',
      'Zoiper',
    ];
    for (const kw of productKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
        result.productKeyword = kw;
        break;
      }
    }

    // 9. Symptom Summary
    const symptomMatch = text.match(/(?:issue|problem|symptom|summary)[:=\s]+([^\n]+)/i);
    if (symptomMatch) {
      result.symptomSummary = symptomMatch[1].trim();
    }

    return result;
  }

  /**
   * Determine which pod this issue belongs to based on vocabulary.
   */
  public detectPod(text: string, entities: ExtractedTicketEntities): PodId {
    const lower = text.toLowerCase();
    
    // CPaaS signals
    if (
      lower.includes('sms') ||
      lower.includes('otp') ||
      lower.includes('smpp') ||
      lower.includes('dlr') ||
      lower.includes('sender id') ||
      lower.includes('message id')
    ) {
      return 'cpaas';
    }

    // Billing signals
    if (
      lower.includes('invoice') ||
      lower.includes('billing') ||
      lower.includes('cdr rating') ||
      lower.includes('credit wallet') ||
      lower.includes('overcharge')
    ) {
      return 'billing';
    }

    // Carrier signals
    if (
      lower.includes('pstn interconnect') ||
      lower.includes('carrier trunk') ||
      lower.includes('isdn') ||
      lower.includes('ss7') ||
      lower.includes('lnp porting')
    ) {
      return 'carrier';
    }

    // Default to CCB (Cloud Telephony & Omnichannel)
    return 'ccb';
  }

  /**
   * Detect specific issue subcategory (call, voice quality, app, auth, fax).
   */
  public detectCategory(text: string, entities: ExtractedTicketEntities): DataPointCategory {
    const lower = text.toLowerCase();

    if (
      lower.includes('voice quality') ||
      lower.includes('robotic') ||
      lower.includes('choppy') ||
      lower.includes('one-way audio') ||
      lower.includes('cannot hear') ||
      lower.includes('jitter') ||
      lower.includes('crackling')
    ) {
      return 'voice_quality';
    }

    if (
      lower.includes('app crash') ||
      lower.includes('desktop app') ||
      lower.includes('mobile app') ||
      lower.includes('web phone') ||
      lower.includes('softphone')
    ) {
      return 'app_issue';
    }

    if (
      lower.includes('login') ||
      lower.includes('unauthorized') ||
      lower.includes('401') ||
      lower.includes('403 forbidden') ||
      lower.includes('password')
    ) {
      return 'auth';
    }

    if (lower.includes('fax') || lower.includes('t.38')) {
      return 'fax';
    }

    if (lower.includes('invoice') || lower.includes('billing') || lower.includes('credit')) {
      return 'billing';
    }

    return 'call';
  }

  /**
   * Audit extracted entities against the target Pod requirements.
   */
  public auditCompleteness(
    entities: ExtractedTicketEntities,
    pod: PodDefinition,
    category: DataPointCategory
  ): {
    completenessScore: number;
    missingRequiredFields: RequiredDataPoint[];
    providedFields: RequiredDataPoint[];
  } {
    // Filter relevant required points for this category and general call
    const relevantRules = pod.requiredDataPoints.filter(
      (dp) => dp.category === category || dp.category === 'call'
    );

    const provided: RequiredDataPoint[] = [];
    const missing: RequiredDataPoint[] = [];

    for (const rule of relevantRules) {
      let isPresent = false;

      if (rule.extractorKey && entities[rule.extractorKey]) {
        isPresent = true;
      } else if (rule.id === 'caller_number' && entities.callerNumber) {
        isPresent = true;
      } else if (rule.id === 'callee_number' && entities.calleeNumber) {
        isPresent = true;
      } else if (rule.id === 'call_direction' && entities.callDirection) {
        isPresent = true;
      } else if (rule.id === 'call_txn_or_id' && (entities.callTxn || entities.sipCallId)) {
        isPresent = true;
      } else if (rule.id === 'org_uuid' && entities.orgUuid) {
        isPresent = true;
      } else if (rule.id === 'domain' && entities.domain) {
        isPresent = true;
      } else if (rule.id === 'timestamp' && entities.timestamp) {
        isPresent = true;
      }

      if (isPresent) {
        provided.push(rule);
      } else if (rule.required) {
        missing.push(rule);
      }
    }

    const mandatoryRules = relevantRules.filter((r) => r.required);
    const providedMandatoryCount = mandatoryRules.filter((r) =>
      provided.some((p) => p.id === r.id)
    ).length;

    const completenessScore =
      mandatoryRules.length === 0
        ? 100
        : Math.round((providedMandatoryCount / mandatoryRules.length) * 100);

    return {
      completenessScore,
      missingRequiredFields: missing,
      providedFields: provided,
    };
  }

  /**
   * Generate polite, professional customer clarification in 100% English.
   */
  public generateCustomerClarification(
    entities: ExtractedTicketEntities,
    missing: RequiredDataPoint[],
    category: DataPointCategory
  ): string {
    if (missing.length === 0) {
      return 'All necessary diagnostic details have been provided. Ready for triage and reproduction.';
    }

    const bullets = missing
      .map((item) => `- **${item.name}**: ${item.description} *(e.g. \`${item.example}\`)*`)
      .join('\n');

    let extraClarification = '';
    if (category === 'voice_quality') {
      extraClarification = `\n\nAdditionally, to diagnose voice packet loss accurately, please answer:\n1. Is this issue occurring on every call or intermittently?\n2. Can both parties not hear, or only one specific party (caller or callee)?\n3. Is the user connected via physical Ethernet cable or office Wi-Fi?`;
    }

    return `Dear Customer,

Thank you for reporting this issue. To help our technical support team trace the exact call logs and isolate the root cause quickly, could you please provide the following missing details?

${bullets}${extraClarification}

Once we receive these details, we will immediately trace the signaling path and update you with our findings.

Best regards,
Technical Support Team
B3Networks`;
  }

  /**
   * Generate structured Markdown escalation dossier for Jira / Zendesk / Slack.
   */
  public generateEscalationMarkdown(
    entities: ExtractedTicketEntities,
    pod: PodDefinition,
    category: DataPointCategory,
    rawText: string
  ): string {
    const lines: string[] = [];

    lines.push(`## [CCB Escalation Dossier] ${entities.productKeyword || 'Telephony'} - ${entities.errorCode || 'Incident Report'}`);
    lines.push(``);
    lines.push(`### 1. Incident Background`);
    lines.push(`- **Product / Feature**: ${entities.productKeyword || 'Cloud Telephony'}`);
    lines.push(`- **Organization UUID**: \`${entities.orgUuid || 'NOT_PROVIDED'}\``);
    lines.push(`- **SIP / Routing Domain**: \`${entities.domain || 'NOT_PROVIDED'}\``);
    lines.push(`- **Direction**: ${entities.callDirection || 'Unknown'}`);
    lines.push(`- **Caller Number (Src)**: \`${entities.callerNumber || 'N/A'}\``);
    lines.push(`- **Callee Number (Dst)**: \`${entities.calleeNumber || 'N/A'}\``);
    lines.push(`- **Call TXN / Call-ID**: \`${entities.callTxn || entities.sipCallId || 'N/A'}\``);
    lines.push(`- **Timestamp**: ${entities.timestamp || 'N/A'}`);
    lines.push(`- **Observed Error / Code**: ${entities.errorCode || 'N/A'}`);
    lines.push(``);

    lines.push(`### 2. Initial Investigation & Findings`);
    if (entities.errorCode?.includes('404')) {
      lines.push(`- Endpoint returned SIP 404 Not Found. Verified user line assignment and DID translation.`);
    } else if (category === 'voice_quality') {
      lines.push(`- Audio degradation reported. Inspected jitter buffer metrics and RTP directional loss.`);
    } else {
      lines.push(`- Triage completed in accordance with CCB Pod SOP.`);
    }
    lines.push(`- Escalated to: ${pod.escalationChannels[0]?.channel || '#pod-ccb-leads'}`);
    lines.push(``);

    lines.push(`### 3. Raw Customer Report`);
    lines.push(`> ${rawText.replace(/\n/g, '\n> ')}`);
    lines.push(``);

    lines.push(`### 4. Next Action Required`);
    lines.push(`- Engineering / L2 review of SIP signaling trace and SBC boundary logs.`);

    return lines.join('\n');
  }
}

export const ticketIntakeParser = new TicketIntakeParser();
