import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { usePipelineContext } from '@/app/PipelineContext';
import { LiveDot } from '@/components/sanket/LevelBadge';
import { scenarioInfo } from '@/app/scenarios';
import { ThemeToggle } from './ThemeToggle';
import type { NavItem } from './nav';

export function TopBar({ item }: { item: NavItem }) {
  const p = usePipelineContext();
  const sourceLabel = p.isSimulating
    ? `Scenario · ${scenarioInfo(p.scenario)?.title ?? 'simulation'}`
    : p.sourceKind === 'mic'
      ? 'Microphone'
      : p.sourceKind === 'conversation'
        ? (p.conversation?.title ?? 'Demo conversation')
        : (p.file.playbackStatus.fileName ?? 'Audio file');

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <Separator orientation="vertical" className="mr-1 hidden h-4 md:block" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">{item.label}</h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{item.description}</p>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-xs">
        <LiveDot active={p.isActive} />
        <span className="max-w-[9rem] truncate sm:max-w-[16rem]">{p.isActive ? sourceLabel : 'Idle'}</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
