import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CallQualityReport } from '../../types/callQuality';
import { NetworkDiagnosticResult } from '../../modules/network-diagnostics/types';
import { InvestigationCase } from '../../modules/investigation-center/types';
import { NavigationTab } from '../types/navigation';
import { InvestigationService } from '../../modules/investigation-center/services/investigationService';

interface WorkbenchContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;

  // Call Forensics State
  activeCallReport: CallQualityReport | null;
  setActiveCallReport: (report: CallQualityReport | null) => void;

  // Network Diagnostics State
  networkTarget: string;
  setNetworkTarget: (target: string) => void;
  latestNetworkResult: NetworkDiagnosticResult | null;
  setLatestNetworkResult: (result: NetworkDiagnosticResult | null) => void;

  // Investigation Center State
  activeCaseId: string;
  setActiveCaseId: (id: string) => void;
  investigations: InvestigationCase[];
  refreshInvestigations: () => void;

  // Pipeline Actions
  forwardCallToNetworkDiagnostics: (report?: CallQualityReport) => void;
  compileToInvestigationCenter: (
    customReport?: CallQualityReport,
    customNetResult?: NetworkDiagnosticResult
  ) => string;
}

const WorkbenchContext = createContext<WorkbenchContextType | undefined>(undefined);

export const WorkbenchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [activeCallReport, setActiveCallReport] = useState<CallQualityReport | null>(null);
  const [networkTarget, setNetworkTarget] = useState<string>('sip.b3networks.com');
  const [latestNetworkResult, setLatestNetworkResult] = useState<NetworkDiagnosticResult | null>(null);

  const [investigations, setInvestigations] = useState<InvestigationCase[]>(() =>
    InvestigationService.getAllInvestigations()
  );
  const [activeCaseId, setActiveCaseId] = useState<string>(() => investigations[0]?.id || '');

  const refreshInvestigations = useCallback(() => {
    const list = InvestigationService.getAllInvestigations();
    setInvestigations(list);
    return list;
  }, []);

  // Action 1: Forward Call to Network Diagnostics
  const forwardCallToNetworkDiagnostics = useCallback(
    (reportOverride?: CallQualityReport) => {
      const rep = reportOverride || activeCallReport;
      if (!rep) return;

      // Extract candidate target IP or domain from report
      let candidateTarget = 'sip.b3networks.com';

      // Check edge gateway or callee endpoint
      const edgeHop = rep.hops.find((h) => h.hopType === 'EDGE_SBC' || h.hopType === 'SIP_GATEWAY');
      if (edgeHop?.nodeName && (edgeHop.nodeName.includes('.') || edgeHop.nodeName.includes(':'))) {
        candidateTarget = edgeHop.nodeName;
      } else if (rep.hops.find((h) => h.hopType === 'CALLEE_ENDPOINT')?.nodeName?.includes('.')) {
        const callee = rep.hops.find((h) => h.hopType === 'CALLEE_ENDPOINT')!.nodeName;
        candidateTarget = callee;
      }

      setNetworkTarget(candidateTarget);
      setActiveTab('network-diagnostics');
    },
    [activeCallReport]
  );

  // Action 2: Compile Telemetry to Investigation Center
  const compileToInvestigationCenter = useCallback(
    (customReport?: CallQualityReport, customNetResult?: NetworkDiagnosticResult) => {
      const call = customReport || activeCallReport;
      const net = customNetResult || latestNetworkResult;

      if (!call) {
        setActiveTab('investigation-center');
        return activeCaseId;
      }

      const updatedCase = InvestigationService.compileInvestigationFromTelemetry(call, net);
      const updatedList = refreshInvestigations();
      setActiveCaseId(updatedCase.id);
      setActiveTab('investigation-center');
      return updatedCase.id;
    },
    [activeCallReport, latestNetworkResult, refreshInvestigations, activeCaseId]
  );

  return (
    <WorkbenchContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeCallReport,
        setActiveCallReport,
        networkTarget,
        setNetworkTarget,
        latestNetworkResult,
        setLatestNetworkResult,
        activeCaseId,
        setActiveCaseId,
        investigations,
        refreshInvestigations,
        forwardCallToNetworkDiagnostics,
        compileToInvestigationCenter,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
};

export const useWorkbench = (): WorkbenchContextType => {
  const context = useContext(WorkbenchContext);
  if (!context) {
    return {
      activeTab: 'call-forensics',
      setActiveTab: () => {},
      activeCallReport: null,
      setActiveCallReport: () => {},
      networkTarget: 'sip.b3networks.com',
      setNetworkTarget: () => {},
      latestNetworkResult: null,
      setLatestNetworkResult: () => {},
      activeCaseId: '',
      setActiveCaseId: () => {},
      investigations: [],
      refreshInvestigations: () => [],
      forwardCallToNetworkDiagnostics: () => {},
      compileToInvestigationCenter: () => '',
    };
  }
  return context;
};
