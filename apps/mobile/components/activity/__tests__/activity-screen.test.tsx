import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import ActivityScreen from '@/app/(tabs)/activity';
import { PAGE_HEADER_HEIGHT } from '@/components/ui/page';
import type { FinanceTransaction } from '@repo/core';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';

function mockRow(
  id: string,
  day: Date,
  amountMinor: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  const iso = day.toISOString();
  return {
    id,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor,
    currency: 'MYR',
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: `Shop ${id}`,
    notes: null,
    transactionDate: iso,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: iso,
    ...over,
  } as FinanceTransaction;
}

// 45 rows, one a day, newest 14 Oct: 30 Sep and earlier fall past the first page.
const mockRows = Array.from({ length: 45 }, (_, index) =>
  mockRow(`r${index + 1}`, new Date(2026, 9, 14 - index, 12), 1000),
);
mockRows[44] = mockRow('r45', new Date(2026, 9, 14 - 44, 12), 1000, {
  merchant: 'Needle Cafe',
  notes: 'buried',
});
mockRows.push(
  mockRow('salary', new Date(2026, 9, 2, 12), 420000, { type: 'income', merchant: 'Salary' }),
  mockRow('reload', new Date(2026, 9, 3, 12), 5000, {
    type: 'transfer',
    merchant: 'Reload',
    transferToWalletId: 'tng',
  }),
);

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useScrollToTop: jest.fn(),
}));
jest.mock('@/components/ui/page', () => ({
  ...jest.requireActual('@/components/ui/page'),
  usePageContentTop: () => jest.requireActual('@/components/ui/page').PAGE_HEADER_HEIGHT,
  Page: ({ title, trailing, children }: { title: string; trailing: ReactNode; children: ReactNode }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {trailing}
        {children}
      </View>
    );
  },
}));
jest.mock('@legendapp/state/react', () => ({
  useValue: (read: () => unknown) => read(),
  useSelector: () => true,
}));
jest.mock('@/lib/store', () => ({ transactions$: {} }));
jest.mock('@/lib/finance/selectors', () => ({
  transactions$: () => () => mockRows,
  walletsForUser$: () => () => [
    { id: 'maybank', name: 'Maybank', currency: 'MYR' },
    { id: 'tng', name: 'TNG', currency: 'MYR' },
    { id: 'wise', name: 'Wise', currency: 'USD' },
  ],
  categoriesForUser$: () => () => [],
  pendingProposals$: () => () => [],
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'kai' } }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));
jest.mock('@/lib/supabase/merchant-aliases', () => ({ listMerchantAliases: () => [] }));
jest.mock('@/components/nav/tab-bar', () => ({ useTabBarClearance: () => 100 }));
jest.mock('@/components/providers/sync-banner', () => ({ SyncBanner: () => null }));
jest.mock('@/components/ui/hold-menu', () => ({
  ...jest.requireActual('@/components/ui/hold-menu'),
  HoldHint: () => null,
}));
jest.mock('@/components/transaction/use-transaction-hold', () => ({
  useTransactionHold: () => ({ holdFor: () => undefined, menu: null }),
}));
jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const shown = (id: string) => screen.queryByTestId(`activity.transaction.${id}`) !== null;
const capsule = () => screen.getByTestId('activity.range');
const settleSheet = (result: unknown) =>
  act(() => {
    const sheet = getOpenSheet();
    (sheet as unknown as { settle: (value: unknown) => void }).settle(result);
    return Promise.resolve();
  });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 14, 12), doNotFake: ['nextTick', 'setImmediate'] });
});
afterEach(() => {
  dismissSheet();
  jest.useRealTimers();
});

describe('Activity pages', () => {
  it('shows one page at a time and moves through them', () => {
    render(<ActivityScreen />);
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 1 of 3');
    expect(shown('r1')).toBe(true);
    expect(shown('r45')).toBe(false);
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 2 of 3');
    expect(shown('r1')).toBe(false);
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 3 of 3');
    expect(shown('r45')).toBe(true);
    expect(screen.queryByTestId('activity.show-more')).toBeNull();
  });

  it('scrolls to the top of the list, not the screen, on a new page', () => {
    render(<ActivityScreen />);
    const scroll = screen.UNSAFE_getByType(ScrollView).instance as { scrollTo: jest.Mock };
    scroll.scrollTo = jest.fn();
    const list = screen.getByTestId('activity.pager.page');
    let wrapper = list.parent;
    while (wrapper && !wrapper.props.onLayout) wrapper = wrapper.parent;
    fireEvent(wrapper!, 'layout', { nativeEvent: { layout: { y: 312 } } });
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: PAGE_HEADER_HEIGHT + 312, animated: true });
  });

  it('goes back to page 1 when a filter changes', async () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    fireEvent.press(screen.getByTestId('activity.filter.type'));
    await settleSheet('expense');
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 1 of 3');
  });
});

