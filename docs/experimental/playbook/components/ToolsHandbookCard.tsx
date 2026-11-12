import React, { useState } from 'react';
import {
  Wrench,
  Search,
  ExternalLink,
  Terminal,
  Activity,
  Smartphone,
  Globe,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PodDefinition, ToolReference } from '../types/playbookTypes';

interface ToolsHandbookCardProps {
  currentPod: PodDefinition;
}

export const ToolsHandbookCard: React.FC<ToolsHandbookCardProps> = ({ currentPod }) => {
  const tools = currentPod.toolsHandbook;
  const [expandedToolId, setExpandedToolId] = useState<string | null>(tools[0]?.id || null);

  const toggleTool = (id: string) => {
    setExpandedToolId(expandedToolId === id ? null : id);
  };

  const getCategoryIcon = (category: ToolReference['category']) => {
    switch (category) {
      case 'observability':
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'provisioning':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'browser':
        return <Globe className="w-4 h-4 text-purple-400" />;
      case 'telemetry':
        return <Sliders className="w-4 h-4 text-amber-400" />;
      default:
        return <Terminal className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wrench className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">
              Technical Support Diagnostic Tools Handbook
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Standard operating instructions for internal observability platforms, softphone provisioning, and browser inspect tokens.
          </p>
        </div>

        <div className="space-y-4">
          {tools.map((tool) => {
            const isExpanded = expandedToolId === tool.id;

            return (
              <div
                key={tool.id}
                className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => toggleTool(tool.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      {getCategoryIcon(tool.category)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{tool.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                          {tool.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{tool.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {tool.urlOrPath && (
                      <span className="hidden sm:inline-block text-[11px] font-mono text-cyan-400 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                        {tool.urlOrPath}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-4 text-xs">
                    {/* Key Metrics or Search Queries */}
                    <div>
                      <span className="font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider text-[11px]">
                        Key Search Syntax & Essential Metrics:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tool.keyMetricsOrCommands.map((metric, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-cyan-300 text-[11px]"
                          >
                            {metric}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step-by-Step Operating Instructions */}
                    <div>
                      <span className="font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider text-[11px]">
                        Operating Instructions:
                      </span>
                      <ol className="space-y-1.5 text-slate-300">
                        {tool.stepByStepInstructions.map((instruction, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-400 font-bold shrink-0">•</span>
                            <span>{instruction}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
