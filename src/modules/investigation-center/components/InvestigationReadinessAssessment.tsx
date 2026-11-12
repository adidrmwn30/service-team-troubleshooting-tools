import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Send,
  ArrowUpRight,
  UserCheck,
  Clipboard,
  History,
  Lock,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import {
  AuditRecord,
  CustomerReportPackage,
  DecisionEngineInput,
  DecisionEngineOutput,
  EngineerApproval,
  InvestigationCase,
  InvestigationDecision,
  L3EscalationPackage,
} from '../types';
import { InvestigationDecisionEngine } from '../services/investigationDecisionEngine';

interface InvestigationReadinessAssessmentProps {
  investigationCase: InvestigationCase;
}

export const InvestigationReadinessAssessment: React.FC<
  InvestigationReadinessAssessmentProps
> = ({ investigationCase }) => {
  // Configurable troubleshooting flags for L2 engineer to test realistic states
  const [isL2Exhausted, setIsL2Exhausted] = useState<boolean>(false);
  const [requiresPrivilegedAccess, setRequiresPrivilegedAccess] = useState<boolean>(false);
  const [hasConflictingEvidence, setHasConflictingEvidence] = useState<boolean>(false);

  // Engineer approval state
  const [engineerName, setEngineerName] = useState<string>('L2 Support Engineer');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [activeApproval, setActiveApproval] = useState<EngineerApproval | null>(null);

  // Modals for report previews
  const [showCustomerReportModal, setShowCustomerReportModal] = useState<boolean>(false);
  const [showL3PackageModal, setShowL3PackageModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [pendingApprovalAction, setPendingApprovalAction] = useState<InvestigationDecision | null>(null);
  const [showAuditHistory, setShowAuditHistory] = useState<boolean>(false);

  // Copy status
  const [copiedCustomerReport, setCopiedCustomerReport] = useState<boolean>(false);
  const [copiedL3Package, setCopiedL3Package] = useState<boolean>(false);

  // Build input for decision engine
  const decisionInput: DecisionEngineInput = useMemo(() => {
    return {
      investigationCase,
      isL2Exhausted,
      requiresPrivilegedAccess,
      hasConflictingEvidence,
    };
  }, [investigationCase, isL2Exhausted, requiresPrivilegedAccess, hasConflictingEvidence]);

  // Evaluate assessment deterministically
  const decisionResult: DecisionEngineOutput = useMemo(() => {
    return InvestigationDecisionEngine.evaluateInvestigation(decisionInput);
  }, [decisionInput]);

  // Audit history
  const auditHistory: AuditRecord[] = useMemo(() => {
    return InvestigationDecisionEngine.getAuditHistory(investigationCase.id);
  }, [investigationCase.id, decisionResult, activeApproval]);

  // Generated reports
  const customerReport: CustomerReportPackage = useMemo(() => {
    return InvestigationDecisionEngine.generateCustomerReport(decisionResult, decisionInput);
  }, [decisionResult, decisionInput]);

  const l3Package: L3EscalationPackage = useMemo(() => {
    return InvestigationDecisionEngine.generateL3EscalationPackage(decisionResult, decisionInput);
  }, [decisionResult, decisionInput]);

  // Handle engineer sign-off
  const handleInitiateApproval = (action: InvestigationDecision) => {
    setPendingApprovalAction(action);
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = () => {
    if (!pendingApprovalAction) return;
    const approval: EngineerApproval = {
      approvedBy: engineerName.trim() || 'L2 Support Engineer',
      approvedAction: pendingApprovalAction,
      timestamp: new Date().toISOString(),
      notes: approvalNotes.trim() || undefined,
    };
    setActiveApproval(approval);
    if (auditHistory.length > 0) {
      InvestigationDecisionEngine.approveAssessment(auditHistory[0].id, approval);
    }
    setShowApprovalModal(false);
    setApprovalNotes('');
  };

  const handleCopyCustomerReport = () => {
    const text = `=== CUSTOMER COMMUNICATION REPORT ===
Ticket: ${customerReport.ticketId || 'N/A'}
Status: ${customerReport.currentStatus}
Issue: ${customerReport.observedIssue}

Customer Impact:
${customerReport.customerImpact}

Verified Findings:
${customerReport.verifiedFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Actions Taken by Engineering:
${customerReport.actionsTaken.map((a, i) => `• ${a}`).join('\n')}

Next Steps:
${customerReport.nextAction}
`;
    navigator.clipboard.writeText(text);
    setCopiedCustomerReport(true);
    setTimeout(() => setCopiedCustomerReport(false), 2000);
  };

  const handleCopyL3Package = () => {
    const text = `=== L3 ENGINEERING ESCALATION DOSSIER ===
Ticket ID: ${l3Package.ticketId || 'N/A'}
TXN UUID: ${l3Package.txnUuid || 'N/A'}
Customer: ${l3Package.customerIdentifier || 'N/A'}
Severity: ${l3Package.severity} | Target: ${l3Package.escalationTarget}

SIP Signaling Timeline:
${l3Package.sipSignaling}

RTP Media Metrics:
${l3Package.rtpMetrics}

Troubleshooting Performed:
${l3Package.troubleshootingPerformed.map((t, i) => `• ${t}`).join('\n')}

Verified Telemetry Facts:
${l3Package.verifiedFindings.map((f, i) => `• ${f}`).join('\n')}

Remaining Technical Questions:
${l3Package.remainingTechnicalQuestions.map((q, i) => `? ${q}`).join('\n')}

Requested L3 Engineering Action:
${l3Package.requestedEngineeringAssistance}
`;
    navigator.clipboard.writeText(text);
    setCopiedL3Package(true);
    setTimeout(() => setCopiedL3Package(false), 2000);
  };

  const breakdown = decisionResult.sufficiencyBreakdown;

  return (
    <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-6 shadow-xl">
      {/* Engine Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>Investigation Readiness & Escalation Engine</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Deterministic v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates technical evidence completeness, root cause confidence, and ownership boundaries to prevent premature customer disclosures or unnecessary L3 escalations.
          </p>
        </div>

        {/* Recommended Decision Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">
              Recommended Decision
            </span>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              {decisionResult.recommendedDecision === 'CUSTOMER_READY' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  CUSTOMER READY
                </span>
              )}
              {decisionResult.recommendedDecision === 'CONTINUE_L2' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  CONTINUE L2 INVESTIGATION
                </span>
              )}
              {decisionResult.recommendedDecision === 'ESCALATE_L3' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                  ESCALATE TO L3
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Engineer Diagnostic Override Toggles (Interactive Simulation) */}
      <div className="p-3.5 rounded-lg bg-navy-950/70 border border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 font-medium">L2 Investigation Conditions:</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={hasConflictingEvidence}
              onChange={(e) => setHasConflictingEvidence(e.target.checked)}
              className="rounded bg-navy-900 border-surface-border text-purple-600 focus:ring-0"
            />
            <span>Conflicting Evidence Detected</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={isL2Exhausted}
              onChange={(e) => setIsL2Exhausted(e.target.checked)}
              className="rounded bg-navy-900 border-surface-border text-purple-600 focus:ring-0"
            />
            <span>L2 Procedures Exhausted</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={requiresPrivilegedAccess}
              onChange={(e) => setRequiresPrivilegedAccess(e.target.checked)}
              className="rounded bg-navy-900 border-surface-border text-purple-600 focus:ring-0"
            />
            <span>Privileged Access Required</span>
          </label>
        </div>
      </div>

      {/* 4 Assessment Quadrants (A, B, C, D) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quadrant A: Evidence Sufficiency Assessment */}
        <div className="p-4 rounded-xl bg-navy-950/80 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-purple-400" />
              <span>A. Evidence Sufficiency</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-white">
                {breakdown.totalScore} / 10
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                  breakdown.totalScore >= 8
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : breakdown.totalScore >= 4
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {breakdown.scoreCategory.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-navy-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                breakdown.totalScore >= 8
                  ? 'bg-emerald-500'
                  : breakdown.totalScore >= 4
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${(breakdown.totalScore / 10) * 100}%` }}
            />
          </div>

          {/* 5 Dimensions Breakdown */}
          <div className="space-y-2 text-[11px] pt-1">
            <div className="flex items-center justify-between p-1.5 rounded bg-navy-900/60 border border-navy-800">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-200 block">1. Evidence Quality</span>
                <span className="text-[10px] text-slate-400">{breakdown.justifications.evidenceQuality}</span>
              </div>
              <span className="font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded bg-navy-800">
                {breakdown.evidenceQuality} / 2
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-navy-900/60 border border-navy-800">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-200 block">2. Root Cause Confidence</span>
                <span className="text-[10px] text-slate-400">{breakdown.justifications.rootCauseConfidence}</span>
              </div>
              <span className="font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded bg-navy-800">
                {breakdown.rootCauseConfidence} / 2
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-navy-900/60 border border-navy-800">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-200 block">3. Technical Clarity</span>
                <span className="text-[10px] text-slate-400">{breakdown.justifications.technicalClarity}</span>
              </div>
              <span className="font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded bg-navy-800">
                {breakdown.technicalClarity} / 2
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-navy-900/60 border border-navy-800">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-200 block">4. Actionability</span>
                <span className="text-[10px] text-slate-400">{breakdown.justifications.actionability}</span>
              </div>
              <span className="font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded bg-navy-800">
                {breakdown.actionability} / 2
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-navy-900/60 border border-navy-800">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-200 block">5. Reproducibility</span>
                <span className="text-[10px] text-slate-400">{breakdown.justifications.reproducibility}</span>
              </div>
              <span className="font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded bg-navy-800">
                {breakdown.reproducibility} / 2
              </span>
            </div>
          </div>
        </div>

        {/* Quadrant B: Root Cause Assessment */}
        <div className="p-4 rounded-xl bg-navy-950/80 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>B. Root Cause Assessment</span>
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-navy-800 border border-navy-700 text-slate-300">
              Confidence: {decisionResult.rootCauseConfidence}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-navy-900/60 border border-navy-800 flex items-center justify-between">
              <span className="text-slate-400">Classified Fault Domain:</span>
              <span className="font-mono font-semibold text-purple-300">
                {decisionResult.faultDomain}
              </span>
            </div>

            <div className="p-2.5 rounded bg-navy-900/60 border border-navy-800 flex items-center justify-between">
              <span className="text-slate-400">Fact / Assumption Balance:</span>
              <span className="font-mono text-slate-200">
                {investigationCase.findings?.filter((f) => f.verifiedFact).length || 0} Verified Facts • {investigationCase.findings?.filter((f) => f.isHypothesis).length || 0} Hypotheses
              </span>
            </div>

            {/* Safety Notes */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Safety & Guardrail Checks:
              </span>
              {decisionResult.safetyNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-blue-950/30 border border-blue-500/30 text-[11px] text-blue-200 leading-relaxed"
                >
                  {note}
                </div>
              ))}
              {decisionResult.safetyNotes.length === 0 && (
                <div className="p-2 rounded bg-navy-900/40 border border-navy-800 text-[11px] text-slate-400">
                  Standard safety checks satisfied. No internal speculation detected.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quadrant C: Escalation Triggers Assessment */}
        <div className="p-4 rounded-xl bg-navy-950/80 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>C. Escalation Assessment</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Target: <strong className="text-slate-200">{decisionResult.escalationTarget || 'L2_SUPPORT'}</strong>
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {decisionResult.activeTriggers.map((t, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                  t.severity === 'CRITICAL'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : t.severity === 'HIGH'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-navy-900/80 border-surface-border text-slate-300'
                }`}
              >
                <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-black/40 border border-white/20">
                      {t.severity} • {t.target}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-normal">{t.reason}</p>
                </div>
              </div>
            ))}

            {decisionResult.activeTriggers.length === 0 && (
              <div className="p-4 text-center rounded bg-navy-900/40 border border-navy-800 text-xs text-slate-400">
                No active escalation triggers. Issue remains within standard L2 Support ownership.
              </div>
            )}
          </div>
        </div>

        {/* Quadrant D: Recommended Next Actions */}
        <div className="p-4 rounded-xl bg-navy-950/80 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>D. Recommended Actions</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Deterministic Guidance
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <ul className="space-y-1.5 text-slate-200">
              {decisionResult.recommendedNextActions.map((act, idx) => (
                <li
                  key={idx}
                  className="p-2 rounded bg-navy-900/60 border border-navy-800 flex items-start gap-2"
                >
                  <span className="text-purple-400 font-bold">•</span>
                  <span className="text-[11px] leading-relaxed">{act}</span>
                </li>
              ))}
            </ul>

            {decisionResult.missingEvidence.length > 0 && (
              <div className="pt-2 border-t border-navy-800 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block">
                  Missing Evidence to Resolve:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-400">
                  {decisionResult.missingEvidence.map((m, idx) => (
                    <li key={idx}>⚠️ {m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Human Approval Sign-Off Bar */}
      <div className="p-4 rounded-xl bg-navy-950 border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Human Engineer Approval & Governance
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Mandatory Sign-off
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {activeApproval ? (
              <span className="text-emerald-300 font-medium">
                ✓ Signed off by <strong>{activeApproval.approvedBy}</strong> as{' '}
                <strong>{activeApproval.approvedAction}</strong> at{' '}
                {new Date(activeApproval.timestamp).toLocaleTimeString()}.
              </span>
            ) : (
              'The decision engine provides technical guidance. Final determination requires engineer sign-off.'
            )}
          </p>
        </div>

        {/* 3 Explicit Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleInitiateApproval('CUSTOMER_READY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeApproval?.approvedAction === 'CUSTOMER_READY'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve Customer Comm</span>
          </button>

          <button
            onClick={() => handleInitiateApproval('CONTINUE_L2')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeApproval?.approvedAction === 'CONTINUE_L2'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Continue L2 Investigation</span>
          </button>

          <button
            onClick={() => handleInitiateApproval('ESCALATE_L3')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeApproval?.approvedAction === 'ESCALATE_L3'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Escalate to L3</span>
          </button>
        </div>
      </div>

      {/* Report Generation & Audit History Toolbar */}
      <div className="pt-2 border-t border-navy-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomerReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 border border-surface-borderLight text-slate-200 font-medium transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Customer Communication Report</span>
          </button>

          <button
            onClick={() => setShowL3PackageModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 border border-surface-borderLight text-slate-200 font-medium transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>L3 Engineering Escalation Package</span>
          </button>
        </div>

        <button
          onClick={() => setShowAuditHistory(!showAuditHistory)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          <span>Decision Audit History ({auditHistory.length})</span>
          {showAuditHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Audit History Dropdown Section */}
      {showAuditHistory && (
        <div className="p-3.5 rounded-lg bg-navy-950/90 border border-surface-border space-y-2 text-xs">
          <span className="font-semibold text-slate-300 block">Assessment Audit Log</span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {auditHistory.map((audit) => (
              <div
                key={audit.id}
                className="p-2 rounded bg-navy-900/60 border border-navy-800 flex items-center justify-between text-[11px]"
              >
                <div className="space-y-0.5">
                  <span className="font-mono text-purple-300 font-semibold">{audit.id}</span>
                  <span className="text-slate-400 block">{audit.decisionReason}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-slate-400 block">
                    {new Date(audit.assessmentTimestamp).toLocaleTimeString()}
                  </span>
                  {audit.engineerApproval ? (
                    <span className="text-emerald-400 font-medium text-[10px]">
                      Approved: {audit.engineerApproval.approvedAction} by {audit.engineerApproval.approvedBy}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">Pending Sign-off</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Customer Communication Report Preview */}
      {showCustomerReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-navy-900 border border-surface-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Customer Communication Report</h3>
              </div>
              <button
                onClick={() => setShowCustomerReportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans text-slate-200">
              <div className="p-3 rounded bg-navy-950/70 border border-navy-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">Current Status:</span>
                <span className="font-semibold block text-emerald-300">{customerReport.currentStatus}</span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Observed Issue:</span>
                <p className="text-slate-300">{customerReport.observedIssue}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Customer Impact:</span>
                <p className="text-slate-300">{customerReport.customerImpact}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Verified Findings (No Speculation):</span>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {customerReport.verifiedFindings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Engineering Actions Taken:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {customerReport.actionsTaken.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Recommended Next Action:</span>
                <p className="p-2.5 rounded bg-navy-950/80 border border-navy-800 text-slate-200">
                  {customerReport.nextAction}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-surface-border flex items-center justify-between bg-navy-950/80">
              <span className="text-[11px] text-slate-400">
                Safe for direct customer transmission.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCustomerReport}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>{copiedCustomerReport ? 'Copied to Clipboard!' : 'Copy Report'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: L3 Engineering Escalation Package Preview */}
      {showL3PackageModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-navy-900 border border-surface-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">L3 Engineering Escalation Package</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                  {l3Package.severity}
                </span>
              </div>
              <button
                onClick={() => setShowL3PackageModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans text-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded bg-navy-950 border border-navy-800">
                  <span className="text-slate-400 block">Ticket ID:</span>
                  <span className="font-mono text-slate-200 font-bold">{l3Package.ticketId || 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-navy-950 border border-navy-800">
                  <span className="text-slate-400 block">Target Team:</span>
                  <span className="font-mono text-purple-300 font-bold">{l3Package.escalationTarget}</span>
                </div>
                <div className="p-2 rounded bg-navy-950 border border-navy-800 col-span-2">
                  <span className="text-slate-400 block">TXN UUID:</span>
                  <span className="font-mono text-slate-200 truncate block">{l3Package.txnUuid || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">SIP Signaling Timeline:</span>
                <pre className="p-2.5 rounded bg-navy-950 border border-navy-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {l3Package.sipSignaling}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">RTP Media Metrics:</span>
                <pre className="p-2.5 rounded bg-navy-950 border border-navy-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {l3Package.rtpMetrics}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">L2 Troubleshooting Performed:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {l3Package.troubleshootingPerformed.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Remaining Technical Questions:</span>
                <ul className="list-disc list-inside space-y-1 text-amber-300">
                  {l3Package.remainingTechnicalQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-semibold block">Requested L3 Assistance:</span>
                <p className="p-2.5 rounded bg-rose-950/30 border border-rose-500/30 text-rose-200">
                  {l3Package.requestedEngineeringAssistance}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-surface-border flex items-center justify-between bg-navy-950/80">
              <span className="text-[11px] text-slate-400">
                Ready to attach to Jira / Internal Escalation Ticket.
              </span>
              <button
                onClick={handleCopyL3Package}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{copiedL3Package ? 'Copied Escalation Package!' : 'Copy Dossier'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Engineer Approval Sign-off Confirmation */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-navy-900 border border-surface-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Confirm Engineer Sign-Off</h3>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded bg-navy-950/70 border border-navy-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">Approved Action:</span>
                <span className="font-bold text-purple-300 block text-sm">
                  {pendingApprovalAction}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium block">
                  Engineer Name / ID
                </label>
                <input
                  type="text"
                  value={engineerName}
                  onChange={(e) => setEngineerName(e.target.value)}
                  className="w-full bg-navy-950 border border-surface-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-medium block">
                  Sign-off Notes / Justification (Optional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="e.g. Telemetry matches customer explanation; confirmed normal BYE."
                  rows={3}
                  className="w-full bg-navy-950 border border-surface-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-surface-border flex items-center justify-end gap-2 bg-navy-950/80">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-3 py-1.5 rounded-lg border border-navy-750 text-slate-300 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Sign Off & Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
