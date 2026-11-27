'use client';

import {
  Select as Root,
  SelectContent,
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
  const chosen = options.find((option) => option.value === value);
  const shown = text ?? chosen?.label ?? placeholder;
  return (
    <Root<T>
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null && next !== value) onChange(next as T);
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
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
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
        ))}
      </SelectContent>
    </Root>
  );
}
