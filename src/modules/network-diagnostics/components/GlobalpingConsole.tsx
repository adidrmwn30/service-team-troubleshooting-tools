import React from 'react';
import {
  Globe,
  Play,
  Square,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DiagnosticType } from '../types';

export interface LocationOption {
  label: string;
  country?: string;
  continent?: string;
  city?: string;
}

export const PROBE_LOCATIONS: LocationOption[] = [
  { label: 'Singapore (SG) — Asia Pacific Hub', country: 'SG', continent: 'AS' },
  { label: 'Hong Kong (HK) — East Asia', country: 'HK', continent: 'AS' },
  { label: 'Tokyo, Japan (JP) — East Asia', country: 'JP', continent: 'AS' },
  { label: 'Sydney, Australia (AU) — Oceania', country: 'AU', continent: 'OC' },
  { label: 'Frankfurt, Germany (DE) — Europe Central', country: 'DE', continent: 'EU' },
  { label: 'London, UK (GB) — Europe West', country: 'GB', continent: 'EU' },
  { label: 'New York, US (US East) — North America', country: 'US', continent: 'NA' },
  { label: 'San Jose, US (US West) — North America', country: 'US', continent: 'NA' },
  { label: 'Global Auto (Closest Probe)', continent: undefined },
];

export const PRESET_VOIP_TARGETS = [
  { label: 'B3 Singapore SIP SBC', target: 'sip.b3networks.com', type: 'dns' as DiagnosticType },
  { label: 'B3 Regional Edge Gateway', target: 'edge.b3networks.com', type: 'ping' as DiagnosticType },
  { label: 'Public DNS 1.1.1.1 (Cloudflare)', target: '1.1.1.1', type: 'ping' as DiagnosticType },
  { label: 'Public DNS 8.8.8.8 (Google)', target: '8.8.8.8', type: 'traceroute' as DiagnosticType },
  { label: 'B3 Portal API (HTTPS)', target: 'portal.b3networks.com', type: 'http' as DiagnosticType },
];

interface GlobalpingConsoleProps {
  target: string;
  onTargetChange: (value: string) => void;
  diagnosticType: DiagnosticType;
  onDiagnosticTypeChange: (type: DiagnosticType) => void;
  selectedLocation: LocationOption;
  onLocationChange: (loc: LocationOption) => void;
  dnsQueryType: string;
  onDnsQueryTypeChange: (type: string) => void;
  httpMethod: 'HEAD' | 'GET';
  onHttpMethodChange: (method: 'HEAD' | 'GET') => void;
  packetsCount: number;
  onPacketsCountChange: (count: number) => void;
  isRunning: boolean;
  progressMessage: string;
  elapsedSeconds: number;
  onRun: () => void;
  onCancel: () => void;
  validationError?: string;
}

