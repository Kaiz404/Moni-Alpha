import { createHash } from 'node:crypto';

// The canvas sample (~/.local/share/moni-canvas/v2-r6/sample-data.json) as of Wed 14 Oct 2026,
// trimmed to what the database stores. Every date shifts so that SAMPLE_TODAY lands on the
// seed day, so a device screenshot shows the names and relative days a board render shows.
export const SAMPLE_TODAY = '2026-10-14';
export const TIMEZONE = 'Asia/Kuala_Lumpur';
const UTC_OFFSET = '+08:00';
export const SHELL_PACKAGE = 'com.android.shell';
export const PROFILES = ['empty', 'full'];

const WALLETS = [
  { key: 'maybank', name: 'Maybank Savings', type: 'bank', currency: 'MYR', balance: 2281.8, style: 'citrus-pop', color: '#E8CF50', notification: { package: SHELL_PACKAGE, label: 'Maybank' } },
  { key: 'tng', name: "Touch 'n Go eWallet", type: 'ewallet', currency: 'MYR', balance: 86.4, style: 'violet-dusk', color: '#B39AE8', notification: { package: 'my.com.tngdigital.ewallet', label: "Touch 'n Go" } },
  { key: 'cash', name: 'Cash', type: 'cash', currency: 'MYR', balance: 63.6, style: 'emerald-grain', color: '#8ECF9D' },
  { key: 'wise', name: 'Wise USD', type: 'bank', currency: 'USD', balance: 120, style: 'ocean-deep', color: '#72CEC4' },
];
const WALLET_ICONS = { bank: 'bank', cash: 'cash', ewallet: 'wallet' };

// Sample category ids to the names the database seeds. Groceries has no system row, so the
// seed creates it as the user's own category.
const CATEGORY_NAMES = {
  food: 'Food & Dining',
  transport: 'Transportation',
  groceries: 'Groceries',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  subscriptions: 'Subscriptions',
  housing: 'Housing',
  health: 'Healthcare',
  gifts: 'Gifts & Donations',
  salary: 'Salary',
  freelance: 'Freelance',
};
export const CUSTOM_CATEGORIES = [{ key: 'groceries', name: 'Groceries', type: 'expense', icon: 'shopping', color: '#BEDB8D' }];
const BUDGETS = { food: 450, transport: 120, groceries: 350, shopping: 200, entertainment: 100, subscriptions: 80 };
const MONTHLY_BUDGET = 1800;

