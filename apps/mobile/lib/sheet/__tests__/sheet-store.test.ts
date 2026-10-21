import {
  dismissSheet,
  getOpenSheet,
  openSheet,
} from '@/lib/sheet/sheet-store';

const deleteWallet = {
  kind: 'confirm',
  title: 'Delete Maybank?',
  confirmLabel: 'Delete',
  cancelLabel: 'Keep it',
  destructive: true,
} as const;

afterEach(() => dismissSheet());

describe('openSheet', () => {
  it('resolves to true when the confirm action runs', async () => {
    const answer = openSheet(deleteWallet);
    const open = getOpenSheet();
    if (open?.kind !== 'confirm') throw new Error('confirm sheet is not open');

    open.settle(true);

    await expect(answer).resolves.toBe(true);
    expect(getOpenSheet()).toBeNull();
  });

  it('resolves to null on dismiss', async () => {
    const answer = openSheet(deleteWallet);

    dismissSheet();

    await expect(answer).resolves.toBeNull();
    expect(getOpenSheet()).toBeNull();
  });

  it('resolves the first sheet to null when a second opens, and keeps the second open', async () => {
    const first = openSheet(deleteWallet);
    const second = openSheet({ kind: 'currency', selected: 'MYR' });

    await expect(first).resolves.toBeNull();
    expect(getOpenSheet()?.request).toEqual({
      kind: 'currency',
      selected: 'MYR',
    });

    const open = getOpenSheet();
    if (open?.kind !== 'currency') throw new Error('currency sheet is not open');
    open.settle('SGD');
    await expect(second).resolves.toBe('SGD');
  });

  it('ignores a late settle from a sheet that was already replaced', async () => {
    void openSheet(deleteWallet);
    const stale = getOpenSheet();
    const second = openSheet({ kind: 'currency', selected: 'MYR' });

    if (stale?.kind !== 'confirm') throw new Error('confirm sheet was not open');
    stale.settle(true);

    expect(getOpenSheet()?.kind).toBe('currency');
    dismissSheet();
    await expect(second).resolves.toBeNull();
  });
});
