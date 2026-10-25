import { userPreferencesSchema } from '@repo/types';
import { useState } from 'react';
import { View } from 'react-native';

import { currencyName } from '@/components/profile/currency-words';
import { MainCurrencySheet } from '@/components/profile/main-currency-sheet';
import { ProfileRow } from '@/components/profile/profile-row';
import { ListCard } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { profilePreferences$ } from '@/lib/store';
import { updateProfilePreferences } from '@/lib/supabase/profile';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

/** Shows the pick at once, then writes `preferences.currency`; a failed write puts the old one back. */
async function saveMainCurrency(currency: string) {
  const previous = profilePreferences$.peek();
  profilePreferences$.set({
    ...userPreferencesSchema.parse(previous ?? {}),
    currency,
  });
  try {
    profilePreferences$.set(await updateProfilePreferences({ currency }));
  } catch {
    profilePreferences$.set(previous);
    showToast({
      text: "Couldn't change the main currency. Try again.",
      tone: 'removed',
    });
  }
}

export function MainCurrencyRow() {
  const main = useMainCurrency();
  const [sheet, setSheet] = useState<'closed' | 'open' | 'closing'>('closed');

  const pick = (currency: string) => {
    setSheet('closing');
    if (currency !== main) void saveMainCurrency(currency);
  };

  return (
    <View className="gap-2">
      <ListCard>
        <ProfileRow
          testID={tid('profile', 'main-currency')}
          icon="cash-multiple"
          tint="aqua"
          title="Main currency"
          meta={currencyName(main)}
          value={main}
          strongValue
          chevron="down"
          onPress={() => setSheet('open')}
        />
      </ListCard>
      <Text
        variant="meta"
        className="px-1 text-ink-2"
      >
        Home, Activity, Budget and Debts show this currency. Wallets in
        other currencies stay in Wallets.
      </Text>
      <MainCurrencySheet
        visible={sheet !== 'closed'}
        open={sheet === 'open'}
        selected={main}
        onPick={pick}
        onDismiss={() => setSheet('closing')}
        onExited={() => setSheet('closed')}
      />
    </View>
  );
}