// date, time, merchant, alert merchant (what the bank alert printed), category, wallet, type,
// amount, place, source; transfers name their destination wallet as `to`.
const TRANSACTIONS = [
  ['2026-10-01', '09:00', 'Salary', null, 'salary', 'maybank', 'income', 4200, null, 'notification'],
  ['2026-10-01', '13:10', 'Mamak Ali', null, 'food', 'cash', 'expense', 12.5, 'bangsar', 'manual'],
  ['2026-10-02', '08:20', 'Starbucks', 'STARBUCKS', 'food', 'tng', 'expense', 18.9, 'klcc', 'notification'],
  ['2026-10-02', '18:40', 'Shell', 'SHELL', 'transport', 'maybank', 'expense', 60, 'ttdi', 'notification'],
  ['2026-10-03', '12:55', 'GRAB*FOOD', 'GRAB*FOOD', 'food', 'maybank', 'expense', 32.8, 'bangsarSouth', 'notification'],
  ['2026-10-03', '20:05', 'TNB electricity', 'PAYNET*8821 KUL', 'housing', 'maybank', 'expense', 96.5, null, 'notification'],
  ['2026-10-04', '11:30', 'Jaya Grocer', null, 'groceries', 'maybank', 'expense', 112.35, 'bangsar', 'camera'],
  ['2026-10-04', '19:15', 'Nasi Kandar Pelita', null, 'food', 'cash', 'expense', 15, 'klcc', 'manual'],
  ['2026-10-05', '07:50', 'iCloud+', 'ICLOUD+', 'subscriptions', 'maybank', 'expense', 3.9, null, 'notification'],
  ['2026-10-05', '09:10', 'Grab', 'GRAB*A-3KX2', 'transport', 'tng', 'expense', 18.5, 'klSentral', 'notification'],
  ['2026-10-05', '20:30', 'Sushi King', 'SUSHI KING', 'food', 'maybank', 'expense', 48.6, 'midValley', 'notification'],
  ['2026-10-06', '10:00', 'Cash withdrawal', null, null, 'maybank', 'transfer', 100, 'bangsar', 'notification', { to: 'cash' }],
  ['2026-10-06', '15:20', 'Uniqlo', null, 'shopping', 'maybank', 'expense', 129.9, 'midValley', 'camera'],
  ['2026-10-06', '16:45', 'Kopitiam', null, 'food', 'cash', 'expense', 9.8, 'ss2', 'manual'],
  ['2026-10-07', '07:40', 'YouTube Premium', 'YOUTUBE PREMIUM', 'subscriptions', 'maybank', 'expense', 17.9, null, 'notification'],
  ['2026-10-07', '12:30', 'GRAB*FOOD', 'GRAB*FOOD', 'food', 'maybank', 'expense', 27.4, 'bangsarSouth', 'notification'],
  ['2026-10-07', '18:10', 'Flower Chimp', null, 'gifts', 'maybank', 'expense', 45, null, 'moni'],
  ['2026-10-08', '10:15', 'Lotus\'s', 'MBB CT 0441 PJ', 'groceries', 'maybank', 'expense', 64.2, 'ss2', 'notification'],
  ['2026-10-08', '14:00', 'Parking KLCC', 'PARKING KLCC', 'transport', 'tng', 'expense', 8, 'klcc', 'notification'],
  ['2026-10-09', '08:25', 'Starbucks', 'STARBUCKS', 'food', 'tng', 'expense', 18.9, 'bukitBintang', 'notification'],
  ['2026-10-09', '11:00', 'Freelance: logo design', null, 'freelance', 'maybank', 'income', 350, null, 'notification'],
  ['2026-10-09', '21:40', 'Grab', 'GRAB*A-3KX2', 'transport', 'tng', 'expense', 23.1, 'bukitBintang', 'notification'],
  ['2026-10-10', '13:20', 'Mamak Ali', null, 'food', 'cash', 'expense', 11, 'bangsar', 'manual'],
  ['2026-10-10', '15:30', 'Watsons', 'WATSONS', 'health', 'maybank', 'expense', 24.6, 'midValley', 'notification'],
  ['2026-10-10', '16:10', 'GSC Mid Valley', 'GSC MID VALLEY', 'entertainment', 'maybank', 'expense', 38, 'midValley', 'notification'],
  ['2026-10-10', '20:00', 'Dinner at Bangsar Shopping Centre', null, 'food', 'maybank', 'expense', 86, 'bangsar', 'camera'],
  ['2026-10-11', '10:40', 'Village Grocer', 'VILLAGE GROCER', 'groceries', 'maybank', 'expense', 58.75, 'bangsar', 'notification'],
  ['2026-10-11', '22:05', 'Shopee', 'IPAY88*SHOPEE', 'shopping', 'maybank', 'expense', 19.4, null, 'notification'],
  ['2026-10-12', '08:30', 'Kopitiam', null, 'food', 'cash', 'expense', 9.8, 'damansaraUtama', 'manual'],
  ['2026-10-12', '17:50', 'Shell', 'SHELL', 'transport', 'maybank', 'expense', 30.4, 'damansaraUtama', 'notification'],
  ['2026-10-13', '12:35', 'GRAB*FOOD', 'GRAB*FOOD', 'food', 'maybank', 'expense', 45.9, 'bangsarSouth', 'notification'],
  ['2026-10-13', '18:20', 'Guardian', 'GUARDIAN', 'health', 'tng', 'expense', 15.9, 'klSentral', 'notification'],
  ['2026-10-13', '19:00', "Touch 'n Go reload", null, null, 'maybank', 'transfer', 100, null, 'notification', { to: 'tng', auto: true }],
  ['2026-10-14', '08:05', 'Mamak Ali', null, 'food', 'cash', 'expense', 13.2, 'bangsar', 'manual'],
];

