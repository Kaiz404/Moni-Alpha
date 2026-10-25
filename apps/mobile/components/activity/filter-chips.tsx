import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ActivityKind } from '@/lib/finance/activity-filter';
import { tid } from '@/lib/test-ids';

const KINDS: { value: ActivityKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
];

export function FilterChips({
  kind,
  onKind,
  walletName,
  onWallet,
  placeName,
  onClearPlace,
}: {
  kind: ActivityKind;
  onKind: (kind: ActivityKind) => void;
  /** The chosen wallet, or null for every wallet. */
  walletName: string | null;
  onWallet: () => void;
  /** The place the map sent the list to, shown first with a way to clear it. */
  placeName: string | null;
  onClearPlace: () => void;
}) {
  const tokens = useThemeTokens();
  const walletInk = walletName ? tokens.primaryForeground : tokens.foreground;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Filter"
      className="-mx-screen"
      contentContainerClassName="gap-2 px-screen py-1"
    >
      {placeName ? (
        <Press
          testID={tid('activity', 'filter', 'place')}
          accessibilityLabel={`${placeName}, clear`}
          onPress={onClearPlace}
          hitSlop={4}
          radius={{ rest: 18, pressed: 16 }}
          pressedClassName="bg-primary-pressed"
          className="h-9 flex-row items-center gap-1 bg-primary pl-3.5 pr-2.5"
        >
          <Text
            className="text-[14px] leading-[19px] font-display-semibold text-primary-foreground"
            numberOfLines={1}
          >
            {placeName}
          </Text>
          <IconSymbol
            name="close"
            size={16}
            color={tokens.primaryForeground}
          />
        </Press>
      ) : null}
      {KINDS.map((option) => (
        <Chip
          key={option.value}
          testID={tid('activity', 'filter', option.value)}
          label={option.label}
          selected={kind === option.value}
          onPress={() => onKind(option.value)}
        />
      ))}
      <Press
        testID={tid('activity', 'filter', 'wallet')}
        accessibilityLabel={walletName ?? 'All wallets'}
        accessibilityState={{ selected: walletName !== null }}
        onPress={onWallet}
        hitSlop={4}
        radius={{ rest: 18, pressed: 16 }}
        pressedClassName={walletName ? 'bg-primary-pressed' : 'bg-hairline'}
        className={`h-9 flex-row items-center gap-1.5 pl-3 pr-2.5 ${walletName ? 'bg-primary' : 'bg-sand'}`}
      >
        <IconSymbol
          name="wallet-outline"
          size={18}
          color={walletInk}
        />
        <Text
          className={`text-[14px] leading-[19px] font-display-semibold ${walletName ? 'text-primary-foreground' : 'text-foreground'}`}
          numberOfLines={1}
        >
          {walletName ?? 'All wallets'}
        </Text>
        <IconSymbol
          name="chevron-down"
          size={18}
          color={walletInk}
        />
      </Press>
    </ScrollView>
  );
}
