import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import type { CaptureQuote, ReadResult } from '@/lib/capture/capture-stage';
import { enqueue, getAll, pruneCompleted, resumeInterrupted } from '@/lib/ai/processing-queue';
import { approveCapture } from '@/lib/capture/approve-capture';

import { CaptureFailed } from '../scan-stages';
import { useCaptureFlow } from '../use-capture-flow';

const mockRead = jest.fn<Promise<ReadResult>, [CaptureQuote]>();
const mockSaveImage = jest.fn(async (_uri: string) => 'file:///documents/receipts/kept.jpg');
const mockDelete = jest.fn();
const mockStart = jest.fn(async () => {});
const mockReplace = jest.fn();
const mockBack = jest.fn();

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
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 3.13, longitude: 101.671 } }),
  reverseGeocodeAsync: async () => [{ name: 'Jalan Telawi 3', city: 'Kuala Lumpur' }],
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'held-1' }));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockDelete })),
}));
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), back: () => mockBack(), dismissTo: jest.fn() },
}));
jest.mock('@/lib/capture/read-capture', () => ({
  readCapture: (quote: CaptureQuote) => mockRead(quote),
}));
jest.mock('@/lib/receipts/images', () => ({
  saveImageLocally: (uri: string) => mockSaveImage(uri),
}));
jest.mock('@/lib/ai/background-processor', () => ({
  startBackgroundProcessor: () => mockStart(),
}));
jest.mock('@/lib/receipts/upload-queue', () => ({ keepScannedReceipt: jest.fn() }));
jest.mock('@/lib/capture/approve-capture', () => ({
  approveCapture: jest.fn(async () => ({ id: 'saved' })),
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'kai' } }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));
jest.mock('@/lib/wallets/default-wallet', () => ({ getDefaultWalletId: () => null }));
jest.mock('@/lib/finance/selectors', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  const empty = () => observable([]);
  return { categoriesForUser$: empty, transactions$: empty, walletsForUser$: empty };
});
jest.mock('@/lib/supabase/profile', () => ({
  ensureFinanceTimezone: () => Promise.resolve('Asia/Kuala_Lumpur'),
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    categoryBudgets$: observable({}),
    debts$: observable({}),
    debtActivities$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    merchantAliases$: observable({}),
    profilePreferences$: observable({ currency: 'MYR' }),
    recurringOverrides$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const VOICE: CaptureQuote = { source: 'voice', text: 'paid 12 ringgit at kedai abc' };
const CAMERA: CaptureQuote = { source: 'camera', imageUri: 'file:///cache/scan.jpg' };
const UNAVAILABLE: ReadResult = { status: 'unavailable', reason: 'AI backend error (503)' };
const DRAFT: ReadResult = {
  status: 'ok',
  draft: {
    kind: 'expense',
    merchant: 'Kedai ABC',
    amountMinor: 1200 as never,
    categoryId: null,
    walletId: 'w1',
    transactionDate: '2026-11-01T02:00:00.000Z',
    evidence: 'You said it.',
    itemCount: null,
    place: { kind: 'auto' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  pruneCompleted();
});

const queued = () =>
  getAll().map((item) => ({
    id: item.id,
    status: item.status,
    type: item.type,
    kept: item.type === 'text' ? item.text : item.type === 'image' ? item.imageUri : null,
  }));

async function failedFlow(source: 'voice' | 'camera', quote: CaptureQuote) {
  mockRead.mockResolvedValueOnce(UNAVAILABLE);
  const hook = renderHook(() => useCaptureFlow(source));
  await act(async () => {
    await hook.result.current.read(quote);
  });
  expect(hook.result.current.stage).toMatchObject({ name: 'failed', failure: 'unavailable', quote });
  return hook;
}

describe('Say it when Moni cannot be reached', () => {
  it('keeps the transcript in the queue, held while the page decides', async () => {
    await failedFlow('voice', VOICE);
    expect(queued()).toEqual([
      { id: 'held-1', status: 'held', type: 'text', kept: 'paid 12 ringgit at kedai abc' },
    ]);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('Try again reads the same words, and a read that works leaves nothing queued', async () => {
    const hook = await failedFlow('voice', VOICE);
    mockRead.mockResolvedValueOnce(DRAFT);
    await act(async () => {
      await hook.result.current.reread();
    });
    expect(mockRead).toHaveBeenLastCalledWith(VOICE);
    expect(hook.result.current.stage).toMatchObject({ name: 'result', quote: VOICE });
    expect(queued()).toEqual([]);
  });

  it('Try again that fails again still holds one copy', async () => {
    const hook = await failedFlow('voice', VOICE);
    mockRead.mockResolvedValueOnce(UNAVAILABLE);
    await act(async () => {
      await hook.result.current.reread();
    });
    expect(hook.result.current.stage).toMatchObject({ name: 'failed', quote: VOICE });
    expect(queued()).toHaveLength(1);
  });

  it('Keep it for Review sends it to the queue and leaves the page', async () => {
    const hook = await failedFlow('voice', VOICE);
    act(() => hook.result.current.keep());
    expect(queued()[0]).toMatchObject({ status: 'pending', kept: 'paid 12 ringgit at kedai abc' });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('leaving the page any other way keeps it too', async () => {
    const hook = await failedFlow('voice', VOICE);
    hook.unmount();
    expect(queued()[0]).toMatchObject({ status: 'pending' });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('Type it instead drops the copy, so the capture cannot arrive twice', async () => {
    const hook = await failedFlow('voice', VOICE);
    act(() => hook.result.current.typeInstead());
    expect(queued()).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith('/transaction/new');
  });

  it('a kill on the failed page brings it back on the next start', async () => {
    await failedFlow('voice', VOICE);
    resumeInterrupted({ includeHeld: true });
    expect(queued()[0]).toMatchObject({ status: 'pending', kept: 'paid 12 ringgit at kedai abc' });
  });

  it('an answer that is not a transaction stays terminal and keeps nothing', async () => {
    mockRead.mockResolvedValueOnce({ status: 'unreadable', reason: "Moni couldn't find a total" });
    const hook = renderHook(() => useCaptureFlow('voice'));
    await act(async () => {
      await hook.result.current.read(VOICE);
    });
    expect(hook.result.current.stage).toMatchObject({ name: 'failed', failure: 'unreadable' });
    expect(queued()).toEqual([]);
  });
});

describe('Scan a receipt when Moni cannot be reached', () => {
  it('moves the photo out of the cache before holding it', async () => {
    await failedFlow('camera', CAMERA);
    expect(mockSaveImage).toHaveBeenCalledWith('file:///cache/scan.jpg');
    expect(queued()).toEqual([
      { id: 'held-1', status: 'held', type: 'image', kept: 'file:///documents/receipts/kept.jpg' },
    ]);
  });

  it('deletes the kept copy once the read works', async () => {
    const hook = await failedFlow('camera', CAMERA);
    mockRead.mockResolvedValueOnce(DRAFT);
    await act(async () => {
      await hook.result.current.reread();
    });
    expect(queued()).toEqual([]);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps the photo that was held when the page is left', async () => {
    enqueue({
      id: 'other',
      type: 'text',
      text: 'older',
      createdAt: '2026-11-01T01:00:00.000Z',
      status: 'done',
    });
    const hook = await failedFlow('camera', CAMERA);
    hook.unmount();
    expect(queued()[1]).toEqual({
      id: 'held-1',
      status: 'pending',
      type: 'image',
      kept: 'file:///documents/receipts/kept.jpg',
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('the failed page', () => {
  const handlers = () => ({ onRetry: jest.fn(), onKeep: jest.fn(), onTypeIt: jest.fn() });

  it('shows the words Moni kept and offers all three ways out', () => {
    const on = handlers();
    render(
      <CaptureFailed
        quote={VOICE}
        failure="unavailable"
        title="Say it"
        {...on}
      />,
    );
    expect(screen.getByText('“paid 12 ringgit at kedai abc”')).toBeTruthy();
    expect(screen.getByText("Couldn't reach Moni")).toBeTruthy();
    expect(
      screen.getByText(
        'Moni kept what you said. Try again, or keep it and it goes to Review once Moni reads it. Nothing was added.',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('capture.failed.retry'));
    fireEvent.press(screen.getByTestId('capture.failed.keep'));
    fireEvent.press(screen.getByTestId('capture.failed.type-it'));
    expect(on.onRetry).toHaveBeenCalledTimes(1);
    expect(on.onKeep).toHaveBeenCalledTimes(1);
    expect(on.onTypeIt).toHaveBeenCalledTimes(1);
  });

  it('has nothing to keep when Moni read it and found no amount', () => {
    render(
      <CaptureFailed
        quote={CAMERA}
        failure="unreadable"
        title="Scan a receipt"
        {...handlers()}
      />,
    );
    expect(screen.queryByTestId('capture.failed.keep')).toBeNull();
    expect(screen.getByText("Moni couldn't find a total")).toBeTruthy();
  });
});

describe('the place saved on Approve', () => {
  async function checkPage() {
    mockRead.mockResolvedValueOnce(DRAFT);
    const hook = renderHook(() => useCaptureFlow('voice'));
    await act(async () => {
      await hook.result.current.read(VOICE);
    });
    return hook;
  }

  it("follows the phone's position by default", async () => {
    const hook = await checkPage();
    await act(async () => hook.result.current.approve());
    expect(jest.mocked(approveCapture).mock.calls[0][2]).toEqual({
      latitude: 3.13,
      longitude: 101.671,
      name: 'Jalan Telawi 3, Kuala Lumpur',
    });
  });

  it('saves the place the user picked', async () => {
    const hook = await checkPage();
    const shop = { latitude: 3.1301, longitude: 101.6712, name: 'Kedai ABC' };
    act(() =>
      hook.result.current.dispatch({
        type: 'edit',
        patch: { place: { kind: 'chosen', place: shop } },
      }),
    );
    await act(async () => hook.result.current.approve());
    expect(jest.mocked(approveCapture).mock.calls[0][2]).toEqual(shop);
  });

  it('saves none once turned off', async () => {
    const hook = await checkPage();
    act(() =>
      hook.result.current.dispatch({ type: 'edit', patch: { place: { kind: 'off' } } }),
    );
    await act(async () => hook.result.current.approve());
    expect(jest.mocked(approveCapture).mock.calls[0][2]).toBeNull();
  });
});
