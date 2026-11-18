'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import type { IconName } from '@/lib/icons';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: IconName;
  hint?: ReactNode;
  invalid?: boolean;
};

export function TextField({ label, icon, hint, invalid, id, ...input }: FieldProps) {
  return (
    <div>
      <div className="label">
        <label htmlFor={id}>{label}</label>
        {hint}
      </div>
      <div className="field" data-invalid={invalid ? 'true' : undefined}>
        <Icon name={icon} size={20} />
        <input id={id} aria-invalid={invalid || undefined} {...input} />
      </div>
    </div>
  );
}

export function PasswordField({ label, hint, invalid, id, ...input }: Omit<FieldProps, 'icon' | 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="label">
        <label htmlFor={id}>{label}</label>
        {hint}
      </div>
      <div className="field" data-invalid={invalid ? 'true' : undefined}>
        <Icon name="lock-outline" size={20} />
        <input id={id} type={shown ? 'text' : 'password'} aria-invalid={invalid || undefined} {...input} />
        <button
          type="button"
          className="icon-btn"
          aria-label={shown ? 'Hide password' : 'Show password'}
          onClick={() => setShown(!shown)}
        >
          <Icon name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} />
        </button>
      </div>
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="field-error" role="alert" style={{ margin: '6px 0 0' }}>
      <Icon name="alert-circle-outline" size={18} />
      <span>{children}</span>
    </p>
  );
}
