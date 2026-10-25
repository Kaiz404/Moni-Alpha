import { useValue } from '@legendapp/state/react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { currencyHeldIn } from '@/components/profile/currency-words';
import { ExportDataRow } from '@/components/profile/export-data-row';
import { MainCurrencyRow } from '@/components/profile/main-currency-row';
import {
  ProfileRow,
  type ProfileTint,
} from '@/components/profile/profile-row';
import {
  usePhoneAccess,
  type AccessState,
} from '@/components/capture-sources/use-phone-access';
import { useLinkedApps } from '@/components/capture-sources/use-linked-apps';
import { useMerchantNames } from '@/components/merchants/use-merchant-names';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { NavRow } from '@/components/ui/nav-row';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
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

const ACCESS_WORD: Record<AccessState, string | undefined> = {
  checking: undefined,
  on: 'On',
  off: 'Off',
  not_set_up: 'Not set up',
  unavailable: 'Off',
};

/** A source's bubble is Mint while it is on and Sand otherwise. */
function accessTint(state: AccessState): ProfileTint {
  return state === 'on' ? 'mint' : 'sand';
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Section({
  label,
  link,
  children,
}: {
  label: string;
  link?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="min-h-6 flex-row items-center justify-between px-1">
        <Text
          variant="caps"
          className="text-muted"
          accessibilityRole="header"
        >
          {label}
        </Text>
        {link}
      </View>
      <ListCard>{children}</ListCard>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const tokens = useThemeTokens();
  const userId = user?.id ?? null;
  const name = displayName(user);
  const google = user?.app_metadata?.provider === 'google';
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const { access } = usePhoneAccess();
  const { apps } = useLinkedApps();
  const merchants = useMerchantNames();

  const wallets = useValue(walletsForUser$(userId));
  const categoryCount = useValue(
    () =>
      categoriesForUser$(userId)
        .get()
        .filter((category) => category.isActive).length,
  );

  const openSources = () => router.push('/capture-sources');

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
          <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-mint">
            <Text className="text-[24px] leading-[28px] font-display-bold text-on-pastel">
              {(name.charAt(0) || '?').toUpperCase()}
            </Text>
          </View>
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
              setThemePreference(next);
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

        <Section
          label="CAPTURE SOURCES"
          link={
            <Press
              testID={tid('profile', 'set-up')}
              onPress={openSources}
              accessibilityLabel="Set up capture sources"
              className="-my-2.5 min-h-11 flex-row items-center gap-0.5 rounded-full pl-2"
            >
              <Text className="text-[15px] leading-5 font-display-semibold text-deep-mint">
                Set up
              </Text>
              <IconSymbol
                name="chevron-right"
                size={18}
                color={tokens.deepMint}
              />
            </Press>
          }
        >
          <ProfileRow
            testID={tid('profile', 'row', 'bank-notifications')}
            icon="bell-outline"
            tint={accessTint(access.notifications)}
            title="Bank notifications"
            meta={plural(apps.length, 'linked app', 'linked apps')}
            value={ACCESS_WORD[access.notifications]}
            chevron="right"
            onPress={openSources}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'location')}
            icon="map-marker"
            tint={accessTint(access.location)}
            title="Location"
            meta="From notifications"
            value={ACCESS_WORD[access.location]}
            chevron="right"
            onPress={openSources}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'camera')}
            icon="camera-outline"
            tint={accessTint(access.camera)}
            title="Camera"
            meta="Scan receipts"
            value={ACCESS_WORD[access.camera]}
            chevron="right"
            onPress={openSources}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'microphone')}
            icon="microphone"
            tint={accessTint(access.microphone)}
            title="Microphone"
            meta="Say it instead of typing"
            value={ACCESS_WORD[access.microphone]}
            chevron="right"
            onPress={openSources}
          />
        </Section>

        <Section label="PRIVACY AND DATA">
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
