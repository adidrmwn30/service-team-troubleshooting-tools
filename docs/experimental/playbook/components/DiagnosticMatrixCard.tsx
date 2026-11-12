import React, { useState } from 'react';
import {
  GitPullRequest,
  CheckSquare,
  Square,
  AlertTriangle,
  ExternalLink,
  Wrench,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { PodDefinition, ProductDiagnosticMatrix } from '../types/playbookTypes';

interface DiagnosticMatrixCardProps {
  currentPod: PodDefinition;
  onNavigateTab?: (tab: string, extraData?: any) => void;
}

export const DiagnosticMatrixCard: React.FC<DiagnosticMatrixCardProps> = ({
  currentPod,
  onNavigateTab,
}) => {
  const matrices = currentPod.diagnosticMatrices;
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>(matrices[0]?.id || '');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const activeMatrix: ProductDiagnosticMatrix | undefined =
    matrices.find((m) => m.id === selectedMatrixId) || matrices[0];

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  if (!activeMatrix) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        No diagnostic matrices defined for this pod.
      </div>
    );
  }

  const completedCount = activeMatrix.checklist.filter((s) => completedSteps[s.id]).length;
  const progressPct = Math.round((completedCount / activeMatrix.checklist.length) * 100);

  return (
    <div className="space-y-6">
      {/* Product Selection Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <GitPullRequest className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Product-Specific Diagnostic Decision Trees
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Interactive triage checklists for each telephony product with direct links into deep diagnostic tools.
            </p>
          </div>

          {/* Product Selector */}
          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            {matrices.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMatrixId(m.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${
                  m.id === activeMatrix.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.productName}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Header & Symptoms */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                {activeMatrix.category}
              </span>
              <h3 className="text-lg font-bold text-white">{activeMatrix.productName}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{activeMatrix.description}</p>
            </div>

            {/* Progress Meter */}
            <div className="flex items-center gap-3 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Triage Checklist
                </span>
                <span className="text-xs font-bold text-white">
                  {completedCount} of {activeMatrix.checklist.length} Complete ({progressPct}%)
                </span>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400">
                {progressPct}%
              </div>
            </div>
          </div>

          {/* Common Symptoms */}
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1.5">
              Common Observed Symptoms:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeMatrix.commonSymptoms.map((sym, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800 text-xs"
                >
                  ⚠️ {sym}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Step-by-Step Checklist */}
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Step-by-Step Diagnostic Procedures
          </h4>

          {activeMatrix.checklist.map((stepItem, idx) => {
            const isDone = !!completedSteps[stepItem.id];

            return (
              <div
                key={stepItem.id}
                onClick={() => toggleStep(stepItem.id)}
                className={`p-4 rounded-lg border cursor-pointer transition select-none ${
                  isDone
                    ? 'bg-slate-950/40 border-emerald-500/30'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="mt-0.5 text-blue-400 hover:text-blue-300 transition shrink-0"
                  >
                    {isDone ? (
                      <CheckSquare className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span
                        className={`font-bold text-sm ${
                          isDone ? 'line-through text-slate-400' : 'text-white'
                        }`}
                      >
                        {idx + 1}. {stepItem.step}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800 self-start sm:self-auto">
                        Tool: {stepItem.toolUsed}
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed">
                      <strong className="text-emerald-400">Expected Outcome:</strong>{' '}
                      {stepItem.expectedOutcome}
                    </p>

                    <p className="text-slate-400 leading-relaxed">
                      <strong className="text-amber-400">If Failed / Discrepancy:</strong>{' '}
                      {stepItem.nextStepIfFailed}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deep Tool Launcher */}
        {activeMatrix.suggestedAction && onNavigateTab && (
          <div className="mt-5 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-300 block">
                Recommended Deep Diagnostic Tool
              </span>
              <span className="text-xs text-slate-300">
                Launch directly into packet inspection for this issue scenario.
              </span>
            </div>
            <button
              onClick={() => onNavigateTab(activeMatrix.suggestedAction!.targetTab)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {activeMatrix.suggestedAction.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
