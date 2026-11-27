'use client';

import {
  addDays,
  addMonths,
  dateLabel,
  dayOfMonth,
  monthName,
  monthOf,
  monthShort,
  shiftMonth,
  shortDate,
  yearsOfMonths,
  type DayKey,
  type MonthKey,
} from '@repo/core';
import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/icon';
import { Glyph } from '@/components/ledger/glyph';
import { WEEKDAY_INITIALS, monthWeeks } from '@/lib/month-grid';
import { Floating } from './floating';

const STEPS: Record<string, (day: DayKey) => DayKey> = {
  ArrowLeft: (day) => addDays(day, -1),
  ArrowRight: (day) => addDays(day, 1),
  ArrowUp: (day) => addDays(day, -7),
  ArrowDown: (day) => addDays(day, 7),
  PageUp: (day) => addMonths(day, -1, dayOfMonth(day)),
  PageDown: (day) => addMonths(day, 1, dayOfMonth(day)),
};

const SPAN_WORDS: Record<string, string> = {
  start: ', start of range',
  end: ', end of range',
  mid: ', in range',
};

function clampDay(day: DayKey, min?: DayKey, max?: DayKey): DayKey {
  if (min && day < min) return min;
  if (max && day > max) return max;
  return day;
}

/**
 * A month of days to pick from. `from` and `to` mark the chosen day or range; the arrow keys move
 * by day and week, Page Up and Page Down by month.
 */
