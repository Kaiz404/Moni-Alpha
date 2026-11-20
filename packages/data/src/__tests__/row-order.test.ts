import { describe, expect, it } from 'vitest';

import { createRowOrder } from '../row-order';

const after = (ms: number, value: string, log: string[]) =>
  new Promise<string>((resolve) =>
    setTimeout(() => {
      log.push(value);
      resolve(value);
    }, ms),
  );

describe('createRowOrder', () => {
  it("lands one row's writes in the order they were made, even when the first is slower", async () => {
    const inOrder = createRowOrder();
    const log: string[] = [];
    await Promise.all([inOrder('transactions/t1', () => after(30, 'change', log)), inOrder('transactions/t1', () => after(1, 'undo', log))]);
    expect(log).toEqual(['change', 'undo']);
  });

  it('lets writes to different rows go out together', async () => {
    const inOrder = createRowOrder();
    const log: string[] = [];
    await Promise.all([inOrder('transactions/t1', () => after(30, 't1', log)), inOrder('transactions/t2', () => after(1, 't2', log))]);
    expect(log).toEqual(['t2', 't1']);
  });

  it('still sends the next write when the one before it failed', async () => {
    const inOrder = createRowOrder();
    const failed = inOrder('transactions/t1', () => Promise.reject(new Error('offline')));
    const next = inOrder('transactions/t1', () => Promise.resolve('sent'));
    await expect(failed).rejects.toThrow('offline');
    await expect(next).resolves.toBe('sent');
  });
});
