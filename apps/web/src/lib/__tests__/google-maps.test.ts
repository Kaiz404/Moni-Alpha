import { describe, expect, it } from 'vitest';
import { staticFrame, staticMapUrl, staticStyle } from '../google-maps';

describe('staticStyle', () => {
  it('writes a rule in the Static Maps words, colours as 0x hex', () => {
    expect(staticStyle({ featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFDF8' }] })).toBe('feature:road|element:geometry.fill|color:0xFFFDF8');
    expect(staticStyle({ elementType: 'labels', stylers: [{ visibility: 'off' }] })).toBe('element:labels|visibility:off');
  });
});

describe('staticMapUrl', () => {
  it('asks for the centre, a whole zoom, the size at twice the pixels, and each style', () => {
    const url = new URL(staticMapUrl({ key: 'k', center: { lat: 3.139, lng: 101.6869 }, zoom: 13, width: 400, height: 140, styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }] }));
    expect([url.origin + url.pathname, url.searchParams.get('center'), url.searchParams.get('zoom'), url.searchParams.get('size'), url.searchParams.get('scale'), url.searchParams.getAll('style')]).toEqual([
      'https://maps.googleapis.com/maps/api/staticmap',
      '3.13900,101.68690',
      '13',
      '400x140',
      '2',
      ['feature:poi|visibility:off'],
    ]);
  });
});

describe('staticFrame', () => {
  it('centres the places at the largest whole zoom that keeps them inside the padding', () => {
    const points = [
      { lat: 3.1579, lng: 101.7123 },
      { lat: 3.1291, lng: 101.6713 },
    ];
    const frame = staticFrame(points, 400, 140, 24);
    const spots = points.map(frame.at).map(({ x, y }) => [Math.round(x), Math.round(y)]);
    expect(frame.zoom).toBe(12);
    expect(spots.every(([x, y]) => x! >= 24 && x! <= 376 && y! >= 24 && y! <= 116)).toBe(true);
    expect(spots).toEqual([
      [260, 28],
      [140, 112],
    ]);
  });

  it('keeps one place in the middle at the street zoom cap', () => {
    const frame = staticFrame([{ lat: 3.1579, lng: 101.7123 }], 400, 140, 24);
    expect([frame.zoom, frame.at({ lat: 3.1579, lng: 101.7123 })]).toEqual([16, { x: 200, y: 70 }]);
  });
});
