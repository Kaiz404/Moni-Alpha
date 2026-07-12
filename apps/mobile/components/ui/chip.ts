/** Shared chip class strings for selectable filters (wallet type, category, etc.). */

export const chipBase =
  'py-1.5 px-2.5 rounded-xl border border-border bg-card';

export const chipActive = 'border-primary bg-primary-muted';

export const chipIdleText = 'text-foreground';

export const chipActiveText = 'font-semibold text-primary';

export function chipTextClass(active: boolean): string {
  return active ? chipActiveText : chipIdleText;
}

export function chipClass(active: boolean): string {
  return `${chipBase} ${active ? chipActive : ''}`;
}
