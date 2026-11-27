/**
 * Moni's guess at a capture's category, from the user's own history first, then what the merchant,
 * the alert or the source app gives away, then the reader's own word for it. The guess never files
 * anything: a prefilled capture still goes to Review, and the picker only offers the rest.
 */
import { isFiled } from '../ledger';
import { merchantKey } from '../read-model/merchants';
import type { RoutineHistoryTransaction } from './routine';

/** What Moni knows about a capture when it guesses. */
export type CategoryClues = {
  type: string | null;
  merchant: string | null;
  /** The alert's title and body, or the words the user typed or said. */
  text: string | null;
  /** The Android package that posted the alert. */
  sourceApp: string | null;
  /** The reader's own word ("food"), which need not be one of the user's names. */
  categoryHint: string | null;
};

type CapturedClues = {
  type: string | null;
  merchant: string | null;
  description: string | null;
  sourceApp: string | null;
  sourceText: string | null;
  notificationTitle: string | null;
  notificationBody: string | null;
  categoryHint: string | null;
};

/** A capture's clues, from a proposal or one about to become one. */
export function captureClues(capture: CapturedClues): CategoryClues {
  const text = [capture.notificationTitle, capture.notificationBody, capture.sourceText, capture.description]
    .filter(Boolean)
    .join(' ');
  return {
    type: capture.type,
    merchant: capture.merchant,
    text: text || null,
    sourceApp: capture.sourceApp,
    categoryHint: capture.categoryHint,
  };
}

export type GuessableCategory = { id: string; name: string | null; type: string | null; isActive: boolean };

export type GuessHistory = Pick<
  RoutineHistoryTransaction,
  'type' | 'categoryId' | 'merchant' | 'analysisExcluded' | 'debtActivityId'
>;

export type CategoryGuess = {
  /** Sure enough to fill in. Null leaves the category empty. */
  prefill: string | null;
  /** Best first, at most `MAX_SUGGESTIONS`, for the picker to offer. */
  suggestions: readonly string[];
};

export const MAX_SUGGESTIONS = 3;

type Clue = { category: string; names: readonly string[]; apps?: readonly string[] };

/** Merchants and apps that name a category by themselves, matched as whole words. */
export const CATEGORY_CLUES: readonly Clue[] = [
  {
    category: 'Tolls',
    names: ['toll', 'tol', 'smarttag', 'plus malaysia', 'plus expressway', 'lekas', 'besraya', 'litrak', 'kesas', 'penang bridge'],
  },
  {
    category: 'Transit',
    names: ['rapidkl', 'rapid kl', 'rapid rail', 'rapid bus', 'rapid penang', 'prasarana', 'mrt', 'lrt', 'ktm', 'ktm komuter', 'ets', 'erl', 'klia ekspres', 'monorail', 'mybas'],
  },
  {
    category: 'Food & Dining',
    names: [
      'mcdonalds', 'mcd', 'kfc', 'starbucks', 'tealive', 'zus coffee', 'chagee', 'mixue', 'subway', 'pizza hut', 'dominos',
      'marrybrown', 'texas chicken', 'secret recipe', 'oldtown', 'nandos', 'sushi king', 'sukiya', 'burger king', 'kenny rogers',
      'familymart', 'family mart', '7 eleven', '7eleven', 'kk mart', 'kk super mart', '99 speedmart', 'mydin', 'lotuss', 'jaya grocer',
      'village grocer', 'econsave', 'giant', 'foodpanda', 'grabfood', 'shopeefood', 'restoran', 'restaurant', 'cafe', 'kopitiam',
      'mamak', 'bakery', 'nasi kandar',
    ],
    apps: ['com.global.foodpanda.android'],
  },
  {
    category: 'Transportation',
    names: ['petronas', 'shell', 'petron', 'caltex', 'bhpetrol', 'setel', 'parking', 'jomparking', 'flexiparking'],
    apps: ['com.setel.mobile'],
  },
  {
    category: 'Shopping',
    names: ['mr diy', 'mrdiy', 'shopee', 'lazada', 'uniqlo', 'ikea', 'daiso', 'eco shop', 'zalora', 'decathlon', 'popular bookstore'],
    apps: ['com.lazada.android'],
  },
  {
    category: 'Healthcare',
    names: ['farmasi', 'pharmacy', 'klinik', 'clinic', 'hospital', 'alpro', 'dental', 'caring pharmacy', 'big pharmacy'],
  },
  {
    category: 'Housing',
    names: ['tnb', 'tenaga nasional', 'air selangor', 'syabas', 'indah water', 'unifi', 'tm unifi', 'time fibre', 'celcomdigi', 'maxis', 'u mobile'],
    apps: ['com.tnb.mytnb'],
  },
  {
    category: 'Subscriptions',
    names: ['netflix', 'spotify', 'youtube premium', 'disney', 'icloud', 'apple com bill', 'chatgpt', 'openai', 'astro'],
  },
  {
    category: 'Entertainment',
    names: ['gsc', 'golden screen', 'tgv', 'mbo cinemas', 'steam'],
  },
  {
    category: 'Travel',
    names: ['airasia', 'malaysia airlines', 'batik air', 'firefly', 'agoda', 'booking com', 'airbnb'],
  },
  {
    category: 'Salary',
    names: ['salary', 'gaji', 'payroll'],
  },
];

