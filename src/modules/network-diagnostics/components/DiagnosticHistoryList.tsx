import React, { useState } from 'react';
import {
  Clock,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { NetworkDiagnosticResult } from '../types';

interface DiagnosticHistoryListProps {
  history: NetworkDiagnosticResult[];
  onSelectResult: (result: NetworkDiagnosticResult) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
  selectedId?: string;
}

export const DiagnosticHistoryList: React.FC<DiagnosticHistoryListProps> = ({
  history,
  onSelectResult,
  onClearHistory,
  onDeleteItem,
  selectedId,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');

  const filteredHistory = history.filter((item) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.target.toLowerCase().includes(q) ||
      item.diagnosticType.toLowerCase().includes(q) ||
      item.probeLocation.toLowerCase().includes(q)
    );
  });

  const getMetricSummary = (item: NetworkDiagnosticResult): string => {
    if (!item.results) return item.errorMessage || 'No telemetry';
    switch (item.results.type) {
      case 'ping': {
        const d = item.results.data;
        return `${d.packetLossPct}% loss, ${d.avgRttMs ?? '—'} ms avg`;
      }
      case 'traceroute': {
        const d = item.results.data;
        return `${d.totalHops} hops (${d.destinationReached ? 'Reached' : 'Incomplete'})`;
      }
      case 'dns': {
        const d = item.results.data;
        return `${d.statusCode || 'OK'} (${d.answers.length} records, ${d.roundTripMs ?? '—'} ms)`;
      }
      case 'mtr': {
        const d = item.results.data;
        return `${d.hops.length} hops continuous probe`;
      }
      case 'http': {
        const d = item.results.data;
        return `HTTP ${d.statusCode} (${d.responseTimeMs} ms)`;
      }
      default:
        return 'Raw measurement';
    }
  };

  return (
    <div className="p-4 rounded-xl bg-navy-900/90 border border-surface-border space-y-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Measurement History
          </h3>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-950 text-slate-400 border border-navy-750">
            {history.length} runs stored locally
          </span>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <>
              {/* Filter input */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter runs..."
                  className="bg-navy-950 border border-navy-800 rounded-md pl-6 pr-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-purple-500 w-36"
                />
              </div>

              <button
                onClick={() => {
                  if (window.confirm('Clear all diagnostic history?')) {
                    onClearHistory();
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/40 transition-colors"
                title="Clear all stored measurements"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-500">
          No diagnostic runs recorded yet. Measurements executed in this session will appear here.
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-500">
          No runs matching '{filterQuery}'.
        </div>
      ) : (
        <div className="divide-y divide-navy-850 overflow-x-auto max-h-80 overflow-y-auto">
          {filteredHistory.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onSelectResult(item)}
                className={`py-2.5 px-3 flex items-center justify-between text-xs cursor-pointer rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-purple-950/40 border border-purple-500/40'
                    : 'hover:bg-navy-950/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      item.status === 'completed'
                        ? 'bg-emerald-400'
                        : item.status === 'failed'
                        ? 'bg-red-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-300 font-bold uppercase text-[10px]">
                        {item.diagnosticType}
                      </span>
                      <span className="font-mono font-semibold text-slate-200">{item.target}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({item.probeInfo?.city || item.probeLocation})
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {getMetricSummary(item)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-[10px] text-slate-500">
                    <div>{new Date(item.startedAt).toLocaleTimeString()}</div>
                    <div>{new Date(item.startedAt).toLocaleDateString()}</div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
