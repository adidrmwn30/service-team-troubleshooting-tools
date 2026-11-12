import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  Globe,
  FolderGit2,
  Settings,
  Shield,
  Volume2,
  FileSearch,
} from 'lucide-react';
import { NavigationTab } from '../types/navigation';

interface NavbarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'call-forensics', label: 'Call Forensics', icon: PhoneCall, badge: 'VoIP' },
    { id: 'network-diagnostics', label: 'Network Diagnostics', icon: Globe, badge: 'Probes' },
    { id: 'investigation-center', label: 'Investigation Center', icon: FolderGit2, badge: 'RCA' },
    { id: 'voice-simulator', label: 'Voice Simulator', icon: Volume2, badge: 'MOS' },
    { id: 'pcap-analyzer', label: 'PCAP Analyzer', icon: FileSearch, badge: 'Packet' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="h-10 bg-navy-900/90 border-b border-surface-border flex items-center justify-between px-4 select-none shrink-0 z-40">
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/60 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                    isActive
                      ? 'bg-purple-500/30 text-purple-200'
                      : 'bg-navy-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-navy-800/80 border border-navy-750 text-slate-300">
          <Shield className="w-3 h-3 text-purple-400" />
          <span>L2 Workbench Active</span>
        </span>
      </div>
    </nav>
  );
};
