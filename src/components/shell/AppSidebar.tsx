import { ShieldCheck } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NAV_ITEMS, type ViewId } from './nav';

interface AppSidebarProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  activeIncidents: number;
}

function SanketLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5">
      <defs>
        <linearGradient id="sl-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6a9dff" />
          <stop offset="100%" stopColor="#3b6dff" />
        </linearGradient>
      </defs>
      <path d="M16 2 L28 7 L28 17 C28 23.5 22.5 28.5 16 30 C9.5 28.5 4 23.5 4 17 L4 7 Z" fill="url(#sl-g)" />
      <polyline
        points="7,17 10,17 11.5,12 13,22 14.5,14 16,20 17.5,17 19,17 20.5,13 22,21 23.5,17 25,17"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppSidebar({ view, onNavigate, activeIncidents }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <span className="grid aspect-square size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <SanketLogo />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="font-semibold tracking-tight">Sanket</span>
                <span className="text-xs text-muted-foreground">Voice Distress Analysis</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton isActive={view === item.id} tooltip={item.label} onClick={() => onNavigate(item.id)}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.id === 'incidents' && activeIncidents > 0 && (
                    <SidebarMenuBadge className="bg-risk-high text-white">{activeIncidents}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-start gap-2 rounded-lg border bg-sidebar-accent/40 p-2.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>Audio is analysed on this device. Nothing is recorded or sent.</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
