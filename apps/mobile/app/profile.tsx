import { useValue } from '@legendapp/state/react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { currencyHeldIn } from '@/components/profile/currency-words';
import { ExportDataRow } from '@/components/profile/export-data-row';
import { ImportDataRow } from '@/components/profile/import-data-row';
import { MainCurrencyRow } from '@/components/profile/main-currency-row';
import {
  ProfileRow,
  type ProfileTint,
} from '@/components/profile/profile-row';
import {
  accessSummary,
  usePhoneAccess,
  type PhoneAccessId,
  type AccessState,
} from '@/components/capture-sources/use-phone-access';
import { useMerchantNames } from '@/components/merchants/use-merchant-names';
import { Button } from '@/components/ui/button';
import { ListCard } from '@/components/ui/list-card';
import { NavRow } from '@/components/ui/nav-row';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/lib/auth/auth-context';
import { userPhotoUrl } from '@/lib/auth/user-photo';
import {
  categoriesForUser$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { tid } from '@/lib/test-ids';
import {
  getThemePreference,
  setThemePreference,
  THEME_PREFERENCE_OPTIONS,
  type ThemePreference,
} from '@/lib/theme/preference';

/**
 * Lets the pill's spring start on the UI thread before the recolour takes the JS thread. Hidden
 * screens are frozen, so only this page recolours now, and a longer wait just reads as lag.
 */
const THEME_AFTER_PILL_MS = 50;

function displayName(user: User | null): string {
  const meta = user?.user_metadata ?? {};
  const named = [meta.display_name, meta.full_name, meta.name].find(
    (value): value is string =>
      typeof value === 'string' && value.trim() !== '',
  );
  return named?.trim() ?? user?.email?.split('@')[0] ?? '';
}

function walletsMeta(currencies: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const currency of currencies) {
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([currency, count]) => `${count} in ${currencyHeldIn(currency)}`)
    .join(' · ');
}

/** Reading alerts is what the page is for, so that state speaks for the whole row. */
function captureSourcesRow(access: Record<PhoneAccessId, AccessState>): {
  meta: string;
  tint: ProfileTint;
} {
  switch (access.notifications) {
    case 'on':
      return { meta: 'Notifications on', tint: 'mint' };
    case 'off':
    case 'not_set_up':
      return { meta: 'Notifications off', tint: 'attention' };
    case 'unavailable':
      return { meta: accessSummary(access), tint: 'sand' };
    case 'checking':
      // Holds the second line, so the title does not jump when the read lands.
      return { meta: 'Notifications', tint: 'sand' };
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text
        variant="caps"
        className="px-1 text-muted"
        accessibilityRole="header"
      >
        {label}
      </Text>
      <ListCard>{children}</ListCard>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const name = displayName(user);
  const google = user?.app_metadata?.provider === 'google';
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const themeFlip = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { access } = usePhoneAccess();
  const sources = captureSourcesRow(access);
  const merchants = useMerchantNames();

  const wallets = useValue(walletsForUser$(userId));
  const categoryCount = useValue(
    () =>
      categoriesForUser$(userId)
        .get()
        .filter((category) => category.isActive).length,
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Page
      screen="profile"
      kind="pushed"
      title="Profile"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="flex-row items-center gap-3.5"
          accessible
          accessibilityLabel={[name, user?.email, google ? 'Google' : null]
            .filter(Boolean)
            .join(', ')}
        >
          <UserAvatar
            initial={(name.charAt(0) || '?').toUpperCase()}
            photoUrl={userPhotoUrl(user)}
            size="profile"
          />
          <View className="min-w-0 flex-1">
            <Text
              variant="sectionTitle"
              className="text-foreground"
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text
              variant="body"
              className="text-ink-2"
              numberOfLines={1}
            >
              {google ? `${user?.email} · Google` : user?.email}
            </Text>
          </View>
        </View>

        <MainCurrencyRow />

        <View className="gap-2">
          <Text
            variant="caps"
            className="px-1 text-muted"
            accessibilityRole="header"
          >
            APPEARANCE
          </Text>
          <Segmented
            screen="profile"
            name="appearance"
            accessibilityLabel="Appearance"
            options={THEME_PREFERENCE_OPTIONS}
            value={theme}
            onChange={(next) => {
              setTheme(next);
              clearTimeout(themeFlip.current);
              themeFlip.current = setTimeout(
                () => setThemePreference(next),
                THEME_AFTER_PILL_MS,
              );
            }}
          />
        </View>

        <Section label="MONEY">
          <ProfileRow
            testID={tid('profile', 'row', 'wallets')}
            icon="wallet"
            tint="lemon"
            title="Wallets"
            meta={walletsMeta(wallets.map((wallet) => wallet.currency))}
            value={String(wallets.length)}
            chevron="right"
            onPress={() => router.push('/wallets')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'categories')}
            icon="tag-outline"
            tint="lilac"
            title="Categories"
            meta="Rename or add your own"
            value={String(categoryCount)}
            chevron="right"
            onPress={() => router.push('/categories')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'merchant-names')}
            icon="store-edit-outline"
            tint="peach"
            title="Merchant names"
            meta={
              merchants.toName.length
                ? plural(merchants.toName.length, 'bank code to name', 'bank codes to name')
                : 'Name the codes banks send'
            }
            value={`${merchants.named.length} named`}
            chevron="right"
            onPress={() => router.push('/merchants')}
          />
        </Section>

        <Section label="PRIVACY AND DATA">
          <ProfileRow
            testID={tid('profile', 'row', 'capture-sources')}
            icon={sources.tint === 'attention' ? 'bell-off-outline' : 'bell-outline'}
            tint={sources.tint}
            title="Capture sources"
            meta={sources.meta}
            chevron="right"
            onPress={() => router.push('/capture-sources')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'capture-log')}
            icon="cellphone-message"
            tint="lilac"
            title="Capture log"
            meta="Every alert Moni read, and what it did"
            chevron="right"
            onPress={() => router.push('/capture-log')}
          />
          <ExportDataRow userId={userId} />
          <ImportDataRow />
        </Section>

        {__DEV__ ? (
          <Section label="DEVELOPER">
            <NavRow
              testID={tid('profile', 'row', 'debug')}
              icon="bug-outline"
              title="Debug panel"
              onPress={() => router.push('/debug')}
            />
          </Section>
        ) : null}

        <Button
          testID={tid('profile', 'sign-out')}
          variant="secondary"
          icon="logout"
          label="Sign out"
          onPress={() => void handleSignOut()}
        />
      </ScrollView>
    </Page>
  );
}
