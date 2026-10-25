import { useValue } from '@legendapp/state/react';
import { addMinor, type MinorAmount } from '@repo/types';
import { Modal, View } from 'react-native';

import { currencyName } from '@/components/profile/currency-words';
import {
  PROFILE_TINT_CLASS,
  type ProfileTint,
} from '@/components/profile/profile-row';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Sheet } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';
import {
  walletBalanceMinor$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { tid } from '@/lib/test-ids';

const TINTS: ProfileTint[] = ['lemon', 'aqua', 'mint', 'peach', 'lilac'];

type Held = { currency: string; wallets: number; totalMinor: MinorAmount };

/** The currencies the user holds a wallet in, most wallets first; the current pick is always listed. */
function useHeldCurrencies(selected: string): Held[] {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useValue(() => {
    const held = new Map<string, Held>();
    for (const wallet of walletsForUser$(userId).get()) {
      const entry = held.get(wallet.currency) ?? {
        currency: wallet.currency,
        wallets: 0,
        totalMinor: 0 as MinorAmount,
      };
      entry.wallets += 1;
      entry.totalMinor = addMinor(
        entry.totalMinor,
        walletBalanceMinor$(wallet.id).get(),
      );
      held.set(wallet.currency, entry);
    }
    if (!held.has(selected)) {
      held.set(selected, {
        currency: selected,
        wallets: 0,
        totalMinor: 0 as MinorAmount,
      });
    }
    return [...held.values()].sort(
      (a, b) =>
        b.wallets - a.wallets || a.currency.localeCompare(b.currency),
    );
  });
}

/**
 * V2H-Profile's Main currency sheet: only the currencies the user holds a
 * wallet in, each with its wallet count and total. It lives in a Modal so its
 * scrim covers the Profile header, as the kit's host does for its sheets.
 */
export function MainCurrencySheet({
  visible,
  open,
  selected,
  onPick,
  onDismiss,
  onExited,
}: {
  visible: boolean;
  open: boolean;
  selected: string;
  onPick: (currency: string) => void;
  onDismiss: () => void;
  onExited: () => void;
}) {
  const tokens = useThemeTokens();
  const held = useHeldCurrencies(selected);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <Sheet
        open={open}
        onDismiss={onDismiss}
        onExited={onExited}
        size="fit"
        title="Main currency"
        note="The one you spend in day to day."
        closeLabel="Close"
      >
        <View className="gap-3.5">
          <View className="overflow-hidden rounded-card bg-card py-1.5">
            {held.map((entry, index) => {
              const picked = entry.currency === selected;
              const meta = `${entry.wallets} ${entry.wallets === 1 ? 'wallet' : 'wallets'} · ${formatMoney(entry.totalMinor, entry.currency)}`;
              return (
                <Press
                  key={entry.currency}
                  testID={tid('profile', 'currency', entry.currency)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked }}
                  accessibilityLabel={`${currencyName(entry.currency)}, ${meta}`}
                  className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
                  onPress={() => onPick(entry.currency)}
                >
                  <View
                    className={`h-[42px] w-[42px] items-center justify-center rounded-full ${PROFILE_TINT_CLASS[TINTS[index % TINTS.length]]}`}
                  >
                    <Text className="text-[15px] font-display-bold text-foreground">
                      {currencySymbol(entry.currency)}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {currencyName(entry.currency)}
                    </Text>
                    <Text
                      variant="meta"
                      className="text-muted"
                      numberOfLines={1}
                    >
                      {meta}
                    </Text>
                  </View>
                  <IconSymbol
                    name={picked ? 'radiobox-marked' : 'radiobox-blank'}
                    size={24}
                    color={picked ? tokens.foreground : tokens.muted}
                  />
                </Press>
              );
            })}
          </View>
          <View className="flex-row gap-2">
            <IconSymbol
              name="information-outline"
              size={16}
              color={tokens.muted}
            />
            <Text
              variant="meta"
              className="flex-1 text-ink-2"
            >
              Only currencies you hold a wallet in are listed. Moni never
              converts between them.
            </Text>
          </View>
        </View>
      </Sheet>
    </Modal>
  );
}
