import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Globe,
  Shield,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trash2,
  Save,
  LogIn,
  LogOut,
  RefreshCw,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { GlobalpingService } from '../network-diagnostics/services/globalpingService';

const GLOBALPING_TOKEN_STORAGE_KEY = 'b3_globalping_api_token';

export const SettingsView: React.FC = () => {
  // B3 SIEM Session State
  const [b3Session, setB3Session] = useState<{
    active: boolean;
    maskedToken?: string;
    secureStorageAvailable?: boolean;
  }>({ active: false });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Globalping Token State
  const [globalpingToken, setGlobalpingToken] = useState('');
  const [savedTokenNotice, setSavedTokenNotice] = useState(false);

  // Diagnostic Storage State
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [historyClearedNotice, setHistoryClearedNotice] = useState(false);

  // Load initial settings and session
  useEffect(() => {
    refreshSession();
    refreshHistoryCount();

    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(GLOBALPING_TOKEN_STORAGE_KEY);
      if (stored) setGlobalpingToken(stored);
    }
  }, []);

  const refreshSession = async () => {
    if (window.electronAPI?.getCallQualitySession) {
      try {
        const res = await window.electronAPI.getCallQualitySession();
        if (res) setB3Session(res);
      } catch {
        // Fallback or dev mode
      }
    }
  };

  const refreshHistoryCount = () => {
    try {
      const history = GlobalpingService.getHistory();
      setHistoryCount(history.length);
    } catch {
      setHistoryCount(0);
    }
  };

  const handleOpenLoginWindow = async () => {
    if (!window.electronAPI?.openB3LoginWindow) {
      setAuthStatusMessage({
        type: 'error',
        text: 'B3 Login Window is only supported in the Electron desktop app environment.',
      });
      return;
    }

    setIsAuthenticating(true);
    setAuthStatusMessage(null);

    try {
      const res = await window.electronAPI.openB3LoginWindow();
      if (res?.success) {
        setB3Session({
          active: true,
          maskedToken: res.maskedToken,
          secureStorageAvailable: true,
        });
        setAuthStatusMessage({
          type: 'success',
          text: `Successfully authenticated B3 session (${res.maskedToken}).`,
        });
      } else if (res?.cancelled) {
        setAuthStatusMessage({
          type: 'error',
          text: 'Login window closed before authentication was completed.',
        });
      } else if (res?.error) {
        setAuthStatusMessage({
          type: 'error',
          text: res.error,
        });
      }
    } catch (err: any) {
      setAuthStatusMessage({
        type: 'error',
        text: err?.message || 'Authentication window encountered an error.',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSaveManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    setAuthStatusMessage(null);

    if (window.electronAPI?.saveCallQualitySession) {
      try {
        const res = await window.electronAPI.saveCallQualitySession(manualTokenInput.trim());
        if (res.success) {
          setB3Session({
            active: true,
            maskedToken: res.maskedToken,
            secureStorageAvailable: res.secureStorageAvailable,
          });
          setManualTokenInput('');
          setShowManualAuth(false);
          setAuthStatusMessage({
            type: 'success',
            text: `Manual session token stored securely (${res.maskedToken}).`,
          });
        } else {
          setAuthStatusMessage({
            type: 'error',
            text: res.error || 'Failed to parse session token or cURL.',
          });
        }
      } catch (err: any) {
        setAuthStatusMessage({
          type: 'error',
          text: err?.message || 'Failed to save session.',
        });
      }
    } else {
      setAuthStatusMessage({
        type: 'error',
        text: 'Session storage is only available within the Electron runtime.',
      });
    }
  };

  const handleClearB3Session = async () => {
    if (window.electronAPI?.clearCallQualitySession) {
      try {
        await window.electronAPI.clearCallQualitySession();
        setB3Session({ active: false });
        setAuthStatusMessage({
          type: 'success',
          text: 'B3 session disconnected and securely removed from Keychain/storage.',
        });
      } catch (err: any) {
        setAuthStatusMessage({
          type: 'error',
          text: err?.message || 'Failed to clear session.',
        });
      }
    } else {
      setB3Session({ active: false });
    }
  };

  const handleSaveGlobalpingToken = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (globalpingToken.trim()) {
        window.localStorage.setItem(GLOBALPING_TOKEN_STORAGE_KEY, globalpingToken.trim());
      } else {
        window.localStorage.removeItem(GLOBALPING_TOKEN_STORAGE_KEY);
      }
      setSavedTokenNotice(true);
      setTimeout(() => setSavedTokenNotice(false), 2500);
    }
  };

  const handleClearGlobalpingToken = () => {
    setGlobalpingToken('');
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(GLOBALPING_TOKEN_STORAGE_KEY);
      setSavedTokenNotice(true);
      setTimeout(() => setSavedTokenNotice(false), 2500);
    }
  };

  const handleClearHistory = () => {
    GlobalpingService.clearHistory();
    refreshHistoryCount();
    setHistoryClearedNotice(true);
    setTimeout(() => setHistoryClearedNotice(false), 3000);
  };

  return (
    <div className="flex flex-col min-h-full bg-navy-950 text-slate-100 p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1 border-b border-surface-border pb-4">
        <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <span>Workbench Settings & Engine Configuration</span>
        </h1>
        <p className="text-xs text-slate-400">
          Configure SIEM credentials, multi-vantage probing keys, VoIP diagnostic quality thresholds, and Decision Engine SLA guardrails.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: B3 Session & Authentication */}
        <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  B3 Networks SIEM Session Management
                </h3>
                <p className="text-[11px] text-slate-400">
                  Read-only authentication used exclusively for querying UniversalEvent SIEM logs.
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-mono px-2.5 py-0.5 rounded border flex items-center gap-1.5 ${
                b3Session.active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
              }`}
            >
              {b3Session.active ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-slate-400" />
                  <span>Not Connected</span>
                </>
              )}
            </span>
          </div>

          {authStatusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                authStatusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/30 text-red-300'
              }`}
            >
              {authStatusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{authStatusMessage.text}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Session Status:</span>
              <span className="font-mono text-slate-200">
                {b3Session.active ? `Active (${b3Session.maskedToken})` : 'No session token configured'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Storage Protection:</span>
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                macOS Keychain / SafeStorage Encrypted (AES-256)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Portal State Safety:</span>
              <span className="font-mono text-blue-400 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                100% Sterile (Read-only UniversalEvent GET queries only)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleOpenLoginWindow}
              disabled={isAuthenticating}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              <span>{b3Session.active ? 'Re-authenticate via B3 Login' : 'Sign In via B3 Login Window'}</span>
            </button>

            <button
              onClick={() => setShowManualAuth(!showManualAuth)}
              className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 border border-surface-border text-xs font-medium transition"
            >
              {showManualAuth ? 'Hide Manual Input' : 'Paste cURL / Session Token'}
            </button>

            {b3Session.active && (
              <button
                onClick={handleClearB3Session}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-xs font-medium flex items-center gap-1.5 transition ml-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect Session</span>
              </button>
            )}
          </div>

          {showManualAuth && (
            <div className="p-3.5 rounded-lg bg-navy-950 border border-surface-border space-y-2 mt-2">
              <label className="text-[11px] font-medium text-slate-300 block">
                Paste Browser cURL command or sessionToken:
              </label>
              <textarea
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                placeholder="curl 'https://portal.b3networks.com/_a/siem/private/v1/universalEvent...' -H 'cookie: sessionToken=...'"
                rows={3}
                className="w-full bg-navy-900 border border-surface-border rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowManualAuth(false)}
                  className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveManualToken}
                  disabled={!manualTokenInput.trim()}
                  className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium disabled:opacity-50"
                >
                  Save Credentials
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Globalping API Integration */}
        <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Globalping.io API Configuration
                </h3>
                <p className="text-[11px] text-slate-400">
                  Multi-vantage public network probing for Ping, Traceroute, DNS, MTR, and HTTP tests.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>Active (Multi-Vantage Probing)</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-300">
                  Globalping API Token (Optional — For Elevated Quotas & Priority Routing)
                </label>
                {savedTokenNotice && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> Token configuration updated!
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={globalpingToken}
                  onChange={(e) => setGlobalpingToken(e.target.value)}
                  placeholder="Bearer globalping_token (optional)"
                  className="flex-1 bg-navy-950 border border-surface-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={handleSaveGlobalpingToken}
                  className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
                {globalpingToken && (
                  <button
                    onClick={handleClearGlobalpingToken}
                    className="px-2.5 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white border border-surface-border text-xs transition"
                    title="Clear Token"
                  >
                    Clear
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                Standard tier allows 500 free public measurements/IP/hour without a key. Entering an API key elevates concurrent probe limits for enterprise carrier investigations.
              </span>
            </div>

            {/* Vantage Point Zones Reference */}
            <div className="p-3 rounded-lg bg-navy-950/60 border border-surface-border space-y-2">
              <span className="text-[11px] font-medium text-slate-300 block">
                Standard Vantage Points Configured in Multi-Module Pipeline:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { code: 'SIN', name: 'Singapore (B3 Core SG)' },
                  { code: 'HKG', name: 'Hong Kong (APAC Edge)' },
                  { code: 'TYO', name: 'Tokyo (Japan NTT/KDDI)' },
                  { code: 'SYD', name: 'Sydney (Telstra/Equinix)' },
                  { code: 'FRA', name: 'Frankfurt (DE-CIX Europe)' },
                  { code: 'LON', name: 'London (LINX UK)' },
                  { code: 'IAD', name: 'US East (Virginia)' },
                  { code: 'SJC', name: 'US West (Silicon Valley)' },
                ].map((v) => (
                  <span
                    key={v.code}
                    className="px-2 py-0.5 rounded bg-navy-900 border border-surface-border text-[10px] font-mono text-slate-300"
                  >
                    <strong className="text-amber-400">{v.code}</strong>: {v.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: VoIP Diagnostic Quality Thresholds & SLA Parameters */}
        <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  VoIP Quality SLA Standards & Diagnostic Thresholds
                </h3>
                <p className="text-[11px] text-slate-400">
                  Deterministic thresholds used by Call Forensics and the Decision Engine to classify degradation.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              ITU-T & RFC Standard Guardrails
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* MOS Score Thresholds */}
            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-2">
              <div className="flex items-center justify-between border-b border-surface-border/50 pb-1.5">
                <span className="font-medium text-slate-200">MOS Score (ITU-T G.107 E-Model)</span>
                <span className="text-[10px] font-mono text-purple-400">Target: ≥ 4.0</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-emerald-400">MOS ≥ 4.00</span>
                  <span className="text-slate-400">Optimal (Toll/HD Voice Quality)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">3.50 ≤ MOS &lt; 4.00</span>
                  <span className="text-slate-400">Acceptable (Cellular/PSTN Normal)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">MOS &lt; 3.50</span>
                  <span className="text-slate-400">Degraded (Noticeable Audio Loss)</span>
                </div>
              </div>
            </div>

            {/* Jitter Thresholds */}
            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-2">
              <div className="flex items-center justify-between border-b border-surface-border/50 pb-1.5">
                <span className="font-medium text-slate-200">Jitter Variance (RFC 3550)</span>
                <span className="text-[10px] font-mono text-purple-400">Target: &lt; 20 ms</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-emerald-400">Jitter &lt; 20 ms</span>
                  <span className="text-slate-400">Normal (Stable Jitter Buffer)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">20 ms ≤ Jitter ≤ 40 ms</span>
                  <span className="text-slate-400">Elevated (Adaptive Buffer Stretch)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Jitter &gt; 40 ms</span>
                  <span className="text-slate-400">Critical (Buffer Discards/Clipping)</span>
                </div>
              </div>
            </div>

            {/* Packet Loss Thresholds */}
            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-2">
              <div className="flex items-center justify-between border-b border-surface-border/50 pb-1.5">
                <span className="font-medium text-slate-200">RTP Packet Loss Ratio</span>
                <span className="text-[10px] font-mono text-purple-400">Target: &lt; 1.0%</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-emerald-400">Loss &lt; 1.0%</span>
                  <span className="text-slate-400">Undetectable / PLC Concealed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">1.0% ≤ Loss ≤ 5.0%</span>
                  <span className="text-slate-400">Degraded (Occasional Word Gaps)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Loss &gt; 5.0%</span>
                  <span className="text-slate-400">Critical (Severe Audio Dropout)</span>
                </div>
              </div>
            </div>

            {/* SIP Signaling Timers */}
            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-2">
              <div className="flex items-center justify-between border-b border-surface-border/50 pb-1.5">
                <span className="font-medium text-slate-200">SIP Timers & Signaling SLA</span>
                <span className="text-[10px] font-mono text-purple-400">RFC 3261 / 4028</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-cyan-400">SIP Timer H</span>
                  <span className="text-slate-400">32.0 s (64 × T1 ACK Timeout)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyan-400">Session-Expires</span>
                  <span className="text-slate-400">900 s (Min-SE: 90 s Keepalive)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyan-400">Signaling SLA</span>
                  <span className="text-slate-400">&lt; 2000 ms (100 Trying / 180 Ringing)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Investigation Decision Engine & SLA Guardrails */}
        <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Investigation Decision Engine Guardrails
                </h3>
                <p className="text-[11px] text-slate-400">
                  Automated correlation rules that evaluate Call Forensics + Network Diagnostics.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Deterministic Rules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Customer Ready Threshold</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Dossier is only approved for customer dissemination when Evidence Score is <strong>≥ 8.0 / 10</strong> with verified SIP signaling or Globalping traceroute proof.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Carrier Escalation Hold</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tickets referencing carrier SIP 503/504 errors are held in <strong>CARRIER_HOLD</strong> if evidence confidence is below 5.0, prompting multi-vantage verification.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-navy-950/60 border border-surface-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Sanitization & PII Redaction</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Customer-facing summaries automatically redact internal B3 SBC core IPs, auth bearer tokens, and internal carrier interconnect circuit IDs.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Diagnostic Cache & History Management */}
        <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Local Diagnostic Cache & Retention
                </h3>
                <p className="text-[11px] text-slate-400">
                  Globalping measurement records and local telemetry storage management.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              7-Day Rolling Retention
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-navy-950/60 border border-surface-border text-xs">
            <div>
              <span className="text-slate-300 font-medium block">
                Cached Network Diagnostic Tests: <strong className="text-white font-mono">{historyCount}</strong> record{historyCount === 1 ? '' : 's'}
              </span>
              <span className="text-[11px] text-slate-400">
                Records older than 7 days are automatically pruned on each measurement dispatch.
              </span>
            </div>

            <button
              onClick={handleClearHistory}
              disabled={historyCount === 0}
              className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-red-300 border border-surface-border text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Diagnostic Cache</span>
            </button>
          </div>

          {historyClearedNotice && (
            <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Diagnostic history cache cleared successfully.
            </p>
          )}
        </div>

        {/* Section 6: System & Framework Versions */}
        <div className="p-4 rounded-xl bg-navy-900/60 border border-surface-border text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span className="font-medium text-slate-300">Service Team Troubleshooting Tools v1.0 • L2 Support Workbench</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Electron 33 • React 18 • TypeScript 5.6 • Tailwind CSS
          </span>
        </div>
      </div>
    </div>
  );
};