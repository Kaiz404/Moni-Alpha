import { catSvg, wordmarkHtml, type GroundName, type Mood } from '@repo/brand';

/** Cat Pebble from @repo/brand. The strings are the package's own trusted art, so inlining them is safe. */
export function Cat({
  mood = 'neutral',
  size,
  ground = 'none',
  tile = false,
  id,
  className,
}: {
  mood?: Mood;
  size: number;
  ground?: GroundName;
  tile?: boolean;
  /** Unique per page: the art's mask ids derive from it. */
  id: string;
  className?: string;
}) {
  const art = (g: GroundName, theme?: 'light' | 'dark') => (
    <span
      aria-hidden="true"
      className={[className, theme && `only-${theme}`].filter(Boolean).join(' ') || undefined}
      style={{ display: 'inline-flex', flex: 'none', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: catSvg(mood, { size, ground: g, tile, idPrefix: `${id}-${g}` }) }}
    />
  );
  // A page cat is Deep mint on light pages and Paper on dark ones; CSS shows the one for the theme.
  if (ground === 'none' && !tile) {
    return (
      <>
        {art('none', 'light')}
        {art('dark', 'dark')}
      </>
    );
  }
  return art(ground);
}

/** The Ask Moni mark: the cat, never a sparkle. Paper cat on the Ink sidebar, Deep mint cat on light pages. */
export function AskMoniMark({ size, onInk = false, id }: { size: number; onInk?: boolean; id: string }) {
  return <Cat size={size} ground={onInk ? 'dark' : 'none'} id={id} />;
}

export function Wordmark({ size, onInk = false }: { size: number; onInk?: boolean }) {
  const html = onInk
    ? wordmarkHtml(size, { color: 'var(--color-on-tab-bar)', dotColor: 'var(--color-mint-key)' })
    : wordmarkHtml(size, { color: 'var(--color-foreground)', dotColor: 'var(--color-deep-mint)' });
  return <span aria-label="moni" style={{ display: 'inline-flex', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: html }} />;
}
