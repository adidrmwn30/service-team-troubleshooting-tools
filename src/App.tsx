import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { Navbar } from './shared/components/Navbar';
import { DashboardView } from './modules/dashboard/DashboardView';
import { CallForensicsView } from './modules/call-forensics/CallForensicsView';
import { NetworkDiagnosticsView } from './modules/network-diagnostics/NetworkDiagnosticsView';
import { InvestigationCenterView } from './modules/investigation-center/InvestigationCenterView';
import { VoiceSimulatorView } from './modules/voice-simulator/VoiceSimulatorView';
import { PcapAnalyzerView } from './modules/pcap-analyzer/PcapAnalyzerView';
import { SettingsView } from './modules/settings/SettingsView';
import { WorkbenchProvider, useWorkbench } from './shared/context/WorkbenchContext';

const WorkbenchApp: React.FC = () => {
  const { activeTab, setActiveTab } = useWorkbench();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans text-slate-100">
      {/* macOS Title Bar & App Header */}
      <header className="h-11 bg-navy-950/95 border-b border-surface-border flex items-center justify-between px-4 select-none shrink-0 z-50 [-webkit-app-region:drag]">
        <div className="flex items-center gap-3 pl-16 [-webkit-app-region:no-drag]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-purple-600 flex items-center justify-center shadow-inner">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-200 tracking-wide">
              L2 Support Workbench
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-navy-800 text-purple-300 border border-navy-700">
              v2.0 Modular
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-medium">
            <ShieldCheck className="w-3 h-3 text-purple-400" />
            <span>Telemetry Active</span>
          </div>
        </div>

        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="text-[11px] text-slate-400">VoIP Forensics • Network Probes • Correlation</span>
        </div>
      </header>

      {/* Workbench Global Navigation */}
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Content Workspace (Preserves view states without unmounting) */}
      <main className="flex-1 overflow-hidden relative bg-navy-950 flex flex-col">
        {/* Dashboard */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
          <DashboardView onNavigate={setActiveTab} />
        </div>

        {/* Call Forensics (Preserves 100% existing state and components) */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'call-forensics' ? 'block' : 'hidden'}`}>
          <CallForensicsView />
        </div>

        {/* Network Diagnostics */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'network-diagnostics' ? 'block' : 'hidden'}`}>
          <NetworkDiagnosticsView />
        </div>

        {/* Investigation Center */}
        <div className={`flex-1 overflow-hidden h-full ${activeTab === 'investigation-center' ? 'block' : 'hidden'}`}>
          <InvestigationCenterView />
        </div>

        {/* Voice Quality Simulator */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'voice-simulator' ? 'block' : 'hidden'}`}>
          <VoiceSimulatorView />
        </div>

        {/* PCAP Packet Capture Analyzer */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'pcap-analyzer' ? 'block' : 'hidden'}`}>
          <PcapAnalyzerView />
        </div>

        {/* Settings */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
          <SettingsView />
        </div>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WorkbenchProvider>
      <WorkbenchApp />
    </WorkbenchProvider>
  );
};
