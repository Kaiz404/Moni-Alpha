import type { BatteryExemption } from './battery';
import { sourceHealth, type CaptureHealth, type CaptureSourceHealth } from './capture-health';
import { localDay } from './capture-health.core.js';

/** Below this, a rhythm is a guess: a new app, or one link old. */
const MIN_ACTIVE_DAYS = 5;
/** A full week, so a weekend-only or weekday-only app has shown its gap. */
const MIN_SPAN_DAYS = 7;
const RECENT_GAPS = 30;
/** Nothing from any app for this long means the listener stopped, not that the phone was quiet. */
const LISTENER_SILENT_DAYS = 2;

export type SourceCadence =
  | { kind: 'learning' }
  | { kind: 'steady' | 'quiet'; usualGapDays: number; silentDays: number };

function dayNumber(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year!, month! - 1, date!) / 86_400_000;
}

/** The gap it stays within nine times in ten, so one holiday does not set the rhythm. */
function usualGap(gaps: readonly number[]): number {
  const sorted = [...gaps].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.9) - 1]!;
}

/**
 * The cadence rule. An app goes quiet when it has been silent for more than twice its own usual
 * gap, plus today, which is not over yet. Daily: 4 days. Weekends only: 14 days, so one skipped
 * weekend passes and two do not. Silence counts from the latest capture or link, so relinking an
 * app after months starts its clock again.
 */
export function assessCadence(
  source: Pick<CaptureSourceHealth, 'captureDays' | 'linkedAt'>,
  today: string,
): SourceCadence {
  const days = source.captureDays.map(dayNumber).sort((a, b) => a - b);
  const first = days[0];
  const last = days[days.length - 1];
  if (
    first === undefined ||
    last === undefined ||
    days.length < MIN_ACTIVE_DAYS ||
    last - first < MIN_SPAN_DAYS
  ) {
    return { kind: 'learning' };
  }
  const gaps = days.slice(1).map((day, index) => day - days[index]!);
  const usualGapDays = usualGap(gaps.slice(-RECENT_GAPS));
  const since = Math.max(last, source.linkedAt ? dayNumber(localDay(source.linkedAt)) : last);
  const silentDays = Math.max(0, dayNumber(today) - since);
  return {
    kind: silentDays > usualGapDays * 2 + 1 ? 'quiet' : 'steady',
    usualGapDays,
    silentDays,
  };
}

export type CaptureFix =
  | 'turn_on_access'
  | 'open_access'
  | 'battery'
  | 'autostart'
  | 'report_missed'
  | 'open_log';

type AlertApp = { packageName: string; label: string };

export type CaptureAlert =
  | { kind: 'access_off'; apps: AlertApp[]; fix: 'turn_on_access' }
  | { kind: 'listener_stopped'; apps: AlertApp[]; fix: CaptureFix; silentDays: number }
  | {
      kind: 'app_quiet' | 'alerts_unread';
      apps: AlertApp[];
      fix: CaptureFix;
      silentDays: number;
      usualGapDays: number;
    }
  | { kind: 'reported_missed'; apps: AlertApp[]; fix: CaptureFix };

function hasUnansweredReport(source: CaptureSourceHealth): boolean {
  const newest = source.missed[0];
  return (
    !!newest &&
    (!source.lastCapturedAt || newest > source.lastCapturedAt) &&
    (!source.quietDismissedAt || newest > source.quietDismissedAt)
  );
}

function isDismissed(source: CaptureSourceHealth): boolean {
  return (
    !!source.quietDismissedAt &&
    (!source.lastCapturedAt || source.quietDismissedAt >= source.lastCapturedAt)
  );
}

/**
 * The one thing most worth saying about capture, or nothing. Only linked apps are looked at, so an
 * unlinked app's history can never raise an alert.
 */
