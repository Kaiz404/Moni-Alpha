import { matchRoutine, merchantKey, type RoutineHistoryTransaction } from '../routine';

const FOOD = 'food';
const TRANSPORT = 'transport';
const active = new Set([FOOD, TRANSPORT]);

function tx(over: Partial<RoutineHistoryTransaction>): RoutineHistoryTransaction {
  return {
    type: 'expense',
    currency: 'MYR',
    amountMinor: 1200,
    categoryId: FOOD,
    merchant: 'FamilyMart KLCC',
    locationLatitude: null,
    locationLongitude: null,
    ...over,
  };
}

const candidate = {
  type: 'expense',
  currency: 'MYR',
  amountMinor: 1500,
  merchant: 'FAMILYMART KLCC #0231',
  location: null,
  sourceApp: null,
};

describe('merchantKey', () => {
  it.each([
    ['GRAB* A-12XY', 'grab'],
    ['GRAB*1234 KL', 'grab'],
    ['SQ *KOPI KOPI', 'sq kopi kopi'],
    ['Grab A-98QZ', 'grab'],
    ['FamilyMart KLCC #0231', 'familymart klcc'],
    ['  ', null],
    [null, null],
  ])('%s -> %s', (raw, key) => {
    expect(merchantKey(raw)).toBe(key);
  });
});

describe('matchRoutine', () => {
  it('sends the first transaction of its kind to review with nothing prefilled', () => {
    expect(matchRoutine(candidate, [], active)).toEqual({
      kind: 'proposal',
      categoryId: null,
      merchant: null,
    });
  });

  it('adds automatically once a same-merchant transaction was categorized', () => {
    expect(matchRoutine(candidate, [tx({})], active)).toEqual({
      kind: 'streak',
      categoryId: FOOD,
      merchant: 'FamilyMart KLCC',
    });
  });

  it('goes back to review after the user corrects the latest category, prefilling the correction', () => {
    const history = [tx({ categoryId: TRANSPORT }), tx({}), tx({})];
    expect(matchRoutine(candidate, history, active)).toEqual({
      kind: 'proposal',
      categoryId: TRANSPORT,
      merchant: 'FamilyMart KLCC',
    });
  });

  it('becomes routine again once the last three agree', () => {
    const history = [
      tx({ categoryId: TRANSPORT }),
      tx({ categoryId: TRANSPORT }),
      tx({ categoryId: TRANSPORT }),
      tx({}),
    ];
    expect(matchRoutine(candidate, history, active).kind).toBe('streak');
  });

  it('reviews an amount far above the usual spend', () => {
    const result = matchRoutine({ ...candidate, amountMinor: 1200 * 3 + 1 }, [tx({})], active);
    expect(result).toEqual({ kind: 'proposal', categoryId: FOOD, merchant: 'FamilyMart KLCC' });
  });

  it('never applies an archived category', () => {
    expect(matchRoutine(candidate, [tx({})], new Set([TRANSPORT])).categoryId).toBe(null);
  });

  it('ignores other currencies, types, transfers and uncategorized rows', () => {
    const history = [
      tx({ currency: 'SGD' }),
      tx({ type: 'income' }),
      tx({ categoryId: null }),
      tx({ analysisExcluded: true }),
      tx({ debtActivityId: 'debt-1' }),
    ];
    expect(matchRoutine(candidate, history, active).categoryId).toBe(null);
    expect(matchRoutine({ ...candidate, type: 'transfer' }, [tx({})], active).kind).toBe(
      'proposal',
    );
  });

  it('matches an unnamed payment by location only with a similar amount', () => {
    const here = { latitude: 3.1579, longitude: 101.7116 };
    const history = [tx({ merchant: null, locationLatitude: 3.1582, locationLongitude: 101.7118 })];
    const unnamed = { ...candidate, merchant: null, location: here };
    expect(matchRoutine({ ...unnamed, amountMinor: 1300 }, history, active).kind).toBe('streak');
    expect(matchRoutine({ ...unnamed, amountMinor: 5000 }, history, active).categoryId).toBe(null);
    expect(matchRoutine({ ...unnamed, location: null }, history, active).categoryId).toBe(null);
  });
});

describe('matchRoutine with auto-add rules', () => {
  const MAYBANK = 'com.maybank2u.life';
  const grabAlert = {
    type: 'expense',
    currency: 'MYR',
    amountMinor: 1200,
    merchant: 'GRAB*1234',
    location: null,
    sourceApp: MAYBANK,
  };
  const grabRule = {
    merchantKey: 'grab',
    sourceApp: MAYBANK,
    walletId: 'wallet-maybank',
    categoryId: TRANSPORT,
  };

  it("adds a notification a rule covers to the rule's wallet and category", () => {
    expect(matchRoutine(grabAlert, [], active, [grabRule])).toEqual({
      kind: 'rule',
      walletId: 'wallet-maybank',
      categoryId: TRANSPORT,
    });
  });

  it('sends the same notification to review when no rule and no history match', () => {
    expect(matchRoutine(grabAlert, [], active, [])).toEqual({
      kind: 'proposal',
      categoryId: null,
      merchant: null,
    });
  });

  it('ignores a rule from another app, for another merchant, or with an archived category', () => {
    const rules = [
      { ...grabRule, sourceApp: 'com.tngdigital.ewallet' },
      { ...grabRule, merchantKey: 'kedai abc' },
      { ...grabRule, categoryId: 'archived' },
    ];
    expect(matchRoutine(grabAlert, [], active, rules).kind).toBe('proposal');
    expect(matchRoutine({ ...grabAlert, sourceApp: null }, [], active, [grabRule]).kind).toBe(
      'proposal',
    );
  });
});
