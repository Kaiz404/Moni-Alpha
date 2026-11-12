import type { PlacePrediction, PlacesClient } from './types';

/** What Google search shows for the current query. */
export type GoogleSearch =
  /** Too short to ask Google. */
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; predictions: PlacePrediction[] }
  | { status: 'unavailable'; query: string };

export const GOOGLE_MIN_CHARS = 3;
export const GOOGLE_DEBOUNCE_MS = 300;

type Bias = { latitude: number; longitude: number } | null;

/**
 * Google autocomplete for one opening of the place sheet: asks once typing pauses, drops an
 * answer the user has typed past, and remembers each answer so retyping a query is free.
 */
export function createGoogleSearch({
  client,
  sessionToken,
  onChange,
  delayMs = GOOGLE_DEBOUNCE_MS,
}: {
  client: PlacesClient;
  sessionToken: string;
  onChange: (search: GoogleSearch) => void;
  delayMs?: number;
}) {
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | null = null;
  const answers = new Map<string, PlacePrediction[]>();

  const stop = () => {
    latest += 1;
    clearTimeout(timer);
    inFlight?.abort();
    inFlight = null;
  };

  return {
    search(text: string, bias: Bias) {
      stop();
      const query = text.trim();
      if (query.length < GOOGLE_MIN_CHARS) return onChange({ status: 'idle' });
      const known = answers.get(query.toLowerCase());
      if (known) return onChange({ status: 'done', query, predictions: known });
      onChange({ status: 'loading', query });
      const ask = latest;
      timer = setTimeout(() => {
        const abort = new AbortController();
        inFlight = abort;
        void client
          .autocomplete({ input: query, sessionToken, bias }, abort.signal)
          .then((result) => {
            if (ask !== latest) return;
            inFlight = null;
            if (result.status !== 'ok') return onChange({ status: 'unavailable', query });
            answers.set(query.toLowerCase(), result.predictions);
            onChange({ status: 'done', query, predictions: result.predictions });
          });
      }, delayMs);
    },
    dispose: stop,
  };
}
