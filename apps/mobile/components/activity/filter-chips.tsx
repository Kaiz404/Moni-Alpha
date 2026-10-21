import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui/chip';
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Filter"
      className="-mx-screen"
      contentContainerClassName="gap-2 px-screen"
    >
      {placeName ? (
        <Chip
          testID={tid('activity', 'filter', 'place')}
          label={placeName}
          icon="close"
          selected
          onPress={onClearPlace}
        />
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
      <Chip
        testID={tid('activity', 'filter', 'wallet')}
        label={walletName ?? 'All wallets'}
        icon="wallet-outline"
        selected={walletName !== null}
        onPress={onWallet}
      />
    </ScrollView>
  );
}
