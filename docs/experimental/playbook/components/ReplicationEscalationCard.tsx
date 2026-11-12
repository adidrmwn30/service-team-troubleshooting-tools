import React, { useState } from 'react';
import {
  FileCode,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Layers,
  Send,
} from 'lucide-react';
import { PodDefinition, IngestedTicket } from '../types/playbookTypes';

interface ReplicationEscalationCardProps {
  currentPod: PodDefinition;
  ticket?: IngestedTicket;
}

export const ReplicationEscalationCard: React.FC<ReplicationEscalationCardProps> = ({
  currentPod,
  ticket,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'replication' | 'escalation'>('escalation');

  const markdownContent =
    ticket?.escalationMarkdown ||
    `## [CCB Escalation Dossier] Bizphone - SIP 404 Not Found

### 1. Incident Background
- **Product / Feature**: Bizphone & IP Phones
- **Organization UUID**: \`d82046ca-46e3-4700-845b-78fb6e7b579f\`
- **SIP / Routing Domain**: \`sipsg02.b3networks.com\`
- **Direction**: Inbound
- **Caller Number (Src)**: \`+6561234567\`
- **Callee Number (Dst)**: \`+6591234567\`
- **Call TXN / Call-ID**: \`1d2eebcd38595796bb2e6db622cd1840\`
- **Timestamp**: 2026-11-09 14:15:00 SGT (UTC+8)
- **Observed Error**: SIP 404 Not Found

### 2. Initial Investigation & Findings
- Inspected Call Forensics Hop Chain: Call arrived at Provider Egress SBC.
- Egress SBC sent INVITE to Customer PBX endpoint (Yeastar/Asterisk).
- Customer PBX immediately returned SIP 404 Not Found.
- Demarcation isolates root cause to Customer Premise PBX extension routing table.

### 3. Issue Replication Steps
- **Positive Test**: Placed test inbound call from Singtel mobile to +6591234567 -> Replicated SIP 404.
- **Negative Test**: Provisioned Zoiper on 4G using test extension 102 -> Inbound call rang successfully.
- **Conclusion**: Failure is isolated to extension +6591234567 configuration on customer PBX.

### 4. Escalation Target
- Channel: #pod-ccb-leads
- Recommended Action: Advise customer PBX administrator to check inbound route for DID +6591234567.`;

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <FileCode className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Issue Replication & Escalation Framework
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Standardized reproduction testing procedures and structured Markdown dossier generation for Jira / Zendesk / Slack.
            </p>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('escalation')}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                activeTab === 'escalation'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Escalation Dossier
            </button>
            <button
              onClick={() => setActiveTab('replication')}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                activeTab === 'replication'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Replication Framework & Zoiper
            </button>
          </div>
        </div>

        {activeTab === 'escalation' ? (
          /* Escalation Dossier View */
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Jira / Zendesk Markdown Dossier Preview
              </span>
              <button
                onClick={copyMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied Dossier!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
              {markdownContent}
            </pre>

            {/* Writing Guidelines Quick Reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 text-xs space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  Writing Best Practices (Do's)
                </span>
                <ul className="space-y-1 text-slate-300">
                  {currentPod.writingGuidelines.dos.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4 text-xs space-y-2">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Writing Pitfalls to Avoid (Don'ts)
                </span>
                <ul className="space-y-1 text-slate-300">
                  {currentPod.writingGuidelines.donts.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Replication Framework View */
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                  1. Positive Reproduction Test
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Execute the exact user flow under identical conditions. Verify if the error happens with the exact same numbers, time, and device model.
                </p>
                <div className="pt-2 text-[11px] text-slate-400 font-mono">
                  Goal: Confirm reproducible defect vs one-time anomaly.
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
                  2. Negative / Isolation Reproduction Test
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Vary exactly ONE variable at a time (e.g. switch network from customer office Wi-Fi to mobile 4G hotspot, or switch from desk phone to softphone).
                </p>
                <div className="pt-2 text-[11px] text-slate-400 font-mono">
                  Goal: Isolate fault domain between customer premise and cloud platform.
                </div>
              </div>
            </div>

            {/* Zoiper Auto-Provisioner Guide */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Zoiper Softphone QR Code Auto-Provisioner
                  </h3>
                </div>
                <a
                  href="https://hnimminh.github.io/zoiper-qr-code/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                >
                  <span>Open Auto-Provisioner Web Tool</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Use the Zoiper QR tool to configure test extensions on iOS or Android in under 5 seconds without manual SIP port or transport entry.
              </p>

              <ol className="space-y-1.5 text-xs text-slate-300 list-decimal list-inside">
                <li>Open <code className="text-cyan-400 font-mono">https://hnimminh.github.io/zoiper-qr-code/</code>.</li>
                <li>Enter the tenant SIP domain (e.g. <code className="text-cyan-400 font-mono">sipsg02.b3networks.com</code>) and test extension credentials.</li>
                <li>Open Zoiper app on mobile handset &rarr; Settings &rarr; QR Codes &rarr; Scan.</li>
                <li>Make test calls over 4G cellular data to eliminate local Wi-Fi / NAT router factors.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
