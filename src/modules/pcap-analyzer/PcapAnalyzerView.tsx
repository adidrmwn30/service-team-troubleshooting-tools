import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileSearch,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Radio,
  FileText,
  Copy,
  Check,
  FolderGit2,
  ArrowRight,
  Info,
  Clock,
  Layers,
  ShieldCheck,
  Cpu,
  Terminal,
  GitCompare,
  Tag,
  Shield,
  Zap,
  Plus,
  Trash2,
  AlertCircle,
  Server,
  Laptop,
  Router,
} from 'lucide-react';
import {
  parsePcapArrayBuffer,
  ParsedPcapResult,
  ParsedSipPacket,
  SipCallSession,
} from './services/pcapParser';
import {
  PCAP_SAMPLE_PRESETS,
  PcapPresetScenario,
  DEMARCATION_LAN_SAMPLE,
} from './services/pcapPresets';
import {
  compareDualPcapTraces,
  DemarcationComparisonResult,
} from './services/dualTraceComparator';
import {
  auditCaptureReadiness,
  CAPTURE_RECIPES,
  CaptureRecipe,
} from './services/captureToolkit';
import { useWorkbench } from '../../shared/context/WorkbenchContext';
import { InvestigationService } from '../investigation-center/services/investigationService';

export const PcapAnalyzerView: React.FC = () => {
  const { setActiveTab, setActiveCaseId, refreshInvestigations } = useWorkbench();

  // State
  const [activePresetId, setActivePresetId] = useState<string>('completed-clean-call');
  const [parsedData, setParsedData] = useState<ParsedPcapResult | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedPacket, setSelectedPacket] = useState<ParsedSipPacket | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<
    'ladder' | 'rtp' | 'rca' | 'demarcation' | 'toolkit'
  >('ladder');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRca, setCopiedRca] = useState<boolean>(false);
  const [forwardedSuccess, setForwardedSuccess] = useState<boolean>(false);
  const [copiedRecipeIndex, setCopiedRecipeIndex] = useState<number | null>(null);

  // IP Role / Alias Annotator State
  const [ipAliases, setIpAliases] = useState<Record<string, string>>({
    '172.21.66.206': 'Carrier Ingress SBC',
    '172.21.165.110': 'CPaaS Media Gateway',
    '35.240.164.189': 'Customer Asterisk PBX',
    '10.0.8.2': 'Customer IP Phone (LAN)',
    '203.0.113.88': 'Provider Edge SBC',
  });
  const [showAliasModal, setShowAliasModal] = useState<boolean>(false);
  const [newAliasIp, setNewAliasIp] = useState<string>('');
  const [newAliasLabel, setNewAliasLabel] = useState<string>('');

  // Dual-Trace Demarcation Comparison State
  const [traceA, setTraceA] = useState<ParsedPcapResult | null>(DEMARCATION_LAN_SAMPLE);
  const [traceB, setTraceB] = useState<ParsedPcapResult | null>(PCAP_SAMPLE_PRESETS[3].data); // Preset 4: 30s ACK timeout
  const [traceALabel, setTraceALabel] = useState<string>('Customer LAN Handset (Leg A)');
  const [traceBLabel, setTraceBLabel] = useState<string>('Provider SBC WAN (Leg B)');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const traceAInputRef = useRef<HTMLInputElement>(null);
  const traceBInputRef = useRef<HTMLInputElement>(null);

  // Initialize with the first preset
  useEffect(() => {
    loadPreset(PCAP_SAMPLE_PRESETS[0]);
  }, []);

  const loadPreset = (preset: PcapPresetScenario) => {
    setIsLoading(true);
    setErrorMessage(null);
    setActivePresetId(preset.id);
    setSelectedPacket(null);
    setForwardedSuccess(false);

    try {
      setParsedData(preset.data);
      if (preset.id === 'ack-timeout-30s-drop') {
        setTraceA(DEMARCATION_LAN_SAMPLE);
        setTraceALabel('Customer LAN Handset (Leg A)');
        setTraceB(preset.data);
        setTraceBLabel('Provider SBC WAN (Leg B)');
      } else {
        setTraceB(preset.data);
        setTraceBLabel(`Trace B (Preset): ${preset.name}`);
      }

      if (preset.data.sessions.length > 0) {
        setSelectedSessionId(preset.data.sessions[0].callId);
        if (preset.data.sessions[0].packets.length > 0) {
          setSelectedPacket(preset.data.sessions[0].packets[0]);
        }
      }
    } catch (err: any) {
      setErrorMessage(`Failed to load preset scenario: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const MAX_PCAP_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB maximum for client-side memory safety

  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (file.size > MAX_PCAP_SIZE_BYTES) {
      setErrorMessage(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum in-memory limit (100 MB). Please filter or truncate the capture in Wireshark/tcpdump first.`);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setActivePresetId('custom');
    setSelectedPacket(null);
    setForwardedSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('Selected file is empty.');
        }

        const result = parsePcapArrayBuffer(buffer, file.name);
        setParsedData(result);

        // Automatically update Demarcation Trace B with the uploaded PCAP
        setTraceB(result);
        setTraceBLabel(`Trace B (Active): ${file.name}`);

        if (result.sessions.length > 0) {
          setSelectedSessionId(result.sessions[0].callId);
          if (result.sessions[0].packets.length > 0) {
            setSelectedPacket(result.sessions[0].packets[0]);
          }
        }
      } catch (err: any) {
        setErrorMessage(`PCAP Parse Error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDualFileUpload = (file: File, isLegA: boolean) => {
    if (!file) return;
    if (file.size > MAX_PCAP_SIZE_BYTES) {
      setErrorMessage(`Boundary trace file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 100 MB limit.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parsePcapArrayBuffer(buffer, file.name);
        if (isLegA) {
          setTraceA(result);
          setTraceALabel(`Trace A: ${file.name}`);
        } else {
          setTraceB(result);
          setTraceBLabel(`Trace B: ${file.name}`);
        }
      } catch (err: any) {
        setErrorMessage(`Failed parsing boundary trace: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const closeCurrentPcap = () => {
    setParsedData(null);
    setActivePresetId('');
    setSelectedSessionId('');
    setSelectedPacket(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearTraceA = () => {
    setTraceA(null);
    setTraceALabel('No file loaded');
    if (traceAInputRef.current) {
      traceAInputRef.current.value = '';
    }
  };

  const clearTraceB = () => {
    setTraceB(null);
    setTraceBLabel('No file loaded');
    if (traceBInputRef.current) {
      traceBInputRef.current.value = '';
    }
  };

  const setTraceAFromActive = () => {
    if (!parsedData) return;
    setTraceA(parsedData);
    setTraceALabel(`Trace A (Active): ${parsedData.filename}`);
  };

  const setTraceBFromActive = () => {
    if (!parsedData) return;
    setTraceB(parsedData);
    setTraceBLabel(`Trace B (Active): ${parsedData.filename}`);
  };

  const loadDefaultDemarcationPair = () => {
    setTraceA(DEMARCATION_LAN_SAMPLE);
    setTraceALabel('Customer LAN Handset (Leg A)');
    setTraceB(PCAP_SAMPLE_PRESETS[3].data);
    setTraceBLabel('Provider SBC WAN (Leg B)');
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const activeSession: SipCallSession | undefined =
    parsedData?.sessions.find((s) => s.callId === selectedSessionId) ||
    parsedData?.sessions[0];

  const hasCritical = Boolean(parsedData?.detectedIssues.some((a) => a.severity === 'CRITICAL'));
  const hasWarning = Boolean(parsedData?.detectedIssues.some((a) => a.severity === 'WARNING'));
  const isCallRejected = Boolean(
    activeSession?.status === 'REJECTED' ||
    activeSession?.status === 'FAILED' ||
    (activeSession?.finalResponseCode !== undefined && activeSession.finalResponseCode >= 400)
  );

  // Audit readiness of current capture
  const readinessAudit = useMemo(() => {
    if (!parsedData) return null;
    return auditCaptureReadiness(parsedData);
  }, [parsedData]);

  // Demarcation result computation
  const demarcationResult: DemarcationComparisonResult | null = useMemo(() => {
    if (traceA && traceB) {
      return compareDualPcapTraces(traceA, traceB, traceALabel, traceBLabel);
    }
    return null;
  }, [traceA, traceB, traceALabel, traceBLabel]);

  // IP Label resolver
  const getIpLabel = (ip: string) => {
    if (!ip) return 'N/A';
    return ipAliases[ip] ? `${ipAliases[ip]} (${ip})` : ip;
  };

  const handleAddAlias = () => {
    if (!newAliasIp.trim() || !newAliasLabel.trim()) return;
    setIpAliases((prev) => ({
      ...prev,
      [newAliasIp.trim()]: newAliasLabel.trim(),
    }));
    setNewAliasIp('');
    setNewAliasLabel('');
  };

  const handleRemoveAlias = (ip: string) => {
    setIpAliases((prev) => {
      const next = { ...prev };
      delete next[ip];
      return next;
    });
  };

  const handleCopyRecipe = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedRecipeIndex(idx);
    setTimeout(() => setCopiedRecipeIndex(null), 2500);
  };

  const handleCopyRca = () => {
    if (!parsedData) return;
    const session = activeSession;
    const text = `=== PCAP FORENSIC DISSECTION REPORT ===
File: ${parsedData.filename} (${(parsedData.fileSizeBytes / 1024).toFixed(1)} KB)
Total Packets: ${parsedData.totalPackets} | SIP Messages: ${parsedData.sipPacketCount} | RTP Streams: ${parsedData.rtpStreams.length}
Call-ID: ${session?.callId || 'N/A'}
From: ${session?.from || 'N/A'}
To: ${session?.to || 'N/A'}
Status: ${session?.status || 'N/A'}
Caller IP: ${getIpLabel(session?.callerIp || '')}
Callee IP: ${getIpLabel(session?.calleeIp || '')}

[DETECTED ISSUES & DEFECTS]
${
  parsedData.detectedIssues.length > 0
    ? parsedData.detectedIssues
        .map((a) => `- [${a.severity}] ${a.title}: ${a.description} -> Action: ${a.suggestedAction}`)
        .join('\n')
    : '- No anomalies detected. Clean transaction.'
}

[RTP MEDIA TELEMETRY]
${
  parsedData.rtpStreams.length > 0
    ? parsedData.rtpStreams
        .map(
          (r) =>
            `${r.ssrcHex}: ${getIpLabel(r.srcIp)}:${r.srcPort} -> ${getIpLabel(r.dstIp)}:${r.dstPort} (${r.codecName}) | Packets: ${r.packetCount} | Loss: ${r.lossPct.toFixed(1)}% | Max Jitter: ${r.maxJitterMs.toFixed(1)}ms`
        )
        .join('\n')
    : 'No RTP packets detected in capture.'
}
`;
    navigator.clipboard.writeText(text);
    setCopiedRca(true);
    setTimeout(() => setCopiedRca(false), 2500);
  };

  const handleSendToInvestigationCenter = () => {
    if (!parsedData) return;
    const session = activeSession;
    const hasCrit = hasCritical || isCallRejected;

    const newCase = InvestigationService.createInvestigation({
      title: `PCAP Forensic: ${session?.callId ? session.callId.slice(0, 24) : parsedData.filename}`,
      status: hasCrit ? 'IN_PROGRESS' : 'OPEN',
      ticketId: `TCK-${Date.now().toString().slice(-5)}`,
      customerIdentifier: 'Customer VoIP Trunk',
      txnUuid: session?.callId || `pcap-${Date.now()}`,
      evidenceReferences: [
        {
          id: `ev-pcap-${Date.now().toString().slice(-4)}`,
          evidenceType: 'CALL_FORENSICS',
          source: `PCAP Analyzer (${parsedData.filename})`,
          referenceId: session?.callId || parsedData.filename,
          timestamp: new Date().toISOString(),
          title: `Packet Capture: ${parsedData.filename}`,
          summary: `Capture file with ${parsedData.totalPackets} packets. SIP messages: ${parsedData.sipPacketCount}, RTP streams: ${parsedData.rtpStreams.length}. Issues detected: ${parsedData.detectedIssues.length}.`,
        },
      ],
      findings: parsedData.detectedIssues.map((a, idx) => ({
        id: `find-${idx + 1}`,
        category: (a.title.toLowerCase().includes('codec')
          ? 'SIP_SIGNALING'
          : a.title.toLowerCase().includes('audio') || a.title.toLowerCase().includes('rtp')
          ? 'RTP_MEDIA'
          : 'ENDPOINT_NAT') as any,
        description: `${a.title}: ${a.description}. Recommendation: ${a.suggestedAction}`,
        verifiedFact: true,
        isHypothesis: false,
      })),
      rcaSummary: {
        faultDomain: hasCrit ? 'CUSTOMER_PREMISE_ENDPOINT' : 'NOMINAL',
        technicalSummary: `PCAP dissection of ${parsedData.filename} revealed ${
          parsedData.detectedIssues.length
        } defect(s). ${
          parsedData.detectedIssues.length > 0
            ? parsedData.detectedIssues.map((a) => a.title).join('; ')
            : 'Signaling and media streams were clean and within nominal bounds.'
        }`,
        customerFacingSummary:
          parsedData.detectedIssues.length > 0
            ? `Deep packet capture analysis identified: ${parsedData.detectedIssues[0].title}. Please consult with your network and PBX administrator regarding the recommended configurations.`
            : 'Deep packet inspection confirmed all signaling and RTP audio streams behaved normally without packet loss or SIP drops.',
        actionItems:
          parsedData.detectedIssues.length > 0
            ? parsedData.detectedIssues.map((a) => a.suggestedAction)
            : ['No action required. Telemetry confirmed clean nominal call signaling.'],
      },
    });

    setForwardedSuccess(true);
    refreshInvestigations();
    setTimeout(() => {
      setActiveCaseId(newCase.id);
      setActiveTab('investigation-center');
    }, 1200);
  };

  // Collect all unique IPs in current capture for quick-alias button
  const activeIps = useMemo(() => {
    if (!parsedData) return [];
    const set = new Set<string>();
    parsedData.sessions.forEach((s) => {
      if (s.callerIp) set.add(s.callerIp);
      if (s.calleeIp) set.add(s.calleeIp);
      s.packets.forEach((p) => {
        if (p.srcIp) set.add(p.srcIp);
        if (p.dstIp) set.add(p.dstIp);
      });
    });
    return Array.from(set).filter(Boolean);
  }, [parsedData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pcap,.pcapng,.cap"
        className="hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
      />
      <input
        ref={traceAInputRef}
        type="file"
        accept=".pcap,.pcapng,.cap"
        className="hidden"
        onChange={(e) => e.target.files && handleDualFileUpload(e.target.files[0], true)}
      />
      <input
        ref={traceBInputRef}
        type="file"
        accept=".pcap,.pcapng,.cap"
        className="hidden"
        onChange={(e) => e.target.files && handleDualFileUpload(e.target.files[0], false)}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-bold text-slate-100">
              PCAP Forensic & Demarcation Dissection Lab
            </h1>
            <span className="text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
              Full Dual-Plane Analyzer
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Client-side binary PCAP/PCAPNG parser, SIP transaction state-machine, RFC 3550 RTP jitter engine, and dual-trace boundary comparator.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAliasModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-navy-900/60 hover:bg-navy-800 text-slate-200 text-xs font-medium transition-colors shadow-sm"
          >
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            <span>IP Role Aliases ({Object.keys(ipAliases).length})</span>
          </button>

          <button
            onClick={() => setActiveViewTab('toolkit')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/40 text-purple-300 text-xs font-medium transition-colors shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Capture Toolkit</span>
          </button>
        </div>
      </div>

      {/* Preset Scenarios Selector */}
      <div className="bg-navy-900/40 border border-surface-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              VoIP Incident Presets
            </span>
            <span className="text-[10px] text-slate-400">
              (Instant reproduction of common carrier & PBX defects)
            </span>
          </div>
          {parsedData && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                Active: <span className="text-purple-300 font-semibold">{parsedData.filename}</span>
              </span>
              <button
                onClick={closeCurrentPcap}
                title="Close and unload current PCAP"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/50 text-[11px] font-medium transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Close PCAP</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PCAP_SAMPLE_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-sm ring-1 ring-purple-500/20'
                    : 'bg-navy-950/40 border-navy-750 hover:border-slate-600/60 hover:bg-navy-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-200">
                    {preset.name}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-surface-border bg-navy-900/30 hover:border-slate-600'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex items-center justify-center gap-3">
          <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-purple-400' : 'text-slate-400'}`} />
          <span className="text-xs text-slate-300 font-medium">
            Drag & Drop any binary <code className="text-purple-300 font-mono">.pcap</code> or <code className="text-purple-300 font-mono">.pcapng</code> capture file here, or click to browse
          </span>
          <span className="text-[11px] text-slate-500">
            • Processed 100% locally in browser memory (zero cloud uploads)
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Top Metrics Cards */}
      {parsedData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-navy-900/70 border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Packets</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {parsedData.totalPackets.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              File size: <span className="font-mono text-purple-300">{(parsedData.fileSizeBytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          <div className="bg-navy-900/70 border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>SIP Transactions</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {parsedData.sessions.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {parsedData.sipPacketCount} SIP signaling frames
            </div>
          </div>

          <div className="bg-navy-900/70 border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>RTP Audio Streams</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {parsedData.rtpStreams.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {parsedData.rtpStreams.reduce((acc, s) => acc + s.packetCount, 0).toLocaleString()} RTP media packets
            </div>
          </div>

          <div className="bg-navy-900/70 border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Diagnosis Status</span>
              {hasCritical || isCallRejected ? (
                <XCircle className="w-4 h-4 text-rose-400" />
              ) : hasWarning || activeSession?.status === 'CANCELLED' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1">
              {hasCritical || isCallRejected ? (
                <span className="text-rose-400">
                  {activeSession?.finalResponseCode
                    ? `Call Rejected (SIP ${activeSession.finalResponseCode})`
                    : 'Critical Defect'}
                </span>
              ) : hasWarning || activeSession?.status === 'CANCELLED' ? (
                <span className="text-amber-400">
                  {activeSession?.status === 'CANCELLED' ? 'Call Cancelled' : 'Anomalies Detected'}
                </span>
              ) : (
                <span className="text-emerald-400">Healthy Transaction</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{parsedData.detectedIssues.length} issue(s) identified</span>
              {readinessAudit && readinessAudit.rtpStreamCount === 0 && (
                <span className="text-[10px] text-amber-300 font-mono">Signaling-Only</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-surface-border pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveViewTab('ladder')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
              activeViewTab === 'ladder'
                ? 'bg-navy-900 text-purple-300 border-t-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SIP Ladder Sequence Flow ({activeSession?.packets.length || 0})
          </button>
          <button
            onClick={() => setActiveViewTab('rtp')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
              activeViewTab === 'rtp'
                ? 'bg-navy-900 text-purple-300 border-t-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RTP Media Streams ({parsedData?.rtpStreams.length || 0})
          </button>
          <button
            onClick={() => setActiveViewTab('rca')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
              activeViewTab === 'rca'
                ? 'bg-navy-900 text-purple-300 border-t-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RCA & Defect Verdict ({parsedData?.detectedIssues.length || 0})
          </button>
          <button
            onClick={() => setActiveViewTab('demarcation')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all flex items-center gap-1.5 ${
              activeViewTab === 'demarcation'
                ? 'bg-navy-900 text-purple-300 border-t-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Dual-Trace Demarcation (A/B Diff)</span>
          </button>
          <button
            onClick={() => setActiveViewTab('toolkit')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all flex items-center gap-1.5 ${
              activeViewTab === 'toolkit'
                ? 'bg-navy-900 text-purple-300 border-t-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Capture Toolkit</span>
          </button>
        </div>

        {/* Copy Report Button */}
        {activeViewTab === 'rca' && parsedData && (
          <button
            onClick={handleCopyRca}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-navy-900/60 hover:bg-navy-800 text-slate-200 text-xs font-medium transition-colors"
          >
            {copiedRca ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRca ? 'Copied Forensic Report' : 'Copy Forensic RCA'}</span>
          </button>
        )}
      </div>

      {/* Empty State when no PCAP is loaded in ladder/rtp/rca tabs */}
      {!parsedData && (activeViewTab === 'ladder' || activeViewTab === 'rtp' || activeViewTab === 'rca') && (
        <div className="bg-navy-900/40 border border-surface-border rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
            <FileSearch className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">No PCAP Trace Loaded</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Upload a <code className="text-purple-300 font-mono">.pcap</code> or <code className="text-purple-300 font-mono">.pcapng</code> file above, or select an incident preset to analyze signaling ladders, RTP media jitter, and root cause evidence.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload PCAP File</span>
            </button>
            <button
              onClick={() => loadPreset(PCAP_SAMPLE_PRESETS[0])}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 border border-surface-border transition-all"
            >
              <span>Load Normal Call Preset</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: SIP LADDER SEQUENCE FLOW */}
      {/* ============================================================== */}
      {activeViewTab === 'ladder' && parsedData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ladder Sequence Visualizer */}
          <div className="lg:col-span-2 bg-navy-900/50 border border-surface-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Interactive SIP Signaling Sequence
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Click any message to inspect headers & SDP
              </span>
            </div>

            {/* Endpoints Header Bar */}
            {activeSession && (
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-navy-800 text-center">
                <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-750">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Caller Endpoint
                  </div>
                  <div className="text-xs font-mono text-purple-300 font-semibold truncate mt-0.5">
                    {getIpLabel(activeSession.callerIp)}
                  </div>
                </div>
                <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-750">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Callee / SIP Proxy
                  </div>
                  <div className="text-xs font-mono text-blue-300 font-semibold truncate mt-0.5">
                    {getIpLabel(activeSession.calleeIp)}
                  </div>
                </div>
              </div>
            )}

            {/* Ladder Messages List */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2">
              {activeSession && activeSession.packets.length > 0 ? (
                activeSession.packets.map((pkt) => {
                  const isSelected = selectedPacket?.packetNumber === pkt.packetNumber;
                  const isError = pkt.statusCode && pkt.statusCode >= 400;
                  const isSuccess = pkt.statusCode && pkt.statusCode >= 200 && pkt.statusCode < 300;
                  const is1xx = pkt.statusCode && pkt.statusCode < 200;

                  return (
                    <div
                      key={pkt.packetNumber}
                      onClick={() => setSelectedPacket(pkt)}
                      className={`relative cursor-pointer p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-purple-950/30 border-purple-500/60 shadow-md ring-1 ring-purple-500/30'
                          : 'bg-navy-950/50 border-navy-800 hover:border-slate-600 hover:bg-navy-800/40'
                      }`}
                    >
                      {/* Top Message Meta */}
                      <div className="flex items-center justify-between text-[11px] mb-1.5 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-semibold">#{pkt.packetNumber}</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            +{pkt.relativeTimeMs.toFixed(1)} ms
                          </span>
                        </div>
                        <span className="text-slate-500 text-[10px]">
                          CSeq: {pkt.cseq || 'N/A'}
                        </span>
                      </div>

                      {/* Directional Visual Arrow Bar */}
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] font-mono text-slate-400 w-28 truncate text-right">
                          {ipAliases[pkt.srcIp] || pkt.srcIp}
                        </div>

                        <div className="flex-1 flex items-center justify-center relative">
                          <div
                            className={`h-0.5 w-full rounded ${
                              isError
                                ? 'bg-rose-500'
                                : isSuccess
                                ? 'bg-emerald-500'
                                : is1xx
                                ? 'bg-cyan-500'
                                : 'bg-purple-500'
                            }`}
                          />
                          <div
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold tracking-tight border shadow-sm z-10 ${
                              isError
                                ? 'bg-rose-950 text-rose-300 border-rose-500/60'
                                : isSuccess
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                                : is1xx
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                                : 'bg-navy-900 text-purple-200 border-purple-500/50'
                            }`}
                          >
                            {pkt.methodOrResponse}
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-slate-400 w-28 truncate text-left">
                          {ipAliases[pkt.dstIp] || pkt.dstIp}
                        </div>
                      </div>

                      {/* Codec / SDP Footnote */}
                      {pkt.sdp && (
                        <div className="mt-2 text-[10px] font-mono text-purple-300/80 bg-purple-950/20 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-2">
                          <span>SDP Audio: Port {pkt.sdp.audioPort || pkt.sdp.port}</span>
                          <span>•</span>
                          <span>Codecs: {pkt.sdp.codecs.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No SIP signaling packets identified in this session.
                </div>
              )}
            </div>
          </div>

          {/* Packet Header & Raw Dissector Inspector */}
          <div className="bg-navy-900/50 border border-surface-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Packet Header Dissection
                </span>
              </div>
              {selectedPacket && (
                <span className="text-[11px] font-mono text-purple-300">
                  Frame #{selectedPacket.packetNumber}
                </span>
              )}
            </div>

            {selectedPacket ? (
              <div className="space-y-4 text-xs">
                {/* Meta Summary */}
                <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Method/Code:</span>
                    <span className="font-bold text-slate-100">{selectedPacket.methodOrResponse}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Source:</span>
                    <span className="text-purple-300 truncate max-w-[180px]">
                      {getIpLabel(selectedPacket.srcIp)}:{selectedPacket.srcPort}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="text-blue-300 truncate max-w-[180px]">
                      {getIpLabel(selectedPacket.dstIp)}:{selectedPacket.dstPort}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Relative Offset:</span>
                    <span className="text-slate-300">+{selectedPacket.relativeTimeMs.toFixed(2)} ms</span>
                  </div>
                  {selectedPacket.userAgent && (
                    <div className="flex justify-between pt-1 border-t border-navy-800">
                      <span className="text-slate-400">Software / PBX:</span>
                      <span className="text-amber-300 truncate max-w-[170px]" title={selectedPacket.userAgent}>
                        {selectedPacket.userAgent}
                      </span>
                    </div>
                  )}
                </div>

                {/* Raw SIP Payload */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">
                    Raw SIP Payload Datagram:
                  </div>
                  <pre className="p-3 bg-navy-950 rounded-lg border border-navy-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed whitespace-pre-wrap select-all">
                    {selectedPacket.rawPayload}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs">
                Select a message on the sequence ladder to dissect headers.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: RTP MEDIA STREAMS */}
      {/* ============================================================== */}
      {activeViewTab === 'rtp' && parsedData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parsedData && parsedData.rtpStreams.length > 0 ? (
              parsedData.rtpStreams.map((stream, idx) => (
                <div
                  key={idx}
                  className="bg-navy-900/60 border border-surface-border rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        RTP Stream SSRC: <span className="font-mono text-purple-300">{stream.ssrcHex}</span>
                      </span>
                    </div>
                    {stream.isOneWay ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        ONE-WAY AUDIO
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ACTIVE DUPLEX
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-800">
                      <span className="text-slate-400 block text-[10px]">Source Socket</span>
                      <span className="font-mono text-slate-200 font-semibold truncate block mt-0.5">
                        {getIpLabel(stream.srcIp)}:{stream.srcPort}
                      </span>
                    </div>
                    <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-800">
                      <span className="text-slate-400 block text-[10px]">Destination Socket</span>
                      <span className="font-mono text-slate-200 font-semibold truncate block mt-0.5">
                        {getIpLabel(stream.dstIp)}:{stream.dstPort}
                      </span>
                    </div>
                    <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-800">
                      <span className="text-slate-400 block text-[10px]">Negotiated Codec</span>
                      <span className="font-mono text-purple-300 font-semibold block mt-0.5">
                        {stream.codecName} (PT {stream.payloadType})
                      </span>
                    </div>
                    <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-800">
                      <span className="text-slate-400 block text-[10px]">Packets Captured</span>
                      <span className="font-mono text-slate-200 font-semibold block mt-0.5">
                        {stream.packetCount.toLocaleString()} ({stream.durationSec.toFixed(1)}s)
                      </span>
                    </div>
                  </div>

                  {/* Packet Loss & Jitter Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">
                          RTP Packet Loss
                        </div>
                        <div className="text-lg font-bold font-mono mt-0.5">
                          <span className={stream.lossPct > 2.0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {stream.lossPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-500 font-mono">
                        {stream.lostPackets} dropped
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-navy-950 border border-navy-800 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">
                          Peak Jitter
                        </div>
                        <div className="text-lg font-bold font-mono mt-0.5">
                          <span className={stream.maxJitterMs > 30.0 ? 'text-amber-400' : 'text-emerald-400'}>
                            {stream.maxJitterMs.toFixed(1)} ms
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-500 font-mono">
                        Avg: {stream.avgJitterMs.toFixed(1)}ms
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 bg-navy-900/40 border border-surface-border rounded-xl p-8 text-center space-y-3">
                <Radio className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-200">
                  No RTP Media Streams in this Capture File
                </h4>
                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  The capture contains only SIP signaling transactions. This is normal when traffic is captured at a signaling proxy or SBC control plane interface where media flows directly between endpoints.
                </p>
                <button
                  onClick={() => setActiveViewTab('toolkit')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>View tcpdump Command to Capture RTP Media</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ROOT CAUSE ANALYSIS & DEFECT VERDICT */}
      {/* ============================================================== */}
      {activeViewTab === 'rca' && parsedData && (
        <div className="space-y-6">
          {/* Detected Defects List */}
          <div className="space-y-3">
            {parsedData.detectedIssues.length > 0 ? (
              parsedData.detectedIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl p-4 transition-all ${
                    issue.severity === 'CRITICAL'
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : issue.severity === 'WARNING'
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-blue-950/20 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {issue.severity === 'CRITICAL' ? (
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      ) : issue.severity === 'WARNING' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-sm font-bold ${
                              issue.severity === 'CRITICAL'
                                ? 'text-rose-300'
                                : issue.severity === 'WARNING'
                                ? 'text-amber-300'
                                : 'text-blue-300'
                            }`}
                          >
                            {issue.title}
                          </h4>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              issue.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : issue.severity === 'WARNING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {issue.description}
                        </p>
                        <div className="mt-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">Recommended Action: </span>
                          {issue.suggestedAction}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : isCallRejected ? (
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-5 flex items-center gap-4">
                <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-rose-300">
                    Call Setup Failed / Terminated Prematurely ({activeSession?.finalResponseCode || 'Error'})
                  </h4>
                  <p className="text-xs text-rose-200/80 mt-1">
                    The call was rejected or could not be established. The remote switch or gateway returned SIP {activeSession?.finalResponseCode} ({activeSession?.finalResponseReason || 'Rejected'}).
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-300">
                    Capture Analysis: Clean Nominal Transaction
                  </h4>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    {parsedData && parsedData.rtpStreams.length > 0
                      ? 'No SIP signaling anomalies, timeout drops, or RTP media packet loss detected. Bidirectional audio streams were received with low jitter and zero packet drops.'
                      : 'SIP call signaling completed cleanly with normal call termination (200 OK / BYE). No RTP media packets were captured on this interface (signaling-only trace).'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Root Cause Technical Summary Box */}
          <div className="bg-navy-900/70 border border-surface-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold text-slate-200">
                  L2 Forensic Verdict & Evidence Summary
                </h3>
              </div>
              <button
                onClick={handleSendToInvestigationCenter}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                <FolderGit2 className="w-4 h-4" />
                <span>Open in Investigation Center</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                This forensic packet dissection parses pure byte-level Ethernet and IP datagrams extracted directly from <code className="text-purple-300 font-mono">{parsedData?.filename}</code>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Signaling Layer Integrity
                  </div>
                  <div className="text-xs text-slate-200 font-medium">
                    {parsedData?.sipPacketCount} SIP frames parsed • Call-ID: <span className="font-mono text-purple-300">{activeSession?.callId || 'N/A'}</span>
                  </div>
                </div>
                <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Media Plane Integrity
                  </div>
                  <div className="text-xs text-slate-200 font-medium">
                    {parsedData?.rtpStreams.length} RTP stream(s) • Average Loss: <span className="font-mono text-emerald-400">{(((parsedData?.rtpStreams || []).reduce((acc, s) => acc + s.lossPct, 0)) / Math.max(1, parsedData?.rtpStreams.length || 1)).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DUAL-TRACE DEMARCATION COMPARISON (A/B DIFF) */}
      {/* ============================================================== */}
      {activeViewTab === 'demarcation' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-navy-900/40 border border-surface-border rounded-xl p-3 px-4">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-slate-200">
                Demarcation Boundary Comparator (A/B Packet Diff)
              </span>
              <span className="text-[11px] text-slate-400 hidden md:inline">
                • Compare multi-point captures to isolate LAN vs Carrier WAN fault domains
              </span>
            </div>
            <button
              onClick={loadDefaultDemarcationPair}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-medium transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <span>Load Demo A/B Pair</span>
            </button>
          </div>

          {/* Dual Leg Upload & Status Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Leg A Card */}
            <div className="bg-navy-900/60 border border-surface-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs">
                    A
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Demarcation Leg A (Customer LAN / Handset)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {parsedData && (
                    <button
                      onClick={setTraceAFromActive}
                      title="Assign active PCAP to Leg A"
                      className="px-2 py-1 text-[11px] rounded bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30 transition-colors"
                    >
                      Use Active
                    </button>
                  )}
                  <button
                    onClick={() => traceAInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] rounded bg-navy-800 hover:bg-navy-700 text-purple-300 border border-navy-700 transition-colors"
                  >
                    Upload PCAP
                  </button>
                  {traceA && (
                    <button
                      onClick={clearTraceA}
                      title="Clear Leg A"
                      className="p-1 rounded bg-navy-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border border-navy-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800 text-xs font-mono space-y-1">
                <div className="text-purple-300 truncate font-semibold">{traceALabel}</div>
                <div className="text-slate-400 text-[11px]">
                  {traceA ? `${traceA.totalPackets} packets (${traceA.sipPacketCount} SIP)` : 'No file loaded'}
                </div>
              </div>
            </div>

            {/* Leg B Card */}
            <div className="bg-navy-900/60 border border-surface-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs">
                    B
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Demarcation Leg B (Provider SBC / WAN)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {parsedData && (
                    <button
                      onClick={setTraceBFromActive}
                      title="Assign active PCAP to Leg B"
                      className="px-2 py-1 text-[11px] rounded bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 transition-colors"
                    >
                      Use Active
                    </button>
                  )}
                  <button
                    onClick={() => traceBInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] rounded bg-navy-800 hover:bg-navy-700 text-blue-300 border border-navy-700 transition-colors"
                  >
                    Upload PCAP
                  </button>
                  {traceB && (
                    <button
                      onClick={clearTraceB}
                      title="Clear Leg B"
                      className="p-1 rounded bg-navy-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border border-navy-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800 text-xs font-mono space-y-1">
                <div className="text-blue-300 truncate font-semibold">{traceBLabel}</div>
                <div className="text-slate-400 text-[11px]">
                  {traceB ? `${traceB.totalPackets} packets (${traceB.sipPacketCount} SIP)` : 'No file loaded'}
                </div>
              </div>
            </div>
          </div>

          {/* Empty state if both legs are not yet provided */}
          {(!traceA || !traceB) && (
            <div className="bg-navy-900/40 border border-dashed border-surface-border rounded-xl p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <GitCompare className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200">Both Traces Required for Demarcation Diff</h3>
                <p className="text-[11px] text-slate-400 max-w-lg mx-auto">
                  Demarcation analysis correlates packets across two capture points (e.g., Inside LAN vs Outside WAN SBC) by SIP Call-ID and CSeq to mathematically identify whether packets vanished on customer infrastructure or carrier transit.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  onClick={loadDefaultDemarcationPair}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 transition-colors"
                >
                  Load Demo A/B Traces (LAN vs Carrier SBC)
                </button>
                {parsedData && (
                  <>
                    {!traceA && (
                      <button
                        onClick={setTraceAFromActive}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-slate-200 transition-colors"
                      >
                        Set Active PCAP as Leg A
                      </button>
                    )}
                    {!traceB && (
                      <button
                        onClick={setTraceBFromActive}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-slate-200 transition-colors"
                      >
                        Set Active PCAP as Leg B
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Demarcation Verdict Banner */}
          {demarcationResult && (
            <div
              className={`rounded-xl p-5 border space-y-3 ${
                demarcationResult.overallVerdict === 'BOUNDARY_DROP_CONFIRMED'
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : demarcationResult.overallVerdict === 'TRANSIT_LATENCY_SPIKE'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-emerald-950/20 border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {demarcationResult.overallVerdict === 'BOUNDARY_DROP_CONFIRMED' ? (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  ) : demarcationResult.overallVerdict === 'TRANSIT_LATENCY_SPIKE' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                  <h3 className="text-sm font-bold text-slate-100">
                    Demarcation Boundary Verdict: {demarcationResult.overallVerdict.replace(/_/g, ' ')}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                    demarcationResult.overallVerdict === 'BOUNDARY_DROP_CONFIRMED'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  Fault Domain: {demarcationResult.overallFaultDomain.replace(/_/g, ' ')}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {demarcationResult.executiveSummary}
              </p>
            </div>
          )}

          {/* Packet Cross-Reference Correlation Table */}
          {demarcationResult && demarcationResult.matchedSessions.length > 0 && (
            <div className="bg-navy-900/60 border border-surface-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Packet-by-Packet Demarcation Correlation Flow
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Call-ID: {demarcationResult.matchedSessions[0].callId}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-navy-800 text-slate-400 text-[11px]">
                      <th className="py-2 px-3">Trace A (LAN)</th>
                      <th className="py-2 px-3">SIP Method / Code</th>
                      <th className="py-2 px-3">Trace B (SBC WAN)</th>
                      <th className="py-2 px-3">Transit Latency (Δt)</th>
                      <th className="py-2 px-3">Demarcation Status</th>
                      <th className="py-2 px-3">Diagnostic Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-800/60">
                    {demarcationResult.matchedSessions[0].packetComparisons.map((item, idx) => {
                      const isDrop = item.status === 'DROPPED_AT_BOUNDARY';
                      const isDelay = item.status === 'SIGNIFICANT_DELAY';
                      return (
                        <tr
                          key={idx}
                          className={`${
                            isDrop
                              ? 'bg-rose-950/30 text-rose-200'
                              : isDelay
                              ? 'bg-amber-950/20 text-amber-200'
                              : 'hover:bg-navy-800/20 text-slate-300'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            {item.packetNumberA ? (
                              <span className="text-purple-300">Pkt #{item.packetNumberA}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-100">
                            {item.methodOrResponse}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.packetNumberB ? (
                              <span className="text-blue-300">Pkt #{item.packetNumberB}</span>
                            ) : (
                              <span className="text-rose-400 font-bold">NEVER RECEIVED</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.transitDeltaMs !== undefined ? (
                              <span
                                className={
                                  Math.abs(item.transitDeltaMs) > 1000
                                    ? 'text-amber-400 font-bold'
                                    : 'text-emerald-400'
                                }
                              >
                                {item.transitDeltaMs > 0 ? `+${item.transitDeltaMs}` : item.transitDeltaMs} ms
                              </span>
                            ) : (
                              <span className="text-slate-600">N/A</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isDrop
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : isDelay
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                            {item.notes}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action item from demarcation */}
              <div className="pt-3 border-t border-navy-800 text-xs text-slate-300 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200">Demarcation Action Item: </span>
                  {demarcationResult.matchedSessions[0].actionItem}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: CAPTURE TOOLKIT & COMMAND RECIPES */}
      {/* ============================================================== */}
      {activeViewTab === 'toolkit' && (
        <div className="space-y-6">
          {/* Capture Readiness Audit Banner */}
          {readinessAudit && (
            <div className="bg-navy-900/60 border border-surface-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Current Capture Forensic Readiness Audit: {parsedData?.filename}
                  </h3>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-xs text-slate-400">Readiness Score:</span>
                  <span
                    className={`text-sm font-bold px-2 py-0.5 rounded ${
                      readinessAudit.grade === 'EXCELLENT'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : readinessAudit.grade === 'GOOD'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {readinessAudit.score} / 100 ({readinessAudit.grade})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {readinessAudit.findings.map((f, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-lg border space-y-1.5 ${
                      f.status === 'OPTIMAL'
                        ? 'bg-emerald-950/15 border-emerald-500/25'
                        : f.status === 'WARNING'
                        ? 'bg-amber-950/15 border-amber-500/25'
                        : 'bg-rose-950/15 border-rose-500/25'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-400 uppercase tracking-wider">{f.dimension}</span>
                      <span
                        className={
                          f.status === 'OPTIMAL'
                            ? 'text-emerald-400'
                            : f.status === 'WARNING'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {f.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">{f.title}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{f.description}</p>
                    {f.remedy && (
                      <div className="text-[10px] text-amber-300 pt-1 font-mono">{f.remedy}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Golden Capture Rules Checklist */}
          <div className="bg-navy-900/40 border border-surface-border rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Pre-Flight Checklist: Maximizing PCAP Troubleshooting Evidence
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="bg-navy-950/50 p-3 rounded-lg border border-navy-800">
                <span className="font-bold text-purple-300 block mb-1">1. Capture Signaling + Media</span>
                Ensure port filter captures both SIP (5060/5070) and dynamic RTP audio (10000–30000). Capturing only SIP blinds you to audio loss and jitter.
              </div>
              <div className="bg-navy-950/50 p-3 rounded-lg border border-navy-800">
                <span className="font-bold text-purple-300 block mb-1">2. Untruncated Snaplen (-s 0)</span>
                Always pass <code className="text-purple-200 font-mono">-s 0</code>. Without it, switches slice packets at 68 bytes, truncating SDP codecs and PBX headers.
              </div>
              <div className="bg-navy-950/50 p-3 rounded-lg border border-navy-800">
                <span className="font-bold text-purple-300 block mb-1">3. Dual-Leg Demarcation</span>
                Capture at both the Customer Handset/Router and the Provider SBC. Comparing both traces definitively proves whether firewall NAT dropped packets.
              </div>
            </div>
          </div>

          {/* Command Recipe Catalog */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                1-Click Packet Capture Commands & Sniffer Recipes
              </h4>
              <span className="text-[11px] text-slate-400">
                Share these commands directly with customers or NOC engineers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAPTURE_RECIPES.map((recipe, idx) => (
                <div
                  key={idx}
                  className="bg-navy-900/60 border border-surface-border rounded-xl p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {recipe.iconName === 'Terminal' && <Terminal className="w-4 h-4 text-purple-400" />}
                        {recipe.iconName === 'Server' && <Server className="w-4 h-4 text-blue-400" />}
                        {recipe.iconName === 'Cpu' && <Cpu className="w-4 h-4 text-emerald-400" />}
                        {recipe.iconName === 'Router' && <Router className="w-4 h-4 text-amber-400" />}
                        {recipe.iconName === 'Shield' && <Shield className="w-4 h-4 text-cyan-400" />}
                        {recipe.iconName === 'Laptop' && <Laptop className="w-4 h-4 text-indigo-400" />}
                        <span className="text-xs font-bold text-slate-200">{recipe.platform}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-navy-800 text-slate-400 px-2 py-0.5 rounded">
                        {recipe.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {recipe.description}
                    </p>

                    <pre className="p-2.5 bg-navy-950 rounded-lg border border-navy-800 font-mono text-[11px] text-purple-300 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                      {recipe.command}
                    </pre>

                    <p className="text-[10px] text-slate-500 italic">
                      {recipe.explanation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-navy-800 flex justify-end">
                    <button
                      onClick={() => handleCopyRecipe(recipe.command, idx)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
                    >
                      {copiedRecipeIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied Command!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Command</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* IP ROLE / ALIAS ANNOTATOR MODAL */}
      {/* ============================================================== */}
      {showAliasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-surface-border rounded-xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Endpoint IP & Network Role Annotator
                </h3>
              </div>
              <button
                onClick={() => setShowAliasModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Assign human-readable roles (e.g., <code className="text-purple-300 font-mono">Customer PBX</code>, <code className="text-purple-300 font-mono">Carrier Ingress SBC</code>) to raw IP addresses. These labels instantly reflect across the ladder sequence, packet inspector, and exported RCA reports.
            </p>

            {/* Add New Alias Form */}
            <div className="grid grid-cols-2 gap-2 bg-navy-950/60 p-3 rounded-lg border border-navy-800">
              <input
                type="text"
                placeholder="IP Address (e.g. 35.240.164.189)"
                value={newAliasIp}
                onChange={(e) => setNewAliasIp(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-navy-900 border border-surface-border text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Friendly Role (e.g. Customer PBX)"
                value={newAliasLabel}
                onChange={(e) => setNewAliasLabel(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-navy-900 border border-surface-border text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <div className="col-span-2 flex justify-end pt-1">
                <button
                  onClick={handleAddAlias}
                  className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add IP Alias</span>
                </button>
              </div>
            </div>

            {/* Quick detected IPs button pills */}
            {activeIps.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Detected IPs in active trace:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeIps.map((ip) => (
                    <button
                      key={ip}
                      onClick={() => setNewAliasIp(ip)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-navy-800 hover:bg-navy-700 text-purple-300 border border-navy-700"
                    >
                      {ip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Aliases List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Active IP Mappings:
              </span>
              {Object.entries(ipAliases).map(([ip, label]) => (
                <div
                  key={ip}
                  className="flex items-center justify-between p-2 rounded bg-navy-950/40 border border-navy-800 text-xs font-mono"
                >
                  <div>
                    <span className="text-purple-300 font-semibold">{label}</span>
                    <span className="text-slate-500 ml-2">({ip})</span>
                  </div>
                  <button
                    onClick={() => handleRemoveAlias(ip)}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-surface-border flex justify-end">
              <button
                onClick={() => setShowAliasModal(false)}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
