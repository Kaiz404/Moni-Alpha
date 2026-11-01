import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { approve, chartStep, keypadTap, notMine, scrubStep } from '@/lib/haptics';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

const haptics = jest.mocked(Haptics);

function onPlatform(os: 'android' | 'ios') {
  jest.replaceProperty(Platform, 'OS', os);
}

beforeEach(() => jest.clearAllMocks());

describe('haptics on Android', () => {
  beforeEach(() => onPlatform('android'));

  it('approve plays Confirm and notMine plays Reject', () => {
    approve();
    notMine();

    expect(haptics.performAndroidHapticsAsync.mock.calls).toEqual([['confirm'], ['reject']]);
    expect(haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('a keypad digit plays Keyboard_Tap', () => {
    keypadTap();

    expect(haptics.performAndroidHapticsAsync.mock.calls).toEqual([['keyboard-tap']]);
  });
});

describe('chartStep', () => {
  beforeEach(() => onPlatform('ios'));

  it('ticks on a chart of up to twelve points and stays quiet on a denser one', () => {
    chartStep(12);
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
    chartStep(13);
    chartStep(366);
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });
});

describe('haptics on iOS', () => {
  beforeEach(() => onPlatform('ios'));

  it('approve plays a success notification and a keypad digit plays nothing', () => {
    approve();
    keypadTap();
    scrubStep();

    expect(haptics.notificationAsync.mock.calls).toEqual([['success']]);
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});
