import type { MinorAmount } from '@repo/types';

import { calendarHeat } from '../calendar-heat';

const rm = (ringgit: number) => (ringgit * 100) as MinorAmount;

describe('calendarHeat', () => {
  it('buckets days against an even pace of RM58 the way V2P-InsightsCalendar colours them', () => {
    const days = [40, 80, 110, 200].map((spent, index) => ({
      day: index + 1,
      spentMinor: rm(spent),
      billDue: false,
    }));
    expect(calendarHeat(days, rm(58)).map((day) => day.bucket)).toEqual([
      'under',
      'x1_5',
      'x2',
      'over_x2',
    ]);
  });

  it('puts 90 and 120 in the next bucket up, because 1.5x and 2x of RM58 are RM87 and RM116', () => {
    const days = [58, 87, 90, 116, 120].map((spent, index) => ({
      day: index + 1,
      spentMinor: rm(spent),
      billDue: false,
    }));
    expect(calendarHeat(days, rm(58)).map((day) => day.bucket)).toEqual([
      'under',
      'x1_5',
      'x2',
      'x2',
      'over_x2',
    ]);
  });

  it('keeps future days uncoloured and their bill-due mark', () => {
    const [today, due] = calendarHeat(
      [
        { day: 14, spentMinor: rm(13.2), billDue: false },
        { day: 15, spentMinor: null, billDue: true },
      ],
      rm(58.06),
    );
    expect(today).toEqual({ day: 14, spentMinor: 1320, billDue: false, bucket: 'under' });
    expect(due).toEqual({ day: 15, spentMinor: null, billDue: true, bucket: 'future' });
  });

  it('leaves a month with nothing spent, or with no budget, plain', () => {
    const empty = [
      { day: 1, spentMinor: rm(0), billDue: false },
      { day: 2, spentMinor: null, billDue: false },
    ];
    expect(calendarHeat(empty, rm(58)).map((day) => day.bucket)).toEqual(['plain', 'future']);
    expect(
      calendarHeat([{ day: 1, spentMinor: rm(40), billDue: false }], null).map((d) => d.bucket),
    ).toEqual(['plain']);
  });
});
