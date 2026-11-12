import React, { useState } from 'react';
import {
  ListChecks,
  HelpCircle,
  Copy,
  Check,
  Send,
  MessageSquare,
  FileQuestion,
  Filter,
} from 'lucide-react';
import { PodDefinition, DataPointCategory } from '../types/playbookTypes';

interface DataPointAuditCardProps {
  currentPod: PodDefinition;
}

const CATEGORIES: { id: DataPointCategory; label: string }[] = [
  { id: 'call', label: 'Call General' },
  { id: 'voice_quality', label: 'Voice Quality (9 Qs)' },
  { id: 'app_issue', label: 'App & Softphone' },
  { id: 'auth', label: 'Auth & Login' },
  { id: 'fax', label: 'Cloud Fax' },
  { id: 'billing', label: 'Billing & CDR' },
];

export const DataPointAuditCard: React.FC<DataPointAuditCardProps> = ({ currentPod }) => {
  const [selectedCategory, setSelectedCategory] = useState<DataPointCategory>('call');
  const [copiedSurvey, setCopiedSurvey] = useState(false);

  const filteredPoints = currentPod.requiredDataPoints.filter(
    (dp) => dp.category === selectedCategory || (selectedCategory === 'call' && dp.category === 'call')
  );

  const copyVoiceSurvey = () => {
    if (!currentPod.voiceQualityQuestions) return;
    const text = currentPod.voiceQualityQuestions
      .map(
        (q) =>
          `Q${q.number}: ${q.question}\nOptions: ${q.options?.join(' / ') || 'N/A'}`
      )
      .join('\n\n');

    const formatted = `Dear Customer,\n\nTo diagnose the reported voice degradation accurately, please provide answers to these 9 diagnostic questions:\n\n${text}\n\nThank you,\nTechnical Support Team`;

    navigator.clipboard.writeText(formatted);
    setCopiedSurvey(true);
    setTimeout(() => setCopiedSurvey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ListChecks className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">
                Information Gathering Guidelines & Data Points
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Required parameters for technical triage. Incomplete tickets must be clarified within 30 minutes.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data Points Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Parameter Name</th>
                <th className="py-2.5 px-4 font-semibold">Requirement</th>
                <th className="py-2.5 px-4 font-semibold">Description</th>
                <th className="py-2.5 px-4 font-semibold">Realistic Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPoints.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.required ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold text-[10px]">
                        MANDATORY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                        OPTIONAL
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs">{item.description}</td>
                  <td className="py-3 px-4 font-mono text-cyan-400 max-w-xs truncate">
                    {item.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9 Voice Quality Diagnostic Questions (If voice quality tab or ccb) */}
      {currentPod.voiceQualityQuestions && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-emerald-400" />
                9-Question Voice Quality Questionnaire
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch this survey to the customer to isolate Wi-Fi vs Carrier vs LAN defects.
              </p>
            </div>

            <button
              onClick={copyVoiceSurvey}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
            >
              {copiedSurvey ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied 9 Questions!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Survey for Customer</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {currentPod.voiceQualityQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center justify-center shrink-0">
                      {q.number}
                    </span>
                    <span className="text-xs font-semibold text-white leading-snug">
                      {q.question}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                    <strong className="text-slate-300">Why needed:</strong> {q.whyNeeded}
                  </p>
                </div>

                {q.options && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block mb-1 font-medium">
                      Answer Choices:
                    </span>
                    <ul className="space-y-0.5 text-[10px] text-slate-300">
                      {q.options.map((opt, idx) => (
                        <li key={idx} className="truncate">
                          • {opt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
