import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { useExportCsv } from '@/components/profile/export-data-row';
import { Button } from '@/components/ui/button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Page, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { deleteAccount } from '@/lib/auth/account-functions';
import { useAuth } from '@/lib/auth/auth-context';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

// W2-Parts "Delete your account": what goes, in the board's words and icons.
const DELETED: { icon: IconSymbolName; text: string }[] = [
  { icon: 'receipt-text', text: 'Transactions, wallets and balances' },
  { icon: 'chart-box', text: 'Budgets, debts, rules and merchant names' },
  { icon: 'bell-outline', text: "Captures and the alert text stored in Moni's cloud database" },
  { icon: 'camera-outline', text: 'Receipt photos' },
  { icon: 'message-outline', text: 'Moni chat history' },
  { icon: 'account-outline', text: 'Your sign-in, on every device' },
];

/** DELETE in any letter case, pasted or typed, with stray spaces. */
function confirmsDeletion(typed: string): boolean {
  return typed.trim().toUpperCase() === 'DELETE';
}

export default function DeleteAccountScreen() {
  const tokens = useThemeTokens();
  const { user, signOut } = useAuth();
  const exportCsv = useExportCsv(user?.id ?? null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const confirmed = confirmsDeletion(typed);

  const remove = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setFailure(null);
    const result = await deleteAccount();
    if (result.kind !== 'ok') {
      setDeleting(false);
      setFailure(
        result.kind === 'unreachable'
          ? "Couldn't reach Moni. Check your connection and try again."
          : `Couldn't delete your account. ${result.message}`,
      );
      return;
    }
    await signOut();
    router.replace('/(auth)/login');
    showToast({ text: 'Your account is deleted' });
  };

  return (
    <Page
      headerScrolls
      screen="profile"
      kind="pushed"
      title="Delete your account"
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3">
          <Text
            variant="caps"
            className="px-1 text-muted"
            accessibilityRole="header"
          >
            WHAT IS DELETED
          </Text>
          {DELETED.map((item) => (
            <View
              key={item.text}
              className="flex-row items-start gap-3 px-1"
            >
              <IconSymbol
                name={item.icon}
                size={20}
                color={tokens.ink2}
              />
              <Text
                variant="body"
                className="flex-1 text-foreground"
              >
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-row items-center gap-3 rounded-tile bg-card px-3.5 py-3">
          <IconSymbol
            name="download"
            size={20}
            color={tokens.foreground}
          />
          <Text
            variant="body"
            className="flex-1 text-foreground"
          >
            Keep a copy first: a CSV of every transaction.
          </Text>
          <Press
            testID={tid('profile', 'delete', 'export')}
            onPress={() => void exportCsv.share()}
            disabled={exportCsv.busy}
            accessibilityLabel="Export data"
            accessibilityHint="Opens the share sheet"
            accessibilityState={{ busy: exportCsv.busy }}
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName="bg-sand-light"
            className="h-11 justify-center border-[1.5px] border-hairline px-3.5"
          >
            <Text className="text-[15px] leading-5 font-display-semibold text-foreground">Export data</Text>
          </Press>
        </View>

        <Text
          variant="body"
          className="px-1 text-ink-2"
        >
          {"It goes at once and can't be undone. Copies in Moni's backups are gone within 7 days."}
        </Text>

        <AuthField
          testID={tid('profile', 'delete', 'confirm')}
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={() => void remove()}
        />

        {failure ? (
          <Text
            variant="body"
            className="px-1 text-over"
            accessibilityLiveRegion="polite"
          >
            {failure}
          </Text>
        ) : null}

        <View className="flex-row gap-2.5">
          <Button
            testID={tid('profile', 'delete', 'cancel')}
            variant="secondary"
            label="Cancel"
            onPress={() => router.back()}
          />
          <Button
            testID={tid('profile', 'delete', 'submit')}
            variant="destructive"
            icon="delete-outline"
            label="Delete my account"
            loadingLabel="Deleting"
            loading={deleting}
            disabled={!confirmed}
            onPress={() => void remove()}
            className="flex-1"
          />
        </View>
      </PageScroll>
    </Page>
  );
}
