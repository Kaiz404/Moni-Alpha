import { userPreferencesSchema } from '@repo/types';
import { View } from 'react-native';

import { ProfileRow } from '@/components/profile/profile-row';
import { ListCard } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';
import { resolveCurrencyOption } from '@/constants/currencies';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { openSheet } from '@/lib/sheet/sheet-store';
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

  const pick = async () => {
    const picked = await openSheet({ kind: 'currency', selected: main });
    if (picked && picked !== main) await saveMainCurrency(picked);
  };

  return (
    <View className="gap-2">
      <ListCard>
        <ProfileRow
          testID={tid('profile', 'main-currency')}
          icon="cash-multiple"
          tint="aqua"
          title="Main currency"
          meta={resolveCurrencyOption(main).name}
          value={main}
          strongValue
          chevron="down"
          onPress={() => void pick()}
        />
      </ListCard>
      <Text
        variant="meta"
        className="px-1 text-ink-2"
      >
        Home, Activity, Budget and Debts show this currency. Wallets in
        other currencies stay in Wallets.
      </Text>
    </View>
  );
}
