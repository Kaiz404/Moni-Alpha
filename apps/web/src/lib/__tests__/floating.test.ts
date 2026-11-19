import { describe, expect, it } from 'vitest';
import { intersect, placeFloating } from '../floating';

const viewport = { left: 0, top: 0, width: 1000, height: 800 };
const menu = { width: 256, height: 240 };

describe('placeFloating', () => {
  it('opens below the anchor on its start edge when there is room', () => {
    expect(placeFloating({ left: 100, top: 100, width: 120, height: 36 }, menu, viewport)).toEqual({
      left: 100,
      top: 142,
      maxHeight: null,
      side: 'bottom',
      origin: 'top left',
    });
  });

  it('flips to the left of a click near the right edge', () => {
    expect(
      placeFloating({ left: 900, top: 100, width: 0, height: 0 }, menu, viewport),
    ).toMatchObject({ left: 644, side: 'bottom', origin: 'top right' });
  });

  it('flips above a click near the bottom', () => {
    expect(
      placeFloating({ left: 100, top: 700, width: 0, height: 0 }, menu, viewport),
    ).toMatchObject({ top: 454, side: 'top', origin: 'bottom left' });
  });

  it('stays out of a docked pane by flipping inside the bounds it is given', () => {
    const list = intersect({ left: 0, top: 60, width: 640, height: 2000 }, viewport);
    expect(list).toEqual({ left: 0, top: 60, width: 640, height: 740 });
    expect(placeFloating({ left: 500, top: 300, width: 0, height: 0 }, menu, list).left).toBe(244);
  });

  it('clamps inside a window narrower than either edge allows', () => {
    expect(
      placeFloating({ left: 150, top: 100, width: 40, height: 36 }, menu, {
        left: 0,
        top: 0,
        width: 300,
        height: 800,
      }).left,
    ).toBe(36);
  });

  it('caps the height to the roomier side when neither side fits', () => {
    expect(
      placeFloating(
        { left: 100, top: 300, width: 120, height: 36 },
        { width: 256, height: 600 },
        viewport,
      ),
    ).toMatchObject({
      top: 342,
      maxHeight: 450,
      side: 'bottom',
    });
  });

  it('keeps an end-aligned popover on the anchor right edge', () => {
    expect(
      placeFloating({ left: 600, top: 100, width: 200, height: 40 }, menu, viewport, {
        align: 'end',
      }),
    ).toMatchObject({ left: 544, origin: 'top right' });
  });

  it('prefers above when asked and there is room', () => {
    expect(
      placeFloating({ left: 100, top: 700, width: 100, height: 40 }, menu, viewport, {
        side: 'top',
      }),
    ).toMatchObject({ top: 454, side: 'top' });
  });
});