describe('Activity type', () => {
  it('opens the type sheet on the current type and shows the picked one', async () => {
    render(<ActivityScreen />);
    const trigger = screen.getByTestId('activity.filter.type');
    expect(trigger).toHaveTextContent('All types');
    fireEvent.press(trigger);
    expect(getOpenSheet()?.request).toEqual({ kind: 'activityKind', selected: 'all' });
    await settleSheet('income');
    expect(screen.getByTestId('activity.filter.type')).toHaveTextContent('Income');
    expect(shown('salary')).toBe(true);
    expect(shown('r1')).toBe(false);
  });

  it('keeps the type when the sheet is dismissed', async () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.filter.type'));
    await settleSheet(null);
    expect(screen.getByTestId('activity.filter.type')).toHaveTextContent('All types');
    expect(shown('r1')).toBe(true);
  });
});

describe('Activity wallets', () => {
  it('offers the main-currency wallets, starting from all of them', () => {
    render(<ActivityScreen />);
    expect(screen.getByTestId('activity.filter.wallet')).toHaveTextContent('All wallets');
    fireEvent.press(screen.getByTestId('activity.filter.wallet'));
    const sheet = getOpenSheet();
    expect(sheet?.kind).toBe('wallets');
    const request = sheet?.request as { selectedIds: string[]; wallets: { id: string }[] };
    expect(request.selectedIds).toEqual([]);
    expect(request.wallets.map((wallet) => wallet.id)).toEqual(['maybank', 'tng']);
  });

  it('shows what one wallet or several cover, and names how many', async () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.filter.wallet'));
    await settleSheet({ walletIds: ['tng'] });
    expect(screen.getByTestId('activity.filter.wallet')).toHaveTextContent('TNG');
    expect(shown('reload')).toBe(true);
    expect(shown('r1')).toBe(false);

    fireEvent.press(screen.getByTestId('activity.filter.wallet'));
    expect((getOpenSheet()?.request as { selectedIds: string[] }).selectedIds).toEqual(['tng']);
    await settleSheet({ walletIds: ['maybank', 'tng'] });
    expect(screen.getByTestId('activity.filter.wallet')).toHaveTextContent('2 wallets');
    expect(shown('r1')).toBe(true);
  });

  it('leaves the wallets as they were on Cancel', async () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.filter.wallet'));
    await settleSheet({ walletIds: ['tng'] });
    fireEvent.press(screen.getByTestId('activity.filter.wallet'));
    await settleSheet(null);
    expect(screen.getByTestId('activity.filter.wallet')).toHaveTextContent('TNG');
    expect(shown('r1')).toBe(false);
  });
});

describe('Activity search', () => {
  it('finds a row on the last page by merchant and by note, on page 1', () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    expect(shown('r45')).toBe(false);
    fireEvent.changeText(screen.getByTestId('activity.search'), 'needle');
    expect(shown('r45')).toBe(true);
    expect(shown('r1')).toBe(false);
    expect(screen.queryByTestId('activity.pager.page')).toBeNull();
    fireEvent.changeText(screen.getByTestId('activity.search'), 'buried');
    expect(shown('r45')).toBe(true);
  });

  it('says so when nothing matches', () => {
    render(<ActivityScreen />);
    fireEvent.changeText(screen.getByTestId('activity.search'), 'zzqx');
    expect(screen.getByText('No matches for "zzqx"')).toBeTruthy();
    expect(screen.getByLabelText('Moni, thinking')).toBeTruthy();
  });

  it('clears the search from the no matches tile and lists everything again', () => {
    render(<ActivityScreen />);
    fireEvent.changeText(screen.getByTestId('activity.search'), 'zzqx');
    fireEvent.press(screen.getByTestId('activity.clear-search'));
    expect(screen.getByTestId('activity.search').props.value).toBe('');
    expect(screen.queryByText('No matches for "zzqx"')).toBeNull();
    expect(shown('r1')).toBe(true);
  });
});

