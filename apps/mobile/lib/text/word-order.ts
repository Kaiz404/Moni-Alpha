/** For text split on `/(\s+)/`: each word's position among the words, -1 for the spaces between them. */
export function wordOrder(parts: readonly string[]): number[] {
  let word = -1;
  return parts.map((part) => (part.trim() ? ++word : -1));
}
