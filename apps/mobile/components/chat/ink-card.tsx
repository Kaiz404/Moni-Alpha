import { View } from 'react-native';

import { glyphOn } from '@/lib/theme/glyph-on';
import { MoniGlyph } from '@/components/brand/mascot';
import { CategoryIcon } from '@/components/categories/category-icon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** The soft bubble fills on Moni's Ink cards: a pastel's light step, or a category's own colour. */
export type SoftTint =
  | 'coral'
  | 'mint'
  | 'lilac'
  | 'lemon'
  | 'sand'
  | { color: string | null };


const FILL: Record<Exclude<SoftTint, object>, string> = {
  coral: 'bg-destructive-fill',
  mint: 'bg-primary-muted',
  lilac: 'bg-pending-fill',
  lemon: 'bg-attention-fill',
  sand: 'bg-sand',
};

/** Text on Moni's cards: Ink cards in light, dark surfaces in dark (#146). */
export const onMoniCard = {
  title: 'text-on-moni-card',
  meta: 'text-on-moni-card-meta',
  body: 'text-on-moni-card-body',
} as const;

/** Secondary marks on an Ink control (the listening capsule): cream controls in dark. */
export function useOnInk() {
  const tokens = useThemeTokens();
  return {
    meta: 'text-on-ink-meta',
    metaGlyph: tokens.onInkMeta,
  };
}

export function SoftBubble({
  icon,
  tint,
  size = 40,
}: {
  /** A category icon name, or `moni` for Moni's cat head. */
  icon: string | null;
  tint: SoftTint;
  size?: 36 | 40 | 42;
}) {
  const tokens = useThemeTokens();
  const color = typeof tint === 'object' ? tint.color : null;
  const glyph = size === 36 ? 18 : size === 40 ? 19 : 20;
  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-full ${typeof tint === 'object' ? (color ? '' : 'bg-sand') : FILL[tint]}`}
      style={color ? { width: size, height: size, backgroundColor: color } : { width: size, height: size }}
    >
      {icon === 'moni' ? (
        <MoniGlyph
          size={glyph}
          color={tokens.foreground}
        />
      ) : (
        <CategoryIcon
          icon={icon}
          size={glyph}
          color={color ? glyphOn(color) : tokens.foreground}
        />
      )}
    </View>
  );
}

/** The "MONI" caps line that opens every Ink card. */
export function InkCardLabel({
  label,
  trailing,
}: {
  label: string;
  trailing?: string;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="flex-row items-center gap-2">
      <MoniGlyph
        size={16}
        color={tokens.moniCardGlyph}
      />
      <Text
        variant="caps"
        className={`flex-1 ${onMoniCard.meta}`}
      >
        {label}
      </Text>
      {trailing ? (
        <Text
          className={`text-[12px] leading-[16px] font-display-semibold ${onMoniCard.meta}`}
        >
          {trailing}
        </Text>
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
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      radius={{ rest: 18, pressed: 16 }}
      pressedClassName="bg-moni-card-pressed"
      className="-mx-2 min-h-[52px] flex-row items-center gap-3 px-2 py-1.5"
      style={done ? { opacity: 0.55 } : undefined}
    >
      <SoftBubble
        icon={icon}
        tint={tint}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] leading-[20px] font-display-semibold text-on-moni-card"
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            variant="meta"
            className={onMoniCard.meta}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-moni-card-raised">
        <IconSymbol
          name={done ? 'check' : 'arrow-up'}
          size={18}
          color={tokens.foreground}
        />
      </View>
    </Press>
  );
}
