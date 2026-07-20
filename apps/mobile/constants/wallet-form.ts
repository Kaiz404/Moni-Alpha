import type { WalletType } from '@repo/types';

import type { IconSymbolName } from '@/components/ui/icon-symbol';

export const WALLET_TYPE_OPTIONS = [
  { value: 'bank', label: 'Bank', icon: 'account-balance' },
  { value: 'cash', label: 'Cash', icon: 'payments' },
  { value: 'credit', label: 'Credit', icon: 'credit-card' },
  { value: 'debit', label: 'Debit', icon: 'payment' },
  { value: 'ewallet', label: 'Digital wallet', icon: 'wallet' },
  { value: 'investment', label: 'Investment', icon: 'trending-up' },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: IconSymbolName;
}>;

export type WalletKind = (typeof WALLET_TYPE_OPTIONS)[number]['value'];

const DEFAULT_WALLET_ICON: IconSymbolName = 'account-balance-wallet';

const WALLET_TYPE_ICON_BY_VALUE = Object.fromEntries(
  WALLET_TYPE_OPTIONS.map((option) => [option.value, option.icon]),
) as Partial<Record<WalletType, IconSymbolName>>;

function isWalletType(value: string): value is WalletType {
  return value in WALLET_TYPE_ICON_BY_VALUE;
}

/** Stored wallet icons used to be emoji; treat non–icon-name values as legacy. */
function isMaterialIconName(value: string): value is IconSymbolName {
  return /^[a-z][a-z0-9-]*$/.test(value);
}

export function getWalletTypeIcon(type: WalletType): IconSymbolName {
  return WALLET_TYPE_ICON_BY_VALUE[type] ?? DEFAULT_WALLET_ICON;
}

export function resolveWalletIcon(
  icon: string | null | undefined,
  type?: string | null,
): IconSymbolName {
  if (icon && isMaterialIconName(icon)) {
    return icon;
  }
  if (type && isWalletType(type)) {
    return getWalletTypeIcon(type);
  }
  return DEFAULT_WALLET_ICON;
}

/** Per-wallet accent swatches (user-chosen; not brand theme tokens). */
export const WALLET_ACCENT_COLORS = [
  '#059669',
  '#0d9488',
  '#0284c7',
  '#7c3aed',
  '#db2777',
  '#d97706',
];
