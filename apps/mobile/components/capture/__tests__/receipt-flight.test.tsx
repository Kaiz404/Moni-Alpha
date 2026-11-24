import { renderHook } from '@testing-library/react-native';

import { receiptFlies, useReceiptFlight, type WindowFrame } from '../receipt-flight';

let mockReduced = false;
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReduced,
}));

const viewfinder: WindowFrame = { x: 44, y: 220, width: 300, height: 390 };

describe('the scanned receipt flying into the check page', () => {
  beforeEach(() => {
    mockReduced = false;
  });

  it('flies from where Moni read it, hiding the header photo until it lands', () => {
    const { result } = renderHook(() => useReceiptFlight('file:///receipt.jpg', viewfinder));
    expect(result.current.flying).toBe(true);
    expect(result.current.photo.hidden).toBe(true);
  });

  it('skips the flight under Reduce Motion and shows the header photo at once', () => {
    mockReduced = true;
    const { result } = renderHook(() => useReceiptFlight('file:///receipt.jpg', viewfinder));
    expect(result.current.flying).toBe(false);
    expect(result.current.photo.hidden).toBe(false);
    expect(receiptFlies(viewfinder, true)).toBe(false);
  });

  it('skips it when the reading page never measured the receipt, or there is no receipt', () => {
    expect(receiptFlies(null, false)).toBe(false);
    const { result } = renderHook(() => useReceiptFlight(null, viewfinder));
    expect(result.current.photo.hidden).toBe(false);
  });
});
