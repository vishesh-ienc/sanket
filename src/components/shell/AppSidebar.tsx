import { ShieldCheck, Waves } from 'lucide-react';
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

export function AppSidebar({ view, onNavigate, activeIncidents }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <span className="grid aspect-square size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Waves className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="font-semibold tracking-tight">Sanket</span>
                <span className="text-xs text-muted-foreground">Voice distress-risk engine</span>
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
