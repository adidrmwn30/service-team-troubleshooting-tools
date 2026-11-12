import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Clock,
  ListChecks,
  GitPullRequest,
  FileCode,
  Wrench,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { PodId } from './types/playbookTypes';
import { podRegistry } from './data/podRegistry';
import { SmartIntakeCard } from './components/SmartIntakeCard';
import { WorkflowSlaCard } from './components/WorkflowSlaCard';
import { DataPointAuditCard } from './components/DataPointAuditCard';
import { DiagnosticMatrixCard } from './components/DiagnosticMatrixCard';
import { ReplicationEscalationCard } from './components/ReplicationEscalationCard';
import { ToolsHandbookCard } from './components/ToolsHandbookCard';

type PlaybookTab =
  | 'intake'
  | 'workflow'
  | 'datapoints'
  | 'diagnostics'
  | 'escalation'
  | 'tools';

interface PlaybookViewProps {
  onNavigateTab?: (tab: string, extraData?: any) => void;
}

export const PlaybookView: React.FC<PlaybookViewProps> = ({ onNavigateTab }) => {
  const [activePodId, setActivePodId] = useState<PodId>(podRegistry.getActivePodId());
  const [activeTab, setActiveTab] = useState<PlaybookTab>('intake');

  const currentPod = podRegistry.getPod(activePodId);

  const tabs: { id: PlaybookTab; label: string; icon: React.ReactNode }[] = [
    { id: 'intake', label: 'Smart Intake & Auditor', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'workflow', label: 'Workflow & SLAs', icon: <Clock className="w-4 h-4" /> },
    { id: 'datapoints', label: 'Data Points & VQ Survey', icon: <ListChecks className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Diagnostic Decision Trees', icon: <GitPullRequest className="w-4 h-4" /> },
    { id: 'escalation', label: 'Replication & Escalation', icon: <FileCode className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools Handbook', icon: <Wrench className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Playbook Header with Pod Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <BookOpen className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Service Team Playbook & Triage Hub
                </h1>
                <p className="text-xs text-blue-400 font-medium">
                  Standard Operating Procedures & Multi-Pod Issue Management Framework
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl pt-1">
              {currentPod.shortDescription}
            </p>
          </div>

          {/* Pod Switcher Dropdown */}
          <div className="flex items-center gap-3 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
            <Layers className="w-4 h-4 text-blue-400 ml-1 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Active Pod
              </span>
              <select
                value={activePodId}
                onChange={(e) => setActivePodId(e.target.value as PodId)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer pr-2"
              >
                {podRegistry.getAllPods().map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-800/80">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'intake' && (
        <SmartIntakeCard
          currentPod={currentPod}
          onPodChange={(id) => setActivePodId(id)}
          onNavigateTab={onNavigateTab}
        />
      )}

      {activeTab === 'workflow' && <WorkflowSlaCard currentPod={currentPod} />}

      {activeTab === 'datapoints' && <DataPointAuditCard currentPod={currentPod} />}

      {activeTab === 'diagnostics' && (
        <DiagnosticMatrixCard currentPod={currentPod} onNavigateTab={onNavigateTab} />
      )}

      {activeTab === 'escalation' && <ReplicationEscalationCard currentPod={currentPod} />}

      {activeTab === 'tools' && <ToolsHandbookCard currentPod={currentPod} />}
    </div>
  );
};
