import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { CategoryIcon } from '@/components/categories/category-icon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** The soft bubble fills on Moni's Ink cards: a pastel's light step, or a category's own colour. */
export type SoftTint = 'coral' | 'mint' | 'lilac' | 'lemon' | 'sand' | { color: string | null };

const FILL: Record<Exclude<SoftTint, object>, string> = {
  coral: 'bg-destructive-fill',
  mint: 'bg-primary-muted',
  lilac: 'bg-pending-fill',
  lemon: 'bg-attention-fill',
  sand: 'bg-sand',
};

/**
 * Secondary text on an Ink card: #A9A397 and #EFE8DA on the boards. In dark the card turns cream
 * (Contrast), where those light tones vanish, so the text dims its own ink instead.
 */
export function useOnInk() {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  return dark
    ? {
        meta: 'text-primary-foreground opacity-70',
        body: 'text-primary-foreground opacity-90',
        metaGlyph: tokens.primaryForeground,
      }
    : { meta: 'text-inactive', body: 'text-sand-light', metaGlyph: tokens.inactive };
}

export function SoftBubble({
  icon,
  tint,
  size = 40,
}: {
  icon: string | null;
  tint: SoftTint;
  size?: 36 | 40 | 42;
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const color = typeof tint === 'object' ? tint.color : null;
  const glyph = size === 36 ? 18 : size === 40 ? 19 : 20;
  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-full ${typeof tint === 'object' ? (color ? 'bg-card' : 'bg-sand') : FILL[tint]}`}
      style={{ width: size, height: size }}
    >
      {color ? (
        <View
          className="absolute inset-0"
          style={{ backgroundColor: `${color}${dark ? '38' : '73'}` }}
        />
      ) : null}
      <CategoryIcon
        icon={icon}
        size={glyph}
        color={color && dark ? color : tokens.foreground}
      />
    </View>
  );
}

/** The "MONI" caps line that opens every Ink card. */
export function InkCardLabel({ label, trailing }: { label: string; trailing?: string }) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  return (
    <View className="flex-row items-center gap-2">
      <IconSymbol
        name="creation"
        size={16}
        color={tokens.lilac}
      />
      <Text
        variant="caps"
        className={`flex-1 ${onInk.meta}`}
      >
        {label}
      </Text>
      {trailing ? (
        <Text className={`text-[12px] leading-[16px] font-display-semibold ${onInk.meta}`}>{trailing}</Text>
      ) : null}
    </View>
  );
}

/** A tappable line on an Ink card (a starter, a noticed item): soft bubble, words, a Paper arrow. */
export function InkRow({
  testID,
  accessibilityLabel,
  icon,
  tint,
  title,
  meta,
  done = false,
  onPress,
}: {
  testID: TestId;
  accessibilityLabel?: string;
  icon: string | null;
  tint: SoftTint;
  title: string;
  meta?: string;
  /** Already asked: the line dims and its arrow turns to a check. */
  done?: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      radius={{ rest: 18, pressed: 16 }}
      pressedClassName="bg-ink-2/40"
      className="-mx-2 min-h-[52px] flex-row items-center gap-3 px-2 py-1.5"
      style={done ? { opacity: 0.55 } : undefined}
    >
      <SoftBubble
        icon={icon}
        tint={tint}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] leading-[20px] font-display-semibold text-primary-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            variant="meta"
            className={onInk.meta}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-card">
        <IconSymbol
          name={done ? 'check' : 'arrow-up'}
          size={18}
          color={tokens.foreground}
        />
      </View>
    </Press>
  );
}
