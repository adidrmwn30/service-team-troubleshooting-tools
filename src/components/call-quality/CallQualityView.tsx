import React, { useState, useRef, useEffect } from 'react';
import {
  CallQualityReport,
  CustomerReportedAnomaly,
  ForkBranchOutcome,
  HangupParty,
  HopDiagnostic,
  HopVerdictLevel,
  ReportedSymptomPreset,
} from '../../types/callQuality';
import {
  CallQualityDiagnosticService,
} from '../../services/callQualityService';
import { useWorkbench } from '../../shared/context/WorkbenchContext';
import { HeaderPortal } from '../common/HeaderPortal';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clipboard,
  Clock,
  Cpu,
  FileJson,
  FolderGit2,
  GitBranch,
  Globe,
  HelpCircle,
  Info,
  Key,
  Laptop,
  Loader2,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';

interface CallQualityViewProps {
  onBackToControlTower?: () => void;
}

interface SimulationPresetItem {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  txnUuid: string;
  symptomPreset?: ReportedSymptomPreset;
  description: string;
}

const SIMULATION_PRESETS: SimulationPresetItem[] = [
  {
    id: 'pbx-refusal-480',
    label: '01a18556 (PBX 480 Refusal)',
    badge: 'SIP 480',
    badgeColor: 'border-orange-500/40 text-orange-300 bg-orange-500/10',
    txnUuid: '01a18556-dddd-7373-b274-6b11e4f8db5e',
    symptomPreset: 'CALL_SETUP_FAILURE',
    description: 'Inbound +6562619008 -> SGUNICENTREX sip19547913 rejected with SIP 480 Signaling Terminated',
  },
  {
    id: 'early-disconnect-487',
    label: '01a17c6a (Caller Abandon 3.4s)',
    badge: 'SIP 487',
    badgeColor: 'border-sky-500/40 text-sky-300 bg-sky-500/10',
    txnUuid: '01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd',
    description: 'Inbound caller hung up after 3.4s ringing on Ext 103 before answer (Originator Cancel)',
  },
  {
    id: 'forked-mobile-55s',
    label: '01a180c5 (Answered Mobile 55s)',
    badge: '200 OK + 404',
    badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    txnUuid: '01a180c5-4cf8-74ef-9cf2-e3bb9de3853f',
    description: 'Parallel forking: Mobile answered cleanly (55s), Desktop returned 404 Congestion',
  },
  {
    id: 'outbound-normal',
    label: 'Outbound Call (Agent Ext 101)',
    badge: 'OUTBOUND',
    badgeColor: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
    txnUuid: 'outbound-01a2b3c4-9876-4321-abcd-ef0123456789',
    description: 'Outgoing call from agent Ext 101 to customer +6591234567 via B3SG_OUT',
  },
  {
    id: 'refusal-under-15s',
    label: 'User Declined (SIP 486 Busy)',
    badge: 'SIP 486',
    badgeColor: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
    txnUuid: 'e9921c44-3312-4aa1-9f90-112233445566',
    symptomPreset: 'CALL_SETUP_FAILURE',
    description: 'Desktop client declined with SIP 486 Busy Here; sibling Mobile cancelled',
  },
  {
    id: 'one-way-audio',
    label: 'One-Way Audio (NAT Block)',
    badge: '100% Tx Loss',
    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
    txnUuid: '88cc4411-90ef-4122-bc33-556677889900',
    symptomPreset: 'ONE_WAY_AUDIO',
    description: 'Callee mic RTP stream blocked by local firewall (100% Tx loss, Rx 0.2%)',
  },
  {
    id: 'wifi-jitter',
    label: 'Wi-Fi Downlink Jitter (64ms)',
    badge: 'MOS 2.85',
    badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    txnUuid: '7b889a12-11c3-4d22-b5e8-99e21f45612a',
    symptomPreset: 'CHOPPY_OR_ROBOTIC',
    description: 'Asymmetric Wi-Fi loss/jitter on callee downlink (Rx 4.6% loss, 64ms jitter)',
  },
  {
    id: 'drop-30s',
    label: 'Drop at ~30s (SIP ACK Timeout)',
    badge: 'Timer H',
    badgeColor: 'border-red-500/40 text-red-300 bg-red-500/10',
    txnUuid: 'f4b10030-99aa-44bb-88cc-303030303030',
    symptomPreset: 'DROP_AT_30S',
    description: 'Call dropped at 31.8s due to firewall dropping SIP ACK packet (RFC 3261 Timer H)',
  },
  {
    id: 'drop-15m',
    label: 'Drop at ~15m (RFC 4028 Refresh)',
    badge: '900s Timeout',
    badgeColor: 'border-orange-500/40 text-orange-300 bg-orange-500/10',
    txnUuid: 'f4b10015-88bb-44cc-99dd-151515151515',
    symptomPreset: 'DROP_AT_15M',
    description: 'Call dropped at 902.5s when carrier failed to acknowledge 15m session refresh',
  },
];

