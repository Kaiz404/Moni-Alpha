import { AppRegistry, Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { getAll, pruneCompleted } from '@/lib/ai/processing-queue';
import { writeLinkedPackages } from '@/lib/notifications/linked-packages-cache.core';

jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const store = stores.get(id) ?? new Map<string, string>();
      stores.set(id, store);
      return {
        set: (key: string, value: string) => store.set(key, value),
        getString: (key: string) => store.get(key),
        remove: (key: string) => store.delete(key),
      };
    },
  };
});
jest.mock('react-native-android-notification-listener', () => ({
  __esModule: true,
  default: {},
  RNAndroidNotificationListenerHeadlessJsName: 'RNAndroidNotificationListenerHeadlessJs',
}));
jest.mock('expo-router/entry', () => ({}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-notifications', () => ({ registerTaskAsync: jest.fn(async () => {}) }));
jest.mock('expo-crypto', () => {
  let next = 0;
  return { randomUUID: () => `00000000-0000-4000-b000-${String(++next).padStart(12, '0')}` };
});
jest.mock('@/lib/ai/background-processor', () => ({
  startBackgroundProcessor: jest.fn(async () => {}),
}));
jest.mock('@/lib/location/location-snapshot', () => ({
  captureLocationSnapshot: jest.fn(async () => null),
}));

type Payload = { app: string; title: string; text: string; time: string; icon?: string };
type Entry = Record<string, unknown> & { id: string; status: string };

const MAYBANK = 'com.maybank2u.life';
const ALERT = "MAYBANK: You've spent RM12.00 at KEDAI ABC.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOG_KEY = 'captured_notifications';
const notifications = createMMKV({ id: 'moni-notifications' });

let listener: (task: { notification: string }) => Promise<void>;

const log = () => JSON.parse(notifications.getString(LOG_KEY) ?? '[]') as Entry[];

const deliver = (payload: Payload) => listener({ notification: JSON.stringify(payload) });

const payment = (time: string, text = ALERT): Payload => ({
  app: MAYBANK,
  title: 'Maybank',
  text,
  time,
  icon: 'data:image/png;base64,AAAA',
});

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(AppRegistry, 'registerHeadlessTask').mockImplementation((_name, provider) => {
    listener = provider() as typeof listener;
  });
  require('../../../index');
});

beforeEach(() => {
  jest.mocked(startBackgroundProcessor).mockClear();
  notifications.remove(LOG_KEY);
  pruneCompleted();
  writeLinkedPackages([MAYBANK]);
});

describe('the headless task', () => {
  it('queues a linked payment alert under the one UUID its log entry and row share', async () => {
    await deliver(payment('1000'));

    const [entry] = log();
    const queue = getAll();
    expect(log()).toHaveLength(1);
    expect(entry!.id).toMatch(UUID);
    expect(entry!.status).toBe('waiting_for_review');
    expect(queue.map((item) => [item.id, item.type, item.status])).toEqual([
      [entry!.id, 'notification', 'pending'],
    ]);
    expect(startBackgroundProcessor).toHaveBeenCalledTimes(1);
  });

  it('keeps no icon in the queue, where a capture can wait for days', async () => {
    await deliver(payment('1000'));

    const [item] = getAll();
    expect(item!.type === 'notification' && item!.notification.text).toBe(ALERT);
    expect(JSON.stringify(item)).not.toContain('base64');
  });

  it('blanks a one-time code, keeps it Ignored, and never queues it', async () => {
    await deliver(payment('1000', 'Your TAC is 482910. RM12.00 payment to KEDAI ABC.'));

    expect(getAll()).toEqual([]);
    expect(startBackgroundProcessor).not.toHaveBeenCalled();
    expect(log()).toHaveLength(1);
    expect(log()[0]).toMatchObject({
      status: 'ignored',
      oneTimeCode: true,
      title: '',
      text: '',
      prefilterPassed: false,
    });
    expect(notifications.getString(LOG_KEY)).not.toContain('482910');
  });

  it('treats a redelivery as a repeat while the first copy is Trying again, and queues nothing more', async () => {
    await deliver(payment('1000'));
    const list = log();
    list[0]!.status = 'trying_again';
    notifications.set(LOG_KEY, JSON.stringify(list));
    const [first] = getAll();

    await deliver(payment('1000'));

    expect(log().map((entry) => entry.status)).toEqual(['ignored', 'trying_again']);
    expect(getAll().map((item) => item.id)).toEqual([first!.id]);
  });

  it('keeps every capture in the queue past the 50 the log holds', async () => {
    for (let time = 1; time <= 60; time += 1) await deliver(payment(String(time), `${ALERT} ${time}`));

    expect(log()).toHaveLength(50);
    expect(getAll()).toHaveLength(60);
    expect(new Set(getAll().map((item) => item.id)).size).toBe(60);
  });
});
