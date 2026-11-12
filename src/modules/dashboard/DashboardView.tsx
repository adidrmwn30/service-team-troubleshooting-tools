import React from 'react';
import {
  PhoneCall,
  Globe,
  FolderGit2,
  Settings,
  ArrowRight,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Server,
  Zap,
  Info,
  Volume2,
  FileSearch,
} from 'lucide-react';
import { NavigationTab } from '../../shared/types/navigation';

interface DashboardViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const modules = [
    {
      id: 'call-forensics' as NavigationTab,
      title: 'VoIP Call Forensics',
      badge: 'Active & Verified',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      description:
        'End-to-end 4-Hop SIP & RTP call quality diagnostics, B3 SIEM event parsing, parallel forking analysis, and culprit node detection.',
      icon: PhoneCall,
      stats: '8 Simulation Scenarios • Full RTP Telemetry',
      actionLabel: 'Launch Forensics',
      color: 'from-blue-600/20 to-purple-600/10 border-blue-500/30 hover:border-blue-400/50',
    },
    {
      id: 'network-diagnostics' as NavigationTab,
      title: 'Network Diagnostics',
      badge: 'Phase 1 Foundation',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description:
        'Multi-vantage network probing (Ping, Traceroute, DNS, MTR, HTTP) via Globalping.io and customer-side diagnostic agent architecture.',
      icon: Globe,
      stats: 'Globalping Integration • Customer Agent Slot',
      actionLabel: 'Launch Diagnostics',
      color: 'from-amber-600/15 to-orange-600/10 border-amber-500/30 hover:border-amber-400/50',
    },
    {
      id: 'investigation-center' as NavigationTab,
      title: 'Investigation Center',
      badge: 'Phase 1 Foundation',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      description:
        'Correlate call transaction evidence with network diagnostic telemetry to construct rigorous technical Root Cause Analyses (RCA).',
      icon: FolderGit2,
      stats: 'Multi-Evidence Dossier • Fact vs Assumption Separation',
      actionLabel: 'Open Investigations',
      color: 'from-purple-600/20 to-indigo-600/10 border-purple-500/30 hover:border-purple-400/50',
    },
    {
      id: 'voice-simulator' as NavigationTab,
      title: 'Voice Quality & MOS Simulator',
      badge: 'Interactive L2 Tool',
      badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      description:
        'Simulate Packet Loss, Jitter, and Latency impacts on ITU-T G.107 E-Model MOS scores with real-time audio playback and side-by-side conversation degradation.',
      icon: Volume2,
      stats: 'ITU-T E-Model • Web Audio Simulator • Conversation Samples',
      actionLabel: 'Launch Simulator',
      color: 'from-teal-600/20 to-emerald-600/10 border-teal-500/30 hover:border-teal-400/50',
    },
    {
      id: 'pcap-analyzer' as NavigationTab,
      title: 'PCAP / Packet Capture Analyzer',
      badge: 'Client-Side Dissector',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      description:
        'Upload .pcap / .pcapng binary captures to dissect interactive SIP ladder flows, inspect SDP media codecs, and calculate RFC 3550 RTP jitter and one-way loss.',
      icon: FileSearch,
      stats: 'Libpcap & PCAPNG • SIP Ladder • RTP Jitter/Loss',
      actionLabel: 'Analyze Capture',
      color: 'from-purple-600/25 to-indigo-600/15 border-purple-500/40 hover:border-purple-400/60',
    },
    {
      id: 'settings' as NavigationTab,
      title: 'Workbench Settings',
      badge: 'Configured',
      badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      description:
        'Manage B3 session tokens, Globalping API credentials, customer agent security allowlists, and diagnostic thresholds.',
      icon: Settings,
      stats: 'Keychain SafeStorage • Target Allowlists',
      actionLabel: 'Manage Settings',
      color: 'from-slate-600/15 to-slate-700/10 border-slate-600/30 hover:border-slate-500/50',
    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-navy-950 text-slate-100 p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-surface-border p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Service Operations L2/L3 Workbench
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Systems Operational
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Unified Support & Triage Workbench
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Consolidated workspace for diagnosing voice quality anomalies, investigating network paths,
              and producing verifiable Root Cause Analyses without conflating network packet drops with VoIP defects.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('call-forensics')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Diagnose a Call</span>
            </button>
            <button
              onClick={() => onNavigate('network-diagnostics')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 border border-surface-borderLight text-slate-200 text-xs font-semibold transition-all cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              <span>Probe Network</span>
            </button>
          </div>
        </div>
      </div>

      {/* Module Overview Cards Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Workbench Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                className={`group flex flex-col justify-between p-5 rounded-xl bg-gradient-to-br ${m.color} border transition-all duration-200 hover:shadow-lg`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-navy-900/90 border border-surface-border flex items-center justify-center text-slate-200 shadow-inner group-hover:scale-105 transition-transform">
                        <Icon className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-wide">
                          {m.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {m.stats}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${m.badgeColor}`}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {m.description}
                  </p>
                </div>

                <div className="pt-4 mt-2 border-t border-navy-800/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Modular Component</span>
                  <button
                    onClick={() => onNavigate(m.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    <span>{m.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engineering Principles & Diagnostic Guidelines */}
      <div className="p-4 rounded-xl bg-navy-900/80 border border-surface-border space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            Operational Heuristics for L2 Engineers
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3 rounded-lg bg-navy-950/60 border border-surface-border space-y-1">
            <span className="font-semibold text-slate-200 block">
              1. Logical ≠ Physical Topology
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Logical call hops (SBC, CPaaS Core, PBX) represent SIP application routing. Traceroute hops represent IP routing. Do not conflate router latency with VoIP defects.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-navy-950/60 border border-surface-border space-y-1">
            <span className="font-semibold text-slate-200 block">
              2. Ping/HTTP ≠ RTP Audio Health
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              A passing ICMP ping or HTTP 200 does not prove that UDP RTP media streams or SIP session state are healthy across firewalls.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-navy-950/60 border border-surface-border space-y-1">
            <span className="font-semibold text-slate-200 block">
              3. ICMP Deprioritization
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Transit carrier routers frequently rate-limit ICMP TTL exceeded responses. Loss at an intermediate traceroute hop without downstream loss is nominal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
