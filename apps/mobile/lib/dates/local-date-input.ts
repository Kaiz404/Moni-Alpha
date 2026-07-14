const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a YYYY-MM-DD string into a local calendar date, or null if invalid. */
export function parseLocalDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!LOCAL_DATE_PATTERN.test(trimmed)) return null;

  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Convert YYYY-MM-DD to an ISO datetime at local midnight, or null if invalid. */
export function localDateInputToIso(value: string): string | null {
  const date = parseLocalDateInput(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

/** Best-effort YYYY-MM-DD from an ISO datetime string. */
export function isoToLocalDateInput(
  iso: string | null | undefined,
  fallback = new Date(),
): string {
  if (!iso) return fallback.toISOString().split('T')[0];
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString().split('T')[0];
  return parsed.toISOString().split('T')[0];
}
