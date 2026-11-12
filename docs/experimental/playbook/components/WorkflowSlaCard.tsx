import React, { useState } from 'react';
import {
  Clock,
  Shield,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  Hash,
  Users,
} from 'lucide-react';
import { PodDefinition, SlaSeverity } from '../types/playbookTypes';

interface WorkflowSlaCardProps {
  currentPod: PodDefinition;
}

export const WorkflowSlaCard: React.FC<WorkflowSlaCardProps> = ({ currentPod }) => {
  const [selectedSeverity, setSelectedSeverity] = useState<SlaSeverity>('sev1');
  const [planType, setPlanType] = useState<'enterprise' | 'standard'>('enterprise');

  const activeSla = currentPod.slaTiers.find((t) => t.severity === selectedSeverity) || currentPod.slaTiers[0];

  return (
    <div className="space-y-6">
      {/* 5-Step Operational Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">
              End-to-End Technical Support Workflow
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Standard operating procedure for issue lifecycle from first customer notification to engineering resolution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {currentPod.workflowSteps.map((step) => (
            <div
              key={step.id}
              className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-4 flex flex-col justify-between relative group hover:border-blue-500/50 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold flex items-center justify-center">
                    {step.stepNumber}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {step.targetDuration}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-white mb-1.5">{step.title}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  {step.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300 block mb-0.5">L1 Role:</span>
                <span className="line-clamp-2">{step.responsibilities.l1Support}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SLA Matrix & Severity Tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Selector & Details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                SLA & Severity Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Target resolution times and escalation criteria by severity level.
              </p>
            </div>

            {/* Plan Switcher */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setPlanType('enterprise')}
                className={`text-xs font-semibold px-3 py-1 rounded transition ${
                  planType === 'enterprise'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Enterprise SLA
              </button>
              <button
                onClick={() => setPlanType('standard')}
                className={`text-xs font-semibold px-3 py-1 rounded transition ${
                  planType === 'standard'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Standard SLA
              </button>
            </div>
          </div>

          {/* Severity Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {currentPod.slaTiers.map((tier) => {
              const isSelected = tier.severity === selectedSeverity;
              const sevBadgeColors: Record<SlaSeverity, string> = {
                sev1: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
                sev2: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
                sev3: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
                sev4: 'border-slate-700 bg-slate-800/50 text-slate-300',
              };

              return (
                <button
                  key={tier.severity}
                  onClick={() => setSelectedSeverity(tier.severity)}
                  className={`p-3 rounded-lg border text-left transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        sevBadgeColors[tier.severity]
                      }`}
                    >
                      {tier.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {tier.targetResolutionHours[planType]}h SLA
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-medium block truncate">
                    {tier.name.split('-')[1]?.trim() || tier.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Tier Details */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{activeSla.name}</span>
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono font-semibold">
                Target Resolution: {activeSla.targetResolutionHours[planType]} Hours ({planType.toUpperCase()})
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed">{activeSla.description}</p>

            <div>
              <span className="font-semibold text-slate-400 block mb-1.5">
                Qualification Criteria:
              </span>
              <ul className="space-y-1">
                {activeSla.criteria.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Escalation Destination:</span>
              <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                {activeSla.escalationChannel}
              </span>
            </div>
          </div>
        </div>

        {/* Escalation Channels & Writing Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-purple-400" />
              Pod Escalation Channels
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Direct points of contact</p>
          </div>

          <div className="space-y-2 text-xs">
            {currentPod.escalationChannels.map((ch, idx) => (
              <div
                key={idx}
                className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-200 block">{ch.role}</span>
                  <span className="text-[11px] text-slate-400">{ch.lead}</span>
                </div>
                <span className="font-mono text-xs px-2 py-1 rounded bg-slate-800 text-blue-400 font-medium">
                  {ch.channel}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Escalation Writing Principles:
            </span>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              {currentPod.writingGuidelines.principles.map((p, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
