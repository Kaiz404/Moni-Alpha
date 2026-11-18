import { describe, expect, it } from 'vitest';

import { catMonoSvg, catSvg, figure, lockupHtml, MOODS, monoFigure, wordmarkHtml } from '../cat';

describe('figure', () => {
  it('draws the happy cat on Deep mint: tilted, arc eyes, coin lifted to the chest', () => {
    const happy = figure('happy', 'deep');
    expect(happy).toMatch(
      /^<g transform="translate\(0 -10\) rotate\(-4 120 198\) translate\(120 198\) scale\(1 0\.9\) translate\(-120 -198\)">/,
    );
    expect(happy).toContain(
      '<path d="M51 112 L59.4 46.6 Q60.8 35.7 69.4 42.5 L102 68 L92 112 Z" fill="#FFFDF8"></path>',
    );
    expect(happy).toContain(
      '<rect x="103" y="76" width="34" height="10" rx="5.0" fill="#236B47"></rect>',
    );
    expect(happy).toContain(
      '<path d="M97 134 Q106 116 115 134" fill="none" stroke="#17181A" stroke-width="7" stroke-linecap="round"></path>',
    );
    expect(happy).toContain(
      '<circle cx="120" cy="172" r="22" fill="#F7CF3A" stroke="#17181A" stroke-width="2.5"></circle>',
    );
    expect(happy).toContain('transform="rotate(14 99 180)"');
  });

  it('paints the body Deep mint with Paper eyes on a light page', () => {
    expect(figure('neutral', 'none')).toContain(
      '<rect x="100" y="117" width="12" height="28" rx="6" fill="#FFFDF8"></rect>',
    );
  });
});

describe('catSvg', () => {
  it('draws the app-icon tile at radius 22%', () => {
    expect(catSvg('neutral')).toMatch(
      /^<svg width="180" height="180" viewBox="0 0 240 240" aria-hidden="true" data-id="x" style="display: block; flex: none"><rect width="240" height="240" rx="52\.8" fill="#236B47"><\/rect><g /,
    );
  });

  it('crops an untiled cat taller when the coin goes over its head', () => {
    expect(catSvg('celebrate', { size: 99, tile: false, ground: 'none', label: 'Moni' })).toMatch(
      /^<svg width="96" height="99" viewBox="24 10 192 198" role="img" aria-label="Moni"/,
    );
  });
});

describe('the one-colour cat', () => {
  it('fills one rect through a mask, so every cut-out is transparent', () => {
    const mono = monoFigure('neutral', 'currentColor', 'm');
    expect(mono).toContain(
      '<mask id="m" maskUnits="userSpaceOnUse" x="-40" y="-40" width="320" height="320">',
    );
    expect(mono).toContain(
      '<rect x="-40" y="-40" width="320" height="320" fill="currentColor" mask="url(#m)"></rect></g>',
    );
  });

  it('picks a light tile for a dark cat and a dark tile for a light one', () => {
    expect(catMonoSvg('neutral', { tile: true, maskId: 'a' })).toContain('fill="#D3E4D4"></rect>');
    expect(catMonoSvg('neutral', { tile: 'round', color: '#FFFFFF', maskId: 'b' })).toContain(
      '<circle cx="120" cy="120" r="120" fill="#2B3A30"></circle>',
    );
  });
});

describe('wordmark and lockups', () => {
  it('draws the i-dot as shares of the font size', () => {
    expect(wordmarkHtml(48)).toContain(
      'top: 6.2px; width: 8.2px; height: 8.2px; margin-left: -4.1px; border-radius: 50%; background: #236B47',
    );
  });

  it('rounds a tie to the even digit, as the Python art module did', () => {
    expect(wordmarkHtml(0.25)).toContain('font-size: 0.2px;');
    expect(wordmarkHtml(0.75)).toContain('font-size: 0.8px;');
  });

  it('keeps the cat beside the word, never inside it, with a Mint key dot on dark', () => {
    const lockup = lockupHtml('stacked', { size: 80, ground: 'dark' });
    expect(lockup).toMatch(/^<div style="[^"]*gap: 12\.8px"><svg width="80" height="80" /);
    expect(lockup).toContain('<span>mon</span>');
    expect(lockup.split('<span>mon</span>')[1]).not.toContain('<svg');
    expect(lockup).toContain('color: #F6F3ED');
    expect(lockup).toContain('background: #8ECF9D');
  });

  it('lists the nine moods', () => {
    expect(MOODS).toEqual([
      'neutral',
      'happy',
      'thinking',
      'listening',
      'worried',
      'sleepy',
      'celebrate',
      'surprised',
      'hidden',
    ]);
  });
});
