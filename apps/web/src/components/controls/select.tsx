'use client';

import {
  Select as Root,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
} from '@ui-sdk/react/select';
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react';
import { Icon } from '@/components/icon';
import type { Align, Side } from '@/lib/floating';
import './controls.css';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  lead?: ReactNode;
  /** Shown at the row's end, as an amount or a budget left. */
  side?: ReactNode;
};

/** A pick a screen offers beside its options, as New category: it runs instead of choosing. */
export type SelectAction = { label: string; lead: ReactNode; run: () => void };

/** Option values in the list itself: a suggested option repeats its value, and the action is none. */
const SUGGESTED = 'suggested:';
const ACTION = 'action:';

/** A letter on the closed trigger stays a screen key (J, K, E), as on the button this was, and never picks an option. */
function letter(event: KeyboardEvent) {
  return event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/**
 * Moni's dropdown: the whole trigger (chevron included) opens a listbox of full-width rows, the chosen
 * one ticked. The trigger takes the caller's shape through `className`; `children` replaces its
 * contents when a screen draws more than the chosen option.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  placeholder = label,
  lead,
  disabled,
  side,
  align,
  listClassName,
  triggerLabel,
  text,
  invalid,
  suggested,
  action,
  children,
}: {
  label: string;
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  className: string;
  placeholder?: string;
  /** The trigger's lead when the chosen option has none. */
  lead?: ReactNode;
  disabled?: boolean;
  side?: Side;
  align?: Align;
  listClassName?: string;
  /** The trigger's accessible name, when its text alone would not say what it picks. */
  triggerLabel?: string;
  /** The trigger's words when they say more than the chosen option's label; a node needs a `triggerLabel`. */
  text?: ReactNode;
  invalid?: boolean;
  /**
   * Offered first, best first, under Suggested while nothing is chosen (the phone's category sheet); the full
   * list follows under `allLabel`.
   */
  suggested?: { values: readonly T[]; allLabel: string };
  action?: SelectAction;
  children?: ReactNode;
}) {
  const chosen = options.find((option) => option.value === value);
  const shown = text ?? chosen?.label ?? placeholder;
  const first = value === null && suggested ? suggested.values.flatMap((each) => options.find((option) => option.value === each) ?? []) : [];
  const row = (option: SelectOption<T>, listed: string) => (
    <SelectItem
      key={listed}
      value={listed}
      label={option.label}
      className="popover-row"
    >
      {option.lead}
      <span className="popover-row-text">{option.label}</span>
      {option.side}
      <SelectItemIndicator className="popover-tick">
        <Icon
          name="check"
          size={18}
        />
      </SelectItemIndicator>
    </SelectItem>
  );
  const rows = options.map((option) => row(option, option.value));
  return (
    <Root<string>
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === null) return;
        if (next.startsWith(ACTION)) return action?.run();
        const picked = (next.startsWith(SUGGESTED) ? next.slice(SUGGESTED.length) : next) as T;
        if (picked !== value) onChange(picked);
      }}
    >
      <SelectTrigger
        className={`select-trigger ${className}`}
        aria-label={triggerLabel ?? `${label}: ${typeof shown === 'string' ? shown : (chosen?.label ?? placeholder)}`}
        aria-invalid={invalid || undefined}
        data-invalid={invalid ? 'true' : undefined}
        data-empty={chosen ? undefined : true}
        render={({ onKeyDown, ...props }: ComponentPropsWithRef<'button'>, state) => (
          <button
            {...props}
            type="button"
            onKeyDown={(event) => {
              if (!state.open && letter(event)) return;
              onKeyDown?.(event);
              // The list kept focus on its trigger and took Esc to close; the pane or form around it must not close too.
              if (event.key === 'Escape' && event.defaultPrevented) event.stopPropagation();
            }}
          />
        )}
      >
        {children ?? (
          <>
            {chosen?.lead ?? lead}
            <span className="select-value">{shown}</span>
            <Icon
              name="chevron-down"
              size={18}
            />
          </>
        )}
      </SelectTrigger>
      <SelectContent
        aria-label={label}
        side={side}
        align={align ?? 'start'}
        sideOffset={6}
        collisionPadding={8}
        className={`popover popover-select${listClassName ? ` ${listClassName}` : ''}`}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {first.length > 0 && suggested ? (
          <>
            <SelectGroup className="popover-group">
              <SelectGroupLabel className="caps popover-group-label">Suggested</SelectGroupLabel>
              {first.map((option) => row(option, `${SUGGESTED}${option.value}`))}
            </SelectGroup>
            <SelectGroup className="popover-group">
              <SelectGroupLabel className="caps popover-group-label">{suggested.allLabel}</SelectGroupLabel>
              {rows}
            </SelectGroup>
          </>
        ) : (
          rows
        )}
        {action && (
          <SelectItem
            value={`${ACTION}${action.label}`}
            label={action.label}
            className="popover-row popover-action"
          >
            {action.lead}
            <span className="popover-row-text">{action.label}</span>
          </SelectItem>
        )}
      </SelectContent>
    </Root>
  );
}
