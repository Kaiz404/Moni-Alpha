import { createGoogleSearch, type GoogleSearch } from '@/lib/places/place-search';
import type { AutocompleteRequest, AutocompleteResult, PlacesClient } from '@/lib/places/types';

const BIAS = { latitude: 3.13, longitude: 101.671 };

function prediction(placeId: string, primaryText: string) {
  return { placeId, primaryText, secondaryText: null, distanceMeters: null };
}

/** A client whose answers the test releases, in any order. */
function heldClient() {
  const asked: { req: AutocompleteRequest; answer: (result: AutocompleteResult) => void }[] = [];
  const client: PlacesClient = {
    autocomplete: (req) => new Promise((resolve) => asked.push({ req, answer: resolve })),
    details: async () => ({ status: 'not_found' }),
  };
  return { client, asked };
}

function setup() {
  const { client, asked } = heldClient();
  const seen: GoogleSearch[] = [];
  const search = createGoogleSearch({
    client,
    sessionToken: 'session-1',
    onChange: (next) => seen.push(next),
  });
  return { search, asked, seen, last: () => seen[seen.length - 1] };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Google search as the user types', () => {
  it('waits for 3 characters and a 300 ms pause, then asks once', async () => {
    const { search, asked, last } = setup();
    search.search('vi', BIAS);
    expect(last()).toEqual({ status: 'idle' });
    search.search('vil', BIAS);
    search.search('vill', BIAS);
    jest.advanceTimersByTime(299);
    expect(asked).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(asked.map((call) => call.req)).toEqual([
      { input: 'vill', sessionToken: 'session-1', bias: BIAS },
    ]);
    expect(last()).toEqual({ status: 'loading', query: 'vill' });
    asked[0].answer({ status: 'ok', predictions: [prediction('p1', 'Village Park')] });
    await Promise.resolve();
    expect(last()).toEqual({
      status: 'done',
      query: 'vill',
      predictions: [prediction('p1', 'Village Park')],
    });
  });

  it('drops an answer the user has typed past', async () => {
    const { search, asked, last } = setup();
    search.search('vill', BIAS);
    jest.advanceTimersByTime(300);
    search.search('village', BIAS);
    jest.advanceTimersByTime(300);
    asked[1].answer({ status: 'ok', predictions: [prediction('p1', 'Village Park')] });
    await Promise.resolve();
    asked[0].answer({ status: 'ok', predictions: [prediction('p9', 'Villa Old')] });
    await Promise.resolve();
    expect(last()).toEqual({
      status: 'done',
      query: 'village',
      predictions: [prediction('p1', 'Village Park')],
    });
  });

  it('answers a query it has seen from memory, without asking again', async () => {
    const { search, asked, last } = setup();
    search.search('pavi', BIAS);
    jest.advanceTimersByTime(300);
    asked[0].answer({ status: 'ok', predictions: [prediction('p2', 'Pavilion')] });
    await Promise.resolve();
    search.search('pav', BIAS);
    jest.advanceTimersByTime(300);
    search.search('Pavi ', BIAS);
    expect(asked).toHaveLength(2);
    expect(last()).toEqual({
      status: 'done',
      query: 'Pavi',
      predictions: [prediction('p2', 'Pavilion')],
    });
  });

  it('reads unavailable when Google cannot answer, and asks nothing once disposed', async () => {
    const { search, asked, last } = setup();
    search.search('kopi', BIAS);
    jest.advanceTimersByTime(300);
    asked[0].answer({ status: 'unavailable' });
    await Promise.resolve();
    expect(last()).toEqual({ status: 'unavailable', query: 'kopi' });
    search.search('kopit', BIAS);
    search.dispose();
    jest.advanceTimersByTime(1000);
    expect(asked).toHaveLength(1);
  });
});
