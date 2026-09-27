import { cn } from '@/lib/utils';
import { NAV_ITEMS, type ViewId } from './nav';

interface MobileNavProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  activeIncidents: number;
}

/** Bottom tab bar for phones */
export function MobileNav({ view, onNavigate, activeIncidents }: MobileNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="size-5" />
                {item.label}
                {item.id === 'incidents' && activeIncidents > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] size-2 rounded-full bg-risk-high" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
