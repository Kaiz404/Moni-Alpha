import { aiUseSchema, type AiUse } from '@repo/types';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AiTag } from '@/components/ui/ai-tag';
import { Button } from '@/components/ui/button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { notNow, turnOnFor, UNASKED } from '@repo/core';
import { changeAiConsent, useAiConsent } from '@/lib/ai/consent/state';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

/** Where "Turn on" goes when the page stood in front of a capture page. */
const CAPTURE_PAGE: Partial<Record<AiUse, Href>> = {
  add: '/capture/say',
  receipts: '/capture/scan',
};

const SENT: { icon: IconSymbolName; title: string; meta: string }[] = [
  { icon: 'bell-outline', title: 'The text of a bank alert', meta: 'When your bank tells you about a payment' },
  { icon: 'receipt-text-outline', title: 'A receipt photo', meta: 'Only one you snap and send to Moni' },
  { icon: 'message-text-outline', title: 'What you type or say to Moni', meta: 'A line in Moni chat, or Say it' },
];

/**
 * "Moni's AI, your choice" (W2-Onboarding step 2, on the phone). It stands in front of the first
 * AI use: a chat message, Scan, Say it, or an alert waiting for AI. Nothing reaches an AI
 * provider until the user turns it on here or in Profile › Moni's AI. Back counts as Not now.
 */
export default function AiConsentScreen() {
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ use?: string; open?: string }>();
  const use = aiUseSchema.catch('chat').parse(params.use);
  const consent = useAiConsent() ?? UNASKED;
  const [saving, setSaving] = useState(false);

  const decline = () => {
    void changeAiConsent(notNow(consent)).catch(() => {});
    router.back();
  };

  const accept = async () => {
    setSaving(true);
    try {
      await changeAiConsent(turnOnFor(consent, use));
    } catch {
      setSaving(false);
      showToast({ text: "Couldn't save the change. Check your connection." });
      return;
    }
    void startBackgroundProcessor().catch(() => {});
    const next = params.open === '1' ? CAPTURE_PAGE[use] : undefined;
    if (next) router.replace(next);
    else router.back();
  };

  return (
    <Page
      screen="ai"
      kind="pushed"
      title="Moni's AI, your choice"
      titleTag={<AiTag />}
      onBack={decline}
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-4"
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="body"
          className="text-ink-2"
        >
          {"Moni's AI turns a bank alert or a receipt into a transaction, and answers you in Moni chat. Nothing goes to it until you say yes."}
        </Text>

        <View className="gap-2">
          <Text
            variant="caps"
            className="px-1 text-muted"
            accessibilityRole="header"
          >
            {"What gets sent, only when it's on"}
          </Text>
          <ListCard>
            {SENT.map((row) => (
              <View
                key={row.icon}
                className="min-h-[62px] flex-row items-center gap-3.5 px-[18px] py-2.5"
              >
                <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
                  <IconSymbol
                    name={row.icon}
                    size={20}
                    color={tokens.foreground}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    variant="rowTitle"
                    className="text-foreground"
                  >
                    {row.title}
                  </Text>
                  <Text
                    variant="meta"
                    className="text-muted"
                  >
                    {row.meta}
                  </Text>
                </View>
              </View>
            ))}
          </ListCard>
        </View>

        <View className="flex-row gap-3 rounded-card bg-pending-fill px-[18px] py-3.5">
          <IconSymbol
            name="shield-check-outline"
            size={20}
            color={tokens.onLilac}
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              variant="rowTitle"
              className="text-on-lilac"
            >
              Read by OpenRouter, an AI service in the US
            </Text>
            <Text
              variant="meta"
              className="text-on-lilac"
            >
              It passes it to the AI model that reads it and sends back the transaction. Neither keeps
              it or trains on it.
            </Text>
          </View>
        </View>

        <Text
          variant="meta"
          className="px-1 text-ink-2"
        >
          Without it, typing a transaction, CSV import, budgets and debts still work. Bank alerts and
          receipts need it to become transactions.
        </Text>
      </PageScroll>

      <View className="gap-2 px-5 pb-3 pt-2">
        <Button
          testID={tid('ai', 'consent', 'turn-on')}
          variant="primary"
          label="Turn on Moni's AI"
          loading={saving}
          onPress={() => void accept()}
        />
        <Button
          testID={tid('ai', 'consent', 'not-now')}
          variant="secondary"
          label="Not now"
          disabled={saving}
          onPress={decline}
        />
        <Text
          variant="smallest"
          className="px-2 pt-1 text-center text-muted"
        >
          {"Either way, your alerts and transactions are stored in Moni's cloud database."}
        </Text>
      </View>
    </Page>
  );
}
