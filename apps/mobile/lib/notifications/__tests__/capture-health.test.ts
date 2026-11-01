import {
  CAPTURE_HEALTH_KEY,
  MAX_CAPTURE_DAYS,
  readCaptureHealth,
  recordCapture,
  recordHeard,
  recordLinked,
  recordMissed,
} from '../capture-health.core.js';
import { lastCapturedLine, sourceHealth, type CaptureHealth } from '../capture-health';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => void values.set(key, value),
  };
}

const MAYBANK = 'com.maybank2u.life';
const at = (day: number, hour = 9) => new Date(2026, 9, day, hour).toISOString();

describe('capture health store', () => {
  it('records the last capture and one day per capture day, newest first', () => {
    const storage = memoryStorage();
    recordCapture(storage, { packageName: MAYBANK, at: at(12) });
    recordCapture(storage, { packageName: MAYBANK, at: at(14) });
    recordCapture(storage, { packageName: MAYBANK, at: at(14, 18) });

    const source = readCaptureHealth(storage).sources[MAYBANK];
    expect(source.lastCapturedAt).toBe(at(14, 18));
    expect(source.captureDays).toEqual(['2026-10-14', '2026-10-12']);
  });

  it('keeps the later time when an older queue item finishes last', () => {
    const storage = memoryStorage();
    recordCapture(storage, { packageName: MAYBANK, at: at(14) });
    recordCapture(storage, { packageName: MAYBANK, at: at(12) });

    const source = readCaptureHealth(storage).sources[MAYBANK];
    expect(source.lastCapturedAt).toBe(at(14));
    expect(source.captureDays).toEqual(['2026-10-14', '2026-10-12']);
  });

  it('stops growing, dropping the oldest days', () => {
    const storage = memoryStorage();
    for (let day = 0; day < MAX_CAPTURE_DAYS + 5; day++) {
      recordCapture(storage, {
        packageName: MAYBANK,
        at: new Date(2026, 0, 1 + day, 9).toISOString(),
      });
    }

    const { captureDays } = readCaptureHealth(storage).sources[MAYBANK];
    expect(captureDays).toHaveLength(MAX_CAPTURE_DAYS);
    expect(captureDays[captureDays.length - 1]).toBe('2026-01-06');
  });

  it('files an alias under the same source as its canonical package', () => {
    const storage = memoryStorage();
    recordCapture(storage, { packageName: 'com.tngdigital.ewallet', at: at(14) });

    const health = readCaptureHealth(storage) as CaptureHealth;
    expect(sourceHealth(health, 'my.com.tngdigital.ewallet').lastCapturedAt).toBe(at(14));
  });

  it('hears every app but keeps a source only for a linked one', () => {
    const storage = memoryStorage();
    recordHeard(storage, { packageName: 'com.whatsapp', linked: false, at: at(14, 8) });
    recordHeard(storage, { packageName: MAYBANK, linked: true, at: at(14, 7) });

    const health = readCaptureHealth(storage);
    expect(health.listenerHeardAt).toBe(at(14, 8));
    expect(Object.keys(health.sources)).toEqual([MAYBANK]);
    expect(health.sources[MAYBANK].lastHeardAt).toBe(at(14, 7));
    expect(health.sources[MAYBANK].lastCapturedAt).toBeNull();
  });

  it('keeps a missed report and a link time without touching the capture history', () => {
    const storage = memoryStorage();
    recordCapture(storage, { packageName: MAYBANK, at: at(12) });
    recordMissed(storage, { packageName: MAYBANK, at: at(13) });
    recordLinked(storage, { packageName: MAYBANK, at: at(13, 10) });

    expect(readCaptureHealth(storage).sources[MAYBANK]).toMatchObject({
      lastCapturedAt: at(12),
      missed: [at(13)],
      linkedAt: at(13, 10),
    });
  });

  it('seeds itself from the log once, so an update does not show a used app as new', () => {
    const storage = memoryStorage({
      captured_notifications: JSON.stringify([
        {
          packageName: MAYBANK,
          packageLinked: true,
          receivedAt: at(14),
          status: 'auto_added',
        },
        { packageName: MAYBANK, packageLinked: true, receivedAt: at(13), status: 'ignored' },
        { packageName: 'com.shopee', packageLinked: false, receivedAt: at(14, 10), status: 'not_linked' },
      ]),
    });

    const health = readCaptureHealth(storage);
    expect(health.listenerHeardAt).toBe(at(14, 10));
    expect(Object.keys(health.sources)).toEqual([MAYBANK]);
    expect(health.sources[MAYBANK]).toMatchObject({
      lastCapturedAt: at(14),
      captureDays: ['2026-10-14'],
    });
  });

  it('survives a corrupt value', () => {
    const storage = memoryStorage({ [CAPTURE_HEALTH_KEY]: '{not json' });
    expect(readCaptureHealth(storage)).toEqual({ listenerHeardAt: null, sources: {} });
    recordCapture(storage, { packageName: MAYBANK, at: at(14) });
    expect(readCaptureHealth(storage).sources[MAYBANK].lastCapturedAt).toBe(at(14));
  });
});

describe('lastCapturedLine', () => {
  const now = new Date(2026, 9, 14, 12).getTime();
  const empty = sourceHealth({ listenerHeardAt: null, sources: {} }, MAYBANK);

  it('reads as the research sentence does', () => {
    expect(
      lastCapturedLine({ ...empty, lastCapturedAt: new Date(2026, 9, 14, 9).toISOString() }, now),
    ).toBe('Last captured 3 hours ago');
  });

  it('says so when nothing has come through', () => {
    expect(lastCapturedLine(empty, now)).toBe('No captures yet');
  });
});
