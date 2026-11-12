import { tickGovernor } from '@/lib/haptics/tick-governor';

describe('tickGovernor', () => {
  it('ticks strong on landing, strong on a day with transactions, light on a quiet one', () => {
    const ticks = tickGovernor();
    expect(ticks.land(0)).toBe('strong');
    expect(ticks.offer(100, 'quiet')).toBe('light');
    expect(ticks.offer(200, 'data')).toBe('strong');
  });

  it('plays a 15-day glide over 200 ms as 4 ticks with the landing, not 16', () => {
    const ticks = tickGovernor();
    const played = [
      ticks.land(0),
      ...Array.from({ length: 15 }, (_, day) => ticks.offer((day + 1) * 13, 'quiet')),
    ].filter(Boolean);
    expect(played).toEqual(['strong', 'light', 'light', 'light']);
  });

  it('keeps a day with transactions that lands inside the gap, and plays it strong at the next slot', () => {
    const ticks = tickGovernor();
    ticks.land(0);
    expect(ticks.offer(20, 'data')).toBeNull();
    expect(ticks.offer(30, 'quiet')).toBeNull();
    expect(ticks.offer(50, 'quiet')).toBe('strong');
    expect(ticks.offer(100, 'quiet')).toBe('light');
  });

  it('starts each touch fresh', () => {
    const ticks = tickGovernor();
    ticks.land(0);
    ticks.offer(10, 'data');
    expect(ticks.land(20)).toBe('strong');
    expect(ticks.offer(70, 'quiet')).toBe('light');
  });
});
