/** One record of a CSV file. `line` is where it starts, counted from 1 as a text editor does. */
export type CsvRow = { line: number; cells: string[] };

export type CsvTable = {
  delimiter: string;
  rows: CsvRow[];
  /** Lines where a quote never closed; the record is dropped and reading carries on at the next line. */
  brokenLines: number[];
};

const DELIMITERS = [',', ';', '\t', '|'];
const SAMPLE_LINES = 10;

/** A spreadsheet runs a cell starting like this as a formula, and an alert's text can start any way. */
const FORMULA_START = /^'*[=+\-@\t\r]/;

/** Text for a cell, quoted when it must be and with a leading `'` when a spreadsheet would run it. */
export function textCell(value: string | null | undefined): string {
  const text = value ?? '';
  return valueCell(FORMULA_START.test(text) ? `'${text}` : text);
}

/** A cell that must stay as it is for a spreadsheet to read it, such as a negative amount. */
export function valueCell(value: string | null | undefined): string {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Undoes the `'` that `textCell` added, so a value survives a round trip exactly. */
export function readTextCell(cell: string): string {
  return cell.startsWith("'") && FORMULA_START.test(cell) ? cell.slice(1) : cell;
}

/** The delimiter used most over the first lines, with quoted text ignored; a tie goes to the comma. */
export function detectDelimiter(text: string): string {
  const counts = new Map(DELIMITERS.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  let lines = 0;
  for (let index = 0; index < text.length && lines < SAMPLE_LINES; index += 1) {
    const char = text[index];
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === '\n') lines += 1;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  let best = ',';
  for (const delimiter of DELIMITERS) {
    if (counts.get(delimiter)! > counts.get(best)!) best = delimiter;
  }
  return best;
}

/** Reads one record from `start`. Returns null when a quote is still open at the end of the text. */
function readRecord(
  text: string,
  start: number,
  delimiter: string,
): { cells: string[]; next: number; lines: number } | null {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  let lines = 0;
  let index = start;
  while (index < text.length) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 2;
        continue;
      }
      if (char === '"') quoted = false;
      else {
        if (char === '\n' || (char === '\r' && text[index + 1] !== '\n')) lines += 1;
        cell += char;
      }
      index += 1;
      continue;
    }
    if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      cells.push(cell);
      return {
        cells,
        lines: lines + 1,
        next: index + (char === '\r' && text[index + 1] === '\n' ? 2 : 1),
      };
    } else {
      cell += char;
    }
    index += 1;
  }
  if (quoted) return null;
  cells.push(cell);
  return { cells, next: index, lines };
}

function nextLineStart(text: string, from: number): number {
  const newline = text.slice(from).search(/\r\n|\r|\n/);
  if (newline < 0) return text.length;
  const at = from + newline;
  return at + (text[at] === '\r' && text[at + 1] === '\n' ? 2 : 1);
}

/** RFC 4180 with any common delimiter and line ending. Blank records are dropped. */
export function parseCsv(text: string): CsvTable {
  const delimiter = detectDelimiter(text);
  const rows: CsvRow[] = [];
  const brokenLines: number[] = [];
  let at = 0;
  let line = 1;
  while (at < text.length) {
    const record = readRecord(text, at, delimiter);
    if (!record) {
      brokenLines.push(line);
      at = nextLineStart(text, at);
      line += 1;
      continue;
    }
    if (record.cells.some((cell) => cell.trim() !== '')) rows.push({ line, cells: record.cells });
    at = record.next;
    line += record.lines;
  }
  return { delimiter, rows, brokenLines };
}
