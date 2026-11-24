import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const { shownPhoto } = await import('@/lib/receipt-photo');
const { RESTING, clickZoom, containSize, flipFrom, wheelZoom, zoomAbout } = await import('@/lib/receipt-viewer');

const PATH = 'u1/t1.jpg';
const LEGACY = 'https://abc.supabase.co/storage/v1/object/public/receipts/u1/t1.jpg';
const SIGNED = 'https://abc.supabase.co/storage/v1/object/sign/receipts/u1/t1.jpg?token=x';

describe('shownPhoto', () => {
  it('shows nothing when no photo is uploaded', () => {
    expect(shownPhoto(null, undefined)).toBeNull();
    expect(shownPhoto('', undefined)).toBeNull();
    expect(shownPhoto('file:///data/receipt.jpg', undefined)).toBeNull();
  });

  it('waits while a stored path or an old public URL is signed', () => {
    expect(shownPhoto(PATH, undefined)).toBeUndefined();
    expect(shownPhoto(LEGACY, undefined)).toBeUndefined();
  });

  it('shows the signed link for the value it was signed for, never the public URL', () => {
    expect(shownPhoto(LEGACY, { stored: LEGACY, url: SIGNED })).toBe(SIGNED);
    expect(shownPhoto(PATH, { stored: PATH, url: SIGNED })).toBe(SIGNED);
  });

  it('waits again when the transaction changes under a link signed for another', () => {
    expect(shownPhoto('u1/t2.jpg', { stored: PATH, url: SIGNED })).toBeUndefined();
  });

  it('shows no photo when signing failed', () => {
    expect(shownPhoto(PATH, { stored: PATH, url: null })).toBeNull();
  });
});

describe('the receipt viewer', () => {
  it('starts the photo over the thumbnail, centred and contained in it', () => {
    expect(flipFrom({ x: 100, y: 200, width: 42, height: 42 }, { x: 500, y: 50, width: 400, height: 800 })).toBe('translate(-389.5px, 150px) scale(0.0525)');
    expect(flipFrom({ x: 0, y: 0, width: 42, height: 42 }, { x: 0, y: 0, width: 0, height: 0 })).toBe('none');
  });

  it('fills the space with the whole photo, a small one included', () => {
    expect(containSize({ width: 1408, height: 820 }, { width: 360, height: 560 })).toEqual({ width: 527, height: 820 });
    expect(containSize({ width: 358, height: 764 }, { width: 1200, height: 900 })).toEqual({ width: 358, height: 269 });
  });

  it('zooms about the point under the pointer', () => {
    expect(zoomAbout(RESTING, { x: 100, y: 40 }, 2)).toEqual({ scale: 2, x: -100, y: -40 });
    expect(zoomAbout({ scale: 2, x: -100, y: -40 }, { x: 100, y: 40 }, 1)).toEqual(RESTING);
  });

  it('keeps the zoom between 1 and 4', () => {
    expect(zoomAbout(RESTING, { x: 0, y: 0 }, 9).scale).toBe(4);
    expect(zoomAbout({ scale: 2, x: -10, y: -10 }, { x: 0, y: 0 }, 0.2)).toEqual(RESTING);
  });

  it('a click zooms in to 2.5 and a second click zooms out', () => {
    const zoomed = clickZoom(RESTING, { x: 200, y: 100 });
    expect(zoomed).toEqual({ scale: 2.5, x: -300, y: -150 });
    expect(clickZoom(zoomed, { x: 10, y: 10 })).toEqual(RESTING);
  });

  it('the wheel turned up zooms in, and turned down from rest stays at rest', () => {
    expect(wheelZoom(RESTING, { x: 0, y: 0 }, -300).scale).toBeCloseTo(Math.E);
    expect(wheelZoom(RESTING, { x: 0, y: 0 }, 300)).toEqual(RESTING);
  });
});
