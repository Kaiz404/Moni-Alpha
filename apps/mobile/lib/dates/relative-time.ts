const MS_SECOND = 1_000;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export type TimeAgoInput = string | number | Date | null | undefined;

export type FormatTimeAgoOptions = {
  now?: number;
  fallback?: string;
  style?: 'short' | 'long';
  /** Short style only: show seconds (e.g. debug timestamps) instead of "Just now". */
  includeSeconds?: boolean;
};

export function getElapsedMs(value: TimeAgoInput, now = Date.now()): number | null {
  if (value == null || value === '') return null;
  const timestamp = typeof value === 'number' ? value : new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, now - timestamp);
}

function pluralize(count: number, unit: string): string {
  return count === 1 ? unit : `${unit}s`;
}

export function formatTimeAgo(value: TimeAgoInput, options: FormatTimeAgoOptions = {}): string {
  const {
    now = Date.now(),
    fallback = 'Not available',
    style = 'long',
    includeSeconds = false,
  } = options;
  const elapsed = getElapsedMs(value, now);
  if (elapsed == null) return fallback;

  const minutes = Math.floor(elapsed / MS_MINUTE);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (style === 'short') {
    if (minutes < 1) {
      if (includeSeconds) {
        const seconds = Math.max(1, Math.round(elapsed / MS_SECOND));
        return `${seconds}s ago`;
      }
      return 'Just now';
    }
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  if (minutes < 1) return 'just now';
  if (minutes < 60) {
    return `${minutes} ${pluralize(minutes, 'minute')} ago`;
  }
  if (hours < 24) {
    return `${hours} ${pluralize(hours, 'hour')} ago`;
  }
  return `${days} ${pluralize(days, 'day')} ago`;
}

export { MS_HOUR, MS_MINUTE };
