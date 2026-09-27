import type { RiskLevel } from '@/analysis/types';
import { LEVEL_LABEL } from '@/app/activity';
import { LEVEL_SOFT_CLASS } from '@/app/signalMeta';
import { cn } from '@/lib/utils';

export function LevelBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        LEVEL_SOFT_CLASS[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function LiveDot({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2', className)}>
      {active && <span className="absolute inline-flex size-full animate-ping rounded-full bg-risk-normal opacity-60" />}
      <span className={cn('relative inline-flex size-2 rounded-full', active ? 'bg-risk-normal' : 'bg-muted-foreground/40')} />
    </span>
  );
}
