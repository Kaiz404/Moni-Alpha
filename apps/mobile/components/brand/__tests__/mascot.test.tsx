import { render, screen } from '@testing-library/react-native';

import { Lockup } from '@/components/brand/lockup';
import {
  MASCOT_ART,
  MASCOT_MONO,
} from '@/components/brand/mascot-art.generated';
import {
  MASCOT_MOODS,
  Mascot,
  MoniGlyph,
} from '@/components/brand/mascot';
import { Wordmark } from '@/components/brand/wordmark';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const MOODS = [
  'neutral',
  'happy',
  'thinking',
  'listening',
  'worried',
  'sleepy',
  'celebrate',
  'surprised',
  'hidden',
];

describe('mascot art', () => {
  it('has all nine moods for every variant', () => {
    expect([...MASCOT_MOODS]).toEqual(MOODS);
    expect(Object.keys(MASCOT_ART)).toEqual([
      'tile',
      'light',
      'dark',
    ]);
    for (const art of Object.values(MASCOT_ART)) {
      expect(Object.keys(art)).toEqual(MOODS);
    }
    expect(Object.keys(MASCOT_MONO)).toEqual(MOODS);
  });

  it('draws the mono cat in one fill that the caller sets', () => {
    for (const xml of Object.values(MASCOT_MONO)) {
      const fills = new Set(xml.match(/fill="[^"]+"/g));
      // Black and white only shape the mask; currentColor is the one paint.
      expect([...fills].sort()).toEqual([
        'fill="#000000"',
        'fill="#FFFFFF"',
        'fill="currentColor"',
        'fill="none"',
      ]);
    }
  });
});

describe('Mascot', () => {
  it.each(
    MOODS.flatMap((mood) =>
      (['tile', 'light', 'dark', 'mono'] as const).map((variant) => [
        mood,
        variant,
      ]),
    ),
  )('renders %s on %s with its label', (mood, variant) => {
    render(
      <Mascot
        mood={mood as (typeof MASCOT_MOODS)[number]}
        variant={variant}
      />,
    );
    expect(
      screen.getByLabelText(
        mood === 'neutral' ? 'Moni' : `Moni, ${mood}`,
      ),
    ).toBeOnTheScreen();
  });

  it('stays out of the accessibility tree when decorative', () => {
    render(
      <Mascot
        decorative
        testID="cat"
      />,
    );
    expect(screen.queryByLabelText('Moni')).toBeNull();
  });
});

describe('brand marks', () => {
  it('reads the wordmark, the lockup and a labelled glyph as Moni', () => {
    render(<Wordmark size={40} />);
    expect(screen.getByLabelText('Moni')).toBeOnTheScreen();
    render(
      <Lockup
        kind="stacked"
        size={64}
      />,
    );
    expect(
      screen.getByRole('header', { name: 'Moni' }),
    ).toBeOnTheScreen();
    render(<MoniGlyph accessibilityLabel="Moni" />);
    expect(screen.getByLabelText('Moni')).toBeOnTheScreen();
  });
});
