import { AppRegistry, Platform } from 'react-native';

const mockLoaded: string[] = [];

jest.mock('react-native-android-notification-listener', () => ({
  __esModule: true,
  default: {},
  RNAndroidNotificationListenerHeadlessJsName: 'RNAndroidNotificationListenerHeadlessJs',
}));
jest.mock('expo-router/entry', () => {
  mockLoaded.push('router');
  return {};
});
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-notifications', () => ({ registerTaskAsync: jest.fn(async () => {}) }));
jest.mock('@/lib/ai/background-processor', () => {
  mockLoaded.push('processor');
  return { startBackgroundProcessor: jest.fn(async () => {}) };
});
jest.mock('@/lib/notifications/notification-filter.core', () => {
  mockLoaded.push('filter');
  throw new Error('filter failed to load');
});

let listener: ((task: { notification: string }) => Promise<void>) | undefined;

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(AppRegistry, 'registerHeadlessTask').mockImplementation((name, provider) => {
    mockLoaded.push(`registered ${name}`);
    listener = provider() as typeof listener;
  });
  require('../../../index');
});

describe('the capture task registration', () => {
  it('registers before the router loads the app, and loads no capture module until an alert arrives', () => {
    expect(mockLoaded).toEqual(['registered RNAndroidNotificationListenerHeadlessJs', 'router']);
  });

  it('survives a capture module that throws while loading', async () => {
    await expect(
      listener!({ notification: JSON.stringify({ app: 'com.maybank2u.life', text: 'RM1.00' }) }),
    ).resolves.toBeUndefined();

    expect(mockLoaded).toContain('filter');
    expect(console.error).toHaveBeenCalledWith(
      '[NotifCapture] failed to handle notification:',
      'filter failed to load',
    );
  });
});