export const GlobalpingConsole: React.FC<GlobalpingConsoleProps> = ({
  target,
  onTargetChange,
  diagnosticType,
  onDiagnosticTypeChange,
  selectedLocation,
  onLocationChange,
  dnsQueryType,
  onDnsQueryTypeChange,
  httpMethod,
  onHttpMethodChange,
  packetsCount,
  onPacketsCountChange,
  isRunning,
  progressMessage,
  elapsedSeconds,
  onRun,
  onCancel,
  validationError,
}) => {
  const diagnosticTypes: Array<{ id: DiagnosticType; label: string; icon: string }> = [
    { id: 'ping', label: 'Ping', icon: '⚡' },
    { id: 'traceroute', label: 'Traceroute', icon: '🛣️' },
    { id: 'dns', label: 'DNS Lookup', icon: '🔍' },
    { id: 'mtr', label: 'MTR', icon: '📊' },
    { id: 'http', label: 'HTTP / TLS', icon: '🌐' },
  ];

  return (
    <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
      <div className="flex items-center justify-between border-b border-navy-800 pb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Globalping Network Probe Console
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
            Official Globalping API v1
          </span>
        </div>

        {/* Preset shortcut buttons */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-[11px] flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick Presets:
          </span>
          {PRESET_VOIP_TARGETS.slice(0, 3).map((p) => (
            <button
              key={p.target}
              onClick={() => {
                onTargetChange(p.target);
                onDiagnosticTypeChange(p.type);
              }}
              disabled={isRunning}
              className="px-2 py-0.5 rounded bg-navy-950 border border-navy-750 hover:border-purple-500/50 hover:text-purple-200 text-[11px] font-mono transition-colors"
            >
              {p.target}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Target input */}
        <div className="md:col-span-5 space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
            <span>Target Hostname / IP / URL</span>
            {validationError && (
              <span className="text-red-400 text-[10px] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {validationError}
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              disabled={isRunning}
              placeholder="e.g. sip.b3networks.com or 103.24.112.5"
              className={`w-full bg-navy-950 border ${
                validationError ? 'border-red-500/60' : 'border-surface-border'
              } rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors`}
            />
            {target && !isRunning && (
              <button
                onClick={() => onTargetChange('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
                title="Clear input"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Diagnostic Type */}
        <div className="md:col-span-4 space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300">
            Diagnostic Type
          </label>
          <div className="grid grid-cols-5 gap-1">
            {diagnosticTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => onDiagnosticTypeChange(t.id)}
                disabled={isRunning}
                className={`px-1.5 py-2 rounded-md text-[11px] font-medium border text-center transition-all ${
                  diagnosticType === t.id
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                    : 'bg-navy-950 border-surface-border text-slate-400 hover:text-slate-200 hover:bg-navy-900'
                } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="text-xs">{t.icon}</div>
                <div className="truncate">{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Probe Location */}
        <div className="md:col-span-3 space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300">
            Probe Vantage Point
          </label>
          <select
            value={selectedLocation.label}
            onChange={(e) => {
              const found = PROBE_LOCATIONS.find((loc) => loc.label === e.target.value);
              if (found) onLocationChange(found);
            }}
            disabled={isRunning}
            className="w-full bg-navy-950 border border-surface-border rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            {PROBE_LOCATIONS.map((loc) => (
              <option key={loc.label} value={loc.label} className="bg-navy-900">
                {loc.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Type Options */}
      {diagnosticType === 'dns' && (
        <div className="pt-2 border-t border-navy-800 flex items-center gap-3 text-xs">
          <span className="text-slate-400 text-[11px]">DNS Query Type:</span>
          {['A', 'AAAA', 'SRV', 'NAPTR', 'CNAME', 'TXT', 'MX'].map((rec) => (
            <button
              key={rec}
              onClick={() => onDnsQueryTypeChange(rec)}
              disabled={isRunning}
              className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                dnsQueryType === rec
                  ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                  : 'bg-navy-950 border-surface-border text-slate-400 hover:text-slate-200'
              }`}
            >
              {rec}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 italic ml-auto">
            (SRV/NAPTR recommended for VoIP SIP SBC discovery)
          </span>
        </div>
      )}

      {diagnosticType === 'http' && (
        <div className="pt-2 border-t border-navy-800 flex items-center gap-3 text-xs">
          <span className="text-slate-400 text-[11px]">HTTP Method:</span>
          {(['HEAD', 'GET'] as const).map((method) => (
            <button
              key={method}
              onClick={() => onHttpMethodChange(method)}
              disabled={isRunning}
              className={`px-3 py-1 rounded text-[11px] font-mono border transition-colors ${
                httpMethod === method
                  ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                  : 'bg-navy-950 border-surface-border text-slate-400 hover:text-slate-200'
              }`}
            >
              {method}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 italic ml-auto">
            Tests TCP connection, TLS handshake negotiation, and HTTP response headers
          </span>
        </div>
      )}

      {(diagnosticType === 'ping' || diagnosticType === 'mtr') && (
        <div className="pt-2 border-t border-navy-800 flex items-center gap-3 text-xs">
          <span className="text-slate-400 text-[11px]">Packets Count:</span>
          {[3, 5, 10].map((count) => (
            <button
              key={count}
              onClick={() => onPacketsCountChange(count)}
              disabled={isRunning}
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                packetsCount === count
                  ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                  : 'bg-navy-950 border-surface-border text-slate-400 hover:text-slate-200'
              }`}
            >
              {count} pkts
            </button>
          ))}
        </div>
      )}

      {/* Action Bar */}
      <div className="pt-3 border-t border-navy-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs">
          {isRunning ? (
            <div className="flex items-center gap-2 text-purple-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span className="font-medium text-[11px]">{progressMessage || 'Polling measurement probe...'}</span>
              <span className="font-mono text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800">
                {elapsedSeconds}s
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ready to dispatch via Globalping API</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors shadow-sm"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Cancel Measurement</span>
            </button>
          ) : (
            <button
              onClick={onRun}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-purple-900/30"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run {diagnosticType.toUpperCase()} Diagnostic</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
