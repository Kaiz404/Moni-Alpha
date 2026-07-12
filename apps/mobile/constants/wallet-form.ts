export const WALLET_TYPE_OPTIONS = [
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'credit', label: 'Credit', icon: '💳' },
  { value: 'debit', label: 'Debit', icon: '💳' },
  { value: 'ewallet', label: 'Digital wallet', icon: '📱' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'other', label: 'Other', icon: '📦' },
] as const;

export type WalletKind = (typeof WALLET_TYPE_OPTIONS)[number]['value'];

/** Per-wallet accent swatches (user-chosen; not brand theme tokens). */
export const WALLET_ACCENT_COLORS = [
  '#059669',
  '#0d9488',
  '#0284c7',
  '#7c3aed',
  '#db2777',
  '#d97706',
];
