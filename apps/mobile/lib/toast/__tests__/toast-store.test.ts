import { act, renderHook } from '@testing-library/react-native';

import { dismissToast, showToast, TOAST_MS, undoToast, useToast } from '@/lib/toast/toast-store';

describe('toast store', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => dismissToast());
    jest.useRealTimers();
  });

  it('holds one toast: a second replaces the first and commits it', () => {
    const { result } = renderHook(() => useToast());
    const firstCommit = jest.fn();
    act(() => showToast({ text: 'Amount saved', commit: firstCommit }));
    act(() => showToast({ text: 'Deleted Shell −RM30.40', tone: 'removed' }));

    expect(result.current?.text).toBe('Deleted Shell −RM30.40');
    expect(result.current?.tone).toBe('removed');
    expect(firstCommit).toHaveBeenCalledTimes(1);
  });

  it('runs undo once on Undo, and never commits that toast', () => {
    const { result } = renderHook(() => useToast());
    const undo = jest.fn();
    const commit = jest.fn();
    act(() => showToast({ text: 'Deleted', undo, commit }));
    act(() => undoToast());
    act(() => undoToast());
    act(() => jest.advanceTimersByTime(TOAST_MS));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('commits and leaves after 5 s', () => {
    const { result } = renderHook(() => useToast());
    const commit = jest.fn();
    act(() => showToast({ text: 'Deleted', undo: () => {}, commit }));
    act(() => jest.advanceTimersByTime(TOAST_MS - 1));
    expect(result.current?.text).toBe('Deleted');
    act(() => jest.advanceTimersByTime(1));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
  });
});
