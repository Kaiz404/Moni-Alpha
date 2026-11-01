import { Platform } from 'react-native';

import { getCachedAppIcon, saveAppIcon } from '../app-icon-cache';
import {
  canListEveryApp,
  fillLinkedAppIcons,
  getCachedInstalledAppsMap,
  getInstalledAppInfo,
  refreshInstalledApps,
} from '../installed-apps';
import { writeLinkedPackages } from '../linked-packages-cache.core';

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

const ICON = 'data:image/png;base64,ICON';
const mockNative = {
  available: true,
  listLaunchableAppsAsync: undefined as undefined | jest.Mock,
  getInstalledAppsAsync: jest.fn(async (): Promise<unknown[]> => []),
  getAppInfoAsync: jest.fn(async (): Promise<unknown> => null),
};

jest.mock('../../../modules/moni-android-apps', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
  isMoniAndroidAppsNativeAvailable: () => mockNative.available,
}));

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
});

beforeEach(() => {
  mockNative.available = true;
  mockNative.listLaunchableAppsAsync = undefined;
  mockNative.getInstalledAppsAsync.mockClear();
  mockNative.getAppInfoAsync.mockClear();
});

describe('listing the apps on the phone', () => {
  it('lists every launchable app and fills getCachedAppIcon from the listing', async () => {
    mockNative.listLaunchableAppsAsync = jest.fn(async () => [
      { packageName: 'com.example.anybank', label: ' Any Bank ', iconUri: ICON },
      { packageName: 'com.example.noicon', label: '', iconUri: null },
    ]);

    const apps = await refreshInstalledApps();

    expect(canListEveryApp()).toBe(true);
    expect(mockNative.getInstalledAppsAsync).not.toHaveBeenCalled();
    expect([...apps.values()]).toEqual([
      { packageName: 'com.example.anybank', label: 'Any Bank', iconUri: ICON },
      { packageName: 'com.example.noicon', label: 'com.example.noicon', iconUri: null },
    ]);
    expect(getCachedAppIcon('com.example.anybank')).toBe(ICON);
    expect(getCachedAppIcon('com.example.noicon')).toBeNull();
  });

  it('falls back to the known finance apps on a build without the new function', async () => {
    mockNative.getInstalledAppsAsync.mockResolvedValueOnce([
      { packageName: 'com.maybank2u.life', label: 'MAE', iconUri: ICON },
    ]);

    const apps = await refreshInstalledApps();

    expect(canListEveryApp()).toBe(false);
    expect([...apps.keys()]).toEqual(['com.maybank2u.life']);
  });

  it('asks the phone only once while a listing is running', async () => {
    mockNative.listLaunchableAppsAsync = jest.fn(async () => []);

    await Promise.all([refreshInstalledApps(), refreshInstalledApps()]);

    expect(mockNative.listLaunchableAppsAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the last listing when the phone fails to answer', async () => {
    mockNative.listLaunchableAppsAsync = jest.fn(async () => [
      { packageName: 'com.example.kept', label: 'Kept', iconUri: null },
    ]);
    await refreshInstalledApps();
    jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
    mockNative.listLaunchableAppsAsync = jest.fn(async () => {
      throw new Error('binder died');
    });

    const apps = await refreshInstalledApps();

    expect([...apps.keys()]).toEqual(['com.example.kept']);
    expect(getCachedInstalledAppsMap()).toBe(apps);
  });

  it('returns nothing, without calling the module, when it is not linked', async () => {
    mockNative.available = false;
    const apps = await refreshInstalledApps();

    expect(apps.size).toBe(0);
    expect(canListEveryApp()).toBe(false);
    expect(await getInstalledAppInfo('com.example.anybank')).toBeNull();
    expect(mockNative.getAppInfoAsync).not.toHaveBeenCalled();
  });
});

describe('icons by name', () => {
  it('keeps the icon of an app looked up by name across a listing', async () => {
    mockNative.getAppInfoAsync.mockResolvedValueOnce({
      packageName: 'com.example.byname',
      label: 'By Name',
      iconUri: ICON,
    });

    expect(await getInstalledAppInfo('com.example.byname')).toEqual({
      packageName: 'com.example.byname',
      label: 'By Name',
      iconUri: ICON,
    });

    mockNative.listLaunchableAppsAsync = jest.fn(async () => []);
    await refreshInstalledApps();
    expect(getCachedAppIcon('com.example.byname')).toBe(ICON);
  });

  it('asks only for linked apps whose icon is missing', async () => {
    saveAppIcon('com.example.have', ICON);
    writeLinkedPackages(['com.example.have', 'com.example.need']);
    mockNative.getAppInfoAsync.mockResolvedValueOnce({
      packageName: 'com.example.need',
      label: 'Need',
      iconUri: ICON,
    });

    await fillLinkedAppIcons();

    expect(mockNative.getAppInfoAsync.mock.calls).toEqual([['com.example.need']]);
    expect(getCachedAppIcon('com.example.need')).toBe(ICON);
  });

  it('refuses something that is not an image', () => {
    saveAppIcon('com.example.bad', 'not-an-image');
    expect(getCachedAppIcon('com.example.bad')).toBeNull();
  });
});