const PLACES = {
  bangsar: ['Bangsar', 3.13, 101.671],
  bangsarSouth: ['Home, Bangsar South', 3.111, 101.6655],
  klcc: ['KLCC', 3.1579, 101.7123],
  ttdi: ['TTDI', 3.1395, 101.629],
  klSentral: ['KL Sentral', 3.134, 101.6865],
  midValley: ['Mid Valley', 3.1176, 101.6772],
  ss2: ['SS2, Petaling Jaya', 3.1188, 101.6224],
  bukitBintang: ['Bukit Bintang', 3.1466, 101.7108],
  damansaraUtama: ['Damansara Utama', 3.136, 101.623],
};

// The bank prints a code; Moni shows the name the user gave it. GRAB*FOOD stays unnamed so
// the Merchant names page has one to name.
const MERCHANT_ALIASES = {
  'IPAY88*SHOPEE': 'Shopee',
  'MBB CT 0441 PJ': "Lotus's",
  'GRAB*A-3KX2': 'Grab',
  'PAYNET*8821 KUL': 'TNB electricity',
};
const UNNAMED_CODES = ['GRAB*FOOD'];

// Bills are confirmed recurring series. Each was paid on its day in the two months before the
// seed month, and in the seed month too once its day has passed.
const BILLS = [
  { key: 'netflix', name: 'Netflix', merchant: 'Netflix', category: 'subscriptions', amount: 54.9, due: '2026-10-15', wallet: 'maybank', kind: 'subscription', remind: true },
  { key: 'spotify', name: 'Spotify', merchant: 'Spotify', category: 'subscriptions', amount: 16.9, due: '2026-10-22', wallet: 'maybank', kind: 'subscription', remind: false },
  { key: 'unifi', name: 'Unifi fibre', merchant: 'Unifi fibre', category: 'housing', amount: 129, due: '2026-10-25', wallet: 'maybank', kind: 'bill', remind: true },
];
const SPOTIFY_RULE = { merchant: 'Spotify', wallet: 'maybank', category: 'subscriptions' };

const DEBTS = [
  { key: 'mei', person: 'Mei', direction: 'i_owe', amount: 40, due: '2026-10-20', note: 'Concert tickets', wallet: 'cash', lentOn: '2026-10-03', status: 'open' },
  { key: 'aiman', person: 'Aiman', direction: 'owed_to_me', amount: 150, due: '2026-10-30', note: 'Penang trip hotel share', wallet: 'maybank', lentOn: '2026-09-28', status: 'open' },
  { key: 'hana', person: 'Hana', direction: 'owed_to_me', amount: 25, due: null, note: 'Lunch', wallet: 'cash', lentOn: '2026-09-30', repaidOn: '2026-10-08', status: 'settled' },
];

// One pending capture of each source type, newest first, which is the Review deck's order.
// The chat capture has no wallet, so approving it asks for one.
const PROPOSALS = [
  { key: 'grabfood', source: 'notification', merchant: 'GRAB*FOOD', alert: 'GRAB*FOOD', amount: 23.4, category: 'food', wallet: 'maybank', date: '2026-10-14', time: '12:41', reason: 'You filed GRAB*FOOD under Food & Dining 14 times.', confidence: 0.94 },
  { key: 'jaya', source: 'notification', merchant: 'Jaya Grocer', alert: 'JAYA GROCER', amount: 86.4, category: 'groceries', wallet: 'maybank', date: '2026-10-14', time: '12:50', reason: 'You filed Jaya Grocer under Groceries on Sun 4 Oct.', confidence: 0.88 },
  { key: 'receipt', source: 'image', merchant: 'Restoran Nasi Kandar Ali', amount: 15.3, category: 'food', wallet: 'cash', date: '2026-10-14', time: '13:05', reason: 'TOTAL RM 15.30, paid in cash.', confidence: 0.92 },
  { key: 'parking', source: 'text', merchant: 'Parking KLCC', said: 'paid 6 ringgit parking at KLCC', amount: 6, category: 'transport', wallet: null, date: '2026-10-14', time: '13:30', reason: 'You said parking at KLCC.', confidence: 0.71 },
];