/** The reader's loose words for a catalogue name it did not copy. */
const HINT_WORDS: Readonly<Record<string, string>> = {
  food: 'Food & Dining',
  dining: 'Food & Dining',
  groceries: 'Food & Dining',
  grocery: 'Food & Dining',
  restaurant: 'Food & Dining',
  transport: 'Transportation',
  fuel: 'Transportation',
  petrol: 'Transportation',
  utilities: 'Housing',
  bills: 'Housing',
  rent: 'Housing',
  health: 'Healthcare',
  medical: 'Healthcare',
  subscription: 'Subscriptions',
  gift: 'Gifts & Donations',
  donation: 'Gifts & Donations',
  fees: 'Fees & Charges',
};

function words(text: string | null | undefined): string {
  if (!text) return ' ';
  return ` ${text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const sameName = (category: GuessableCategory, name: string) =>
  category.name?.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase();

function clueCategory(clues: CategoryClues, choices: readonly GuessableCategory[]): string | null {
  const text = words([clues.merchant, clues.text].filter(Boolean).join(' '));
  for (const clue of CATEGORY_CLUES) {
    const named =
      clue.names.some((name) => text.includes(` ${name} `)) ||
      (!!clues.sourceApp && !!clue.apps?.includes(clues.sourceApp));
    const category = named ? choices.find((choice) => sameName(choice, clue.category)) : undefined;
    if (category) return category.id;
  }
  return null;
}

function hintCategory(hint: string | null, choices: readonly GuessableCategory[]): string | null {
  const word = hint?.trim().toLocaleLowerCase();
  if (!word) return null;
  const catalogue = HINT_WORDS[word];
  return (
    choices.find((choice) => sameName(choice, word))?.id ??
    (catalogue ? choices.find((choice) => sameName(choice, catalogue))?.id : undefined) ??
    choices.find((choice) => choice.name?.toLocaleLowerCase().includes(word))?.id ??
    null
  );
}

/** Categories by how often they were filed, most first. */
function byCount(rows: readonly GuessHistory[], active: ReadonlySet<string>): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryId && active.has(row.categoryId)) counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/**
 * @param history newest first. Only filed rows of the capture's type count.
 * @param categories every category; only active ones of the capture's type are guessed.
 */
export function guessCategory(
  clues: CategoryClues,
  history: readonly GuessHistory[],
  categories: readonly GuessableCategory[],
): CategoryGuess {
  const none: CategoryGuess = { prefill: null, suggestions: [] };
  if (clues.type !== 'expense' && clues.type !== 'income') return none;
  const choices = categories.filter((category) => category.isActive && category.type === clues.type);
  const active = new Set(choices.map((category) => category.id));
  const filed = history.filter((row) => row.type === clues.type && isFiled(row));

  const key = merchantKey(clues.merchant);
  const firstWord = key?.split(' ')[0];
  const sameMerchant = key ? filed.filter((row) => merchantKey(row.merchant) === key) : [];
  const nearMerchant =
    firstWord && firstWord.length >= 3
      ? filed.filter((row) => merchantKey(row.merchant)?.split(' ')[0] === firstWord)
      : [];
  const latest = sameMerchant.find((row) => row.categoryId && active.has(row.categoryId))?.categoryId ?? null;

  const sure = [latest, clueCategory(clues, choices), hintCategory(clues.categoryHint, choices)];
  const ranked = [...sure, ...byCount(sameMerchant, active), ...byCount(nearMerchant, active), ...byCount(filed, active)];
  const suggestions = [...new Set(ranked.filter((id): id is string => id !== null))].slice(0, MAX_SUGGESTIONS);
  return { prefill: sure.find((id) => id !== null) ?? null, suggestions };
}
