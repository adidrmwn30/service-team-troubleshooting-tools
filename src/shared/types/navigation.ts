export type NavigationTab =
  | 'dashboard'
  | 'call-forensics'
  | 'network-diagnostics'
  | 'investigation-center'
  | 'voice-simulator'
  | 'pcap-analyzer'
  | 'settings';

export interface NavItemConfig {
  id: NavigationTab;
  label: string;
  shortLabel?: string;
  badge?: string;
  badgeColor?: string;
}