describe('Activity dates', () => {
  it('opens on all time for the chart and the list alike', () => {
    render(<ActivityScreen />);
    expect(capsule()).toHaveTextContent('All time');
    expect(screen.queryByText('List shows all time')).toBeNull();
    expect(screen.queryByTestId('activity.range.clear')).toBeNull();
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 1 of 3');
  });

  it('narrows the totals, the chart and the list to the dates picked', async () => {
    render(<ActivityScreen />);
    fireEvent.press(capsule());
    await settleSheet({ range: { from: '2026-10-01', to: '2026-10-14' } });
    expect(screen.getByText('RM140.00')).toBeTruthy();
    expect(screen.getByTestId('activity.chart.2026-10-01')).toBeTruthy();
    expect(screen.queryByTestId('activity.chart.2026-09')).toBeNull();
    expect(shown('r15')).toBe(false);
  });

  it('applies dates from the sheet, drops to page 1, and clears back', async () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    fireEvent.press(capsule());
    expect(getOpenSheet()?.kind).toBe('activityRange');
    await settleSheet({ range: { from: '2026-10-01', to: '2026-10-14' } });
    expect(capsule()).toHaveTextContent('1 Oct to 14 Oct');
    expect(shown('r1')).toBe(true);
    expect(shown('r14')).toBe(true);
    expect(shown('r15')).toBe(false);
    expect(screen.queryByTestId('activity.pager.page')).toBeNull();
    fireEvent.press(screen.getByTestId('activity.range.clear'));
    expect(capsule()).toHaveTextContent('All time');
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 1 of 3');
  });

  it('keeps the dates when the sheet is dismissed', async () => {
    render(<ActivityScreen />);
    fireEvent.press(capsule());
    await settleSheet(null);
    expect(capsule()).toHaveTextContent('All time');
  });

});

describe('Activity chart', () => {
  it('totals the drawn period as Budget counts, leaving transfers out', () => {
    render(<ActivityScreen />);
    expect(screen.getByText('RM450.00')).toBeTruthy();
    expect(screen.getByText('RM4,200.00')).toBeTruthy();
  });

  it('follows the search, so the totals add up to what is listed', () => {
    render(<ActivityScreen />);
    fireEvent.changeText(screen.getByTestId('activity.search'), 'salary');
    expect(screen.getByText('RM0.00')).toBeTruthy();
    expect(screen.getByText('RM4,200.00')).toBeTruthy();
  });

  it('hides the chart and keeps the date control when nothing is left to draw', async () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.filter.type'));
    await settleSheet('transfer');
    expect(screen.queryByTestId('activity.chart')).toBeNull();
    expect(capsule()).toHaveTextContent('All time');
    expect(shown('reload')).toBe(true);
  });

  it('shows the bar held and never changes the dates', () => {
    render(<ActivityScreen />);
    const bar = screen.getByTestId('activity.chart.2026-10');
    fireEvent(bar, 'pressIn');
    expect(screen.getByText('Oct 2026')).toBeTruthy();
    expect(screen.getByText('Spent RM140.00')).toBeTruthy();
    expect(screen.getByText('Money in RM4,200.00')).toBeTruthy();
    fireEvent(bar, 'pressOut');
    expect(screen.queryByText('Spent RM140.00')).toBeNull();
    expect(capsule()).toHaveTextContent('All time');
  });

  it('leaves no figures up after a tap, and leaves the list alone', () => {
    render(<ActivityScreen />);
    const bar = screen.getByTestId('activity.chart.2026-09');
    fireEvent(bar, 'pressIn');
    fireEvent(bar, 'pressOut');
    fireEvent.press(bar);
    expect(screen.queryByText('Sep 2026')).toBeNull();
    expect(capsule()).toHaveTextContent('All time');
    expect(shown('r1')).toBe(true);
  });

  it('draws no legend: the totals carry the bars\' colours', () => {
    render(<ActivityScreen />);
    expect(screen.getByText('RM450.00')).toHaveProp('className', expect.stringContaining('text-primary'));
    expect(screen.getByText('RM4,200.00')).toHaveProp('className', expect.stringContaining('text-deep-mint'));
  });
});
