import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import ActivityScreen from '@/app/(tabs)/activity';
import type { ActivityLinkParams } from '@/components/activity/activity-link';
import type { FinanceTransaction } from '@/lib/finance/types';
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

let mockParams: ActivityLinkParams = {};
const mockNavigation = {
  setParams: () => {
    mockParams = {};
  },
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => mockNavigation,
  useScrollToTop: jest.fn(),
}));
jest.mock('@/components/ui/page', () => ({
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
  walletsForUser$: () => () => [{ id: 'maybank', name: 'Maybank', currency: 'MYR' }],
  categoriesForUser$: () => () => [],
  pendingProposals$: () => () => [],
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'kai' } }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));
jest.mock('@/lib/supabase/merchant-aliases', () => ({ listMerchantAliases: () => [] }));
jest.mock('@/lib/supabase/proposed-transactions', () => ({ isAwaitingReview: () => false }));
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
  mockParams = {};
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
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 312, animated: true });
  });

  it('goes back to page 1 when a filter changes', () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.pager.older'));
    fireEvent.press(screen.getByTestId('activity.filter.expense'));
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 1 of 3');
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
  });
});

describe('Activity dates', () => {
  it('opens on the last 6 months for the chart and all time for the list, and says so', () => {
    render(<ActivityScreen />);
    expect(capsule()).toHaveTextContent('Last 6 months');
    expect(screen.getByText('List shows all time')).toBeTruthy();
    expect(screen.queryByTestId('activity.range.clear')).toBeNull();
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
    expect(capsule()).toHaveTextContent('Last 6 months');
    expect(screen.getByTestId('activity.pager.page')).toHaveTextContent('Page 1 of 3');
  });

  it('keeps the dates when the sheet is dismissed', async () => {
    render(<ActivityScreen />);
    fireEvent.press(capsule());
    await settleSheet(null);
    expect(capsule()).toHaveTextContent('Last 6 months');
  });

  it('opens a day link on just that day, with a way back', () => {
    mockParams = { day: '2026-09-14' };
    render(<ActivityScreen />);
    expect(capsule()).toHaveTextContent('Mon 14 Sep');
    expect(shown('r31')).toBe(true);
    expect(shown('r1')).toBe(false);
    expect(screen.queryByTestId('activity.filter.day')).toBeNull();
    fireEvent.press(screen.getByTestId('activity.range.clear'));
    expect(shown('r1')).toBe(true);
  });
});

describe('Activity chart', () => {
  it('totals the drawn period as Budget counts, leaving transfers out', () => {
    render(<ActivityScreen />);
    expect(screen.getByText('RM450.00')).toBeTruthy();
    expect(screen.getByText('RM4,200.00')).toBeTruthy();
  });

  it('narrows the list to the bar tapped, in finer bars', () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.chart.2026-09'));
    expect(capsule()).toHaveTextContent('Sep 2026');
    expect(shown('r15')).toBe(true);
    expect(shown('r1')).toBe(false);
    expect(screen.getByTestId('activity.chart.2026-09-29')).toBeTruthy();
    fireEvent.press(screen.getByTestId('activity.chart.2026-09-29'));
    expect(capsule()).toHaveTextContent('29 Sep to 30 Sep');
    expect(screen.getByTestId('activity.chart.2026-09-30')).toBeTruthy();
  });

  it('follows the search, so the totals add up to what is listed', () => {
    render(<ActivityScreen />);
    fireEvent.changeText(screen.getByTestId('activity.search'), 'salary');
    expect(screen.getByText('RM0.00')).toBeTruthy();
    expect(screen.getByText('RM4,200.00')).toBeTruthy();
  });

  it('hides the chart and keeps the date control when nothing is left to draw', () => {
    render(<ActivityScreen />);
    fireEvent.press(screen.getByTestId('activity.filter.transfer'));
    expect(screen.queryByTestId('activity.chart')).toBeNull();
    expect(capsule()).toHaveTextContent('All time');
    expect(shown('reload')).toBe(true);
  });

  it('shows the bar held and only a tap narrows', () => {
    render(<ActivityScreen />);
    const bar = screen.getByTestId('activity.chart.2026-10');
    fireEvent(bar, 'pressIn');
    expect(screen.getByText('Oct 2026')).toBeTruthy();
    expect(screen.getByText('Spent RM140.00')).toBeTruthy();
    expect(screen.getByText('Money in RM4,200.00')).toBeTruthy();
    fireEvent(bar, 'pressOut');
    expect(screen.queryByText('Spent RM140.00')).toBeNull();
    expect(capsule()).toHaveTextContent('Last 6 months');
  });
});
