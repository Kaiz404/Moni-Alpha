import {
  addDays,
  dayLabel,
  dayOfMonth,
  daysInMonth,
  firstDayOf,
  monthName,
  monthOf,
  monthsBetween,
  shiftMonth,
  weekday,
  type DayKey,
} from '@repo/core';

export type GridCell = {
  id: string;
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
};

/** One screen of the grid picker; `null` holds an empty slot, such as the days before the 1st. */
export type GridPage = { label: string; cells: readonly (GridCell | null)[] };

export type GridLayout = { columns: number; heads?: readonly string[]; pages: readonly GridPage[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function shortMonth(month: number): string {
  return MONTHS[month - 1] ?? '';
}

/** Jan to Dec on one page; ids are the month numbers 1 to 12. */
export function monthGrid(): GridLayout {
  return {
    columns: 4,
    pages: [
      {
        label: '',
        cells: MONTHS.map((label, index) => ({
          id: String(index + 1),
          label,
          accessibilityLabel: monthName(`2000-${String(index + 1).padStart(2, '0')}`),
          disabled: false,
        })),
      },
    ],
  };
}

/** `count` years up to `newest`, a decade a page, oldest page first. */
export function yearGrid(newest: number, count: number): GridLayout {
  const oldest = newest - count + 1;
  const pages: GridPage[] = [];
  for (let decade = oldest - (oldest % 10); decade <= newest; decade += 10) {
    const cells = Array.from({ length: 10 }, (_, index) => {
      const year = decade + index;
      if (year < oldest || year > newest) return null;
      return { id: String(year), label: String(year), accessibilityLabel: String(year), disabled: false };
    });
    pages.push({ label: `${decade}s`, cells });
  }
  return { columns: 5, pages };
}

/** A month a page, Sunday first, from `first`'s month to `last`'s; days outside them can't be picked. */
export function dayGrid(first: DayKey, last: DayKey, today: DayKey): GridLayout {
  const start = monthOf(first);
  const pages = Array.from({ length: monthsBetween(start, monthOf(last)) + 1 }, (_, offset) => {
    const month = shiftMonth(start, offset);
    const firstOfMonth = firstDayOf(month);
    const days = Array.from({ length: daysInMonth(month) }, (_, index): GridCell => {
      const day = addDays(firstOfMonth, index);
      return {
        id: day,
        label: String(dayOfMonth(day)),
        accessibilityLabel: dayLabel(day, today),
        disabled: day < first || day > last,
      };
    });
    return {
      label: `${monthName(month)} ${month.slice(0, 4)}`,
      cells: [...Array<null>(weekday(firstOfMonth)).fill(null), ...days],
    };
  });
  return { columns: 7, heads: WEEKDAY_INITIALS, pages };
}

/** The page holding `id`, else the page holding `fallback`, else the first. */
export function pageOf(layout: GridLayout, id: string | null, fallback?: string): number {
  for (const want of [id, fallback]) {
    const index = layout.pages.findIndex((page) => page.cells.some((cell) => cell?.id === want));
    if (want && index >= 0) return index;
  }
  return 0;
}
