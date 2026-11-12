import React, { useState } from 'react';
import {
  FileText,
  Search,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Send,
} from 'lucide-react';
import { IngestedTicket, PodDefinition, PodId } from '../types/playbookTypes';
import { ticketIntakeParser } from '../services/ticketIntakeParser';
import { podRegistry } from '../data/podRegistry';

interface SmartIntakeCardProps {
  currentPod: PodDefinition;
  onPodChange: (podId: PodId) => void;
  onNavigateTab?: (tab: string, extraData?: any) => void;
}

const SAMPLE_TICKETS = [
  {
    label: 'Bizphone 404 Drop (Complete)',
    text: `Customer from domain sipsg02.b3networks.com (Org UUID: d82046ca-46e3-4700-845b-78fb6e7b579f) reports inbound call dropped.
Caller Number: +6561234567
Callee Number: +6591234567
Direction: inbound
Call-ID: 1d2eebcd38595796bb2e6db622cd1840
Timestamp: 2026-11-09 14:15:00 SGT
Error: SIP 404 Not Found
Product: Bizphone
Agent hears immediate fast busy tone when incoming call arrives.`,
  },
  {
    label: 'Voice Quality (Choppy Audio)',
    text: `Tenant: voice.b3networks.com
Org: 77a192bc-3344-4211-9988-bbccddeeff00
Direction: outbound
Caller: Ext 104 (+6561112233)
Callee: +6598765432
Call TXN: txn-vq-nov-88771
Timestamp: 2026-11-09 11:20:00 SGT
Issue: Customer reports robotic and choppy audio. Callee cannot hear agent clearly.
Product: Contact Center`,
  },
  {
    label: 'Incomplete Report (Missing TXN)',
    text: `Urgent! Bizphone is down for our staff.
Customer domain is acme.b3networks.com.
Cannot make outbound calls to +6591234567.
Please fix as soon as possible!`,
  },
];

export const SmartIntakeCard: React.FC<SmartIntakeCardProps> = ({
  currentPod,
  onPodChange,
  onNavigateTab,
}) => {
  const [rawText, setRawText] = useState<string>(SAMPLE_TICKETS[0].text);
  const [ingestedTicket, setIngestedTicket] = useState<IngestedTicket>(() =>
    ticketIntakeParser.parseTicket(SAMPLE_TICKETS[0].text, currentPod.id)
  );
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleParse = (text: string) => {
    setRawText(text);
    if (!text.trim()) return;
    const parsed = ticketIntakeParser.parseTicket(text, currentPod.id);
    setIngestedTicket(parsed);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const entities = ingestedTicket.extractedEntities;
  const isComplete = ingestedTicket.completenessScore >= 80;

  return (
    <div className="space-y-6">
      {/* Header & Pod Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Smart Ticket Intake & Completeness Auditor
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Paste raw customer emails, Jira descriptions, or portal tickets. Automatic regex extracts UUIDs, TXNs, and cross-references required data points in seconds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Assigned Pod:</span>
            <select
              value={currentPod.id}
              onChange={(e) => {
                const nextId = e.target.value as PodId;
                onPodChange(nextId);
                const nextPod = podRegistry.getPod(nextId);
                const reParsed = ticketIntakeParser.parseTicket(rawText, nextPod.id);
                setIngestedTicket(reParsed);
              }}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {podRegistry.getAllPods().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Load Preset Example:</span>
          {SAMPLE_TICKETS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleParse(sample.text)}
              className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Text Input Area */}
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Raw Ticket Text / Clipboard Input
          </label>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="Paste raw ticket text here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Results Grid: Extracted Telemetry & Completeness Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Extracted Telemetry Badges */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-400" />
              Extracted Incident Telemetry
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Category: {ingestedTicket.matchedCategory.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Organization UUID</span>
              <span className="font-mono text-white font-medium break-all">
                {entities.orgUuid || <span className="text-amber-400 italic">Not detected</span>}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">SIP / PBX Domain</span>
              <span className="font-mono text-white font-medium break-all">
                {entities.domain || <span className="text-amber-400 italic">Not detected</span>}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Call Direction</span>
              <span className="font-mono text-white font-medium uppercase">
                {entities.callDirection || <span className="text-amber-400 italic">Unknown</span>}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Product Keyword</span>
              <span className="font-mono text-blue-400 font-semibold">
                {entities.productKeyword || 'Cloud Telephony'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Caller (Source)</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {entities.callerNumber || <span className="text-amber-400 italic">Not detected</span>}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Callee (Destination)</span>
              <span className="font-mono text-purple-400 font-semibold">
                {entities.calleeNumber || <span className="text-amber-400 italic">Not detected</span>}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Call TXN / SIP Call-ID</span>
              <span className="font-mono text-cyan-400 font-medium break-all">
                {entities.callTxn || entities.sipCallId || (
                  <span className="text-rose-400 font-semibold italic">Missing (Required)</span>
                )}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Observed Error / Code</span>
              <span className="font-mono text-amber-300 font-semibold">
                {entities.errorCode || <span className="text-slate-500 italic">None reported</span>}
              </span>
            </div>
          </div>

          {/* Quick Actions into Analyzer / Forensics */}
          <div className="pt-2 flex flex-wrap gap-2">
            {onNavigateTab && (
              <>
                <button
                  onClick={() => onNavigateTab('pcap')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Launch PCAP Analyzer
                </button>
                <button
                  onClick={() => onNavigateTab('forensics')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Open Call Forensics Demarcation
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Completeness Score & 30-Minute Clarification Rule */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Data Point Completeness
              </h3>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isComplete
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {ingestedTicket.completenessScore}% COMPLETE
              </span>
            </div>

            {/* Score Bar */}
            <div className="mt-4">
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${ingestedTicket.completenessScore}%` }}
                />
              </div>
            </div>

            {/* Status explanation */}
            <div className="mt-3 text-xs">
              {isComplete ? (
                <div className="flex items-start gap-2 text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Ready for Tier 2 investigation. All critical telephony data points provided.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-rose-300 bg-rose-500/5 border border-rose-500/20 p-2.5 rounded-lg">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <div>
                    <span className="font-semibold block text-rose-400">
                      30-Minute Rule Triggered: Missing Data
                    </span>
                    <span>
                      {ingestedTicket.missingRequiredFields.length} mandatory field(s) missing. Request details from customer before escalating to Engineering.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Missing Fields List */}
            {ingestedTicket.missingRequiredFields.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-semibold text-slate-400 block mb-2">
                  Missing Mandatory Items:
                </span>
                <ul className="space-y-1 text-xs">
                  {ingestedTicket.missingRequiredFields.map((field) => (
                    <li key={field.id} className="flex items-center gap-1.5 text-rose-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span className="font-medium">{field.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Quick Copy Clarification Button */}
          <div className="pt-2">
            <button
              onClick={() => copyToClipboard(ingestedTicket.clarificationDraft, 'clarification')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              {copiedType === 'clarification' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied Clarification Email!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-blue-400" />
                  <span>Copy Customer Clarification Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
