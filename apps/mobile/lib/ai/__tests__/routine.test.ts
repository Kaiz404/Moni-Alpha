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
};

describe('merchantKey', () => {
  it.each([
    ['GRAB* A-12XY', 'grab'],
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
      categoryId: null,
      merchant: null,
      routine: false,
    });
  });

  it('adds automatically once a same-merchant transaction was categorized', () => {
    expect(matchRoutine(candidate, [tx({})], active)).toEqual({
      categoryId: FOOD,
      merchant: 'FamilyMart KLCC',
      routine: true,
    });
  });

  it('goes back to review after the user corrects the latest category, prefilling the correction', () => {
    const history = [tx({ categoryId: TRANSPORT }), tx({}), tx({})];
    expect(matchRoutine(candidate, history, active)).toEqual({
      categoryId: TRANSPORT,
      merchant: 'FamilyMart KLCC',
      routine: false,
    });
  });

  it('becomes routine again once the last three agree', () => {
    const history = [
      tx({ categoryId: TRANSPORT }),
      tx({ categoryId: TRANSPORT }),
      tx({ categoryId: TRANSPORT }),
      tx({}),
    ];
    expect(matchRoutine(candidate, history, active).routine).toBe(true);
  });

  it('reviews an amount far above the usual spend', () => {
    const result = matchRoutine({ ...candidate, amountMinor: 1200 * 3 + 1 }, [tx({})], active);
    expect(result).toEqual({ categoryId: FOOD, merchant: 'FamilyMart KLCC', routine: false });
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
    expect(matchRoutine({ ...candidate, type: 'transfer' }, [tx({})], active).routine).toBe(false);
  });

  it('matches an unnamed payment by location only with a similar amount', () => {
    const here = { latitude: 3.1579, longitude: 101.7116 };
    const history = [
      tx({ merchant: null, locationLatitude: 3.1582, locationLongitude: 101.7118 }),
    ];
    const unnamed = { ...candidate, merchant: null, location: here };
    expect(matchRoutine({ ...unnamed, amountMinor: 1300 }, history, active).routine).toBe(true);
    expect(matchRoutine({ ...unnamed, amountMinor: 5000 }, history, active).categoryId).toBe(null);
    expect(matchRoutine({ ...unnamed, location: null }, history, active).categoryId).toBe(null);
  });
});
