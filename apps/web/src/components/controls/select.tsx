'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import type { Align, Side } from '@/lib/floating';
import { Floating } from './floating';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  lead?: ReactNode;
  /** Shown at the row's end, as an amount or a budget left. */
  side?: ReactNode;
};

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
  children?: ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);
  const shown = text ?? chosen?.label ?? placeholder;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel ?? `${label}: ${typeof shown === 'string' ? shown : (chosen?.label ?? placeholder)}`}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        data-invalid={invalid ? 'true' : undefined}
        data-empty={chosen ? undefined : true}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
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
      </button>
      {open && (
        <Floating
          anchor={anchor}
          role="listbox"
          label={label}
          matchWidth
          side={side}
          align={align}
          className={listClassName}
          onClose={() => setOpen(false)}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="popover-row"
              onClick={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
              }}
            >
              {option.lead}
              <span className="popover-row-text">{option.label}</span>
              {option.side}
              {option.value === value && (
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
        </Floating>
      )}
    </>
  );
}
