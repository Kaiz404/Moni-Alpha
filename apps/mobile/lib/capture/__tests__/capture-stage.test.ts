import type { MinorAmount } from '@repo/types';

import {
  START,
  captureStage,
  type CaptureDraft,
  type CaptureQuote,
  type CaptureStage,
} from '@/lib/capture/capture-stage';

const quote: CaptureQuote = {
  source: 'camera',
  imageUri: 'file:///cache/receipt.jpg',
};
const draft: CaptureDraft = {
  kind: 'expense',
  merchant: '99 Speedmart',
  amountMinor: 1860 as MinorAmount,
  categoryId: 'groceries',
  walletId: 'cash',
  transactionDate: '2026-10-14T06:04:00.000Z',
  evidence: 'Moni read a total of RM18.60.',
};
const reading: CaptureStage = { name: 'reading', quote };
const result: CaptureStage = { name: 'result', quote, draft };

describe('scan stages', () => {
  it('goes from the camera to reading when an image is captured', () => {
    expect(captureStage(START, { type: 'captured', quote })).toEqual(
      reading,
    );
  });

  it('shows the result when the read is ok', () => {
    expect(
      captureStage(reading, {
        type: 'read',
        result: { status: 'ok', draft },
      }),
    ).toEqual(result);
  });

  it('fails when the reader is unavailable', () => {
    expect(
      captureStage(reading, {
        type: 'read',
        result: { status: 'unavailable', reason: 'offline' },
      }),
    ).toEqual({
      name: 'failed',
      quote,
      failure: 'unavailable',
      reason: 'offline',
    });
  });

  it('approves only from the result', () => {
    expect(captureStage(result, { type: 'approved' })).toEqual({
      name: 'approved',
      draft,
    });
    expect(captureStage(reading, { type: 'approved' })).toBe(reading);
  });

  it('edits the draft in place on the result', () => {
    const edited = captureStage(result, {
      type: 'edit',
      patch: { amountMinor: 2000 as MinorAmount },
    });

    expect(edited).toEqual({
      ...result,
      draft: { ...draft, amountMinor: 2000 },
    });
  });

  it('leaves the stage unchanged for an event that does not fit', () => {
    expect(captureStage(START, { type: 'approved' })).toBe(START);
    expect(
      captureStage(START, {
        type: 'read',
        result: { status: 'ok', draft },
      }),
    ).toBe(START);
    expect(captureStage(reading, { type: 'captured', quote })).toBe(
      reading,
    );
    expect(captureStage(reading, { type: 'retry' })).toBe(reading);
  });
});
