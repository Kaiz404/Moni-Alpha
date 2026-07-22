export type CurrencyOption = {
  code: string;
  name: string;
};

/** Curated ISO 4217 codes for wallet selection — popular codes first, then alphabetical. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'OMR', name: 'Omani Rial' },
  { code: 'BHD', name: 'Bahraini Dinar' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'ARS', name: 'Argentine Peso' },
];

const CURRENCY_BY_CODE = new Map(CURRENCY_OPTIONS.map((option) => [option.code, option]));

export function resolveCurrencyOption(code: string): CurrencyOption {
  const normalized = code.trim().toUpperCase();
  return (
    CURRENCY_BY_CODE.get(normalized) ?? {
      code: normalized,
      name: normalized,
    }
  );
}

export function filterCurrencyOptions(query: string, selectedCode?: string): CurrencyOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  const selected = selectedCode?.trim().toUpperCase();
  const base =
    selected && !CURRENCY_BY_CODE.has(selected)
      ? [resolveCurrencyOption(selected), ...CURRENCY_OPTIONS]
      : CURRENCY_OPTIONS;

  if (!normalizedQuery) return base;

  return base.filter(
    (option) =>
      option.code.toLowerCase().includes(normalizedQuery) ||
      option.name.toLowerCase().includes(normalizedQuery),
  );
}
