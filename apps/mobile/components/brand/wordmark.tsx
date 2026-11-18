import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import {
  BRAND_COLORS,
  WORDMARK,
} from '@/components/brand/mascot-art.generated';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WordmarkProps = {
  /** Font size; the line box is the same height. */
  size: number;
  /** The drawn round i-dot: Deep mint on light grounds, Mint key on dark ones. */
  dot?: boolean;
  /** The word colour; defaults to the text colour. */
  color?: string;
};

/** "moni" in Funnel Display Bold, lowercase. The cat never goes inside it. */
export function Wordmark({ size, dot = true, color }: WordmarkProps) {
  const dark = useUniwind().theme === 'dark';
  const tokens = useThemeTokens();
  const style = {
    color: color ?? tokens.foreground,
    fontSize: size,
    lineHeight: size,
    letterSpacing: size * WORDMARK.tracking,
  };
  const d = size * WORDMARK.dot;

  return (
    <View
      className="flex-row"
      accessible
      accessibilityRole="text"
      accessibilityLabel="Moni"
    >
      <Text
        className="font-display-bold"
        style={style}
      >
        {dot ? 'mon' : 'moni'}
      </Text>
      {dot ? (
        <View>
          <Text
            className="font-display-bold"
            style={style}
          >
            ı
          </Text>
          <View
            style={{
              position: 'absolute',
              left: '50%',
              top: size * WORDMARK.dotTop,
              width: d,
              height: d,
              marginLeft: -d / 2,
              borderRadius: d / 2,
              backgroundColor: dark
                ? BRAND_COLORS.mintKey
                : BRAND_COLORS.deepMint,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
