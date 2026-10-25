const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const MAJOR = new Set(['rm', 'ringgit', 'ringgits', 'dollar', 'dollars', 'bucks', '$']);
const MINOR = new Set(['sen', 'cent', 'cents']);
const POINT = new Set(['point', 'dot']);
const GLUE = new Set(['a', 'and', 'hundred', 'thousand']);

const INTEGER = /^\d+(?:,\d{3})*$/;
const DECIMAL = /^\d+(?:,\d{3})*[.:]\d{1,2}$/;
const TOKEN = /rm(?=\d)|\$|[a-z]+|\d+(?:,\d{3})*(?:[.:]\d+)?/gi;
const LONGEST_SPAN = 8;

type Token = { word: string; start: number; end: number };

function isAmountWord(word: string): boolean {
  return (
    word in ONES ||
    word in TENS ||
    GLUE.has(word) ||
    MAJOR.has(word) ||
    MINOR.has(word) ||
    POINT.has(word) ||
    INTEGER.test(word) ||
    DECIMAL.test(word)
  );
}

/** A whole number said in words ("two hundred and five") or written in digits; null otherwise. */
function integer(words: readonly string[]): number | null {
  if (words.length === 1 && INTEGER.test(words[0])) return Number(words[0].replace(/,/g, ''));
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  let last: 'start' | 'ones' | 'tens' | 'a' | 'scale' | 'and' = 'start';
  for (const word of words) {
    if (word in ONES) {
      const value = ONES[word];
      const afterTens = last === 'tens' && value > 0 && value < 10;
      if (!(last === 'start' || last === 'scale' || last === 'and' || afterTens)) return null;
      current += value;
      last = 'ones';
    } else if (word in TENS) {
      if (!(last === 'start' || last === 'scale' || last === 'and')) return null;
      current += TENS[word];
      last = 'tens';
    } else if (word === 'a') {
      if (last !== 'start') return null;
      current = 1;
      last = 'a';
    } else if (word === 'hundred') {
      if (!(last === 'ones' || last === 'tens' || last === 'a') || current >= 100) return null;
      current *= 100;
      last = 'scale';
    } else if (word === 'thousand') {
      if (last === 'start' || last === 'and' || total > 0 || current === 0) return null;
      total = current * 1000;
      current = 0;
      last = 'scale';
    } else if (word === 'and') {
      if (last !== 'scale') return null;
      last = 'and';
    } else {
      return null;
    }
  }
  return last === 'a' || last === 'and' ? null : total + current;
}

/** Every amount in minor units a run of words can mean: "nine eighty" is 9.80, "one twenty" 1.20 or 120. */
function readings(words: readonly string[]): number[] {
  if (words.length > 1 && MAJOR.has(words[0])) return readings(words.slice(1));
  const major = words.findIndex((word) => MAJOR.has(word));
  if (major === 0) return [];
  if (major > 0) {
    const whole = integer(words.slice(0, major));
    let rest = words.slice(major + 1);
    if (rest[0] === 'and') rest = rest.slice(1);
    if (rest.length > 0 && MINOR.has(rest[rest.length - 1])) rest = rest.slice(0, -1);
    if (whole === null) return [];
    if (rest.length === 0) return [whole * 100];
    const cents = integer(rest);
    return cents !== null && cents < 100 ? [whole * 100 + cents] : [];
  }
  if (MINOR.has(words[words.length - 1])) {
    const cents = integer(words.slice(0, -1));
    return cents !== null && cents < 100 ? [cents] : [];
  }
  const point = words.findIndex((word) => POINT.has(word));
  if (point >= 0) {
    const whole = integer(words.slice(0, point));
    const digits = words.slice(point + 1).map((word) => integer([word]));
    if (whole === null || digits.length === 0 || digits.length > 2) return [];
    if (digits.some((digit) => digit === null || digit > 9)) return [];
    const [tenths, hundredths = 0] = digits as number[];
    return [whole * 100 + tenths * 10 + hundredths];
  }
  const out: number[] = [];
  if (words.length === 1 && DECIMAL.test(words[0])) {
    const [whole, fraction] = words[0].replace(/,/g, '').split(/[.:]/);
    out.push(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
  }
  const whole = integer(words);
  if (whole !== null) {
    out.push(whole * 100);
    // Speech often drops the point: "980" for nine eighty.
    if (words.length === 1 && whole >= 100 && whole < 10_000) out.push(whole);
  }
  for (let split = 1; split < words.length; split++) {
    const before = integer(words.slice(0, split));
    const after = integer(words.slice(split));
    if (before === null || after === null || after < 10 || after > 99) continue;
    out.push(before * 100 + after);
    if (before > 0 && before < 10) out.push((before * 100 + after) * 100);
  }
  return out;
}

/**
 * The words in `transcript` that said `amountMinor`, as spoken ("nine eighty",
 * "6 ringgit"), so the check page can quote them. Null when no run of words
 * means that amount.
 */
export function spokenAmount(transcript: string, amountMinor: number): string | null {
  const tokens: Token[] = [...transcript.matchAll(TOKEN)].map((match) => ({
    word: match[0].toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
  let best: { from: number; to: number } | null = null;
  for (let from = 0; from < tokens.length; from++) {
    if (!isAmountWord(tokens[from].word) || tokens[from].word === 'and') continue;
    for (let to = from + 1; to <= Math.min(tokens.length, from + LONGEST_SPAN); to++) {
      if (!isAmountWord(tokens[to - 1].word)) break;
      if (best && to - from <= best.to - best.from) continue;
      const words = tokens.slice(from, to).map((token) => token.word);
      if (readings(words).includes(amountMinor)) best = { from, to };
    }
  }
  return best ? transcript.slice(tokens[best.from].start, tokens[best.to - 1].end) : null;
}