const DAY_MS = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (day) => Date.parse(`${day}T00:00:00Z`);

export function dayShift(today) {
  return Math.round((dayMs(today) - dayMs(SAMPLE_TODAY)) / DAY_MS);
}

export function shiftDate(sampleDay, today) {
  return isoDay(dayMs(sampleDay) + dayShift(today) * DAY_MS);
}

export function todayInTimezone(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const at = (day, time) => new Date(`${day}T${time}:00${UTC_OFFSET}`).toISOString();

/** Mirrors `merchantKey` in lib/ai/routine.ts, which keys aliases, rules, and bill series. */
export function merchantKey(merchant) {
  const text = (merchant ?? '').toLowerCase();
  const star = text.indexOf('*');
  const afterStar = star < 0 ? '' : (text.slice(star + 1).trim().split(/\s+/)[0] ?? '');
  const name = star > 0 && /\d/.test(afterStar) ? text.slice(0, star) : text.replace(/\*/g, ' ');
  const key = name
    .split(/\s+/)
    .filter((token) => !/\d/.test(token))
    .join(' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return key || null;
}

/** A stable UUID per user and fixture, so a reseed writes the same ids. */
export function fixtureId(userId, ...parts) {
  const hex = createHash('sha256').update([userId, ...parts].join(':')).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const money = (value) => Math.round(value * 100) / 100;

function monthDay(day, dayOfMonth) {
  const [year, month] = day.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(dayOfMonth, last)).padStart(2, '0')}`;
}

function monthsBefore(day, count) {
  const [year, month] = day.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 - count, 1));
  return isoDay(first.getTime());
}

export function buildProfile(profile, { userId, today, systemCategories }) {
  if (!PROFILES.includes(profile)) throw new Error(`unknown profile ${profile}, use ${PROFILES.join(' or ')}`);
  const base = { user_id: userId, deleted: false };
  const empty = {
    displayName: 'Kai',
    preferences: { currency: 'MYR', theme: 'light', notifications_enabled: true, finance_timezone: TIMEZONE },
    rows: {},
  };
  if (profile === 'empty') return empty;

  const id = (...parts) => fixtureId(userId, ...parts);
  const shift = (day) => shiftDate(day, today);
  const walletId = (key) => (key ? id('wallet', key) : null);
  const categories = CUSTOM_CATEGORIES.map((c, index) => ({
    ...base,
    id: id('category', c.key),
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    is_active: true,
    display_order: 100 + index,
  }));
  const categoryId = (key) => {
    if (!key) return null;
    const custom = categories.find((c) => c.name === CATEGORY_NAMES[key]);
    const found = custom?.id ?? systemCategories[CATEGORY_NAMES[key]];
    if (!found) throw new Error(`no category named ${CATEGORY_NAMES[key]}`);
    return found;
  };

  const transaction = (key, fields) => ({
    ...base,
    id: id('transaction', key),
    category_id: null,
    transfer_to_wallet_id: null,
    linked_transaction_id: null,
    description: null,
    notes: null,
    location_latitude: null,
    location_longitude: null,
    location_name: null,
    receipt_image_url: null,
    analysis_excluded: false,
    debt_activity_id: null,
    ...fields,
  });

  const transactions = TRANSACTIONS.map(([day, time, merchant, alert, category, wallet, type, amount, place, source, extra = {}], index) => {
    const [locationName, lat, lng] = place ? PLACES[place] : [null, null, null];
    const coded = alert && (alert in MERCHANT_ALIASES || UNNAMED_CODES.includes(alert));
    return transaction(`sample-${index + 1}`, {
      wallet_id: walletId(wallet),
      transfer_to_wallet_id: walletId(extra.to),
      amount,
      currency: 'MYR',
      type,
      category_id: categoryId(category),
      merchant: coded ? alert : merchant,
      description: type === 'transfer' ? merchant : null,
      transaction_date: at(shift(day), time),
      location_latitude: lat,
      location_longitude: lng,
      location_name: locationName,
      metadata: extra.auto ? { source, ai_suggested: true } : { source },
    });
  });

  const seedMonth = shift(SAMPLE_TODAY);
  for (const bill of BILLS) {
    const dueDay = Number(shift(bill.due).slice(8));
    const months = [2, 1, 0].map((back) => monthDay(monthsBefore(seedMonth, back), dueDay));
    for (const paidOn of months.filter((day) => day < today)) {
      transactions.push(
        transaction(`bill-${bill.key}-${paidOn.slice(0, 7)}`, {
          wallet_id: walletId(bill.wallet),
          amount: bill.amount,
          currency: 'MYR',
          type: 'expense',
          category_id: categoryId(bill.category),
          merchant: bill.merchant,
          transaction_date: at(paidOn, '07:30'),
          metadata: { source: 'notification' },
        }),
      );
    }
  }

  const debts = [];
  const debtActivities = [];
  for (const debt of DEBTS) {
    const debtId = id('debt', debt.key);
    debts.push({
      ...base,
      id: debtId,
      counterparty_name: debt.person,
      direction: debt.direction,
      currency: 'MYR',
      due_date: debt.due ? shift(debt.due) : null,
      note: debt.note,
      status: debt.status,
    });
    const events = [['principal', debt.lentOn], ...(debt.repaidOn ? [['repayment', debt.repaidOn]] : [])];
    for (const [kind, day] of events) {
      const activityId = id('debt-activity', debt.key, kind);
      const cash = transaction(`debt-${debt.key}-${kind}`, {});
      const outgoing = (debt.direction === 'owed_to_me') === (kind === 'principal');
      const description =
        kind === 'principal'
          ? outgoing
            ? `Lent to ${debt.person}`
            : `Borrowed from ${debt.person}`
          : outgoing
            ? `Repayment to ${debt.person}`
            : `Repayment from ${debt.person}`;
      const when = at(shift(day), '12:00');
      debtActivities.push({
        ...base,
        id: activityId,
        debt_id: debtId,
        kind,
        amount: debt.amount,
        activity_date: when,
        wallet_id: walletId(debt.wallet),
        cash_transaction_id: cash.id,
        note: debt.note,
      });
      transactions.push({
        ...cash,
        wallet_id: walletId(debt.wallet),
        amount: debt.amount,
        currency: 'MYR',
        type: outgoing ? 'expense' : 'income',
        description,
        merchant: null,
        notes: debt.note,
        transaction_date: when,
        analysis_excluded: true,
        debt_activity_id: activityId,
        metadata: { debt_activity_id: activityId },
      });
    }
  }

  const delta = (walletKey) =>
    transactions.reduce((sum, t) => {
      const wallet = walletId(walletKey);
      if (t.type === 'income' && t.wallet_id === wallet) return sum + t.amount;
      if (t.type === 'expense' && t.wallet_id === wallet) return sum - t.amount;
      if (t.type === 'transfer' && t.wallet_id === wallet) return sum - t.amount;
      if (t.type === 'transfer' && t.transfer_to_wallet_id === wallet) return sum + t.amount;
      return sum;
    }, 0);
  const now = new Date().toISOString();
  const wallets = WALLETS.map((w, index) => ({
    ...base,
    id: walletId(w.key),
    name: w.name,
    type: w.type,
    currency: w.currency,
    initial_balance: money(w.balance - delta(w.key)),
    color: w.color,
    icon: WALLET_ICONS[w.type],
    card_style_id: w.style,
    is_active: true,
    display_order: index,
    notification_package: w.notification?.package ?? null,
    notification_app_label: w.notification?.label ?? null,
    notification_account_hint: null,
    balance_confirmed_at: now,
    record_location: true,
  }));

  const budgets = Object.entries(BUDGETS).map(([key, amount]) => ({
    ...base,
    id: id('budget', key),
    category_id: categoryId(key),
    amount,
    period: 'monthly',
    currency: 'MYR',
  }));

  const bills = BILLS.map((bill) => ({
    ...base,
    id: id('bill', bill.key),
    series_key: `MYR|expense|${merchantKey(bill.merchant)}`,
    status: 'confirmed',
    kind: bill.kind,
    expected_amount: bill.amount,
    expected_day: Number(shift(bill.due).slice(8)),
    currency: 'MYR',
    remind: bill.remind,
    name: bill.name,
    wallet_id: walletId(bill.wallet),
    category_id: categoryId(bill.category),
    skip_period: null,
    due_once: null,
  }));

  const rules = [
    {
      ...base,
      id: id('rule', 'spotify'),
      merchant_key: merchantKey(SPOTIFY_RULE.merchant),
      source_app: SHELL_PACKAGE,
      wallet_id: walletId(SPOTIFY_RULE.wallet),
      category_id: categoryId(SPOTIFY_RULE.category),
    },
  ];

  const aliases = Object.entries(MERCHANT_ALIASES).map(([code, name]) => ({
    ...base,
    id: id('alias', code),
    raw_key: merchantKey(code),
    display_name: name,
  }));

  const proposals = PROPOSALS.map((p, index) => {
    const day = shift(p.date);
    const received = at(day, p.time);
    const alertText = p.alert
      ? `MAYBANK: You've spent RM${p.amount.toFixed(2)} at ${p.alert} on ${day.slice(8)}/${day.slice(5, 7)} ${p.time}.`
      : null;
    return {
      ...base,
      id: id('proposal', p.key),
      source_type: p.source,
      source_app: p.source === 'notification' ? SHELL_PACKAGE : null,
      notification_title: p.source === 'notification' ? 'Maybank' : null,
      notification_body: alertText,
      notification_received_at: p.source === 'notification' ? received : null,
      source_text: p.said ?? alertText,
      source_image_uri: null,
      ai_reasoning: p.reason,
      ai_confidence: p.confidence,
      wallet_id: walletId(p.wallet),
      wallet_hint: null,
      amount: p.amount,
      currency: 'MYR',
      type: 'expense',
      description: null,
      merchant: p.merchant,
      category_id: categoryId(p.category),
      category_hint: CATEGORY_NAMES[p.category],
      transaction_date: received,
      status: 'pending',
      snoozed_until: null,
      created_at: new Date(Date.parse(now) - index * 60_000).toISOString(),
    };
  });

  return {
    displayName: 'Kai',
    preferences: { ...empty.preferences, monthly_budget: MONTHLY_BUDGET, default_wallet_id: walletId('maybank') },
    rows: {
      categories,
      wallets,
      transactions,
      debts,
      debt_activities: debtActivities,
      category_budgets: budgets,
      recurring_overrides: bills,
      auto_add_rules: rules,
      merchant_aliases: aliases,
      proposed_transactions: proposals,
    },
  };
}

export const DELETE_ORDER = [
  'transaction_tags',
  'auto_add_rules',
  'merchant_aliases',
  'recurring_overrides',
  'category_budgets',
  'proposed_transactions',
  'debt_activities',
  'transactions',
  'debts',
  'tags',
  'wallets',
  'categories',
];

export const INSERT_ORDER = [
  'categories',
  'wallets',
  'transactions',
  'debts',
  'debt_activities',
  'category_budgets',
  'recurring_overrides',
  'auto_add_rules',
  'merchant_aliases',
  'proposed_transactions',
];
