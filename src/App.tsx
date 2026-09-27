/**
 * Sanket — application shell
 *
 * Sidebar (desktop) / bottom tab bar (phone) navigation across five views.
 * Detail surfaces (activity events, incident evidence) open in sheets so the
 * main views stay uncluttered. All pipeline state lives in PipelineContext.
 */

import { useState } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { MobileNav } from '@/components/shell/MobileNav';
import { TopBar } from '@/components/shell/TopBar';
import { NAV_ITEMS, type ViewId } from '@/components/shell/nav';
import { AlertBanner } from '@/components/sanket/AlertBanner';
import { EventSheet } from '@/components/sanket/EventSheet';
import { IncidentSheet } from '@/components/sanket/IncidentSheet';
import { usePipelineContext } from '@/app/PipelineContext';
import type { ActivityEvent } from '@/app/activity';
import { MonitorView } from '@/views/MonitorView';
import { SignalsView } from '@/views/SignalsView';
import { IncidentsView } from '@/views/IncidentsView';
import { DemoView } from '@/views/DemoView';
import { SettingsView } from '@/views/SettingsView';

export function App() {
  const p = usePipelineContext();
  const [view, setView] = useState<ViewId>('monitor');
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
  const item = NAV_ITEMS.find((n) => n.id === view)!;

  const activeIncidents = p.incidents.alertHistory.filter((i) => i.status === 'ACTIVE').length;
  const current = p.incidents.currentIncident;

  // Keep the most recent alert on screen until the user dismisses it, even if
  // the risk has since eased and the incident auto-resolved.
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [sessionStart] = useState(() => Date.now());
  const latest = current ?? p.incidents.alertHistory[0] ?? null;
  const bannerIncident = latest && latest.id !== dismissedId && latest.timestamp >= sessionStart ? latest : null;

  const navigate = (v: ViewId) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const openIncident = (id: string) => {
    const inc = p.incidents.alertHistory.find((i) => i.id === id) ?? (current?.id === id ? current : null);
    setSelectedEvent(null);
    if (inc) p.incidents.openModal(inc);
  };

  return (
    <SidebarProvider>
      <AppSidebar view={view} onNavigate={navigate} activeIncidents={activeIncidents} />
      <SidebarInset className="min-w-0">
        <TopBar item={item} />
        <AlertBanner
          incident={bannerIncident}
          live={bannerIncident !== null && bannerIncident.id === current?.id}
          recipients={p.contacts.contacts.length}
          onView={() => p.incidents.openModal(bannerIncident)}
          onAcknowledge={() => {
            if (bannerIncident?.status === 'ACTIVE') p.incidents.acknowledgeIncident(bannerIncident.id);
            setDismissedId(bannerIncident?.id ?? null);
          }}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 md:p-6 md:pb-8">
          {view === 'monitor' && <MonitorView onSelectEvent={setSelectedEvent} onNavigate={navigate} />}
          {view === 'signals' && <SignalsView />}
          {view === 'incidents' && <IncidentsView onNavigate={navigate} />}
          {view === 'demo' && <DemoView onNavigate={navigate} />}
          {view === 'settings' && <SettingsView />}
        </main>
      </SidebarInset>
      <MobileNav view={view} onNavigate={navigate} activeIncidents={activeIncidents} />

      <EventSheet event={selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)} onOpenIncident={openIncident} />
      <IncidentSheet
        incident={p.incidents.modalIncident}
        open={p.incidents.isModalOpen}
        onClose={p.incidents.closeModal}
        onAcknowledge={p.incidents.acknowledgeIncident}
        onResolve={p.incidents.resolveIncident}
        contacts={p.contacts.contacts}
      />
    </SidebarProvider>
  );
}

export default App;
