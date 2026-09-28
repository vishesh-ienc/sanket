import { BellRing, Gauge, Presentation, Settings, SlidersHorizontal, Download, type LucideIcon } from 'lucide-react';

export type ViewId = 'monitor' | 'signals' | 'incidents' | 'demo' | 'settings' | 'deploy';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'monitor', label: 'Monitor', icon: Gauge, description: 'Live risk, source and activity' },
  { id: 'signals', label: 'Signals', icon: SlidersHorizontal, description: 'Customise detection signals' },
  { id: 'incidents', label: 'Incidents', icon: BellRing, description: 'Silent alerts and evidence' },
  { id: 'demo', label: 'Demo', icon: Presentation, description: 'Conversations and scenario simulator' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Baseline, code word, speech, contacts' },
  { id: 'deploy', label: 'Deploy', icon: Download, description: 'Run the engine locally on your device' },
];
