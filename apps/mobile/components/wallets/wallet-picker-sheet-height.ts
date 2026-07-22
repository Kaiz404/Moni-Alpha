const HEADER_HEIGHT = 100;
const ROW_HEIGHT = 64;
const VERTICAL_PADDING = 44;
const EMPTY_LIST_HEIGHT = 48;
const MIN_HEIGHT = 220;
const MAX_HEIGHT_RATIO = 0.78;
/** Beyond this count the sheet caps and the list scrolls inside. */
const SCROLL_THRESHOLD = 6;

/** Bottom-sheet height that grows with wallet count, capped for long lists. */
export function walletPickerSheetHeight(
  walletCount: number,
  windowHeight: number,
): number {
  const listHeight =
    walletCount === 0
      ? EMPTY_LIST_HEIGHT
      : walletCount * ROW_HEIGHT;
  const raw = HEADER_HEIGHT + listHeight + VERTICAL_PADDING;
  const max = Math.round(windowHeight * MAX_HEIGHT_RATIO);
  return Math.min(Math.max(raw, MIN_HEIGHT), max);
}

export function walletPickerScrollEnabled(walletCount: number): boolean {
  return walletCount > SCROLL_THRESHOLD;
}
