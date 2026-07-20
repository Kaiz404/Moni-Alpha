/** Shared chip class strings for selectable filters (wallet type, category, etc.). */

export const chipBase = 'rounded-xl bg-surface-2 px-2.5 py-1.5';

export const chipActive = 'bg-primary-muted';

export const chipIdleText = 'text-foreground';

export const chipActiveText = 'font-semibold text-primary';

export function chipTextClass(active: boolean): string {
  return active ? chipActiveText : chipIdleText;
}

export function chipClass(active: boolean): string {
  return `${chipBase} ${active ? chipActive : ''}`;
}
