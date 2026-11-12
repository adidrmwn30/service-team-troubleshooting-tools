import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  PhoneCall,
  Globe,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Hash,
  ShieldCheck,
  Search,
  Plus,
  ExternalLink,
  Info,
  Clipboard,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  InvestigationCase,
  EvidenceType,
  InvestigationFinding,
} from './types';
import { InvestigationService } from './services/investigationService';
import { InvestigationReadinessAssessment } from './components/InvestigationReadinessAssessment';
import { useWorkbench } from '../../shared/context/WorkbenchContext';

export const InvestigationCenterView: React.FC = () => {
  const {
    activeCaseId,
    setActiveCaseId,
    investigations,
    activeCallReport,
    latestNetworkResult,
    compileToInvestigationCenter,
  } = useWorkbench();

  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    activeCaseId || investigations[0]?.id || ''
  );
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<EvidenceType>('CALL_FORENSICS');
  const [copiedRca, setCopiedRca] = useState<boolean>(false);

  useEffect(() => {
    if (activeCaseId && activeCaseId !== selectedCaseId) {
      setSelectedCaseId(activeCaseId);
    }
  }, [activeCaseId]);

  const selectedCase =
    investigations.find((inv) => inv.id === selectedCaseId) ||
    investigations.find((inv) => inv.id === activeCaseId) ||
    investigations[0];

  const handleCopyRca = () => {
    if (!selectedCase?.rcaSummary) return;
    const text = `=== ROOT CAUSE ANALYSIS (RCA) ===
Ticket ID: ${selectedCase.ticketId || 'N/A'}
Investigation ID: ${selectedCase.id}
Customer: ${selectedCase.customerIdentifier || 'N/A'}
Fault Domain: ${selectedCase.rcaSummary.faultDomain}

Technical Summary:
${selectedCase.rcaSummary.technicalSummary}

Customer Facing Summary:
${selectedCase.rcaSummary.customerFacingSummary}

Action Items:
${selectedCase.rcaSummary.actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopiedRca(true);
    setTimeout(() => setCopiedRca(false), 2000);
  };

  return (
    <div className="flex h-full bg-navy-950 text-slate-100 overflow-hidden">
      {/* Left Sidebar: Investigation Cases List */}
      <div className="w-80 border-r border-surface-border flex flex-col shrink-0 bg-navy-900/60">
        <div className="p-3.5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Investigations
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {investigations.length} Cases
          </span>
        </div>

        {/* Quick Sync Active Call Action */}
        {activeCallReport && (
          <div className="p-2 border-b border-surface-border bg-purple-950/40">
            <button
              onClick={() => {
                const id = compileToInvestigationCenter(activeCallReport, latestNetworkResult || undefined);
                setSelectedCaseId(id);
                setActiveCaseId(id);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold shadow transition-all cursor-pointer"
              title="Sync active call into this dossier"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sync Active Call ({activeCallReport.txnUuid.slice(0, 8)}...)</span>
            </button>
          </div>
        )}

        {/* Case List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {investigations.map((c) => {
            const isSelected = c.id === selectedCaseId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCaseId(c.id);
                  setActiveCaseId(c.id);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500/40 text-white shadow-sm'
                    : 'bg-navy-950/40 hover:bg-navy-800/40 border-surface-border text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-mono font-semibold text-purple-300">{c.id}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {c.status}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-200 line-clamp-1 mb-1">
                  {c.title}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{c.customerIdentifier?.split(' ')[0]}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Phase Label Note */}
        <div className="p-3 border-t border-surface-border bg-navy-950/80 text-[11px] text-slate-400">
          <span className="text-emerald-400 font-medium">Tri-Module Pipeline:</span> Call Forensics &amp; Globalping correlation active.
        </div>
      </div>

      {/* Main Right Dossier Content */}
      {selectedCase && (
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Header & Identifiers */}
          <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                    {selectedCase.id}
                  </span>
                  {selectedCase.ticketId && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-navy-800 text-slate-300 border border-navy-700">
                      Ticket {selectedCase.ticketId}
                    </span>
                  )}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedCase.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {selectedCase.title}
                </h2>
                {selectedCase.description && (
                  <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                    {selectedCase.description}
                  </p>
                )}
              </div>

              <button
                onClick={handleCopyRca}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{copiedRca ? 'Copied RCA!' : 'Copy RCA Dossier'}</span>
              </button>
            </div>

            {/* Quick Identifier Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-navy-800 text-xs">
              <div className="p-2.5 rounded bg-navy-950/60 border border-surface-border">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Customer</span>
                <span className="font-medium text-slate-200">{selectedCase.customerIdentifier || 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded bg-navy-950/60 border border-surface-border">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Transaction UUID</span>
                <span className="font-mono text-slate-200 text-[11px] truncate block" title={selectedCase.txnUuid}>
                  {selectedCase.txnUuid || 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded bg-navy-950/60 border border-surface-border">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">SIP Domain</span>
                <span className="font-mono text-slate-200">{selectedCase.sipDomain || 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded bg-navy-950/60 border border-surface-border">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Source & Destination IP</span>
                <span className="font-mono text-slate-200 text-[11px]">
                  {selectedCase.sourceIp || 'N/A'} ➔ {selectedCase.destinationIp || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Evidence Sources Section */}
          <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Correlated Evidence Dossier</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveEvidenceTab('CALL_FORENSICS')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                    activeEvidenceTab === 'CALL_FORENSICS'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-navy-950 border-surface-border text-slate-400'
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Evidence</span>
                </button>
                <button
                  onClick={() => setActiveEvidenceTab('GLOBAL_NETWORK')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                    activeEvidenceTab === 'GLOBAL_NETWORK'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-navy-950 border-surface-border text-slate-400'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Global Network</span>
                </button>
              </div>
            </div>

            {/* Evidence items display */}
            <div className="space-y-3">
              {selectedCase.evidenceReferences
                .filter((e) => e.evidenceType === activeEvidenceTab)
                .map((ref) => (
                  <div
                    key={ref.id}
                    className="p-3.5 rounded-lg bg-navy-950/80 border border-surface-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100">{ref.title}</span>
                        <span className="text-[10px] font-mono text-slate-400">({ref.source})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(ref.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-mono text-[11px] bg-navy-900/60 p-2.5 rounded border border-navy-800">
                      {ref.summary}
                    </p>
                  </div>
                ))}

              {selectedCase.evidenceReferences.filter((e) => e.evidenceType === activeEvidenceTab).length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500 bg-navy-950/40 rounded-lg border border-dashed border-navy-800">
                  No evidence attached for {activeEvidenceTab.replace('_', ' ')}.
                </div>
              )}
            </div>
          </div>

          {/* Technical Findings: Fact vs Hypothesis Separation */}
          <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Technical Findings (Observed Facts vs Hypotheses)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Rigorous forensic distinction enforced
              </span>
            </div>

            <div className="space-y-2">
              {selectedCase.findings?.map((finding) => (
                <div
                  key={finding.id}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-3 ${
                    finding.verifiedFact
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5 ${
                      finding.verifiedFact
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {finding.verifiedFact ? 'VERIFIED FACT' : 'HYPOTHESIS'}
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      [{finding.category}]
                    </span>
                    <p className="text-slate-200 leading-relaxed">{finding.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Investigation Readiness & Escalation Engine Assessment */}
          <InvestigationReadinessAssessment investigationCase={selectedCase} />

          {/* Root Cause Analysis (RCA) Report Preview */}
          {selectedCase.rcaSummary && (
            <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Technical RCA Summary</span>
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Fault Domain: {selectedCase.rcaSummary.faultDomain}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-navy-950/80 border border-surface-border space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide block">
                    Engineering Technical Summary
                  </span>
                  <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                    {selectedCase.rcaSummary.technicalSummary}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-navy-950/80 border border-surface-border space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide block">
                    Customer-Facing Summary
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedCase.rcaSummary.customerFacingSummary}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-navy-950/80 border border-surface-border space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide block">
                    Recommended Action Items
                  </span>
                  <ul className="space-y-1 list-disc list-inside text-slate-300">
                    {selectedCase.rcaSummary.actionItems.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
