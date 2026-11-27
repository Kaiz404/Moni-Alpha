import { describe, expect, it } from 'vitest';

import { captureClues, guessCategory, type CategoryClues, type GuessHistory } from '../category-guess';

const categories = [
  { id: 'food', name: 'Food & Dining', type: 'expense', isActive: true },
  { id: 'transport', name: 'Transportation', type: 'expense', isActive: true },
  { id: 'shopping', name: 'Shopping', type: 'expense', isActive: true },
  { id: 'tolls', name: 'Tolls', type: 'expense', isActive: true },
  { id: 'transit', name: 'Transit', type: 'expense', isActive: true },
  { id: 'housing', name: 'Housing', type: 'expense', isActive: true },
  { id: 'subs', name: 'Subscriptions', type: 'expense', isActive: true },
  { id: 'old', name: 'Takaful', type: 'expense', isActive: false },
  { id: 'salary', name: 'Salary', type: 'income', isActive: true },
];

const clues = (over: Partial<CategoryClues>): CategoryClues => ({
  type: 'expense',
  merchant: null,
  text: null,
  sourceApp: null,
  categoryHint: null,
  ...over,
});

const filed = (merchant: string, categoryId: string, type = 'expense'): GuessHistory => ({
  type,
  merchant,
  categoryId,
  analysisExcluded: false,
  debtActivityId: null,
});

describe('guessCategory', () => {
  it.each([
    ['PLUS MALAYSIA BERHAD', 'Toll payment of RM5.40 at PLUS MALAYSIA BERHAD.', 'tolls'],
    [null, 'SmartTAG toll RM2.30 deducted.', 'tolls'],
    ['RAPID KL', 'Payment of RM3.50 to RAPID KL was successful.', 'transit'],
    ['KTM BERHAD', "You've spent RM6.00 at KTM BERHAD.", 'transit'],
    ['MR DIY PLUS', "You've spent RM12.00 at MR DIY PLUS.", 'shopping'],
    ['KFC', "You've spent RM25.00 at KFC.", 'food'],
    ["McDonald's Bangsar", 'Payment of RM18.90 to McDonalds Bangsar.', 'food'],
    ['PETRONAS JLN AMPANG', "MAYBANK: You've spent RM50.00 at PETRONAS JLN AMPANG.", 'transport'],
    ['TNB', "You've paid RM120.00 to TNB.", 'housing'],
    ['NETFLIX.COM', 'Card ending 1234 charged RM54.90 at NETFLIX.COM.', 'subs'],
  ])('prefills %s from what the merchant or alert gives away', (merchant, text, expected) => {
    expect(guessCategory(clues({ merchant, text }), [], categories)).toEqual({
      prefill: expected,
      suggestions: [expected],
    });
  });

  it('reads the app that sent the alert', () => {
    expect(guessCategory(clues({ sourceApp: 'com.global.foodpanda.android' }), [], categories).prefill).toBe('food');
  });

  it('turns the reader’s own word into one of the user’s categories', () => {
    expect(guessCategory(clues({ categoryHint: 'food' }), [], categories).prefill).toBe('food');
    expect(guessCategory(clues({ categoryHint: 'groceries' }), [], categories).prefill).toBe('food');
    expect(guessCategory(clues({ categoryHint: 'transport' }), [], categories).prefill).toBe('transport');
    expect(guessCategory(clues({ categoryHint: 'Shopping' }), [], categories).prefill).toBe('shopping');
  });

  it('lets the user’s own filing beat what the merchant suggests', () => {
    const history = [filed('KFC', 'shopping')];
    expect(guessCategory(clues({ merchant: 'KFC' }), history, categories)).toEqual({
      prefill: 'shopping',
      suggestions: ['shopping', 'food'],
    });
  });

  it('leaves an unknown shop empty and suggests what the user files most', () => {
    const history = [
      filed('Sushi Tei', 'food'),
      filed('Kedai Ah Seng', 'shopping'),
      filed('Nasi Lemak Wanjo', 'food'),
      filed('Grab', 'transport'),
      filed('Kedai Runcit', 'housing'),
      filed('Nasi Ayam', 'food'),
      filed('Grab', 'transport'),
    ];
    expect(guessCategory(clues({ merchant: 'Metro Mart' }), history, categories)).toEqual({
      prefill: null,
      suggestions: ['food', 'transport', 'shopping'],
    });
  });

  it('suggests what shops with the same first word were filed under first', () => {
    const history = [filed('Kedai Runcit', 'housing'), filed('Grab', 'transport'), filed('Grab', 'transport')];
    expect(guessCategory(clues({ merchant: 'Kedai Kopi' }), history, categories).suggestions).toEqual([
      'housing',
      'transport',
    ]);
  });

  it('never guesses a deleted category, the other type or a transfer', () => {
    expect(guessCategory(clues({ merchant: 'Etiqa', categoryHint: 'Takaful' }), [filed('Etiqa', 'old')], categories)).toEqual({
      prefill: null,
      suggestions: [],
    });
    expect(guessCategory(clues({ type: 'income', merchant: 'KFC' }), [], categories).prefill).toBeNull();
    expect(guessCategory(clues({ type: 'transfer', merchant: 'KFC' }), [filed('KFC', 'food')], categories)).toEqual({
      prefill: null,
      suggestions: [],
    });
  });

  it('files salary under the user’s income category', () => {
    expect(
      guessCategory(clues({ type: 'income', text: 'Salary credited RM4,200.00 from ACME SDN BHD' }), [], categories).prefill,
    ).toBe('salary');
  });

  it('uses the category the user named themselves', () => {
    expect(guessCategory(clues({ merchant: 'TOLL' }), [], [{ id: 'mine', name: 'tolls', type: 'expense', isActive: true }]).prefill).toBe(
      'mine',
    );
  });
});

describe('captureClues', () => {
  it('reads the alert and the typed words together', () => {
    expect(
      captureClues({
        type: 'expense',
        merchant: 'KFC',
        description: 'Dinner',
        sourceApp: 'com.maybank2u.life',
        sourceText: null,
        notificationTitle: 'MAE',
        notificationBody: "You've spent RM25.00 at KFC.",
        categoryHint: 'food',
      }),
    ).toEqual({
      type: 'expense',
      merchant: 'KFC',
      text: "MAE You've spent RM25.00 at KFC. Dinner",
      sourceApp: 'com.maybank2u.life',
      categoryHint: 'food',
    });
  });
});