export const CallQualityView: React.FC<CallQualityViewProps> = ({
  onBackToControlTower,
}) => {
  const {
    setActiveCallReport,
    forwardCallToNetworkDiagnostics,
    compileToInvestigationCenter,
  } = useWorkbench();

  const [txnInput, setTxnInput] = useState('');
  const [report, setReport] = useState<CallQualityReport | null>(null);

  useEffect(() => {
    setActiveCallReport(report);
  }, [report, setActiveCallReport]);
  const [selectedHop, setSelectedHop] = useState<HopDiagnostic | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [copiedTxn, setCopiedTxn] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedL2Dossier, setCopiedL2Dossier] = useState(false);
  const [copiedResolution, setCopiedResolution] = useState(false);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);

  // Customer reported symptom / anomaly state
  const [reportedPreset, setReportedPreset] = useState<ReportedSymptomPreset>('NONE');
  const [customSymptomNote, setCustomSymptomNote] = useState('');
  const [copiedCorrelationNote, setCopiedCorrelationNote] = useState(false);

  // Live B3 Session and SIEM query state
  const [b3Session, setB3Session] = useState<{ active: boolean; maskedToken?: string } | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [manualSessionInput, setManualSessionInput] = useState('');
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const drilldownRef = useRef<HTMLDivElement>(null);

  // Check existing B3 session from Keychain / Electron bridge on mount
  useEffect(() => {
    if (window.electronAPI?.getCallQualitySession) {
      window.electronAPI.getCallQualitySession().then((res) => {
        setB3Session(res);
      }).catch(() => {});
    } else if (window.electronAPI?.getScTicketSession) {
      window.electronAPI.getScTicketSession().then((res) => {
        setB3Session(res);
      }).catch(() => {});
    }
  }, []);

  const handleSelectHop = (hop: HopDiagnostic) => {
    setSelectedHop(hop);
    setTimeout(() => {
      drilldownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDiagnose = async (
    txnToUse?: string,
    presetToUse?: ReportedSymptomPreset,
    customNoteToUse?: string
  ) => {
    const id = (txnToUse !== undefined ? txnToUse : txnInput).trim();
    if (!id) {
      setReport(null);
      setSelectedHop(null);
      return;
    }
    setTxnInput(id);
    setSelectedHop(null);

    const activePreset = presetToUse !== undefined ? presetToUse : reportedPreset;
    const activeNote = customNoteToUse !== undefined ? customNoteToUse : customSymptomNote;
    const symptomParam =
      activePreset !== 'NONE' || activeNote.trim()
        ? { preset: activePreset, customDescription: activeNote.trim() }
        : undefined;

    // If running in Electron with live SIEM fetch capability
    if (window.electronAPI?.fetchB3SiemEvents) {
      setIsFetchingLive(true);
      setLiveNotice(null);
      try {
        const res = await window.electronAPI.fetchB3SiemEvents(id);
        if (res.success && res.data) {
          const liveReport = CallQualityDiagnosticService.parseSiemUniversalEvents(res.data, id, symptomParam);
          setReport(liveReport);
          setLiveNotice(`Live SIEM events retrieved directly from B3 portal (${res.maskedToken || 'authenticated'})`);
          setIsFetchingLive(false);
          return;
        } else if (res.requiresAuth) {
          setLiveNotice('B3 session required or expired. Log in with your B3 account or Google SSO to fetch live data.');
          setIsSessionModalOpen(true);
        } else {
          setLiveNotice(`Live query note: ${res.error || 'Server response could not be parsed'}. Showing modeled diagnosis.`);
        }
      } catch (err: any) {
        setLiveNotice(`Query error: ${err.message}. Showing modeled diagnosis.`);
      } finally {
        setIsFetchingLive(false);
      }
    }

    // Fallback to sample or simulated diagnosis
    const result = CallQualityDiagnosticService.diagnoseByTxn(id, symptomParam);
    setReport(result);
  };

  const handleOpenB3Login = async () => {
    if (!window.electronAPI?.openB3LoginWindow) {
      setSessionError('Desktop login window is only available inside the Electron desktop application. In browser mode, please paste your session token or cURL below.');
      return;
    }
    setSessionSaving(true);
    setSessionError(null);
    try {
      const res = await window.electronAPI.openB3LoginWindow();
      if (res.success) {
        setB3Session({ active: true, maskedToken: res.maskedToken });
        setIsSessionModalOpen(false);
        setLiveNotice(`Connected to B3Networks (${res.maskedToken}). Querying live data...`);
        handleDiagnose(txnInput);
      } else if (!res.cancelled) {
        setSessionError(res.error || 'Login was not completed.');
      }
    } catch (err: any) {
      setSessionError(err?.message || 'Login failed.');
    } finally {
      setSessionSaving(false);
    }
  };

  const handleSaveManualSession = async () => {
    const raw = manualSessionInput.trim();
    if (!raw) {
      setSessionError('Please paste a session token or B3 cURL command.');
      return;
    }
    setSessionSaving(true);
    setSessionError(null);
    try {
      if (window.electronAPI?.saveCallQualitySession) {
        const res = await window.electronAPI.saveCallQualitySession(raw);
        if (res.success) {
          setB3Session({ active: true, maskedToken: res.maskedToken });
          setIsSessionModalOpen(false);
          setManualSessionInput('');
          setLiveNotice(`Connected to B3Networks (${res.maskedToken}). Querying live data...`);
          handleDiagnose(txnInput);
        } else {
          setSessionError(res.error || 'Failed to save session token.');
        }
      } else {
        // Fallback in web browser mode
        const tokenMatch = raw.match(/sessionToken=([^;\s]+)/i) || raw.match(/^[a-zA-Z0-9_.-]{16,}$/);
        const token = tokenMatch ? (tokenMatch[1] || tokenMatch[0]) : raw;
        if (token.length >= 16) {
          const masked = `${token.slice(0, 6)}...${token.slice(-4)}`;
          setB3Session({ active: true, maskedToken: masked });
          setIsSessionModalOpen(false);
          setManualSessionInput('');
          setLiveNotice(`Session token saved in browser session (${masked}).`);
        } else {
          setSessionError('Invalid session token format (expected at least 16 characters).');
        }
      }
    } catch (err: any) {
      setSessionError(err?.message || 'Failed to parse session token.');
    } finally {
      setSessionSaving(false);
    }
  };

  const handlePasteJsonAnalyze = () => {
    try {
      const symptomParam =
        reportedPreset !== 'NONE' || customSymptomNote.trim()
          ? { preset: reportedPreset, customDescription: customSymptomNote.trim() }
          : undefined;
      const parsed = CallQualityDiagnosticService.diagnoseRawJson(rawJsonInput, symptomParam);
      setReport(parsed);
      setTxnInput(parsed.txnUuid);
      setIsJsonModalOpen(false);
      setSelectedHop(null);
    } catch (e: any) {
      alert('Invalid JSON: ' + e.message);
    }
  };

  const handleCopyTxn = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.txnUuid);
    setCopiedTxn(true);
    setTimeout(() => setCopiedTxn(false), 2000);
  };

  const handleCopyFormattedSummary = () => {
    if (!report) return;
    let formatted = `[Call Quality Diagnosis - TXN: ${report.txnUuid}]
Status: ${report.overallStatus} (${report.callDurationSeconds}s)
Who Hung Up: ${report.termination.terminatedBy} (${report.termination.initiatorName}) via ${report.termination.sipMethod}
Culprit Hop: ${report.culpritHop ? `Hop ${report.culpritHop.hopIndex} - ${report.culpritHop.label}` : 'None (Optimal)'}
Root Cause: ${report.culpritHop ? report.culpritHop.reason : report.executiveSummary}
Recommended Action: ${report.recommendedAction}`;

    if (report.l2Details) {
      formatted += `\n\n--- L2 SUPPORT INVESTIGATION DOSSIER ---
Ticket Category: ${report.l2Details.ticketCategory}
Fault Domain:    ${report.l2Details.faultDomain}
Carrier Peer:    ${report.l2Details.carrierPeer || 'N/A'}
Edge Gateway:    ${report.l2Details.edgeGateway || 'N/A'}
Dialed DID:      ${report.l2Details.dialedDid || 'N/A'}
Caller:          ${report.l2Details.callerIdentity || report.termination.initiatorName}
Callee:          ${report.l2Details.calleeIdentity || 'N/A'}

Technical Root Cause Summary:
${report.l2Details.rootCauseTechnicalSummary}

Customer Resolution Note:
${report.l2Details.suggestedCustomerResolution}`;

      if (report.l2Details.chronologicalEvents && report.l2Details.chronologicalEvents.length > 0) {
        formatted += `\n\nChronological Timeline:\n` +
          report.l2Details.chronologicalEvents.map(e => `[${e.relativeOffset}] ${e.eventName.padEnd(16)} | ${e.description}`).join('\n');
      }
    }

    navigator.clipboard.writeText(formatted);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyL2Dossier = () => {
    if (!report?.l2Details) return;
    const l2 = report.l2Details;
    const isOutbound = report.callDirection === 'OUTBOUND' || l2.callDirection === 'OUTBOUND';
    let text = `=====================================================
L2 SUPPORT TELEPHONY INCIDENT DOSSIER
=====================================================
TXN UUID:        ${report.txnUuid}
Call Direction:  ${isOutbound ? 'OUTBOUND' : 'INBOUND'}
Call Duration:   ${report.callDurationSeconds}s
Ticket Category: ${l2.ticketCategory}
Fault Domain:    ${l2.faultDomain}
${isOutbound ? 'Agent / Orig:   ' : 'Caller / Orig:   '}${l2.callerIdentity || report.termination.initiatorName}
${isOutbound ? 'Dialed Target:  ' : 'Dialed DID:      '}${l2.dialedDid || 'N/A'}
${isOutbound ? 'Egress Carrier: ' : 'Inbound Carrier: '}${l2.carrierPeer || 'N/A'}
Edge SBC Node:   ${l2.edgeGateway || 'N/A'}
${isOutbound ? 'Dest / Callee:  ' : 'Target Callee:   '}${l2.calleeIdentity || 'N/A'}

[Signaling Termination]
Initiator:       ${report.termination.terminatedBy} (${report.termination.initiatorName})
SIP Method:      ${report.termination.sipMethod}
Q.850 Cause:     Cause ${report.termination.q850CauseCode || 16} (${report.termination.q850ReasonText || 'Normal clearing'})

[Technical Root Cause Audit]
${l2.rootCauseTechnicalSummary}

[Customer Resolution / Response Note]
${l2.suggestedCustomerResolution}`;

    if (l2.vendorSummary) {
      text += `\nVendor Topology: ${l2.vendorSummary}`;
    }

    if (report.hops && report.hops.length > 0) {
      text += `\n\n[Per-Leg Forensic Telephony Breakdown]\n` +
        report.hops.map(h => {
          const parts = [`Hop ${h.hopIndex} [${h.hopType}] ${h.label}`];
          if (h.legUuid) parts.push(`Leg: ${h.legUuid.slice(0, 13)}`);
          if (h.vendor) parts.push(`Vendor: ${h.vendor}`);
          if (h.originPeer || h.terminatedPeer) parts.push(`Peer: ${h.originPeer || h.terminatedPeer}`);
          if (h.sipCode) parts.push(`SIP: ${h.sipCode} (${h.sipReason || ''})`);
          if (h.hangupReason) parts.push(`Hangup: ${h.hangupReason}`);
          if (h.isCulprit) parts.push(`🚨 CULPRIT`);
          return parts.join(' | ');
        }).join('\n');
    }

    if (l2.chronologicalEvents && l2.chronologicalEvents.length > 0) {
      text += `\n\n[Forensic Chronological Timeline]
` + l2.chronologicalEvents.map(ev => `[${ev.relativeOffset}] ${ev.eventName.padEnd(16)} | ${ev.description}`).join('\n');
    }

    navigator.clipboard.writeText(text);
    setCopiedL2Dossier(true);
    setTimeout(() => setCopiedL2Dossier(false), 2000);
  };

  const handleCopyCustomerResolution = () => {
    if (!report?.l2Details?.suggestedCustomerResolution) return;
    navigator.clipboard.writeText(report.l2Details.suggestedCustomerResolution);
    setCopiedResolution(true);
    setTimeout(() => setCopiedResolution(false), 2000);
  };

  const getFaultDomainBadge = (faultDomain: string) => {
    switch (faultDomain) {
      case 'EXTERNAL_CALLER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <User className="w-3.5 h-3.5 text-sky-400" />
            Fault Domain: External Caller (No Platform Fault)
          </span>
        );
      case 'CARRIER_PEER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            Fault Domain: Carrier / Telco Trunk
          </span>
        );
      case 'B3_CORE_SBC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <Server className="w-3.5 h-3.5 text-rose-400" />
            Fault Domain: B3 Core / Edge SBC
          </span>
        );
      case 'CUSTOMER_PREMISE_ENDPOINT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Laptop className="w-3.5 h-3.5 text-purple-400" />
            Fault Domain: Customer Premise / Device
          </span>
        );
      case 'NOMINAL':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Fault Domain: Nominal (Clean Call)
          </span>
        );
    }
  };

  const getStatusBadge = (
    status: CallQualityReport['overallStatus'],
    culpritReason?: string,
    terminatedBy?: HangupParty
  ) => {
    if (status === 'CANCELLED' || (status === 'REFUSED' && terminatedBy === 'CALLER')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          <PhoneMissed className="w-3.5 h-3.5" /> Early Disconnect / Caller Cancelled
        </span>
      );
    }
    switch (status) {
      case 'OPTIMAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Optimal Call Quality
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />{' '}
            {culpritReason?.includes('Jitter')
              ? 'Quality Degraded / High Jitter'
              : culpritReason?.includes('Loss')
              ? 'Quality Degraded / Packet Loss'
              : culpritReason?.includes('MOS')
              ? 'Quality Degraded / Low MOS'
              : 'Voice Quality Degraded'}
          </span>
        );
      case 'REFUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30">
            <PhoneOff className="w-3.5 h-3.5" /> Call Refused / Busied Out
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" /> Call Dropped / Route Failed
          </span>
        );
    }
  };

  const getHangupBadge = (party: HangupParty) => {
    switch (party) {
      case 'CALLER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <PhoneIncoming className="w-3 h-3 text-blue-400" /> Caller Hung Up
          </span>
        );
      case 'CALLEE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <PhoneOutgoing className="w-3 h-3 text-purple-400" /> Callee Hung Up / Refused
          </span>
        );
      case 'SYSTEM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Cpu className="w-3 h-3 text-amber-400" /> System / Ring Timeout
          </span>
        );
      case 'NETWORK_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-400" /> Network Disconnect
          </span>
        );
    }
  };

  const getForkOutcomeBadge = (outcome?: ForkBranchOutcome) => {
    switch (outcome) {
      case 'PRIMARY_REFUSAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Action: 486 Busy (Declined)
          </span>
        );
      case 'CANCELLED_BY_FORK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            Auto-Cancelled (Forked)
          </span>
        );
      case 'ANSWERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Picked Up (Answered)
          </span>
        );
      case 'NO_ANSWER_TIMEOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Ring Timeout
          </span>
        );
      case 'CONGESTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-300 border border-orange-500/40">
            404 Congestion
          </span>
        );
      default:
        return null;
    }
  };

  const getHopStatusIcon = (level: HopVerdictLevel, isCulprit: boolean) => {
    if (isCulprit) {
      return <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />;
    }
    switch (level) {
      case 'PASS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'WARN':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'FAIL':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'INFO':
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  const getHopTypeIcon = (type: HopDiagnostic['hopType'], nodeName: string) => {
    if (nodeName.toLowerCase().includes('mobile')) {
      return <Smartphone className="w-4 h-4 text-indigo-400" />;
    }
    if (nodeName.toLowerCase().includes('desktop')) {
      return <Laptop className="w-4 h-4 text-blue-400" />;
    }
    switch (type) {
      case 'CALLER':
        return <Phone className="w-4 h-4 text-amber-400" />;
      case 'EDGE_SBC':
        return <Radio className="w-4 h-4 text-cyan-400" />;
      case 'CPAAS_CORE':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'SIP_GATEWAY':
        return <PhoneForwarded className="w-4 h-4 text-emerald-400" />;
      case 'CALLEE_ENDPOINT':
        return <Laptop className="w-4 h-4 text-indigo-400" />;
    }
  };

  // Group hops for parallel branching
  const sequentialHops = report ? report.hops.filter((h) => !h.isForkedBranch) : [];
  const forkedHops = report ? report.hops.filter((h) => h.isForkedBranch) : [];

  return (
    <div className="flex flex-col min-h-full bg-navy-950 text-slate-100 p-6 pb-36 space-y-6">
      {/* Call Quality Actions Portaled into Global Top Header */}
      <HeaderPortal>
        <button
          onClick={() => setIsSessionModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm ${
            b3Session?.active
              ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/50 text-emerald-300'
              : 'bg-navy-900 hover:bg-navy-800 border-navy-750 text-slate-400 hover:text-white'
          }`}
          title="Configure B3 Session Token (Reuses your B3 Internal Ticketing session)"
        >
          <Key className={`w-3.5 h-3.5 ${b3Session?.active ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>
            {b3Session?.active
              ? `B3 Connected (${b3Session.maskedToken})`
              : 'Connect B3 Session'}
          </span>
        </button>

        <button
          onClick={handleCopyFormattedSummary}
          disabled={!report}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-750 text-slate-300 hover:text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title="Copy technical diagnosis for Jira ticket or Telegram update"
        >
          <Clipboard className="w-3.5 h-3.5 text-blue-400" />
          <span>{copiedSummary ? 'Copied Summary!' : 'Copy for Jira / Chat'}</span>
        </button>
      </HeaderPortal>

      {/* Live Fetch Notice Banner (if any) */}
      {liveNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-xs bg-blue-950/40 border border-blue-500/30 text-blue-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{liveNotice}</span>
          </div>
          <button
            onClick={() => setLiveNotice(null)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Simulation Presets Strip */}
      <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-3 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-200">
              Interactive Telephony Simulation Presets:
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Click any scenario for instant, consistent hop topology, directional telemetry & L2 dossiers
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SIMULATION_PRESETS.map((preset) => {
            const isSelected = txnInput.trim().toLowerCase() === preset.txnUuid.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setTxnInput(preset.txnUuid);
                  setReportedPreset(preset.symptomPreset || 'NONE');
                  setCustomSymptomNote('');
                  handleDiagnose(preset.txnUuid, preset.symptomPreset || 'NONE', '');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-blue-600/90 text-white border-blue-400 shadow-md ring-1 ring-blue-400'
                    : 'bg-navy-950/80 hover:bg-navy-800/90 text-slate-300 border-navy-750 hover:border-slate-600'
                }`}
                title={preset.description}
              >
                <span>{preset.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                    isSelected ? 'bg-blue-700/80 border-blue-300/40 text-blue-100' : preset.badgeColor
                  }`}
                >
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TXN Search & Input Bar */}
      <div className="bg-navy-900/70 border border-navy-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={txnInput}
              onChange={(e) => {
                const val = e.target.value;
                setTxnInput(val);
                if (!val.trim()) {
                  setReport(null);
                  setSelectedHop(null);
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleDiagnose()}
              placeholder="Enter Call TXN UUID (e.g. 01a17c6a-5dd0-7cd7-9e0c-01a6965b25dd)"
              className="w-full pl-9 pr-9 py-2 bg-navy-950 border border-navy-750 focus:border-blue-500 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            {txnInput && (
              <button
                type="button"
                onClick={() => {
                  setTxnInput('');
                  setReport(null);
                  setSelectedHop(null);
                  setReportedPreset('NONE');
                  setCustomSymptomNote('');
                }}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-200 transition-colors p-0.5"
                title="Clear TXN UUID and results"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => handleDiagnose()}
            disabled={isFetchingLive || !txnInput.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors shrink-0 disabled:opacity-50"
          >
            {isFetchingLive ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isFetchingLive ? 'Querying B3 SIEM...' : 'Diagnose Call'}</span>
          </button>
          <button
            onClick={() => setIsJsonModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors shrink-0"
            title="Paste raw JSON from B3 Portal Network tab"
          >
            <FileJson className="w-3.5 h-3.5 text-blue-400" />
            <span>Paste Raw JSON</span>
          </button>
        </div>

        {/* Customer-Reported Symptom & Anomaly Input Section */}
        <div className="pt-3 border-t border-navy-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Customer-Reported Symptom & Anomaly Correlation (English):</span>
              <span className="text-[10px] font-normal text-slate-400">
                Optional telemetry correlation against customer-reported issue
              </span>
            </div>
            {(reportedPreset !== 'NONE' || customSymptomNote) && (
              <button
                type="button"
                onClick={() => {
                  setReportedPreset('NONE');
                  setCustomSymptomNote('');
                  if (txnInput.trim()) {
                    handleDiagnose(txnInput, 'NONE', '');
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                title="Clear selected symptom"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Symptom</span>
              </button>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'NONE', label: 'Auto (No Symptom Filter)', desc: 'Run pure telemetry analysis' },
              { id: 'CALL_SETUP_FAILURE', label: 'Call Setup Failure / Busy', desc: 'Call failed to establish or fast busy' },
              { id: 'DROP_AT_30S', label: 'Drop at ~30s (NAT / ACK Timeout)', desc: 'Session severed after ~30s' },
              { id: 'DROP_AT_15M', label: 'Drop at ~15m (Session Refresh)', desc: 'Session severed at ~15m (RFC 4028)' },
              { id: 'MID_CALL_DROP', label: 'Unexpected Mid-Call Cut-Off', desc: 'Call abruptly disconnected during conversation' },
              { id: 'ONE_WAY_AUDIO', label: 'One-Way Audio', desc: 'One side cannot hear the other' },
              { id: 'CHOPPY_OR_ROBOTIC', label: 'Choppy / Robotic Audio', desc: 'Distorted or broken voice quality' },
              { id: 'CUSTOM', label: 'Custom Note...', desc: 'Free-text customer complaint' },
            ].map((preset) => {
              const isSelected = reportedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const nextPreset = preset.id as ReportedSymptomPreset;
                    setReportedPreset(nextPreset);
                    if (txnInput.trim()) {
                      handleDiagnose(txnInput, nextPreset, customSymptomNote);
                    }
                  }}
                  title={preset.desc}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-bold shadow-sm shadow-blue-500/20'
                      : 'bg-navy-950/80 hover:bg-navy-800 border-navy-750 text-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Custom Input Field */}
          <div className="relative">
            <input
              type="text"
              value={customSymptomNote}
              onChange={(e) => setCustomSymptomNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && txnInput.trim()) {
                  handleDiagnose(txnInput, reportedPreset === 'NONE' ? 'CUSTOM' : reportedPreset, customSymptomNote);
                }
              }}
              placeholder="Enter custom customer observation (e.g. 'Customer reported call dropped after 30 seconds', 'Caller could not hear callee')..."
              className="w-full px-3 py-1.5 pr-20 bg-navy-950 border border-navy-750 focus:border-blue-500 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            {customSymptomNote && (
              <button
                type="button"
                onClick={() => {
                  if (txnInput.trim()) {
                    handleDiagnose(txnInput, reportedPreset === 'NONE' ? 'CUSTOM' : reportedPreset, customSymptomNote);
                  }
                }}
                disabled={!txnInput.trim()}
                className="absolute right-1.5 top-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze
              </button>
            )}
          </div>
        </div>
      </div>

      {report ? (
        <>
          {/* TRI-MODULE SYNCHRONIZED WORKFLOW PIPELINE BAR */}
          <div className="bg-gradient-to-r from-purple-950/70 via-blue-950/50 to-navy-900 border border-purple-500/30 rounded-xl p-3.5 shadow-md flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-wide">
                    Tri-Module Telemetry Pipeline
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    1. Forensic Done
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Data call TXN <span className="font-mono text-purple-300 font-semibold">{report.txnUuid.slice(0, 8)}...</span> siap diteruskan ke Network Diagnostics &amp; Investigation Center.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => forwardCallToNetworkDiagnostics(report)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                title="Teruskan IP / SIP domain ke Globalping Network Diagnostics"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>2. Network Diag ➔</span>
              </button>
              <button
                type="button"
                onClick={() => compileToInvestigationCenter(report)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
                title="Langsung susun berkas investigasi di Investigation Center"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>3. Investigation Dossier ➔</span>
              </button>
            </div>
          </div>

          {/* EXECUTIVE DIAGNOSIS BANNER (The Conclusion) */}
      <div
        className={`rounded-xl border p-5 shadow-sm transition-all ${
          report.culpritHop
            ? report.overallStatus === 'REFUSED'
              ? 'bg-orange-950/20 border-orange-500/40'
              : 'bg-rose-950/20 border-rose-500/40'
            : report.overallStatus === 'CANCELLED' || (report.overallStatus === 'REFUSED' && report.termination.terminatedBy === 'CALLER')
            ? 'bg-sky-950/20 border-sky-500/40'
            : 'bg-emerald-950/20 border-emerald-500/40'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-navy-800/80">
          <div className="flex items-center flex-wrap gap-2.5">
            {getStatusBadge(report.overallStatus, report.culpritHop?.reason, report.termination.terminatedBy)}
            {report.callDirection === 'OUTBOUND' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
                <PhoneOutgoing className="w-3.5 h-3.5" />
                <span>Outgoing / Outbound Call</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                <PhoneIncoming className="w-3.5 h-3.5" />
                <span>Inbound Call</span>
              </span>
            )}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>TXN: {report.txnUuid}</span>
              <button
                onClick={handleCopyTxn}
                className="hover:text-white transition-colors"
                title="Copy TXN"
              >
                <Clipboard className="w-3.5 h-3.5" />
              </button>
              {copiedTxn && <span className="text-[10px] text-emerald-400">Copied!</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">
              Duration: <strong className="text-slate-200">{report.callDurationSeconds}s</strong>
            </span>
            <span className="text-slate-400">
              RTP Stream:{' '}
              {report.qualityAvailable ? (
                <strong className="text-emerald-400">Captured (≥15s)</strong>
              ) : report.callDurationSeconds <= 5 && (report.termination.terminatedBy === 'CALLER' || !report.hops.some((h) => h.metrics?.mos)) ? (
                <strong className="text-sky-300 font-medium">Pre-media (0s Talk Time)</strong>
              ) : (
                <strong className="text-amber-400">Not captured (&lt;15s)</strong>
              )}
            </span>
          </div>
        </div>

        {/* WHO HUNG UP THE CALL (Call Termination Card) */}
        <div className="mt-4 p-3.5 rounded-lg bg-navy-950/90 border border-blue-500/30 flex items-start gap-3">
          <div className="p-2 rounded-md bg-blue-500/10 text-blue-400 mt-0.5 shrink-0">
            <PhoneOff className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300 uppercase tracking-wide text-[11px]">
                  Call Disconnect Initiator:
                </span>
                {getHangupBadge(report.termination.terminatedBy)}
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-400">Signaling:</span>
                <span className="px-2 py-0.5 rounded bg-navy-800 text-blue-300 font-semibold border border-navy-700">
                  {report.termination.sipMethod}
                </span>
                {report.termination.q850CauseCode && (
                  <span className="text-slate-500">
                    (Q.850 Cause {report.termination.q850CauseCode}: {report.termination.q850ReasonText})
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-200 pt-0.5">{report.termination.explanation}</p>
            <div className="text-slate-400 text-[11px]">
              Disconnected by: <span className="text-slate-200 font-semibold">{report.termination.initiatorName}</span>
            </div>
          </div>
        </div>

        {/* Culprit Hop Highlight */}
        {report.culpritHop && (
          <div className="mt-3 p-3.5 rounded-lg bg-navy-950/80 border border-rose-500/30 flex items-start gap-3">
            <div className="p-2 rounded-md bg-rose-500/10 text-rose-400 mt-0.5 shrink-0">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-400 tracking-wide uppercase text-[11px]">
                  Culprit Hop Identified:
                </span>
                <span className="font-semibold text-white px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30">
                  Hop {report.culpritHop.hopIndex}: {report.culpritHop.label}
                </span>
              </div>
              <p className="text-slate-200">{report.culpritHop.reason}</p>
              <div className="text-slate-400 pt-1">
                <span className="text-amber-300 font-medium">Recommended Resolution: </span>
                <span>{report.culpritHop.recommendedAction}</span>
              </div>
            </div>
          </div>
        )}

        {/* Executive Summary */}
        <div className="mt-4 space-y-2 text-xs">
          <div>
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Summary &amp; Flow Analysis:
            </span>
            <p className="text-slate-300 mt-0.5 leading-relaxed">{report.executiveSummary}</p>
          </div>
        </div>
      </div>

      {/* CUSTOMER SYMPTOM & ANOMALY CORRELATION DOSSIER */}
      {report.symptomCorrelation && (
        <div className="bg-navy-900/95 border border-purple-500/30 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-navy-800">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Symptom Correlation Verdict
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    report.symptomCorrelation.verdictColor === 'rose'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : report.symptomCorrelation.verdictColor === 'amber'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : report.symptomCorrelation.verdictColor === 'blue'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  }`}
                >
                  {report.symptomCorrelation.verdictBadgeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Correlates customer-reported anomalies (English) against network packet metrics and SIP signaling timestamps.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `[Customer Anomaly Analysis]\nReported: ${report.symptomCorrelation?.reportedText}\nVerdict: ${report.symptomCorrelation?.verdictBadgeLabel}\n\nTechnical Forensic:\n${report.symptomCorrelation?.explanation}\n\nCustomer Response Note:\n${report.symptomCorrelation?.customerFacingExplanation}`
                  );
                  setCopiedCorrelationNote(true);
                  setTimeout(() => setCopiedCorrelationNote(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                title="Copy entire correlation report to clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-purple-400" />
                <span>{copiedCorrelationNote ? 'Copied Analysis!' : 'Copy Correlation Analysis'}</span>
              </button>
            </div>
          </div>

          {/* Reported Symptom vs Telemetry Alignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-navy-950/60 border border-navy-800/80 rounded-lg p-3 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                Customer Reported Symptom:
              </span>
              <p className="text-slate-200 font-medium leading-relaxed">
                {report.symptomCorrelation.reportedText}
              </p>
            </div>

            <div className="bg-navy-950/60 border border-navy-800/80 rounded-lg p-3 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-blue-400" />
                Telemetry Verification Facts:
              </span>
              <p className="text-slate-200 font-mono text-[11px] leading-relaxed">
                Duration: {report.callDurationSeconds}s | Status: {report.overallStatus} | End: {report.termination.terminatedBy} ({report.termination.sipMethod})
              </p>
            </div>
          </div>

          {/* Technical Forensic Explanation */}
          <div className="bg-navy-950/70 border border-navy-800 rounded-lg p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Technical Forensic Explanation (L2 Incident Engineering):
            </span>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {report.symptomCorrelation.explanation}
            </p>
          </div>

          {/* Customer-Facing Explanation */}
          <div className="bg-navy-950/70 border border-purple-500/20 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Suggested Customer-Facing Response Note (English):
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(report.symptomCorrelation!.customerFacingExplanation);
                  setCopiedResolution(true);
                  setTimeout(() => setCopiedResolution(false), 2000);
                }}
                className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1 transition-colors"
                title="Copy suggested customer message"
              >
                <Clipboard className="w-3 h-3" />
                <span>{copiedResolution ? 'Copied Response!' : 'Copy Customer Response'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans bg-navy-900/60 p-2.5 rounded border border-navy-800">
              "{report.symptomCorrelation.customerFacingExplanation}"
            </p>
          </div>
        </div>
      )}

      {/* L2 SUPPORT TECHNICAL INVESTIGATION DOSSIER */}
      {report.l2Details && (
        <div className="bg-navy-900/90 border border-blue-500/30 rounded-xl p-5 shadow-lg space-y-4">
          {/* Header & Meta Badges */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-navy-800">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  L2 INCIDENT DOSSIER
                </span>
                {getFaultDomainBadge(report.l2Details.faultDomain)}
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{report.l2Details.ticketCategory}</span>
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyL2Dossier}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors"
                title="Copy full L2 Support Telephony Incident Dossier"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{copiedL2Dossier ? 'Copied Full Dossier!' : 'Copy L2 Incident Report'}</span>
              </button>
            </div>
          </div>

          {/* Telephony Identifiers & Routing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-navy-950/70 border border-navy-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                {report.callDirection === 'OUTBOUND' ? (
                  <>
                    <PhoneOutgoing className="w-3 h-3 text-purple-400" /> Outbound Caller (Agent)
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-slate-500" /> Inbound Caller
                  </>
                )}
              </span>
              <p className="text-xs font-mono font-semibold text-slate-200 truncate">
                {report.l2Details.callerIdentity || report.termination.initiatorName}
              </p>
              <span className="text-[10px] text-slate-500 block truncate">
                {report.callDirection === 'OUTBOUND' ? 'Originating Agent Extension' : 'Originating Endpoint'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-navy-950/70 border border-navy-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-500" />{' '}
                {report.callDirection === 'OUTBOUND' ? 'Dialed Destination / Customer' : 'Dialed DID / Number'}
              </span>
              <p className="text-xs font-mono font-semibold text-slate-200 truncate">
                {report.l2Details.dialedDid || (report.callDirection === 'OUTBOUND' ? 'External Destination' : 'PBX / Direct')}
              </p>
              <span className="text-[10px] text-slate-500 block truncate">
                {report.callDirection === 'OUTBOUND' ? 'External Customer Number' : 'Target Company DID'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-navy-950/70 border border-navy-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Radio className="w-3 h-3 text-slate-500" />{' '}
                {report.callDirection === 'OUTBOUND' ? 'Outbound Trunk & Egress SBC' : 'Carrier Trunk & Edge SBC'}
              </span>
              <p className="text-xs font-mono font-semibold text-slate-200 truncate">
                {report.l2Details.carrierPeer || (report.callDirection === 'OUTBOUND' ? 'Outbound Egress Trunk' : 'Telco Peer')}
              </p>
              <span className="text-[10px] text-slate-500 block truncate">
                Node: {report.l2Details.edgeGateway || (report.callDirection === 'OUTBOUND' ? 'Egress SBC' : 'Edge SBC')}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-navy-950/70 border border-navy-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Laptop className="w-3 h-3 text-slate-500" />{' '}
                {report.callDirection === 'OUTBOUND' ? 'Target Callee / Destination' : 'Target Callee / Device'}
              </span>
              <p className="text-xs font-mono font-semibold text-slate-200 truncate">
                {report.l2Details.calleeIdentity || (report.callDirection === 'OUTBOUND' ? 'External Callee' : 'Internal Extension')}
              </p>
              <span className="text-[10px] text-slate-500 block truncate">
                {report.callDirection === 'OUTBOUND' ? 'Terminating Telco / Destination Trunk' : 'Resolved PBX Extension'}
              </span>
            </div>
          </div>

          {/* Technical Root Cause Audit */}
          <div className="p-3.5 rounded-lg bg-navy-950/90 border border-navy-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              Technical Root Cause &amp; Signaling Audit
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">
              {report.l2Details.rootCauseTechnicalSummary}
            </p>
          </div>

          {/* Suggested Customer Resolution Note */}
          <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                Customer Resolution Note (Ready to Send to Customer / Jira)
              </span>
              <button
                onClick={handleCopyCustomerResolution}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-300 hover:text-white px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 transition-colors"
              >
                <Clipboard className="w-3 h-3" />
                <span>{copiedResolution ? 'Copied Note!' : 'Copy Note'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans bg-navy-950/60 p-2.5 rounded border border-navy-800">
              {report.l2Details.suggestedCustomerResolution}
            </p>
          </div>

          {/* Chronological Forensic Event Timeline */}
          {report.l2Details.chronologicalEvents && report.l2Details.chronologicalEvents.length > 0 && (
            <div className="border border-navy-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-navy-950/80 hover:bg-navy-950 text-left transition-colors text-xs font-semibold text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Chronological Forensic Timeline ({report.l2Details.chronologicalEvents.length} Signaling Events)</span>
                </div>
                {isTimelineExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isTimelineExpanded && (
                <div className="p-3 bg-navy-950/40 space-y-2 max-h-72 overflow-y-auto">
                  {report.l2Details.chronologicalEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-xs p-2 rounded bg-navy-900/60 border border-navy-800/80"
                    >
                      <span className="font-mono text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded shrink-0">
                        {ev.relativeOffset}
                      </span>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] text-slate-200">
                            {ev.eventName}
                          </span>
                          {ev.legUuid && (
                            <span className="text-[10px] font-mono text-slate-500 truncate">
                              leg: {ev.legUuid.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 text-[11px] leading-tight">
                          {ev.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VISUAL HOP DIAGRAM (With Parallel Forking Group) */}
      <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Interactive Call Flow &amp; Parallel Forking Topology
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any hop card to inspect directional telemetry
          </span>
        </div>

        {/* Flow Representation */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Sequential Hops (Caller -> Edge -> CPaaS) */}
          {sequentialHops.map((hop, idx) => {
            const isSelected = selectedHop?.hopIndex === hop.hopIndex && selectedHop?.nodeName === hop.nodeName;
            return (
              <React.Fragment key={`${hop.hopIndex}-${hop.nodeName}-${idx}`}>
                <div
                  onClick={() => handleSelectHop(hop)}
                  className={`relative flex flex-col justify-between p-3.5 rounded-xl border cursor-pointer transition-all min-w-[200px] flex-1 max-w-[260px] select-none ${
                    hop.isCulprit
                      ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/50'
                      : isSelected
                      ? 'bg-blue-950/40 border-blue-400 ring-1 ring-blue-400'
                      : 'bg-navy-950 hover:bg-navy-900 border-navy-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                      <div className="flex items-center gap-2">
                        {getHopTypeIcon(hop.hopType, hop.nodeName)}
                        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                          Hop {hop.hopIndex}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getHopStatusIcon(hop.status, hop.isCulprit)}
                        <span
                          className={`text-[10px] font-bold ${
                            hop.isCulprit
                              ? 'text-rose-400'
                              : hop.status === 'PASS'
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {hop.isCulprit ? 'CULPRIT' : hop.status}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="text-xs font-semibold text-white truncate" title={hop.label}>
                        {hop.label}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate" title={hop.nodeName}>
                        {hop.nodeName}
                      </div>
                      {hop.subLabel && (
                        <div className="text-[10px] text-slate-500 font-mono truncate pt-0.5">
                          {hop.subLabel}
                        </div>
                      )}
                      {(hop.vendor || hop.originPeer || hop.terminatedPeer) && (
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {hop.vendor && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30 truncate max-w-[120px]" title={`Vendor: ${hop.vendor}`}>
                              {hop.vendor}
                            </span>
                          )}
                          {(hop.originPeer || hop.terminatedPeer) && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[120px]" title={`Peer: ${hop.originPeer || hop.terminatedPeer}`}>
                              {hop.originPeer || hop.terminatedPeer}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Telemetry / Directional loss */}
                  <div className="pt-3 mt-2 border-t border-navy-800/80">
                    {hop.metrics ? (
                      <div className="space-y-1 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">MOS: </span>
                          <strong className={hop.metrics.mos! >= 3.8 ? 'text-emerald-400' : 'text-rose-400'}>
                            {hop.metrics.mos}
                          </strong>
                        </div>
                        {hop.metrics.isOneWayAudio ? (
                          <div className="text-rose-400 font-bold text-[9px] flex items-center gap-1">
                            <VolumeX className="w-3 h-3" /> ONE-WAY AUDIO
                          </div>
                        ) : (
                          <div className="flex justify-between text-slate-400 text-[9px]">
                            <span>Rx: {hop.metrics.rxPacketLossPct ?? hop.metrics.packetLossPct}%</span>
                            <span>Tx: {hop.metrics.txPacketLossPct ?? 0}%</span>
                          </div>
                        )}
                      </div>
                    ) : hop.sipCode ? (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-mono text-emerald-400">
                          SIP {hop.sipCode} {hop.sipReason}
                        </div>
                        {hop.hangupReason && (
                          <div className="text-[9px] text-slate-400 truncate max-w-[190px]" title={hop.hangupReason}>
                            Hangup: {hop.hangupReason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Core Routing</span>
                    )}
                  </div>
                </div>

                <div className="hidden lg:flex items-center text-slate-600 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </React.Fragment>
            );
          })}

          {/* PARALLEL FORKING CONTAINER (Multi-Leg Branches) */}
          {forkedHops.length > 0 && (
            <div className="flex-1 min-w-[300px] border border-indigo-500/30 rounded-2xl p-3 bg-indigo-950/10 space-y-2">
              <div className="flex items-center justify-between pb-1 px-1">
                <div className="flex items-center gap-1.5 text-indigo-300 text-[11px] font-semibold">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Parallel Forking (Simultaneous Ringing)</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono">
                  {forkedHops.length} Simultaneous Legs
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {forkedHops.map((hop, idx) => {
                  const isSelected = selectedHop?.legUuid === hop.legUuid;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectHop(hop)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        hop.isCulprit
                          ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/40'
                          : isSelected
                          ? 'bg-blue-950/50 border-blue-400 ring-1 ring-blue-400'
                          : 'bg-navy-950 hover:bg-navy-900 border-navy-800'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-navy-800">
                        <div className="flex items-center gap-1.5">
                          {getHopTypeIcon(hop.hopType, hop.nodeName)}
                          <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                            {hop.nodeName}
                          </span>
                        </div>
                        {getHopStatusIcon(hop.status, hop.isCulprit)}
                      </div>

                      <div className="pt-2 space-y-1">
                        <div className="text-[11px] text-slate-300 truncate" title={hop.label}>
                          {hop.label}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {hop.legUuid}
                        </div>
                        {(hop.vendor || hop.terminatedPeer) && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {hop.vendor && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                {hop.vendor}
                              </span>
                            )}
                            {hop.terminatedPeer && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {hop.terminatedPeer}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="pt-1">{getForkOutcomeBadge(hop.forkBranchOutcome)}</div>
                      </div>

                      {hop.forkOutcomeNote && (
                        <div className="pt-2 text-[10px] text-slate-400 leading-tight">
                          {hop.forkOutcomeNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SELECTED HOP DRILLDOWN (If clicked) */}
      {selectedHop && (
        <div
          ref={drilldownRef}
          className="bg-navy-900 border border-blue-500/40 rounded-xl p-4 shadow-sm animate-fade-in space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Hop {selectedHop.hopIndex} Diagnostic Inspection
              </span>
              <span className="text-xs font-semibold text-white">
                — {selectedHop.label} ({selectedHop.nodeName})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={scrollToTable}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
              >
                <span>Jump to Telemetry Table ↓</span>
              </button>
              <button
                onClick={() => setSelectedHop(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-navy-800 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div className="space-y-2 bg-navy-950 p-3 rounded-lg border border-navy-800">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase">Analysis Notes</h4>
              <ul className="space-y-1">
                {selectedHop.diagnosisNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 bg-navy-950 p-3 rounded-lg border border-navy-800 font-mono text-xs">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase">Directional Telemetry &amp; Signaling</h4>
              {selectedHop.legUuid && (
                <div>
                  <span className="text-slate-500">Leg UUID: </span>
                  <span className="text-slate-200">{selectedHop.legUuid}</span>
                </div>
              )}
              {selectedHop.vendor && (
                <div>
                  <span className="text-slate-500">Vendor / Node: </span>
                  <span className="text-blue-300 font-semibold">{selectedHop.vendor}</span>
                </div>
              )}
              {(selectedHop.originPeer || selectedHop.terminatedPeer) && (
                <div>
                  <span className="text-slate-500">{selectedHop.originPeer ? 'Origin Peer: ' : 'Terminated Peer: '}</span>
                  <span className="text-cyan-300">{selectedHop.originPeer || selectedHop.terminatedPeer}</span>
                </div>
              )}
              {selectedHop.legDirection && (
                <div>
                  <span className="text-slate-500">Leg Direction: </span>
                  <span className="text-purple-300 font-semibold">{selectedHop.legDirection}</span>
                </div>
              )}
              {selectedHop.sipCode && (
                <div>
                  <span className="text-slate-500">SIP Response: </span>
                  <span className="text-amber-400 font-bold">
                    {selectedHop.sipCode} {selectedHop.sipReason}
                  </span>
                </div>
              )}
              {selectedHop.hangupReason && (
                <div>
                  <span className="text-slate-500">Hangup Reason: </span>
                  <span className="text-rose-300 font-semibold">{selectedHop.hangupReason}</span>
                </div>
              )}
              {selectedHop.hangupDisposition && (
                <div>
                  <span className="text-slate-500">Disposition: </span>
                  <span className="text-slate-300">{selectedHop.hangupDisposition}</span>
                </div>
              )}
              {selectedHop.metrics ? (
                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                  <div>MOS: <strong className="text-emerald-400">{selectedHop.metrics.mos}</strong></div>
                  <div>RTT: <strong>{selectedHop.metrics.rttMs ?? 'N/A'}ms</strong></div>
                  <div>
                    <span className="text-cyan-400">Rx Loss (Down): </span>
                    <strong className={selectedHop.metrics.rxPacketLossPct! > 1 ? 'text-rose-400' : ''}>
                      {selectedHop.metrics.rxPacketLossPct}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-purple-400">Tx Loss (Up): </span>
                    <strong className={selectedHop.metrics.txPacketLossPct! > 1 ? 'text-rose-400' : ''}>
                      {selectedHop.metrics.txPacketLossPct}%
                    </strong>
                  </div>
                  <div>Rx Jitter: <strong>{selectedHop.metrics.rxJitterMs ?? selectedHop.metrics.jitterMs}ms</strong></div>
                  <div>Tx Jitter: <strong>{selectedHop.metrics.txJitterMs ?? 'N/A'}ms</strong></div>
                </div>
              ) : selectedHop.isSignalingOnly || selectedHop.hopType === 'CPAAS_CORE' ? (
                <div className="pt-2 text-[11px] font-sans text-slate-400 space-y-1">
                  <div className="text-blue-300 font-semibold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> SIP Signaling Control Plane
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    CPaaS Core evaluates agent routing, hunting, and dispatches parallel ring requests. In VoIP architecture, RTP voice media packets bypass this control node and flow directly or via SBC relay to the callee device.
                  </p>
                </div>
              ) : selectedHop.hopType === 'CALLER' ? (
                <div className="pt-2 text-[11px] font-sans text-slate-400 space-y-1">
                  <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> {report.callDirection === 'OUTBOUND' ? 'Originating Agent Endpoint' : 'Originating Carrier Trunk'}
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {report.callDirection === 'OUTBOUND'
                      ? `Originating agent client (${selectedHop.nodeName || 'Agent'}) dispatched SIP INVITE to CPaaS Outbound Routing Engine via Edge SBC (${report.l2Details?.edgeGateway || 'wdfvedge1'}).`
                      : `External telco carriers (Singtel, StarHub, mobile PSTN) typically do not transmit RTCP-XR quality reports to the receiving SBC. Voice packets are received and relayed by Edge SBC (${report.l2Details?.edgeGateway || 'wdfvedge1'}).`}
                  </p>
                </div>
              ) : selectedHop.hopType === 'EDGE_SBC' ? (
                <div className="pt-2 text-[11px] font-sans text-slate-400 space-y-1">
                  <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Edge SBC Media Relay
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    The SBC anchored the media session and bridged RTP packets between the external carrier and internal callee endpoint without packet loss.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* DIRECTIONAL METRICS COMPARISON TABLE */}
      <div ref={tableRef} className="bg-navy-900/60 border border-navy-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-navy-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Hop Directional Telemetry Matrix (Tx vs Rx)
            </h3>
            <span className="text-[11px] text-slate-500">
              Comparing uplink (agent mic) and downlink (agent speaker) packet transmission
            </span>
          </div>
        </div>

        {/* Telephony Architecture Guide Banner */}
        <div className="px-5 py-2.5 bg-navy-950/60 border-b border-navy-800 text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-blue-300 font-semibold">
            <Info className="w-3.5 h-3.5" /> Hop Telemetry Architecture:
          </span>
          {report.callDirection === 'OUTBOUND' ? (
            <>
              <span><strong>Hop 1 (Agent Endpoint):</strong> Originating agent WebRTC/SIP device measuring live mic/speaker QoS.</span>
              <span><strong>Hop 2 (Egress SBC):</strong> Edge session border controller routing media outbound.</span>
              <span><strong>Hop 3 (CPaaS Core):</strong> Outbound dial plan, least-cost routing (LCR), and signaling engine.</span>
              <span><strong>Hop 4 (Terminating Telco / Destination):</strong> External PSTN carrier / customer endpoint (no RTCP-XR reports).</span>
            </>
          ) : (
            <>
              <span><strong>Hop 1 (Carrier):</strong> PSTN telco trunks don't transmit RTCP-XR reports.</span>
              <span><strong>Hop 2 (Edge SBC):</strong> B2BUA media anchor bridging caller &amp; callee.</span>
              <span><strong>Hop 3 (CPaaS Core):</strong> Pure SIP signaling engine (evaluates routing/forking; no RTP media).</span>
              <span><strong>Hop 4 (Endpoint):</strong> Active WebRTC/SIP device measuring live mic/speaker QoS.</span>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-navy-950/80 text-slate-400 border-b border-navy-800 font-semibold text-[11px]">
                <th className="py-2.5 px-4">Hop</th>
                <th className="py-2.5 px-4">Node / Identity</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">MOS</th>
                <th className="py-2.5 px-4">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-cyan-400" />
                    <span>Rx Loss (Down)</span>
                  </div>
                </th>
                <th className="py-2.5 px-4">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3 text-purple-400" />
                    <span>Tx Loss (Up)</span>
                  </div>
                </th>
                <th className="py-2.5 px-4">Jitter</th>
                <th className="py-2.5 px-4">One-Way Audio?</th>
                <th className="py-2.5 px-4">Signaling / SIP</th>
                <th className="py-2.5 px-4">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60 text-slate-300 font-mono text-[11px]">
              {report.hops.map((hop, i) => (
                <tr
                  key={i}
                  className={`hover:bg-navy-800/40 transition-colors ${
                    hop.isCulprit ? 'bg-rose-950/20' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-white">Hop {hop.hopIndex}</td>
                  <td className="py-3 px-4 text-slate-200">
                    <div className="font-sans font-semibold text-xs text-white">{hop.label}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span>{hop.nodeName}</span>
                      {hop.vendor && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-indigo-300 border border-indigo-500/20 font-sans font-medium">
                          {hop.vendor}
                        </span>
                      )}
                      {(hop.terminatedPeer || hop.originPeer) && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                          {hop.terminatedPeer ? `Term: ${hop.terminatedPeer}` : `Orig: ${hop.originPeer}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-sans">
                    {hop.isSignalingOnly || hop.hopType === 'CPAAS_CORE' ? (
                      <span className="text-blue-300 font-medium">CPAAS_CORE (SIGNALING)</span>
                    ) : (
                      hop.hopType
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.metrics?.mos !== undefined ? (
                      <span
                        className={`font-bold ${
                          hop.metrics.jitterMs && hop.metrics.jitterMs >= 40
                            ? 'text-amber-300'
                            : hop.metrics.mos >= 3.8
                            ? 'text-emerald-400'
                            : hop.metrics.mos >= 3.1
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                        title={
                          hop.metrics.jitterMs && hop.metrics.jitterMs >= 40
                            ? `Reported MOS is ${hop.metrics.mos.toFixed(2)}, but voice suffered severe lag/delay due to ${hop.metrics.jitterMs}ms jitter`
                            : undefined
                        }
                      >
                        {hop.metrics.mos.toFixed(2)}
                        {hop.metrics.jitterMs && hop.metrics.jitterMs >= 40 && (
                          <span className="ml-1 text-[9px] font-sans font-normal text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1 rounded">
                            Lag
                          </span>
                        )}
                      </span>
                    ) : hop.isSignalingOnly || hop.hopType === 'CPAAS_CORE' ? (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20"
                        title="Control Plane: CPaaS Core manages SIP signaling (INVITE/RINGING/BYE). RTP voice media does not pass through this node."
                      >
                        Signaling Plane
                      </span>
                    ) : hop.hopType === 'CALLER' ? (
                      <span className="text-[10px] text-slate-500 font-sans italic" title="External carrier PSTN/ISDN trunk did not transmit RTCP-XR stream telemetry to SBC">
                        {report.callDirection === 'OUTBOUND' ? 'Agent Endpoint' : 'Carrier Trunk (No RTCP)'}
                      </span>
                    ) : hop.hopType === 'EDGE_SBC' ? (
                      <span className="text-[10px] text-slate-500 font-sans italic" title="Edge SBC bridged RTP media relay without separate RTCP logging">
                        SBC Relay
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.metrics?.rxPacketLossPct !== undefined ? (
                      <span className={hop.metrics.rxPacketLossPct > 1.0 ? 'text-rose-400 font-bold' : ''}>
                        {hop.metrics.rxPacketLossPct}%
                      </span>
                    ) : hop.isSignalingOnly || hop.hopType === 'CPAAS_CORE' ? (
                      <span className="text-slate-500 font-sans text-[10px]" title="No RTP media stream on signaling plane">N/A (Control)</span>
                    ) : hop.hopType === 'CALLER' ? (
                      <span className="text-slate-500 font-sans text-[10px]" title="Carrier trunk did not provide RTCP packet loss report">No RTCP</span>
                    ) : hop.hopType === 'EDGE_SBC' ? (
                      <span className="text-slate-500 font-sans text-[10px]" title="SBC media relay bridged without separate packet loss count">Relayed</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.metrics?.txPacketLossPct !== undefined ? (
                      <span className={hop.metrics.txPacketLossPct > 1.0 ? 'text-rose-400 font-bold' : ''}>
                        {hop.metrics.txPacketLossPct}%
                      </span>
                    ) : hop.isSignalingOnly || hop.hopType === 'CPAAS_CORE' ? (
                      <span className="text-slate-500 font-sans text-[10px]" title="No RTP media stream on signaling plane">N/A (Control)</span>
                    ) : hop.hopType === 'CALLER' ? (
                      <span className="text-slate-500 font-sans text-[10px]" title="Carrier trunk did not provide RTCP packet loss report">No RTCP</span>
                    ) : hop.hopType === 'EDGE_SBC' ? (
                      <span className="text-slate-500 font-sans text-[10px]" title="SBC media relay bridged without separate packet loss count">Relayed</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.metrics?.jitterMs !== undefined ? (
                      <span
                        className={`font-semibold ${
                          hop.metrics.jitterMs >= 40
                            ? 'text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30'
                            : hop.metrics.jitterMs >= 20
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                        title={
                          hop.metrics.jitterMs >= 40
                            ? `Critical Jitter (${hop.metrics.jitterMs}ms >= 40ms threshold): severe packet arrival delay variance`
                            : undefined
                        }
                      >
                        {hop.metrics.jitterMs}ms
                      </span>
                    ) : hop.isSignalingOnly || hop.hopType === 'CPAAS_CORE' ? (
                      <span className="text-slate-500 font-sans text-[10px]">N/A</span>
                    ) : hop.hopType === 'CALLER' ? (
                      <span className="text-slate-500 font-sans text-[10px]">No RTCP</span>
                    ) : hop.hopType === 'EDGE_SBC' ? (
                      <span className="text-slate-500 font-sans text-[10px]">Relayed</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.isSignalingOnly || hop.hopType === 'CPAAS_CORE' ? (
                      <span className="text-slate-500 font-sans text-[10px]">N/A</span>
                    ) : hop.metrics?.isOneWayAudio ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        🚨 YES
                      </span>
                    ) : (
                      <span className="text-slate-500">No</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.sipCode ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            hop.sipCode === 200
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : hop.sipCode === 486 || hop.sipCode >= 500
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {hop.sipReason
                            ? hop.sipReason.startsWith(String(hop.sipCode))
                              ? hop.sipReason
                              : `${hop.sipCode} ${hop.sipReason}`
                            : hop.sipCode}
                        </span>
                        {hop.hangupReason && (
                          <span className="text-[9px] text-slate-400 font-sans truncate max-w-[150px]" title={hop.hangupReason}>
                            Reason: {hop.hangupReason}
                          </span>
                        )}
                      </div>
                    ) : hop.hangupReason ? (
                      <span className="text-[10px] text-slate-400 font-sans">
                        {hop.hangupReason}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {hop.isCulprit ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                        CULPRIT
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          hop.status === 'PASS'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : hop.status === 'WARN'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {hop.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
    ) : (
      <div className="bg-navy-900/40 border border-dashed border-navy-750/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 my-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-sm">
          <Search className="w-6 h-6 text-blue-400" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="text-sm font-semibold text-white">No Call Telemetry Loaded</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter a Call TXN UUID above and click <span className="text-blue-300 font-medium">Diagnose Call</span>, or click <span className="text-blue-300 font-medium">Paste Raw JSON</span> from B3 Network logs to inspect hop-by-hop latency, jitter, packet loss, and call termination telemetry.
          </p>
        </div>
      </div>
    )}

      {/* RAW JSON MODAL */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-750 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  Paste Raw B3 Call Log / Quality JSON
                </h3>
              </div>
              <button
                onClick={() => setIsJsonModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Open your browser Network tab when viewing the call on B3 Portal, copy the response body from the TXN API request, and paste it here:
            </p>

            <textarea
              value={rawJsonInput}
              onChange={(e) => setRawJsonInput(e.target.value)}
              placeholder='{\n  "txnUuid": "01a180c5-4cf8-74ef-9cf2-e3bb9de3853f",\n  "durationSeconds": 8.4,\n  "legs": [...]\n}'
              className="w-full h-48 bg-navy-950 border border-navy-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsJsonModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-750 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteJsonAnalyze}
                disabled={!rawJsonInput.trim()}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                Analyze JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B3 SESSION AUTH MODAL */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-750 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  B3 Portal Session Authentication
                </h3>
              </div>
              <button
                onClick={() => setIsSessionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                The Call Quality Inspector automatically shares the session token authenticated via{' '}
                <strong className="text-white">B3Networks Portal</strong>.
              </p>
              <p className="text-slate-400">
                Sign in with your corporate B3 credentials or Google SSO to connect and fetch live SIEM call forensics.
              </p>
            </div>

            {sessionError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                {sessionError}
              </div>
            )}

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
              <div className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
                Option 1: Interactive Desktop Login
              </div>
              <button
                type="button"
                disabled={sessionSaving}
                onClick={handleOpenB3Login}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-lg hover:shadow-blue-900/40 disabled:opacity-50"
              >
                {sessionSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Waiting for login completion...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-amber-300" />
                    <span>Open B3Networks Login (Google SSO)</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-navy-800"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider">
                Option 2: Direct Token / cURL Paste
              </span>
              <div className="flex-grow border-t border-navy-800"></div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 block">
                Paste raw <code className="text-emerald-400 font-mono">sessionToken</code> or full B3 <code className="text-emerald-400 font-mono">_query</code> cURL:
              </label>
              <textarea
                value={manualSessionInput}
                onChange={(e) => setManualSessionInput(e.target.value)}
                placeholder="e.g. 206b0d912... or curl 'https://portal.b3networks.com/_a/...' -H 'cookie: sessionToken=...'"
                rows={3}
                className="w-full rounded-lg bg-navy-950 border border-navy-750 px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                disabled={sessionSaving || !manualSessionInput.trim()}
                onClick={handleSaveManualSession}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Save Session & Connect</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-navy-800">
              <span className="text-[11px] text-slate-500">
                Stored securely in macOS Keychain
              </span>
              <button
                onClick={() => setIsSessionModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-750 text-xs text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
