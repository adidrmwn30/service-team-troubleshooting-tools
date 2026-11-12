import React, { useState } from 'react';
import {
  Shield,
  Copy,
  Check,
  Terminal,
  UploadCloud,
  Play,
  Sparkles,
  Server,
  AlertCircle,
  Network,
  Cpu,
} from 'lucide-react';
import { CustomerDiagnosticService } from '../services/customerDiagnosticService';
import { CustomerAgentTelemetry } from '../types';

interface CustomerAgentConsoleProps {
  onTelemetryLoaded: (telemetry: CustomerAgentTelemetry) => void;
  isRunning?: boolean;
}

export const CustomerAgentConsole: React.FC<CustomerAgentConsoleProps> = ({
  onTelemetryLoaded,
  isRunning = false,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'import' | 'simulate'>('simulate');
  const [pairingCode, setPairingCode] = useState<string>('B3-7K9M2');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [targetOrg, setTargetOrg] = useState('Acme Corporation Pte Ltd');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleGenerateCode = () => {
    const session = CustomerDiagnosticService.createPairingSession(targetOrg);
    setPairingCode(session.pairingCode);
  };

  const runnerCommand = CustomerDiagnosticService.generateRunnerCommand(pairingCode);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(runnerCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleImportJson = () => {
    setJsonError(null);
    try {
      const parsed = CustomerDiagnosticService.importTelemetryJson(rawJsonInput);
      onTelemetryLoaded(parsed);
      setRawJsonInput('');
    } catch (err: any) {
      setJsonError(err.message || 'Failed to parse customer telemetry JSON.');
    }
  };

  const handleLoadPreset = (preset: 'SYMMETRIC_NAT' | 'WIFI_JITTER' | 'OPTIMAL_WIRED') => {
    const telemetry = CustomerDiagnosticService.getSamplePreset(preset);
    onTelemetryLoaded(telemetry);
  };

  return (
    <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-navy-800 gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Customer-Side Premise Diagnostic Agent
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
            Endpoint Telemetry & NAT
          </span>
        </div>

        {/* Console action mode selector */}
        <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-lg border border-navy-800">
          <button
            onClick={() => setActiveTab('simulate')}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-all ${
              activeTab === 'simulate'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Realistic Presets
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-all ${
              activeTab === 'generate'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pairing Token
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-all ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Import JSON
          </button>
        </div>
      </div>

      {/* TAB 1: REALISTIC PRESET SCENARIOS */}
      {activeTab === 'simulate' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-300 leading-relaxed">
            Diagnose customer LAN & WAN characteristics without manual software installation. Select a realistic customer endpoint scenario to inspect:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Scenario 1: Symmetric NAT & SIP ALG */}
            <div className="p-3.5 rounded-lg bg-navy-950/80 border border-rose-500/30 hover:border-rose-500/60 transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Symmetric NAT + SIP ALG
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                    Critical Defect
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Corporate Fortinet/MikroTik firewall dynamically remaps UDP ports and alters SDP headers. Directly triggers ~30s call drops & 1-way audio.
                </p>
              </div>
              <button
                disabled={isRunning}
                onClick={() => handleLoadPreset('SYMMETRIC_NAT')}
                className="w-full flex items-center justify-center gap-1.5 rounded bg-rose-600/80 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition-all shadow"
              >
                <Play className="w-3 h-3" /> Load Symmetric NAT Telemetry
              </button>
            </div>

            {/* Scenario 2: High Wi-Fi Jitter & Packet Loss */}
            <div className="p-3.5 rounded-lg bg-navy-950/80 border border-amber-500/30 hover:border-amber-500/60 transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-amber-400" /> Weak Wi-Fi & High Jitter
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Degraded
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Softphone connected via congested 2.4GHz Wi-Fi (38% RSSI). Causes 74ms jitter and 6% local packet drop (choppy voice).
                </p>
              </div>
              <button
                disabled={isRunning}
                onClick={() => handleLoadPreset('WIFI_JITTER')}
                className="w-full flex items-center justify-center gap-1.5 rounded bg-amber-600/80 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-all shadow"
              >
                <Play className="w-3 h-3" /> Load Wi-Fi Jitter Telemetry
              </button>
            </div>

            {/* Scenario 3: Optimal Wired Enterprise LAN */}
            <div className="p-3.5 rounded-lg bg-navy-950/80 border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Optimal Wired Ethernet
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    Optimal
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Full Cone NAT with low latency (11ms RTT, 0% loss, 2ms jitter) to B3 Voice SBC and RTP relay pools.
                </p>
              </div>
              <button
                disabled={isRunning}
                onClick={() => handleLoadPreset('OPTIMAL_WIRED')}
                className="w-full flex items-center justify-center gap-1.5 rounded bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-all shadow"
              >
                <Play className="w-3 h-3" /> Load Optimal Wired Telemetry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERATE CUSTOMER COMMAND */}
      {activeTab === 'generate' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-8 space-y-1">
              <label className="text-[11px] font-medium text-slate-400">
                Customer Organization / Ticket Reference
              </label>
              <input
                type="text"
                value={targetOrg}
                onChange={(e) => setTargetOrg(e.target.value)}
                placeholder="e.g. Acme Corp (Ticket #88219)"
                className="w-full rounded-lg bg-navy-950 border border-navy-750 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-4">
              <button
                onClick={handleGenerateCode}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Generate New Pairing Code
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-navy-950 border border-navy-750 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                <Terminal className="w-3.5 h-3.5 text-purple-400" /> Active Diagnostic Session:
              </span>
              <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                Session Code: {pairingCode}
              </span>
            </div>

            <div className="p-3 rounded bg-black/40 text-slate-300 font-mono text-[11px] border border-navy-800 space-y-1">
              <p className="text-emerald-300 font-semibold flex items-center justify-between">
                <span>Session ID: <span className="select-all underline text-emerald-200">{pairingCode}</span></span>
                <span className="text-[10px] text-slate-400 font-normal">Valid for 60 minutes</span>
              </p>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Use this reference code to correlate client-side telemetry directly with this ticket. The diagnostic workflow is entirely localized to this workbench and does not require modifying or hosting files on B3 Portal.
              </p>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal">
              🔒 <strong>Security Policy:</strong> Probing strictly restricts targets to pre-approved voice relays. No modifications to B3 Portal or production systems occur.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: IMPORT RAW JSON */}
      {activeTab === 'import' && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
            <span>Paste Customer Telemetry JSON</span>
            <span className="text-[10px] text-slate-500">Exported from customer script or web probe</span>
          </label>
          <textarea
            value={rawJsonInput}
            onChange={(e) => setRawJsonInput(e.target.value)}
            placeholder='{"sessionId": "CAG-1002", "localNetwork": {...}, "stunNat": {...}, "targetProbes": [...]}'
            rows={4}
            className="w-full rounded-lg bg-navy-950 border border-navy-750 p-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
          />
          {jsonError && (
            <div className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {jsonError}
            </div>
          )}
          <button
            disabled={!rawJsonInput.trim()}
            onClick={handleImportJson}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Parse & Analyze Customer Telemetry
          </button>
        </div>
      )}
    </div>
  );
};
