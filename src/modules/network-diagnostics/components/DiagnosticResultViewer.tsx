import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FolderGit2,
  Globe,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Radio,
  Server,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import {
  DiagnosticResultPayload,
  NetworkDiagnosticResult,
  NetworkProbeHop,
} from '../types';
import { useWorkbench } from '../../../shared/context/WorkbenchContext';

interface DiagnosticResultViewerProps {
  result: NetworkDiagnosticResult | null;
  isRunning?: boolean;
}

export const DiagnosticResultViewer: React.FC<DiagnosticResultViewerProps> = ({
  result,
  isRunning = false,
}) => {
  const { compileToInvestigationCenter } = useWorkbench();
  const [showRawOutput, setShowRawOutput] = useState<boolean>(false);
  const [copiedRaw, setCopiedRaw] = useState<boolean>(false);

  if (isRunning) {
    return (
      <div className="p-12 text-center rounded-xl bg-navy-900/90 border border-surface-border flex flex-col items-center justify-center space-y-4 shadow-lg">
        <div className="w-14 h-14 rounded-full bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 animate-pulse">
          <Activity className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-semibold text-slate-200 block">
            Executing Globalping Measurement...
          </span>
          <p className="text-xs text-slate-400 max-w-md">
            Distributing probe measurement to worldwide Globalping vantage point, waiting for ICMP/UDP/TCP network telemetry.
          </p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-12 text-center rounded-xl bg-navy-900/90 border border-surface-border flex flex-col items-center justify-center space-y-3 shadow-lg">
        <div className="w-12 h-12 rounded-full bg-navy-950 border border-navy-800 flex items-center justify-center text-slate-500">
          <Globe className="w-6 h-6 text-slate-400" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-300 block">
            No Active Diagnostic Selected
          </span>
          <p className="text-[11px] text-slate-500 max-w-md">
            Configure a target above and click <strong>Run Diagnostic</strong>, or select a previous run from the Measurement History table below.
          </p>
        </div>
      </div>
    );
  }

  const handleCopyRaw = () => {
    const raw = result.results?.data?.rawOutput || JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(raw);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const isSuccess = result.status === 'completed';
  const isFailed = result.status === 'failed';
  const isCancelled = result.status === 'cancelled';

  return (
    <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-5 shadow-lg">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
              isSuccess
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                : isFailed
                ? 'bg-red-950/40 border-red-500/40 text-red-400'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-5 h-5" />}
            {isFailed && <XCircle className="w-5 h-5" />}
            {isCancelled && <AlertTriangle className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                {result.diagnosticType}
              </span>
              <span className="text-sm font-semibold text-slate-100 font-mono">
                {result.target}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${
                  isSuccess
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : isFailed
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {result.status}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {new Date(result.startedAt).toLocaleTimeString()} ({new Date(result.startedAt).toLocaleDateString()})
              </span>
              <span>•</span>
              <span className="font-mono text-slate-400">ID: {result.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Probe Vantage Info Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-950 border border-surface-border text-xs">
            <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="text-left">
              <span className="font-medium text-slate-200 block text-[11px]">
                {result.probeInfo?.city || 'Probe'}, {result.probeInfo?.country || result.probeLocation}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {result.probeInfo?.network || (result.probeInfo?.asn ? `AS${result.probeInfo.asn}` : 'Public Globalping Probe')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => compileToInvestigationCenter(undefined, result)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
            title="Attach this probe result directly to Investigation Center"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Attach to Investigation ➔</span>
          </button>
        </div>
      </div>

      {/* Error Message if Failed */}
      {result.errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-red-200">Execution Error:</span>
            <span>{result.errorMessage}</span>
          </div>
        </div>
      )}

      {/* Diagnostic Interpretation & VoIP Reality Check */}
      {result.interpretation && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Factual Technical Observations */}
          <div className="md:col-span-7 p-3.5 rounded-lg bg-navy-950 border border-surface-border space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Technical Observations</span>
            </span>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
              {result.interpretation.observations.map((obs, idx) => (
                <li key={idx} className="leading-relaxed">
                  {obs}
                </li>
              ))}
            </ul>
          </div>

          {/* VoIP Reality Check Guardrail Box */}
          <div className="md:col-span-5 p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>VoIP Reality Check</span>
            </span>
            <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4">
              {result.interpretation.voipGuardrailNotes.map((note, idx) => (
                <li key={idx} className="leading-snug">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Type-Specific Metric Presentation */}
      {result.results && (
        <div>
          {result.results.type === 'ping' && renderPingResults(result.results.data)}
          {result.results.type === 'traceroute' && renderTracerouteResults(result.results.data)}
          {result.results.type === 'dns' && renderDnsResults(result.results.data)}
          {result.results.type === 'mtr' && renderMtrResults(result.results.data)}
          {result.results.type === 'http' && renderHttpResults(result.results.data)}
        </div>
      )}

      {/* Raw Output Terminal Toggle */}
      <div className="pt-2 border-t border-navy-800 flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowRawOutput(!showRawOutput)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>{showRawOutput ? 'Hide Raw Probe Output' : 'Show Raw Probe Output'}</span>
          </button>

          {showRawOutput && (
            <button
              onClick={handleCopyRaw}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-purple-300 px-2 py-0.5 rounded bg-navy-950 border border-navy-800 transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedRaw ? 'Copied!' : 'Copy Output'}</span>
            </button>
          )}
        </div>

        {showRawOutput && (
          <pre className="p-3.5 rounded-lg bg-navy-950 border border-surface-border text-slate-300 font-mono text-xs overflow-x-auto max-h-60 whitespace-pre-wrap leading-relaxed">
            {result.results?.data?.rawOutput || JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

/* ========================================================
   SUB-RENDERERS FOR DIAGNOSTIC TYPES
   ======================================================== */

function renderPingResults(ping: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">Packet Loss</span>
          <span
            className={`text-lg font-bold font-mono ${
              ping.packetLossPct === 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {ping.packetLossPct}%
          </span>
          <span className="text-[10px] text-slate-500 block">
            {ping.packetsReceived} / {ping.packetsSent} received
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">Average Latency</span>
          <span className="text-lg font-bold font-mono text-purple-300">
            {ping.avgRttMs !== undefined ? `${ping.avgRttMs} ms` : 'N/A'}
          </span>
          <span className="text-[10px] text-slate-500 block">RTT mean</span>
        </div>

        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">Min / Max Latency</span>
          <span className="text-sm font-bold font-mono text-slate-200">
            {ping.minRttMs ?? '—'} ms / {ping.maxRttMs ?? '—'} ms
          </span>
          <span className="text-[10px] text-slate-500 block">Round-trip extremes</span>
        </div>

        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">Jitter / StdDev</span>
          <span className="text-sm font-bold font-mono text-slate-200">
            {ping.stdDevMs !== undefined ? `${ping.stdDevMs} ms` : 'N/A'}
          </span>
          <span className="text-[10px] text-slate-500 block">Delay variation</span>
        </div>
      </div>
    </div>
  );
}

function renderTracerouteResults(trace: any) {
  const hops: NetworkProbeHop[] = trace.hops || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">
          Route Hops Table ({hops.length} total hops traversed)
        </span>
        <span
          className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
            trace.destinationReached
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {trace.destinationReached ? 'Destination Reached' : 'Destination Incomplete'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-navy-950">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-navy-900/80 text-slate-400 text-[10px] uppercase border-b border-surface-border">
            <tr>
              <th className="py-2.5 px-3 w-16">Hop #</th>
              <th className="py-2.5 px-3">IP Address</th>
              <th className="py-2.5 px-3">Hostname / PTR</th>
              <th className="py-2.5 px-3 text-right">Latency</th>
              <th className="py-2.5 px-3 text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-850">
            {hops.map((hop) => (
              <tr key={hop.hopNumber} className="hover:bg-navy-900/50 transition-colors">
                <td className="py-2 px-3 text-slate-400 font-bold">#{hop.hopNumber}</td>
                <td className="py-2 px-3 text-slate-200">{hop.address}</td>
                <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{hop.hostname || '—'}</td>
                <td className="py-2 px-3 text-right">
                  {hop.latency !== undefined ? (
                    <span
                      className={`font-bold ${
                        hop.latency < 100
                          ? 'text-emerald-400'
                          : hop.latency < 200
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {hop.latency} ms
                    </span>
                  ) : (
                    <span className="text-slate-500">* * *</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      hop.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : hop.status === 'WARN'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : hop.status === 'TIMEOUT'
                        ? 'bg-slate-700/20 text-slate-400 border-slate-700'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {hop.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderDnsResults(dns: any) {
  const answers = dns.answers || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">
          DNS Query: <strong className="font-mono text-purple-300">{dns.queryTarget}</strong> ({dns.queryType})
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">
            Lookup RTT: <strong className="text-slate-200">{dns.roundTripMs ?? '—'} ms</strong>
          </span>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
              dns.statusCode === 'NOERROR'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {dns.statusCode}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-navy-950">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-navy-900/80 text-slate-400 text-[10px] uppercase border-b border-surface-border">
            <tr>
              <th className="py-2 px-3">Record Name</th>
              <th className="py-2 px-3 w-20">Type</th>
              <th className="py-2 px-3 w-20">TTL</th>
              <th className="py-2 px-3">Value / Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-850">
            {answers.length > 0 ? (
              answers.map((ans: any, idx: number) => (
                <tr key={idx} className="hover:bg-navy-900/50">
                  <td className="py-2 px-3 text-slate-300">{ans.name}</td>
                  <td className="py-2 px-3 text-purple-300 font-bold">{ans.type}</td>
                  <td className="py-2 px-3 text-slate-400">{ans.ttl ?? '—'}s</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">{ans.value}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-500">
                  No records returned for query type {dns.queryType}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderMtrResults(mtr: any) {
  const hops: NetworkProbeHop[] = mtr.hops || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">
          MTR Continuous Loss & Latency Hop Analysis ({hops.length} hops)
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          Destination: {mtr.destination}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-navy-950">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-navy-900/80 text-slate-400 text-[10px] uppercase border-b border-surface-border">
            <tr>
              <th className="py-2 px-3 w-16">Hop #</th>
              <th className="py-2 px-3">Gateway Address</th>
              <th className="py-2 px-3">Hostname</th>
              <th className="py-2 px-3 text-right">Loss %</th>
              <th className="py-2 px-3 text-right">Avg RTT</th>
              <th className="py-2 px-3 text-center w-20">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-850">
            {hops.map((hop) => (
              <tr key={hop.hopNumber} className="hover:bg-navy-900/50">
                <td className="py-2 px-3 text-slate-400 font-bold">#{hop.hopNumber}</td>
                <td className="py-2 px-3 text-slate-200">{hop.address}</td>
                <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{hop.hostname || '—'}</td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`font-bold ${
                      (hop.packetLoss ?? 0) === 0
                        ? 'text-emerald-400'
                        : (hop.packetLoss ?? 0) < 20
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {hop.packetLoss ?? 0}%
                  </span>
                </td>
                <td className="py-2 px-3 text-right text-purple-300 font-bold">
                  {hop.latency !== undefined ? `${hop.latency} ms` : '—'}
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      hop.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : hop.status === 'WARN'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {hop.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderHttpResults(http: any) {
  const statusCode = http.statusCode || 0;
  const is2xx = statusCode >= 200 && statusCode < 300;
  const is3xx = statusCode >= 300 && statusCode < 400;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">HTTP Status</span>
          <span
            className={`text-xl font-bold font-mono ${
              is2xx ? 'text-emerald-400' : is3xx ? 'text-blue-400' : 'text-red-400'
            }`}
          >
            {statusCode} {http.statusText || ''}
          </span>
          <span className="text-[10px] text-slate-500 block truncate">
            Target: {http.effectiveUrl}
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">Response Time</span>
          <span className="text-xl font-bold font-mono text-purple-300">
            {http.responseTimeMs} ms
          </span>
          <span className="text-[10px] text-slate-500 block">Total turnaround</span>
        </div>

        <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border">
          <span className="text-[10px] font-medium uppercase text-slate-400 block">TLS Security</span>
          <span className="text-sm font-bold font-mono text-slate-200">
            {http.tlsInfo?.protocol || 'TLS'}
          </span>
          <span className="text-[10px] text-emerald-400 block">
            {http.tlsInfo?.authorized ? 'Certificate Valid' : 'Cipher Negotiated'}
          </span>
        </div>
      </div>

      {http.headers && Object.keys(http.headers).length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 block">Response Headers:</span>
          <div className="overflow-x-auto rounded-lg border border-surface-border bg-navy-950 max-h-40 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <tbody className="divide-y divide-navy-850">
                {Object.entries(http.headers).map(([key, val]: any) => (
                  <tr key={key} className="hover:bg-navy-900/50">
                    <td className="py-1 px-3 text-slate-400 w-1/3">{key}</td>
                    <td className="py-1 px-3 text-slate-200 truncate">{String(val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