export function assessCaptureHealth({
  apps,
  health,
  listener,
  battery,
  autostart,
  now,
}: {
  apps: readonly AlertApp[];
  health: CaptureHealth;
  listener: 'on' | 'off' | 'unknown';
  battery: BatteryExemption | 'checking';
  autostart: boolean;
  now: Date;
}): CaptureAlert | null {
  if (apps.length === 0) return null;
  if (listener === 'off') {
    return health.accessOffDismissedAt ? null : { kind: 'access_off', apps: [...apps], fix: 'turn_on_access' };
  }
  if (listener !== 'on') return null;

  const today = localDay(now.toISOString());
  const assessed = apps.map((app) => {
    const source = sourceHealth(health, app.packageName);
    return { app, source, cadence: assessCadence(source, today) };
  });
  const batteryFix = battery === 'not_exempt' ? ('battery' as const) : null;

  // Sooner than any one app's cadence, and it needs no history: nothing at all is arriving.
  const heardDaysAgo = health.listenerHeardAt
    ? dayNumber(today) - dayNumber(localDay(health.listenerHeardAt))
    : null;
  const undismissed = assessed.filter(({ source }) => !isDismissed(source)).map(({ app }) => app);
  if (heardDaysAgo !== null && heardDaysAgo >= LISTENER_SILENT_DAYS && undismissed.length > 0) {
    return {
      kind: 'listener_stopped',
      apps: undismissed,
      silentDays: heardDaysAgo,
      fix: batteryFix ?? (autostart ? 'autostart' : 'open_access'),
    };
  }

  const quiet = assessed.flatMap(({ app, source, cadence }) =>
    cadence.kind === 'quiet' && !isDismissed(source) ? [{ app, source, cadence }] : [],
  );
  const reported = assessed.filter(({ source }) => hasUnansweredReport(source)).map(({ app }) => app);
  if (quiet.length === 0 && reported.length === 0) return null;

  if (quiet.length === 0) {
    return {
      kind: 'reported_missed',
      apps: reported,
      fix: batteryFix ?? (autostart ? 'autostart' : 'open_log'),
    };
  }

  const quietApps = quiet.map(({ app }) => app);
  const silentDays = Math.min(...quiet.map(({ cadence }) => cadence.silentDays));
  const allStillHeard = quiet.every(
    ({ source }) =>
      !!source.lastHeardAt &&
      !!source.lastCapturedAt &&
      localDay(source.lastHeardAt) > localDay(source.lastCapturedAt),
  );
  return {
    kind: allStillHeard ? 'alerts_unread' : 'app_quiet',
    apps: quietApps,
    silentDays,
    usualGapDays: Math.max(...quiet.map(({ cadence }) => cadence.usualGapDays)),
    fix: batteryFix ?? 'report_missed',
  };
}

function joinAnd(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function days(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

const FIX_LABEL: Record<CaptureFix, string> = {
  turn_on_access: 'Turn on',
  open_access: 'Open settings',
  battery: 'Allow',
  autostart: 'Autostart',
  report_missed: 'Add it',
  open_log: 'Capture log',
};

const FIX_REASON: Partial<Record<CaptureFix, string>> = {
  battery: 'Android may be stopping Moni to save battery.',
  autostart: 'Check Autostart is on for Moni.',
  open_access: 'Turning notification access off and on restarts it.',
  report_missed: 'Add anything Moni missed.',
};

export type CaptureAlertCopy = {
  title: string;
  body: string;
  actionLabel: string;
  dismissLabel: string;
};

export function captureAlertCopy(alert: CaptureAlert): CaptureAlertCopy {
  const names = joinAnd(alert.apps.map((app) => app.label));
  const one = alert.apps.length === 1;
  const reason = FIX_REASON[alert.fix];
  const finish = (title: string, sentence: string, dismissLabel = 'Nothing missed') => ({
    title,
    body: reason ? `${sentence} ${reason}` : sentence,
    actionLabel: FIX_LABEL[alert.fix],
    dismissLabel,
  });
  switch (alert.kind) {
    case 'access_off':
      return finish(
        "Moni can't see notifications",
        `Payments from ${names} won't add themselves until notification access is back on.`,
        'Not now',
      );
    case 'listener_stopped':
      return finish(
        'Moni stopped reading alerts',
        `No notification from any app for ${days(alert.silentDays)}.`,
      );
    case 'app_quiet':
      return finish(
        `${names} ${one ? 'has' : 'have'} gone quiet`,
        `${one ? `Usually ${alert.usualGapDays === 1 ? 'every day' : `every ${alert.usualGapDays} days`}. ` : ''}Nothing for ${days(alert.silentDays)}.`,
      );
    case 'alerts_unread':
      return finish(
        `${names} ${one ? 'has' : 'have'} gone quiet`,
        `Alerts still arrive, but none became a capture for ${days(alert.silentDays)}. The wording may have changed.`,
      );
    case 'reported_missed':
      return finish(
        `${names} missed a transaction`,
        'You reported it, and nothing has come through since.',
      );
  }
}
