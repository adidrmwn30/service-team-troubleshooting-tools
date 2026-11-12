import React, { useState, useEffect, useRef } from 'react';
import { Globe, PhoneCall, FolderGit2, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  DiagnosticType,
  NetworkDiagnosticResult,
} from './types';
import { GlobalpingService } from './services/globalpingService';
import {
  GlobalpingConsole,
  LocationOption,
  PROBE_LOCATIONS,
} from './components/GlobalpingConsole';
import { DiagnosticResultViewer } from './components/DiagnosticResultViewer';
import { DiagnosticHistoryList } from './components/DiagnosticHistoryList';
import { useWorkbench } from '../../shared/context/WorkbenchContext';

export const NetworkDiagnosticsView: React.FC = () => {
  const {
    activeCallReport,
    networkTarget,
    setNetworkTarget,
    latestNetworkResult,
    setLatestNetworkResult,
    compileToInvestigationCenter,
  } = useWorkbench();

  const [target, setTarget] = useState<string>(networkTarget || 'sip.b3networks.com');
  const [diagnosticType, setDiagnosticType] = useState<DiagnosticType>('ping');
  const [selectedLocation, setSelectedLocation] = useState<LocationOption>(PROBE_LOCATIONS[0]);
  const [dnsQueryType, setDnsQueryType] = useState<string>('A');
  const [httpMethod, setHttpMethod] = useState<'HEAD' | 'GET'>('HEAD');
  const [packetsCount, setPacketsCount] = useState<number>(3);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [currentResult, setCurrentResult] = useState<NetworkDiagnosticResult | null>(latestNetworkResult);
  const [history, setHistory] = useState<NetworkDiagnosticResult[]>([]);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync network target from context if it changes externally
  useEffect(() => {
    if (networkTarget && networkTarget !== target) {
      setTarget(networkTarget);
    }
  }, [networkTarget]);

  // Load history on mount
  useEffect(() => {
    const loadedHistory = GlobalpingService.getHistory();
    setHistory(loadedHistory);
    if (loadedHistory.length > 0 && !currentResult) {
      setCurrentResult(loadedHistory[0]);
      setLatestNetworkResult(loadedHistory[0]);
    }
  }, []);

  const handleRunDiagnostic = async () => {
    setValidationError(undefined);

    // Validate target
    const validation = GlobalpingService.validateTarget(target, diagnosticType);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setIsRunning(true);
    setProgressMessage('Dispatching measurement to Globalping probe...');
    setElapsedSeconds(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build location payload
    const locationsPayload: Array<{ country?: string; continent?: string }> = [];
    if (selectedLocation.country) {
      locationsPayload.push({ country: selectedLocation.country });
    } else if (selectedLocation.continent) {
      locationsPayload.push({ continent: selectedLocation.continent });
    }

    // Build measurement options
    const measurementOptions: Record<string, any> = {};
    if (diagnosticType === 'ping') {
      measurementOptions.packets = packetsCount;
    } else if (diagnosticType === 'mtr') {
      measurementOptions.packets = packetsCount;
    } else if (diagnosticType === 'dns') {
      measurementOptions.query = { type: dnsQueryType };
    } else if (diagnosticType === 'http') {
      measurementOptions.request = { method: httpMethod };
    }

    try {
      const result = await GlobalpingService.runDiagnostic(
        {
          target: validation.cleanTarget || target,
          type: diagnosticType,
          locations: locationsPayload.length > 0 ? locationsPayload : undefined,
          locationLabel: selectedLocation.label,
          measurementOptions: Object.keys(measurementOptions).length > 0 ? measurementOptions : undefined,
          dnsQueryType,
        },
        {
          onProgress: (status, elapsed) => {
            setProgressMessage(status);
            setElapsedSeconds(elapsed);
          },
          signal: abortController.signal,
        }
      );

      setCurrentResult(result);
      setLatestNetworkResult(result);
      setHistory(GlobalpingService.getHistory());
    } catch (err: any) {
      const failedResult: NetworkDiagnosticResult = {
        id: `err-${Date.now()}`,
        target,
        diagnosticType,
        probeLocation: selectedLocation.label,
        source: 'globalping',
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        errorMessage: err?.message || 'Diagnostic execution failed.',
        interpretation: {
          observations: ['Measurement dispatch failed before telemetry was gathered.'],
          voipGuardrailNotes: ['No Layer 3 data could be evaluated.'],
        },
      };
      setCurrentResult(failedResult);
      GlobalpingService.saveToHistory(failedResult);
      setHistory(GlobalpingService.getHistory());
    } finally {
      setIsRunning(false);
      setProgressMessage('');
      abortControllerRef.current = null;
    }
  };

  const handleCancelDiagnostic = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setProgressMessage('Cancelling measurement...');
    }
  };

  const handleClearHistory = () => {
    GlobalpingService.clearHistory();
    setHistory([]);
    setCurrentResult(null);
  };

  const handleDeleteHistoryItem = (id: string) => {
    GlobalpingService.deleteHistoryItem(id);
    const updated = GlobalpingService.getHistory();
    setHistory(updated);
    if (currentResult?.id === id) {
      setCurrentResult(updated.length > 0 ? updated[0] : null);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-navy-950 text-slate-100 p-6 pb-24 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Global Network Diagnostics</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Globalping.io Multi-Vantage
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Independent external multi-point network probing (Ping, Traceroute, DNS, MTR, HTTP) from worldwide vantage probes.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Module: <span className="font-mono text-slate-300">Network Diagnostics v1.2</span>
        </div>
      </div>

      {/* TRI-MODULE CONTEXT BANNER */}
      {activeCallReport && (
        <div className="bg-gradient-to-r from-blue-950/70 via-purple-950/40 to-navy-900 border border-blue-500/30 rounded-xl p-3.5 shadow-md flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">
                  Tri-Module Pipeline: Linked to Call TXN
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                  {activeCallReport.txnUuid.slice(0, 8)}...
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-navy-800 text-slate-300 border border-navy-700">
                  {activeCallReport.overallStatus}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Target probe terisi dari call telemetry: <span className="font-mono text-cyan-300 font-semibold">{target}</span>. Jalankan probe atau teruskan langsung ke dossier.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => compileToInvestigationCenter(activeCallReport, currentResult || undefined)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>3. Open in Investigation Center ➔</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Active Globalping Console */}
        <GlobalpingConsole
          target={target}
          onTargetChange={setTarget}
          diagnosticType={diagnosticType}
          onDiagnosticTypeChange={setDiagnosticType}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          dnsQueryType={dnsQueryType}
          onDnsQueryTypeChange={setDnsQueryType}
          httpMethod={httpMethod}
          onHttpMethodChange={setHttpMethod}
          packetsCount={packetsCount}
          onPacketsCountChange={setPacketsCount}
          isRunning={isRunning}
          progressMessage={progressMessage}
          elapsedSeconds={elapsedSeconds}
          onRun={handleRunDiagnostic}
          onCancel={handleCancelDiagnostic}
          validationError={validationError}
        />

        {/* Diagnostic Results Presentation */}
        <DiagnosticResultViewer result={currentResult} isRunning={isRunning} />

        {/* Measurement History Area */}
        <DiagnosticHistoryList
          history={history}
          selectedId={currentResult?.id}
          onSelectResult={(item) => {
            setCurrentResult(item);
            setLatestNetworkResult(item);
          }}
          onClearHistory={handleClearHistory}
          onDeleteItem={handleDeleteHistoryItem}
        />
      </div>
    </div>
  );
};
