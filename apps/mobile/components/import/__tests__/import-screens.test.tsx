import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import ImportColumnsScreen from '@/app/import/columns';
import ImportScreen from '@/app/import/index';
import ImportPreviewScreen from '@/app/import/preview';
import { applyPlan } from '@/lib/backup/apply';
import { pickFile, readPickedFile, setImportSession, type ImportSession } from '@/lib/backup/import-session';
import { buildMoniExport } from '@/lib/backup/moni-export';
import { storeHasPulled } from '@/lib/backup/store-tables';
import { showToast } from '@/lib/toast/toast-store';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WALLET = '11111111-1111-4111-8111-111111111111';

jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), push: jest.fn(), back: jest.fn() },
}));
jest.mock('@/components/ui/page', () => ({
  Page: ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {children}
      </View>
    );
  },
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }),
}));
jest.mock('@/lib/backup/apply', () => ({ applyPlan: jest.fn(async () => 3) }));
jest.mock('@/lib/toast/toast-store', () => ({ showToast: jest.fn() }));
jest.mock('@/lib/backup/store-tables', () => ({
  ...jest.requireActual('@/lib/backup/store-tables'),
  storeHasPulled: jest.fn(() => true),
}));
jest.mock('@/lib/backup/import-session', () => ({
  ...jest.requireActual('@/lib/backup/import-session'),
  pickFile: jest.fn(),
}));

const bytes = (text: string) => Uint8Array.from(Buffer.from(text, 'utf8'));

function session(text: string): ImportSession {
  const read = readPickedFile('bank.csv', bytes(text), USER);
  if (read.kind !== 'ok') throw new Error(read.reason);
  return read.session;
}

function genericWithWallet(text: string): ImportSession {
  const current = session(text);
  if (current.kind !== 'generic') throw new Error('expected generic');
  return { ...current, choices: { ...current.choices, wallet: { id: WALLET, currency: 'MYR' } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  setImportSession(null);
  (storeHasPulled as jest.Mock).mockReturnValue(true);
});

describe('Import data', () => {
  it('holds choosing a file back until the first pull has run', () => {
    (storeHasPulled as jest.Mock).mockReturnValue(false);
    render(<ImportScreen />);
    expect(screen.getByText(/Moni is still loading your data/)).toBeTruthy();
    expect(screen.queryByTestId('import.choose')).toBeNull();
  });

  it('sends a Moni export to its preview', async () => {
    (pickFile as jest.Mock).mockResolvedValue({
      name: 'moni.csv',
      bytes: bytes(
        buildMoniExport(
          { wallets: [], categories: [], budgets: [], debts: [], debtActivities: [], transactions: [] },
          USER,
          new Date(),
        ),
      ),
    });
    render(<ImportScreen />);
    fireEvent.press(screen.getByTestId('import.choose'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/import/preview'));
  });

  it('sends any other CSV to its columns', async () => {
    (pickFile as jest.Mock).mockResolvedValue({ name: 'bank.csv', bytes: bytes('Date,Amount\n14/10/2026,-1\n') });
    render(<ImportScreen />);
    fireEvent.press(screen.getByTestId('import.choose'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/import/columns'));
  });

  it('says why it can not take a file, and stays', async () => {
    (pickFile as jest.Mock).mockResolvedValue({ name: 'a.xlsx', bytes: Uint8Array.from([0x50, 0x4b, 3, 4]) });
    render(<ImportScreen />);
    fireEvent.press(screen.getByTestId('import.choose'));
    await screen.findByText("That's an Excel workbook. Save it as a CSV, then choose it again.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    (pickFile as jest.Mock).mockResolvedValue(null);
    render(<ImportScreen />);
    fireEvent.press(screen.getByTestId('import.choose'));
    await waitFor(() => expect(pickFile).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('Match columns', () => {
  it('has nothing to show without a file', () => {
    render(<ImportColumnsScreen />);
    expect(screen.getByText('No file chosen')).toBeTruthy();
  });

  it('shows the columns it guessed, and asks for a wallet first', () => {
    setImportSession(session('Date,Merchant,Amount\n14/10/2026,Grab,-1\n'));
    render(<ImportColumnsScreen />);
    expect(screen.getByTestId('import.column.date')).toHaveTextContent(/Date/);
    expect(screen.getByTestId('import.column.merchant')).toHaveTextContent(/Merchant/);
    expect(screen.getByTestId('import.wallet')).toHaveTextContent(/Choose a wallet/);
    expect(screen.getByTestId('import.check')).toHaveTextContent('Choose a wallet');
  });

  it('asks which way round dates are only when the file does not say', () => {
    setImportSession(session('Date,Amount\n03/04/2026,-1\n'));
    const { unmount } = render(<ImportColumnsScreen />);
    expect(screen.getByTestId('import.date-order.dmy')).toBeTruthy();
    unmount();

    setImportSession(session('Date,Amount\n14/04/2026,-1\n'));
    render(<ImportColumnsScreen />);
    expect(screen.queryByTestId('import.date-order.dmy')).toBeNull();
  });
});

describe('Check the file', () => {
  it('has nothing to show without a file', () => {
    render(<ImportPreviewScreen />);
    expect(screen.getByText('No file chosen')).toBeTruthy();
  });

  it('shows what is new and what it can not read before anything is written', () => {
    setImportSession(genericWithWallet('Date,Merchant,Amount\n14/10/2026,Grab,-12.00\nsomeday,Kedai,-1\n'));
    render(<ImportPreviewScreen />);
    expect(screen.getByTestId('import.new')).toHaveTextContent('1');
    expect(screen.getByTestId('import.here')).toHaveTextContent('0');
    expect(screen.getByText('Grab')).toBeTruthy();
    expect(screen.getByText('−RM12.00')).toBeTruthy();
    expect(screen.getByText('Line 3')).toBeTruthy();
    expect(screen.getByText("The date can't be read")).toBeTruthy();
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it('writes on the button, then opens Activity', async () => {
    setImportSession(genericWithWallet('Date,Merchant,Amount\n14/10/2026,Grab,-12.00\n'));
    render(<ImportPreviewScreen />);
    fireEvent.press(screen.getByTestId('import.write'));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/activity'));
    expect(applyPlan).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({ text: 'Added 3 transactions' });
  });

  it('writes nothing for a file with nothing new, and goes back to Profile', () => {
    setImportSession(session(buildMoniExport(
      { wallets: [], categories: [], budgets: [], debts: [], debtActivities: [], transactions: [] },
      USER,
      new Date(),
    )));
    render(<ImportPreviewScreen />);
    expect(screen.getByTestId('import.new')).toHaveTextContent('0');
    fireEvent.press(screen.getByTestId('import.write'));
    expect(applyPlan).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/profile');
  });
});
