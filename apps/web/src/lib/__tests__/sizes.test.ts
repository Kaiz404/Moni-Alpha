import { describe, expect, it } from 'vitest';
import { COLUMN_SPANS, PANE_SPANS, parseColumnWidths, parseSize, sizeForDrag, sizeForKey } from '../sizes';

describe('resizable seams', () => {
  it('reads a stored pane width, clamped, and the default for anything else', () => {
    expect(parseSize(PANE_SPANS.transaction, '712')).toBe(712);
    expect(parseSize(PANE_SPANS.transaction, '9000')).toBe(1600);
    expect(parseSize(PANE_SPANS.transaction, '12')).toBe(560);
    expect(parseSize(PANE_SPANS.transaction, null)).toBe(960);
    expect(parseSize(PANE_SPANS.transaction, 'wide')).toBe(960);
    expect(parseSize(PANE_SPANS.transaction, '')).toBe(960);
  });

  it('drags a pane wider to the left and a column wider to the right', () => {
    expect(sizeForDrag(PANE_SPANS.category, 960, -100, 'left')).toBe(1060);
    expect(sizeForDrag(COLUMN_SPANS.category, 150, 40, 'right')).toBe(190);
    expect(sizeForDrag(COLUMN_SPANS.category, 150, -400, 'right')).toBe(96);
  });

  it('moves a focused seam with the arrows, 64 with Shift, and Home, End and Enter jump', () => {
    expect(sizeForKey(PANE_SPANS.category, 960, 'ArrowLeft', false, 'left')).toBe(976);
    expect(sizeForKey(PANE_SPANS.category, 600, 'ArrowRight', true, 'left')).toBe(560);
    expect(sizeForKey(COLUMN_SPANS.wallet, 116, 'ArrowRight', false, 'right')).toBe(132);
    expect(sizeForKey(COLUMN_SPANS.wallet, 116, 'Home', false, 'right')).toBe(80);
    expect(sizeForKey(COLUMN_SPANS.wallet, 116, 'End', false, 'right')).toBe(260);
    expect(sizeForKey(COLUMN_SPANS.wallet, 200, 'Enter', false, 'right')).toBe(116);
    expect(sizeForKey(COLUMN_SPANS.wallet, 116, 'a', false, 'right')).toBeNull();
  });

  it('keeps only known columns with numbers', () => {
    expect(parseColumnWidths('{"category":240,"wallet":"wide","merchant":400,"amount":20}')).toEqual({ category: 240, amount: 80 });
    expect(parseColumnWidths('not json')).toEqual({});
    expect(parseColumnWidths(null)).toEqual({});
  });
});
