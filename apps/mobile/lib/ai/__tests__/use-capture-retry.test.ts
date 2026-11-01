import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useCaptureRetry } from '@/hooks/use-capture-retry';

const mockStart = jest.fn(async () => {});
let mockNetwork: { isConnected?: boolean; isInternetReachable?: boolean } = {};

jest.mock('@/lib/ai/background-processor', () => ({
  startBackgroundProcessor: () => mockStart(),
}));
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

function appStateChanges() {
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    listener: (state: string) => void,
  ) => {
    listeners.push(listener);
    return { remove: jest.fn() };
  }) as never);
  return (state: string) => listeners.forEach((listener) => listener(state));
}

beforeEach(() => {
  mockStart.mockClear();
  mockNetwork = {};
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('when queued captures retry', () => {
  it('retries when the app opens', () => {
    appStateChanges();
    renderHook(() => useCaptureRetry());
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('retries when the app returns to the foreground, not when it leaves', () => {
    const change = appStateChanges();
    renderHook(() => useCaptureRetry());
    mockStart.mockClear();

    act(() => change('background'));
    expect(mockStart).not.toHaveBeenCalled();
    act(() => change('active'));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('retries when connectivity returns, and not while it stays the same', () => {
    appStateChanges();
    mockNetwork = { isConnected: false, isInternetReachable: false };
    const hook = renderHook(() => useCaptureRetry());
    mockStart.mockClear();

    hook.rerender({});
    expect(mockStart).not.toHaveBeenCalled();

    mockNetwork = { isConnected: true, isInternetReachable: true };
    hook.rerender({});
    expect(mockStart).toHaveBeenCalledTimes(1);

    hook.rerender({});
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('reads an unknown network as online, so it does not retry on the first answer', () => {
    appStateChanges();
    const hook = renderHook(() => useCaptureRetry());
    mockStart.mockClear();

    mockNetwork = { isConnected: true, isInternetReachable: true };
    hook.rerender({});
    expect(mockStart).not.toHaveBeenCalled();
  });
});
