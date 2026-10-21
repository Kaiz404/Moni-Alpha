import { act, renderHook } from '@testing-library/react-native';

import { deleteTransaction } from '@/lib/supabase/transactions';
import { TOAST_MS, undoToast, useToast } from '@/lib/toast/toast-store';
import { deleteWithUndo, useHiddenTransactionIds } from '@/lib/transactions/delete-with-undo';

jest.mock('@/lib/supabase/transactions', () => ({
  deleteTransaction: jest.fn(() => Promise.resolve()),
}));

describe('deleteWithUndo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(deleteTransaction).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('hides the row and brings it back on Undo without deleting it', () => {
    const hidden = renderHook(() => useHiddenTransactionIds());
    const toast = renderHook(() => useToast());
    act(() => deleteWithUndo('tx-1', 'Deleted Shell −RM30.40'));

    expect(hidden.result.current.has('tx-1')).toBe(true);
    expect(toast.result.current?.text).toBe('Deleted Shell −RM30.40');
    act(() => undoToast());

    expect(hidden.result.current.has('tx-1')).toBe(false);
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('soft-deletes the row once the toast leaves without Undo', async () => {
    const hidden = renderHook(() => useHiddenTransactionIds());
    act(() => deleteWithUndo('tx-2', 'Deleted Guardian −RM15.90'));
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS);
    });

    expect(deleteTransaction).toHaveBeenCalledWith('tx-2');
    expect(hidden.result.current.has('tx-2')).toBe(false);
  });
});
