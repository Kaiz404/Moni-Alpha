import type { Observable } from '@legendapp/state';
import {
  isLocationRecordedForPackage,
  isPackageLinkedInCache,
  refreshLinkedPackagesFromStore,
} from '../linked-packages-cache';

jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { wallets$: observable({}) };
});

const { wallets$ } = jest.requireMock('@/lib/store') as {
  wallets$: Observable<Record<string, Record<string, unknown>>>;
};

const MAYBANK = 'com.maybank2u.life';
const TNG = 'my.com.tngdigital.ewallet';

function wallet(id: string, pkg: string, recordLocation?: boolean) {
  return {
    id,
    notification_package: pkg,
    is_active: true,
    deleted: false,
    ...(recordLocation === undefined ? {} : { record_location: recordLocation }),
  };
}

describe('Record where I spend, per linked app', () => {
  it('skips location only when every wallet linked to the app has it off', () => {
    wallets$.set({
      a: wallet('a', MAYBANK, false),
      b: wallet('b', MAYBANK, false),
      c: wallet('c', TNG),
    });
    refreshLinkedPackagesFromStore();

    expect(isPackageLinkedInCache(MAYBANK)).toBe(true);
    expect(isLocationRecordedForPackage(MAYBANK)).toBe(false);
    expect(isLocationRecordedForPackage(TNG)).toBe(true);

    wallets$.b.record_location.set(true);
    refreshLinkedPackagesFromStore();

    expect(isLocationRecordedForPackage(MAYBANK)).toBe(true);
  });
});
