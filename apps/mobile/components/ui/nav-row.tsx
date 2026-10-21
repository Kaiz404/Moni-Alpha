import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

export type BubbleTint =
  | 'sand'
  | 'mint'
  | 'lemon'
  | 'lilac'
  | 'peach'
  | 'coral'
  | 'sky'
  | 'aqua';

const tintClass: Record<BubbleTint, string> = {
  sand: 'bg-sand',
  mint: 'bg-mint',
  lemon: 'bg-lemon',
  lilac: 'bg-lilac',
  peach: 'bg-peach',
  coral: 'bg-coral',
  sky: 'bg-sky',
  aqua: 'bg-aqua',
};

type NavRowProps = {
  testID: TestId;
  title: string;
  onPress: () => void;
  icon?: IconSymbolName;
  tint?: BubbleTint;
  /** Trailing value in Ink 2, such as "4 wallets". */
  value?: string;
  disabled?: boolean;
};

/** A row that opens another page (settings, wallets, people, bills): optional value, then a chevron. */
export function NavRow({
  testID,
  title,
  onPress,
  icon,
  tint = 'sand',
  value,
  disabled = false,
}: NavRowProps) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityState={{ disabled }}
      className={`min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3 ${disabled ? 'opacity-50' : ''}`}
    >
      {icon ? (
        <View
          className={`h-[42px] w-[42px] items-center justify-center rounded-full ${tintClass[tint]}`}
        >
          <IconSymbol
            name={icon}
            size={20}
            color={
              tint === 'sand' ? tokens.foreground : tokens.onPastel
            }
          />
        </View>
      ) : null}
      <Text
        variant="rowTitle"
        className="min-w-0 flex-1 text-foreground"
        numberOfLines={1}
      >
        {title}
      </Text>
      {value ? (
        <Text
          variant="body"
          className="text-ink-2"
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}
