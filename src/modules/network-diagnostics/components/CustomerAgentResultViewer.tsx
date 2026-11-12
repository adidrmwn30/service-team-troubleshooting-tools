import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  HardDrive,
  Activity,
  Layers,
  ArrowRight,
  Server,
  Share2,
  Copy,
  Check,
  FileCheck,
} from 'lucide-react';
import { CustomerAgentTelemetry } from '../types';

interface CustomerAgentResultViewerProps {
  telemetry: CustomerAgentTelemetry;
  onCorrelate?: () => void;
}

export const CustomerAgentResultViewer: React.FC<CustomerAgentResultViewerProps> = ({
  telemetry,
  onCorrelate,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  const {
    sessionId,
    customerOrgName,
    timestamp,
    osPlatform,
    osVersion,
    localNetwork,
    stunNat,
    targetProbes,
    overallVoipReadiness,
    primaryVoipDefects,
    recommendedCustomerActions,
  } = telemetry;

  const isCritical = overallVoipReadiness === 'CRITICAL_DEFECT';
  const isDegraded = overallVoipReadiness === 'DEGRADED';
  const isOptimal = overallVoipReadiness === 'OPTIMAL';

  const handleCopySummary = () => {
    const summary = `[B3 Networks Customer-Side Diagnostic Dossier]
Session: ${sessionId} (${timestamp})
Customer: ${customerOrgName || 'N/A'} (OS: ${osPlatform} ${osVersion || ''})
Overall VoIP Readiness: ${overallVoipReadiness}

--- Local Endpoint Network ---
Interface: ${localNetwork.adapterType} ${localNetwork.adapterType === 'WIFI' ? `(SSID: ${localNetwork.wifiSsid || 'N/A'}, Signal: ${localNetwork.wifiSignalStrengthPct ?? 'N/A'}%)` : ''}
IP: ${localNetwork.localIp} | Gateway: ${localNetwork.gatewayIp || 'N/A'} | MTU: ${localNetwork.mtu || 1500}
DNS Resolvers: ${localNetwork.dnsServers.join(', ')}

--- NAT & Firewall Discovery (RFC 5389) ---
NAT Type: ${stunNat.natType} (Discovered via ${stunNat.stunServerUsed} in ${stunNat.roundTripMs}ms)
SIP ALG Status: ${stunNat.sipAlgStatus}
Public Binding: ${stunNat.publicIp || 'N/A'}:${stunNat.publicPort || 'N/A'}
Impact: ${stunNat.voipImpactSummary}

--- B3 Voice Infrastructure Probing ---
${targetProbes
  .map(
    (p) =>
      `* ${p.role} (${p.target}:${p.port}/${p.protocol}): ${p.reachability} | RTT: ${p.latencyMs ?? 'N/A'}ms | Loss: ${p.packetLossPct ?? 0}% | Jitter: ${p.jitterMs ?? 0}ms`
  )
  .join('\n')}

--- Detected Defects ---
${primaryVoipDefects.length > 0 ? primaryVoipDefects.map((d) => `- ${d}`).join('\n') : 'None (Optimal network)'}

--- Customer Remediation Actions ---
${recommendedCustomerActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;

    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* HEADER CARD */}
      <div
        className={`p-5 rounded-xl border shadow-lg transition-all ${
          isCritical
            ? 'bg-rose-950/30 border-rose-500/40'
            : isDegraded
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-emerald-950/30 border-emerald-500/40'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl border ${
                isCritical
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : isDegraded
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              }`}
            >
              {isCritical ? (
                <ShieldAlert className="w-6 h-6" />
              ) : isDegraded ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isDegraded
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {overallVoipReadiness.replace('_', ' ')}
                </span>
                <span className="text-xs font-mono text-slate-400">ID: {sessionId}</span>
              </div>
              <h2 className="text-sm font-bold text-white mt-1">
                {customerOrgName || 'Customer Premise Network Telemetry'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Timestamp: {new Date(timestamp).toLocaleString()} • OS: {osPlatform} ({osVersion || 'Generic'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-200 text-xs transition-colors border border-navy-700"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? 'Dossier Copied' : 'Copy Dossier'}</span>
            </button>

            {onCorrelate && (
              <button
                onClick={onCorrelate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Correlate in Investigation Center</span>
              </button>
            )}
          </div>
        </div>

        {/* DEFECT LIST IF ANY */}
        {primaryVoipDefects.length > 0 && (
          <div className="mt-4 pt-3 border-t border-navy-800/80 space-y-1.5">
            <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
              Identified Root Causes:
            </span>
            <div className="space-y-1">
              {primaryVoipDefects.map((defect, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-rose-200">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{defect}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* METRIC GRID: 3 COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: NAT & FIREWALL CLASSIFICATION */}
        <div className="p-4 rounded-xl bg-navy-900 border border-surface-border space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-navy-800 pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" /> NAT & Firewall Traversal
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono border ${
                stunNat.natType === 'SYMMETRIC'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : stunNat.natType === 'FULL_CONE'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {stunNat.natType}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-navy-850">
              <span className="text-slate-400">SIP ALG Status:</span>
              <span
                className={`font-semibold font-mono ${
                  stunNat.sipAlgStatus === 'DETECTED'
                    ? 'text-rose-400'
                    : stunNat.sipAlgStatus === 'NOT_DETECTED'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {stunNat.sipAlgStatus}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-navy-850">
              <span className="text-slate-400">Public IP / Port:</span>
              <span className="font-mono text-slate-200">
                {stunNat.publicIp || 'N/A'}:{stunNat.publicPort || 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-navy-850">
              <span className="text-slate-400">STUN Server & RTT:</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {stunNat.stunServerUsed} ({stunNat.roundTripMs}ms)
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal pt-1 italic">
              {stunNat.voipImpactSummary}
            </p>
          </div>
        </div>

        {/* CARD 2: LOCAL ENDPOINT NETWORK */}
        <div className="p-4 rounded-xl bg-navy-900 border border-surface-border space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-navy-800 pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              {localNetwork.adapterType === 'WIFI' ? (
                <Wifi className="w-4 h-4 text-blue-400" />
              ) : (
                <HardDrive className="w-4 h-4 text-blue-400" />
              )}
              Endpoint Adapter & LAN
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
              {localNetwork.adapterType}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {localNetwork.adapterType === 'WIFI' && (
              <div className="p-2.5 rounded-lg bg-navy-950 border border-navy-800 space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Wi-Fi SSID:</span>
                  <span className="font-mono text-white">{localNetwork.wifiSsid || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Signal Strength:</span>
                  <span
                    className={`font-mono font-bold ${
                      (localNetwork.wifiSignalStrengthPct ?? 0) < 50
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {localNetwork.wifiSignalStrengthPct ?? 'N/A'}%
                  </span>
                </div>
                <div className="w-full bg-navy-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (localNetwork.wifiSignalStrengthPct ?? 0) < 50 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(localNetwork.wifiSignalStrengthPct ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between items-center py-1 border-b border-navy-850">
              <span className="text-slate-400">Local IP / Subnet:</span>
              <span className="font-mono text-slate-200">{localNetwork.localIp}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-navy-850">
              <span className="text-slate-400">Default Gateway:</span>
              <span className="font-mono text-slate-200">{localNetwork.gatewayIp || 'N/A'}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">DNS Resolvers:</span>
              <span className="font-mono text-slate-300 text-[11px]">
                {localNetwork.dnsServers.slice(0, 2).join(', ')}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: B3 VOICE TARGET PROBES */}
        <div className="p-4 rounded-xl bg-navy-900 border border-surface-border space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-navy-800 pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" /> B3 Voice Core Paths
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {targetProbes.length} Targets
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {targetProbes.map((probe, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-navy-950/80 border border-surface-border space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-slate-200 font-semibold flex items-center gap-1.5">
                    <Server className="w-3 h-3 text-blue-400" /> {probe.role}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      probe.reachability === 'REACHABLE'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {probe.reachability}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>RTT: {probe.latencyMs ?? 'N/A'}ms</span>
                  <span>Loss: {probe.packetLossPct ?? 0}%</span>
                  <span>Jitter: {probe.jitterMs ?? 0}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECOMMENDED CUSTOMER ACTIONS CHECKLIST */}
      <div className="p-4 rounded-xl bg-navy-900/90 border border-navy-750 space-y-3 shadow">
        <div className="flex items-center gap-2 border-b border-navy-800 pb-2">
          <FileCheck className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Recommended Customer Premise Remediation Checklist
          </h4>
        </div>

        <div className="space-y-2">
          {recommendedCustomerActions.map((action, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-2 rounded-lg bg-navy-950/50 border border-navy-800/60 text-xs text-slate-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
