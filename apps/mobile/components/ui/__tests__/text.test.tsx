import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Text, textFonts } from '@/components/ui/text';

describe('Text', () => {
  it('sets family, size, and line height from the variant', () => {
    render(<Text variant="screenTitle">Budget</Text>);

    expect(
      StyleSheet.flatten(screen.getByText('Budget').props.style),
    ).toEqual({
      fontFamily: 'FunnelDisplay_700Bold',
      fontSize: 28,
      lineHeight: 32,
    });
  });

  it('defaults to Regular, keeps a named weight, and lets nested text inherit', () => {
    render(
      <Text className="text-muted">
        Spent <Text className="font-display-bold">RM42</Text>{' '}
        <Text>today</Text>
      </Text>,
    );

    expect(screen.getByText(/^Spent/).props.className).toBe(
      'font-display text-muted',
    );
    expect(screen.getByText('RM42').props.className).toBe(
      'font-display-bold',
    );
    expect(screen.getByText('today').props.className).toBeUndefined();
  });

  it('loads a font file for every family global.css names', () => {
    const css = readFileSync(
      join(__dirname, '../../../global.css'),
      'utf8',
    );
    const families = [
      ...css.matchAll(/--font-display[\w-]*:\s*(\w+);/g),
    ].map((m) => m[1]);

    expect(families).toEqual([
      'FunnelDisplay_400Regular',
      'FunnelDisplay_600SemiBold',
      'FunnelDisplay_700Bold',
    ]);
    expect(Object.keys(textFonts)).toEqual(families);
  });
});
