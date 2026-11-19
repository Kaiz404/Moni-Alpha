import { useValue } from '@legendapp/state/react';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { ExportDataRow } from '@/components/profile/export-data-row';
import { ImportDataRow } from '@/components/profile/import-data-row';
import { MainCurrencyRow } from '@/components/profile/main-currency-row';
import { MoniToneRow } from '@/components/profile/moni-tone-row';
import {
  ProfileRow,
  type ProfileTint,
} from '@/components/profile/profile-row';
import {
  usePhoneAccess,
  type PhoneAccessId,
  type AccessState,
} from '@/components/capture-sources/use-phone-access';
import { useMerchantNames } from '@/components/merchants/use-merchant-names';
import { Button } from '@/components/ui/button';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { ListCard } from '@/components/ui/list-card';
import { NavRow } from '@/components/ui/nav-row';
import { Page, PageScroll } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAiConsent } from '@/lib/ai/consent/state';
import { useAuth } from '@/lib/auth/auth-context';
import { userPhotoUrl } from '@/lib/auth/user-photo';
import { openSheet } from '@/lib/sheet/sheet-store';
import { categoriesForUser$, walletsForUser$ } from '@/lib/finance/selectors';
import { tid } from '@/lib/test-ids';
import { switchTheme } from '@/lib/theme/reveal';
import { showToast } from '@/lib/toast/toast-store';

function displayName(user: User | null): string {
  const meta = user?.user_metadata ?? {};
  const named = [meta.display_name, meta.full_name, meta.name].find(
    (value): value is string =>
      typeof value === 'string' && value.trim() !== '',
  );
  return named?.trim() ?? user?.email?.split('@')[0] ?? '';
}

/** A bell off and the attention bubble when notification access is off. The title stays one line. */
function captureSourcesTint(access: Record<PhoneAccessId, AccessState>): ProfileTint {
  switch (access.notifications) {
    case 'on':
      return 'mint';
    case 'off':
    case 'not_set_up':
      return 'attention';
    case 'unavailable':
    case 'checking':
      return 'sand';
  }
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

/**
 * One round button flips light and dark, and the new theme opens as a circle from the finger. A plain
 * tap, not a sliding control: the screenshot under the circle never catches a control mid-slide.
 */
function ThemeButton() {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  return (
    <HeaderIconButton
      testID={tid('profile', 'theme')}
      icon={dark ? 'white-balance-sunny' : 'weather-night'}
      accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        void switchTheme(dark ? 'light' : 'dark', { x: pageX, y: pageY });
      }}
    />
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const name = displayName(user);
  const google = user?.app_metadata?.provider === 'google';
  const { access } = usePhoneAccess();
  const sourcesTint = captureSourcesTint(access);
  const merchants = useMerchantNames();
  const aiConsent = useAiConsent();
  const aiOn = aiConsent?.kind === 'answered' && aiConsent.on;

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

  const handleDeleteAccount = async () => {
    if (!(await openSheet({ kind: 'deleteAccount', userId }))) return;
    await handleSignOut();
    showToast({ text: 'Your account is deleted' });
  };

  return (
    <Page
      headerScrolls
      screen="profile"
      kind="pushed"
      title="Profile"
      trailing={<ThemeButton />}
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="flex-row items-center gap-3.5"
          accessible
          accessibilityLabel={[
            name,
            user?.email,
            google ? 'Google' : null,
          ]
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

        <Section label="MONEY">
          <ProfileRow
            testID={tid('profile', 'row', 'wallets')}
            icon="wallet"
            tint="lemon"
            title="Wallets"
            value={String(wallets.length)}
            chevron="right"
            onPress={() => router.push('/wallets')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'categories')}
            icon="tag-outline"
            tint="lilac"
            title="Categories"
            value={String(categoryCount)}
            chevron="right"
            onPress={() => router.push('/categories')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'merchant-names')}
            icon="store-edit-outline"
            tint="peach"
            title="Merchants"
            value={`${merchants.named.length} named`}
            chevron="right"
            onPress={() => router.push('/merchants')}
          />
        </Section>

        <Section label="MONI CHAT">
          <MoniToneRow />
        </Section>

        <Section label="ON THE WEB">
          <ProfileRow
            testID={tid('profile', 'row', 'scan-sign-in')}
            icon="qrcode-scan"
            tint="aqua"
            title="Scan to sign in"
            chevron="right"
            onPress={() => router.push('/sign-in/scan')}
          />
        </Section>

        <Section label="PRIVACY AND DATA">
          <ProfileRow
            testID={tid('profile', 'row', 'moni-ai')}
            icon="creation"
            tint="lilac"
            title="Moni's AI"
            value={aiOn ? 'On' : 'Off'}
            chevron="right"
            onPress={() => router.push('/moni-ai')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'capture-sources')}
            icon={
              sourcesTint === 'attention'
                ? 'bell-off-outline'
                : 'bell-outline'
            }
            tint={sourcesTint}
            title="Permissions"
            chevron="right"
            onPress={() => router.push('/capture-sources')}
          />
          <ProfileRow
            testID={tid('profile', 'row', 'capture-log')}
            icon="cellphone-message"
            tint="lilac"
            title="Capture log"
            chevron="right"
            onPress={() => router.push('/capture-log')}
          />
          <ExportDataRow userId={userId} />
          <ImportDataRow />
          <ProfileRow
            testID={tid('profile', 'row', 'delete-account')}
            icon="account-remove-outline"
            tint="peach"
            title="Delete your account"
            over
            chevron="down"
            onPress={() => void handleDeleteAccount()}
          />
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
      </PageScroll>
    </Page>
  );
}
