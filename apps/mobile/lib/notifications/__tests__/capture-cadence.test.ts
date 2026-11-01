import {
  assessCadence,
  assessCaptureHealth,
  captureAlertCopy,
  type CaptureAlert,
} from '../capture-cadence';
import { emptySource } from '../capture-health.core.js';
import type { CaptureHealth, CaptureSourceHealth } from '../capture-health';

const day = (date: number, month = 10) => {
  const value = new Date(2026, month, date);
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${mm}-${dd}`;
};
/** Newest first, as the store keeps them. 1 Nov 2026 is a Sunday. */
const daily = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => day(from - index));
/** Sat and Sun for four weekends, ending on Sun 1 Nov. */
const WEEKENDS = [1, 0, -6, -7, -13, -14, -20, -21].map((date) => day(date));
/** Mon to Fri for two weeks, ending Fri 30 Oct. */
const WEEKDAYS = [-1, -2, -3, -4, -5, -8, -9, -10, -11, -12].map((date) => day(date));

function source(over: Partial<CaptureSourceHealth> = {}): CaptureSourceHealth {
  return { ...(emptySource() as CaptureSourceHealth), ...over };
}

describe('assessCadence', () => {
  it('stays learning for a new app with little history', () => {
    expect(assessCadence(source(), day(30))).toEqual({ kind: 'learning' });
    expect(assessCadence(source({ captureDays: daily(1, 4) }), day(30))).toEqual({
      kind: 'learning',
    });
  });

  it('stays learning with five days packed into less than a week', () => {
    expect(assessCadence(source({ captureDays: daily(5, 5) }), day(30))).toEqual({
      kind: 'learning',
    });
  });

  it('holds a daily app until more than twice its gap plus today has passed', () => {
    const history = source({ captureDays: daily(1, 20) });
    expect(assessCadence(history, day(1))).toEqual({
      kind: 'steady',
      usualGapDays: 1,
      silentDays: 0,
    });
    expect(assessCadence(history, day(4))).toEqual({
      kind: 'steady',
      usualGapDays: 1,
      silentDays: 3,
    });
    expect(assessCadence(history, day(5))).toEqual({
      kind: 'quiet',
      usualGapDays: 1,
      silentDays: 4,
    });
  });

  it('reads a weekend-only app by its own gap, so no weekday looks like silence', () => {
    const history = source({ captureDays: WEEKENDS });
    for (const today of [2, 3, 4, 5, 6]) {
      expect(assessCadence(history, day(today)).kind).toBe('steady');
    }
  });

  it('lets one skipped weekend pass and catches the second', () => {
    const history = source({ captureDays: WEEKENDS });
    expect(assessCadence(history, day(8))).toMatchObject({ kind: 'steady', usualGapDays: 6 });
    expect(assessCadence(history, day(14))).toMatchObject({ kind: 'steady', silentDays: 13 });
    expect(assessCadence(history, day(15))).toMatchObject({ kind: 'quiet', silentDays: 14 });
  });

  it('reads a weekday-only app by its own gap, so a weekend is not silence', () => {
    const history = source({ captureDays: WEEKDAYS });
    expect(assessCadence(history, day(2))).toMatchObject({ kind: 'steady', usualGapDays: 3 });
    expect(assessCadence(history, day(7))).toMatchObject({ kind: 'quiet', silentDays: 8 });
  });

  it('does not let one holiday set the rhythm', () => {
    const history = source({
      captureDays: [...daily(1, 15), ...daily(-40, 15)],
    });
    expect(assessCadence(history, day(5))).toMatchObject({ kind: 'quiet', usualGapDays: 1 });
  });

  it('starts the clock again when an app is linked after a long gap', () => {
    const history = source({
      captureDays: daily(-60, 20),
      linkedAt: new Date(2026, 10, 1, 9).toISOString(),
    });
    expect(assessCadence(history, day(2))).toMatchObject({ kind: 'steady', silentDays: 1 });
    expect(assessCadence(history, day(5))).toMatchObject({ kind: 'quiet', silentDays: 4 });
  });

  it('survives a clock moved backwards', () => {
    expect(assessCadence(source({ captureDays: daily(5, 20) }), day(1))).toMatchObject({
      kind: 'steady',
      silentDays: 0,
    });
  });
});

const MAYBANK = { packageName: 'com.maybank2u.life', label: 'Maybank' };
const GRAB = { packageName: 'com.grabtaxi.passenger', label: 'Grab' };
const now = new Date(2026, 10, 5, 12);
const LAST_CAPTURED = new Date(2026, 10, 1, 9).toISOString();
const healthyListener = new Date(2026, 10, 5, 8).toISOString();

const quietMaybank = source({ captureDays: daily(1, 20), lastCapturedAt: LAST_CAPTURED });

function assess(
  over: Partial<Parameters<typeof assessCaptureHealth>[0]> & {
    sources?: Record<string, CaptureSourceHealth>;
    heardAt?: string | null;
  } = {},
) {
  const { sources, heardAt, ...rest } = over;
  const health: CaptureHealth = {
    listenerHeardAt: heardAt === undefined ? healthyListener : heardAt,
    sources: sources ?? { [MAYBANK.packageName]: quietMaybank },
    accessOffDismissedAt: null,
  };
  return assessCaptureHealth({
    apps: [MAYBANK],
    health,
    listener: 'on',
    battery: 'exempt',
    autostart: false,
    now,
    ...rest,
  });
}

describe('assessCaptureHealth', () => {
  it('says nothing about an app once it is unlinked, whatever its history', () => {
    expect(assess({ apps: [] })).toBeNull();
    expect(assess({ apps: [], listener: 'off' })).toBeNull();
    expect(assess({ apps: [GRAB] })).toBeNull();
  });

  it('says nothing about a new app with little history', () => {
    expect(
      assess({ sources: { [MAYBANK.packageName]: source({ captureDays: daily(1, 3) }) } }),
    ).toBeNull();
  });

  it('flags a quiet app whose listener is alive, with a way to add what it missed', () => {
    expect(assess()).toEqual({
      kind: 'app_quiet',
      apps: [MAYBANK],
      silentDays: 4,
      usualGapDays: 1,
      fix: 'report_missed',
    });
  });

  it('detects revoked access above every other alert', () => {
    expect(assess({ listener: 'off' })).toEqual({
      kind: 'access_off',
      apps: [MAYBANK],
      fix: 'turn_on_access',
    });
  });

  it('respects a user who chose to turn access off and said Not now', () => {
    const health: CaptureHealth = {
      listenerHeardAt: healthyListener,
      sources: {},
      accessOffDismissedAt: healthyListener,
    };
    expect(
      assessCaptureHealth({
        apps: [MAYBANK],
        health,
        listener: 'off',
        battery: 'exempt',
        autostart: false,
        now,
      }),
    ).toBeNull();
  });

  it('stays out of the way while access cannot be read', () => {
    expect(assess({ listener: 'unknown' })).toBeNull();
  });

  it('reads silence from every app as the listener stopping', () => {
    expect(assess({ heardAt: new Date(2026, 10, 1, 9).toISOString() })).toMatchObject({
      kind: 'listener_stopped',
      silentDays: 4,
      fix: 'open_access',
    });
  });

  it('needs no history to see the listener stopped, and no alert before it has heard anything', () => {
    const fresh = { [MAYBANK.packageName]: source() };
    expect(
      assess({ sources: fresh, heardAt: new Date(2026, 10, 2).toISOString() }),
    ).toMatchObject({ kind: 'listener_stopped', silentDays: 3 });
    expect(assess({ sources: fresh, heardAt: null })).toBeNull();
    expect(assess({ sources: fresh, heardAt: new Date(2026, 10, 4).toISOString() })).toBeNull();
  });

  it('offers the battery prompt first when Moni is not exempt', () => {
    expect(assess({ battery: 'not_exempt' })).toMatchObject({ kind: 'app_quiet', fix: 'battery' });
    expect(
      assess({ battery: 'not_exempt', heardAt: new Date(2026, 10, 1).toISOString() }),
    ).toMatchObject({ kind: 'listener_stopped', fix: 'battery' });
  });

  it('offers Autostart next where the phone has it', () => {
    expect(
      assess({ autostart: true, heardAt: new Date(2026, 10, 1).toISOString() }),
    ).toMatchObject({ kind: 'listener_stopped', fix: 'autostart' });
  });

  it('tells apart an app that still sends alerts none of which became captures', () => {
    expect(
      assess({
        sources: {
          [MAYBANK.packageName]: {
            ...quietMaybank,
            lastHeardAt: new Date(2026, 10, 4, 18).toISOString(),
          },
        },
      }),
    ).toMatchObject({ kind: 'alerts_unread' });
  });

  it('stops asking after Nothing missed, until the next capture goes quiet again', () => {
    const dismissed = { ...quietMaybank, quietDismissedAt: new Date(2026, 10, 5, 9).toISOString() };
    expect(assess({ sources: { [MAYBANK.packageName]: dismissed } })).toBeNull();
    expect(
      assess({
        now: new Date(2026, 10, 30, 12),
        heardAt: new Date(2026, 10, 30, 8).toISOString(),
        sources: {
          [MAYBANK.packageName]: {
            ...dismissed,
            captureDays: daily(20, 20),
            lastCapturedAt: new Date(2026, 10, 20, 9).toISOString(),
          },
        },
      }),
    ).toMatchObject({ kind: 'app_quiet', silentDays: 10 });
  });

  it('counts a reported miss even for an app still learning', () => {
    expect(
      assess({
        sources: {
          [MAYBANK.packageName]: source({
            captureDays: daily(1, 2),
            lastCapturedAt: LAST_CAPTURED,
            missed: [new Date(2026, 10, 3).toISOString()],
          }),
        },
      }),
    ).toEqual({ kind: 'reported_missed', apps: [MAYBANK], fix: 'open_log' });
  });

  it('stops counting a report once a capture comes through', () => {
    expect(
      assess({
        sources: {
          [MAYBANK.packageName]: source({
            captureDays: daily(4, 2),
            lastCapturedAt: new Date(2026, 10, 4).toISOString(),
            missed: [new Date(2026, 10, 3).toISOString()],
          }),
        },
      }),
    ).toBeNull();
  });

  it('names every quiet app in one alert', () => {
    expect(
      assess({
        apps: [MAYBANK, GRAB],
        sources: {
          [MAYBANK.packageName]: quietMaybank,
          [GRAB.packageName]: quietMaybank,
        },
      }),
    ).toMatchObject({ kind: 'app_quiet', apps: [MAYBANK, GRAB] });
  });
});

describe('captureAlertCopy', () => {
  const copy = (alert: CaptureAlert) => captureAlertCopy(alert);

  it('says what a quiet daily app normally does', () => {
    expect(
      copy({
        kind: 'app_quiet',
        apps: [MAYBANK],
        silentDays: 4,
        usualGapDays: 1,
        fix: 'report_missed',
      }),
    ).toEqual({
      title: 'Maybank has gone quiet',
      body: 'Usually every day. Nothing for 4 days. Add anything Moni missed.',
      actionLabel: 'Add it',
      dismissLabel: 'Nothing missed',
    });
  });

  it('says why when the fix is the battery prompt', () => {
    expect(
      copy({ kind: 'listener_stopped', apps: [MAYBANK], silentDays: 3, fix: 'battery' }),
    ).toEqual({
      title: 'Moni stopped reading alerts',
      body: 'No notification from any app for 3 days. Android may be stopping Moni to save battery.',
      actionLabel: 'Allow',
      dismissLabel: 'Nothing missed',
    });
  });

  it('uses the permission words when access is off', () => {
    expect(copy({ kind: 'access_off', apps: [MAYBANK, GRAB], fix: 'turn_on_access' })).toEqual({
      title: "Moni can't see notifications",
      body: "Payments from Maybank and Grab won't add themselves until notification access is back on.",
      actionLabel: 'Turn on',
      dismissLabel: 'Not now',
    });
  });
});
