export const WALLET_TYPE_OPTIONS = [
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'credit', label: 'Credit', icon: '💳' },
  { value: 'debit', label: 'Debit', icon: '💳' },
  { value: 'ewallet', label: 'E-Wallet', icon: '📱' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'other', label: 'Other', icon: '📦' },
] as const;

export type WalletKind = (typeof WALLET_TYPE_OPTIONS)[number]['value'];

export const WALLET_ACCENT_COLORS = [
  '#EF476F',
  '#FF6B6B',
  '#FFD166',
  '#06D6A0',
  '#118AB2',
  '#0066FF',
];