export function MonthCalendar({
  from,
  to,
  today,
  min,
  max,
  onPick,
}: {
  from: DayKey | null;
  to: DayKey | null;
  today: DayKey;
  min?: DayKey;
  max?: DayKey;
  onPick: (day: DayKey) => void;
}) {
  const start = to ?? from ?? today;
  const [month, setMonth] = useState<MonthKey>(monthOf(start));
  const [focused, setFocused] = useState<DayKey>(start);
  const grid = useRef<HTMLDivElement>(null);
  const tabStop =
    monthOf(focused) === month ? focused : clampDay(`${month}-01`, min, max);
  const pickable = (day: DayKey) =>
    (!min || day >= min) && (!max || day <= max);

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = clampDay(step(focused), min, max);
    setFocused(next);
    setMonth(monthOf(next));
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)
        ?.focus(),
    );
  };
  const low = from && to ? (from <= to ? from : to) : null;
  const high = from && to ? (from <= to ? to : from) : null;
  const spanOf = (day: DayKey) => {
    if (!low || !high || day < low || day > high || low === high)
      return undefined;
    return (
      [day === low && 'start', day === high && 'end']
        .filter(Boolean)
        .join(' ') || 'mid'
    );
  };

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-step press"
          aria-label={`Previous month, ${monthName(shiftMonth(month, -1))}`}
          disabled={!!min && shiftMonth(month, -1) < monthOf(min)}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <Glyph
            name="chevron-left"
            size={20}
          />
        </button>
        <span
          className="calendar-title"
          aria-live="polite"
        >
          {monthName(month)} {month.slice(0, 4)}
        </span>
        <button
          type="button"
          className="calendar-step press"
          aria-label={`Next month, ${monthName(shiftMonth(month, 1))}`}
          disabled={!!max && shiftMonth(month, 1) > monthOf(max)}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <Icon
            name="chevron-right"
            size={20}
          />
        </button>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={`${monthName(month)} ${month.slice(0, 4)}`}
        className="calendar-grid"
        onKeyDown={keys}
      >
        <div role="row">
          {WEEKDAY_INITIALS.map((initial, at) => (
            <span
              key={at}
              role="columnheader"
              className="calendar-weekday"
            >
              {initial}
            </span>
          ))}
        </div>
        {monthWeeks(month).map((week) => (
          <div
            role="row"
            key={week.find(Boolean)}
          >
            {week.map((day, at) =>
              day && pickable(day) ? (
                <span
                  key={day}
                  role="gridcell"
                  className="calendar-day"
                  data-span={spanOf(day)}
                  aria-selected={day === from || day === to}
                >
                  <button
                    type="button"
                    data-day={day}
                    tabIndex={day === tabStop ? 0 : -1}
                    aria-label={`${dateLabel(day, today)}${SPAN_WORDS[spanOf(day) ?? ''] ?? ''}`}
                    data-focus-first={day === tabStop || undefined}
                    aria-current={day === today ? 'date' : undefined}
                    onFocus={() => setFocused(day)}
                    onClick={() => onPick(day)}
                  >
                    {Number(day.slice(8))}
                  </button>
                </span>
              ) : (
                <span
                  key={`blank-${at}`}
                  role="gridcell"
                  className="calendar-day"
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A field that shows a day as Moni writes it and opens a calendar to change it. */
export function DateField({
  label,
  value,
  today,
  onChange,
  className,
  placeholder = 'No date',
  min,
  max,
  disabled,
  lead = (
    <Glyph
      name="calendar-blank-outline"
      size={18}
    />
  ),
  onClear,
}: {
  label: string;
  value: DayKey | null;
  today: DayKey;
  onChange: (day: DayKey) => void;
  /** Offers No date, for a date that may be left out. */
  onClear?: () => void;
  className: string;
  placeholder?: string;
  min?: DayKey;
  max?: DayKey;
  disabled?: boolean;
  lead?: ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const text = value ? dateLabel(value, today) : placeholder;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`select-trigger ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${text}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {lead}
        <span className="select-value">{text}</span>
        <Icon
          name="chevron-down"
          size={18}
        />
      </button>
      {open && (
        <Floating
          anchor={anchor}
          role="dialog"
          label={label}
          className="date-pop"
          onClose={() => setOpen(false)}
        >
          <MonthCalendar
            from={value}
            to={value}
            today={today}
            min={min}
            max={max}
            onPick={(day) => {
              setOpen(false);
              if (day !== value) onChange(day);
            }}
          />
          {onClear && value && (
            <button
              type="button"
              className="popover-row date-clear"
              onClick={() => {
                setOpen(false);
                onClear();
              }}
            >
              {placeholder}
            </button>
          )}
        </Floating>
      )}
    </>
  );
}

/**
 * A chip that shows a month and opens a year of months a page, with arrows between years; months
 * outside `first` to `last` are empty slots. The phone's Choose month grid (#111).
 */
export function MonthField({
  label,
  value,
  first,
  last,
  onChange,
  className,
}: {
  label: string;
  value: MonthKey;
  first: MonthKey;
  last: MonthKey;
  onChange: (month: MonthKey) => void;
  className: string;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const text = `${monthName(value)} ${value.slice(0, 4)}`;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${text}`}
        onClick={() => setOpen(!open)}
      >
        <span className="select-value">{text}</span>
        <Icon
          name="chevron-down"
          size={18}
        />
      </button>
      {open && (
        <Floating
          anchor={anchor}
          role="listbox"
          label={label}
          className="date-pop"
          onClose={() => setOpen(false)}
        >
          <MonthGrid
            value={value}
            first={first}
            last={last}
            onPick={(month) => {
              setOpen(false);
              if (month !== value) onChange(month);
            }}
          />
        </Floating>
      )}
    </>
  );
}

function MonthGrid({
  value,
  first,
  last,
  onPick,
}: {
  value: MonthKey;
  first: MonthKey;
  last: MonthKey;
  onPick: (month: MonthKey) => void;
}) {
  const years = yearsOfMonths(first, last);
  const [at, setAt] = useState(() =>
    Math.max(0, years.findIndex((each) => each.year === value.slice(0, 4))),
  );
  const page = years[at] ?? years[0]!;
  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-step press"
          aria-label={`Previous year, ${Number(page.year) - 1}`}
          disabled={at === 0}
          onClick={() => setAt(at - 1)}
        >
          <Glyph
            name="chevron-left"
            size={20}
          />
        </button>
        <span
          className="calendar-title"
          aria-live="polite"
        >
          {page.year}
        </span>
        <button
          type="button"
          className="calendar-step press"
          aria-label={`Next year, ${Number(page.year) + 1}`}
          disabled={at === years.length - 1}
          onClick={() => setAt(at + 1)}
        >
          <Icon
            name="chevron-right"
            size={20}
          />
        </button>
      </div>
      <div className="month-grid">
        {page.months.map((month) =>
          month < first || month > last ? (
            <span key={month} />
          ) : (
            <button
              key={month}
              type="button"
              role="option"
              aria-selected={month === value}
              aria-label={`${monthName(month)} ${page.year}`}
              onClick={() => onPick(month)}
            >
              {monthShort(month)}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export type DayRange = { from: DayKey; to: DayKey };

/**
 * Presets as full-width rows, then a calendar where the first click sets From and the second sets
 * To. A preset applies at once; a custom range applies on its second click.
 */
export function RangePicker({
  presets,
  value,
  today,
  onPreset,
  onRange,
}: {
  presets: readonly {
    key: string;
    label: string;
    selected: boolean;
  }[];
  value: DayRange;
  today: DayKey;
  onPreset: (key: string) => void;
  onRange: (range: DayRange) => void;
}) {
  const [pending, setPending] = useState<DayKey | null>(null);
  return (
    <div className="range-body">
      <div
        role="listbox"
        aria-label="Presets"
        className="range-presets"
      >
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            role="option"
            aria-selected={preset.selected}
            className="popover-row"
            onClick={() => onPreset(preset.key)}
          >
            <span className="popover-row-text">{preset.label}</span>
            {preset.selected && (
              <span
                className="popover-tick"
                aria-hidden="true"
              >
                <Icon
                  name="check"
                  size={18}
                />
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="range-pick">
        <MonthCalendar
          from={pending ?? value.from}
          to={pending ?? value.to}
          today={today}
          onPick={(day) => {
            if (!pending) return setPending(day);
            setPending(null);
            onRange(
              day < pending
                ? { from: day, to: pending }
                : { from: pending, to: day },
            );
          }}
        />
        <div
          className="range-ends"
          aria-live="polite"
        >
          <span
            className="range-end"
            data-active={!pending || undefined}
          >
            From
            <b>{shortDate(pending ?? value.from, true)}</b>
          </span>
          <span
            className="range-end"
            data-active={pending ? true : undefined}
          >
            To
            <b>
              {pending ? 'Pick a day' : shortDate(value.to, true)}
            </b>
          </span>
        </div>
      </div>
    </div>
  );
}
