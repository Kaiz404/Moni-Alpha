import { ICON_PATHS, type IconName } from '@/lib/icons';

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className} style={{ flex: 'none' }}>
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}
