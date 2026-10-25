import { useValue } from '@legendapp/state/react';
import type { MinorAmount } from '@repo/types';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FieldBubble } from '@/components/capture/field-bubble';
import { CategoryIcon } from '@/components/categories/category-icon';
import { Button } from '@/components/ui/button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { Page } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Text } from '@/components/ui/text';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { amountSentence } from '@/lib/capture/amount-sentence';
import type {
  CaptureDraft,
  CaptureQuote,
} from '@/lib/capture/capture-stage';
import { dayAndTime } from '@/lib/capture/clock-time';
import {
  isoToLocalDateInput,
  localDateInputToIso,
  toLocalDateInput,
} from '@/lib/dates/local-date-input';
import {
  currencySymbol,
  formatSignedMoney,
} from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import {
  budgetProgress$,
  categoriesForUser$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { tid, type TestId } from '@/lib/test-ids';

type CaptureResultProps = {
  quote: CaptureQuote;
  draft: CaptureDraft;
  onEdit: (patch: Partial<CaptureDraft>) => void;
  /** Say again, or Retake. */
  again: { label: string; icon: IconSymbolName; onPress: () => void };
  onApprove: () => void;
  approving: boolean;
};

/**
 * The check page after Say it or Scan a receipt (V2A-CaptureSayHeard,
 * V2A-CaptureScanAdded): shop and amount edit in place, category, wallet and
 * date open pickers, one line of evidence, and Approve adds it to the ledger.
 */
export function CaptureResult({
  quote,
  draft,
  onEdit,
  again,
  onApprove,
  approving,
}: CaptureResultProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const [editing, setEditing] = useState<TestId | null>(null);
  const wallets = useValue(walletsForUser$(userId)).filter(
    (wallet) => wallet.currency === currency,
  );
  const categories = useValue(categoriesForUser$(userId)).filter(
    (category) => category.isActive && category.type === draft.kind,
  );
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(userId, timezone));

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  const category = categories.find((item) => item.id === draft.categoryId);
  const wallet = wallets.find((item) => item.id === draft.walletId);
  const row = progress.find(
    (item) =>
      item.categoryId === draft.categoryId && item.currency === currency,
  );
  const sentence =
    draft.kind === 'expense'
      ? amountSentence({
          kind: 'expense',
          amountMinor: draft.amountMinor,
          currency,
          category: category
            ? {
                name: category.name,
                budgetMinor: row?.budgetAmountMinor ?? null,
                spentMinor: row?.spentMinor ?? (0 as MinorAmount),
              }
            : null,
        })
      : null;
  const voice = quote.source === 'voice';
  const amountText = formatSignedMoney(
    draft.kind,
    draft.amountMinor,
    currency,
  );

  const pickCategory = async () => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency,
      categories: toCategoryTiles(categories, progress, currency),
      selectedId: draft.categoryId,
    });
    if (picked) onEdit({ categoryId: picked });
  };

  const pickWallet = async () => {
    const picked = await openSheet({
      kind: 'wallet',
      title: draft.kind === 'income' ? 'Paid into' : 'Paid with',
      wallets: wallets.map((item) => ({
        id: item.id,
        name: item.name,
        currency: item.currency,
        type: item.type,
        icon: item.icon,
        color: item.color,
        cardStyleId: item.cardStyleId,
      })),
      selectedId: draft.walletId,
    });
    if (picked?.walletId) onEdit({ walletId: picked.walletId });
  };

  const pickDate = async () => {
    const picked = await openSheet({
      kind: 'date',
      selected: isoToLocalDateInput(draft.transactionDate),
    });
    if (!picked) return;
    onEdit({
      transactionDate:
        picked === toLocalDateInput(new Date())
          ? new Date().toISOString()
          : (localDateInputToIso(picked) ?? draft.transactionDate),
    });
  };

  return (
    <Page
      screen="capture"
      kind="task"
      title="Check and approve"
    >
      <InPlaceGroup
        editing={editing}
        onEditingChange={setEditing}
      >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-5 pb-3"
        keyboardShouldPersistTaps="handled"
      >
        {voice ? (
          <View className="flex-row gap-2.5 rounded-field bg-sand px-3.5 py-3">
            <IconSymbol
              name="microphone"
              size={18}
              color={tokens.foreground}
            />
            <Text
              testID={tid('capture', 'quote')}
              variant="body"
              className="flex-1 text-foreground"
            >
              {`“${quote.text}”`}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-3 pt-1">
          {quote.source === 'camera' ? (
            <Image
              source={{ uri: quote.imageUri }}
              contentFit="cover"
              accessibilityLabel="The scanned receipt"
              style={{ width: 52, height: 64, borderRadius: 12 }}
            />
          ) : (
            <View
              className="h-[52px] w-[52px] items-center justify-center rounded-full"
              style={{ backgroundColor: category?.color ?? tokens.sand }}
            >
              <CategoryIcon
                icon={category?.icon ?? null}
                size={24}
                color={tokens.onPastel}
              />
            </View>
          )}
          <View className="min-w-0 flex-1 gap-0.5">
            <InPlaceField
              testID={tid('capture', 'shop')}
              label="Shop"
              kind="text"
              required
              value={draft.merchant}
              onSave={(merchant) => onEdit({ merchant })}
            >
              {({ editable, editor }) =>
                editor ?? (
                  <>
                    {editable(
                      <Text
                        variant="sectionTitle"
                        className="text-foreground"
                        numberOfLines={1}
                      >
                        {draft.merchant || 'Add a shop'}
                      </Text>,
                    )}
                    <Text
                      variant="meta"
                      className="text-muted"
                    >
                      {voice
                        ? `${dayAndTime(draft.transactionDate)} · Voice`
                        : 'Receipt'}
                    </Text>
                  </>
                )
              }
            </InPlaceField>
          </View>
        </View>
        <View className="py-2">
          <InPlaceField
            testID={tid('capture', 'amount')}
            label="Amount"
            kind="amount"
            prefix={`${draft.kind === 'expense' ? '−' : '+'}${currencySymbol(currency)}`}
            value={draft.amountMinor > 0 ? draft.amountMinor : null}
            onSave={(amountMinor) => onEdit({ amountMinor })}
          >
            <Text
              testID={tid('capture', 'result', 'amount')}
              variant="amountHero"
              className={
                draft.kind === 'income'
                  ? 'text-deep-mint'
                  : 'text-foreground'
              }
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountText}
            </Text>
          </InPlaceField>
        </View>
        <PickerField
          testID={tid('capture', 'result', 'category')}
          label="Category"
          value={category?.name ?? ''}
          leading={
            category ? (
              <FieldBubble color={category.color ?? tokens.card}>
                <CategoryIcon
                  icon={category.icon}
                  size={18}
                  color={tokens.onPastel}
                />
              </FieldBubble>
            ) : undefined
          }
          onPress={() => void pickCategory()}
        />
        <View className="flex-row gap-2">
          <PickerField
            testID={tid('capture', 'result', 'wallet')}
            className="flex-1"
            label={draft.kind === 'income' ? 'Into' : 'Paid with'}
            value={wallet?.name ?? ''}
            leading={
              wallet ? (
                <FieldBubble color={wallet.color ?? tokens.card}>
                  <WalletIcon
                    icon={wallet.icon}
                    type={wallet.type}
                    size={18}
                    color={tokens.onPastel}
                  />
                </FieldBubble>
              ) : undefined
            }
            onPress={() => void pickWallet()}
          />
          <PickerField
            testID={tid('capture', 'result', 'date')}
            className="flex-1"
            label="Date"
            value={dayAndTime(draft.transactionDate)}
            onPress={() => void pickDate()}
          />
        </View>
        <View className="flex-row gap-2.5 pt-2">
          <IconSymbol
            name="creation"
            size={16}
            color={tokens.foreground}
          />
          <View className="flex-1 gap-1">
            <Text
              testID={tid('capture', 'evidence')}
              variant="meta"
              className="text-ink-2"
            >
              {draft.evidence}
            </Text>
            {sentence ? (
              <Text
                variant="meta"
                className={
                  sentence.tone === 'over' ? 'text-over' : 'text-ink-2'
                }
              >
                {sentence.text}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
      </InPlaceGroup>
      <View className="flex-row gap-2 px-5 pb-3">
        <Button
          testID={tid('capture', 'again')}
          className="flex-[0.75]"
          pinned
          variant="secondary"
          icon={again.icon}
          label={again.label}
          onPress={again.onPress}
        />
        <Button
          testID={tid('capture', 'approve')}
          className="flex-1"
          pinned
          variant="approve"
          icon="check"
          label="Approve"
          loading={approving}
          loadingLabel="Adding"
          disabled={!draft.walletId || draft.amountMinor <= 0 || !!editing}
          onPress={onApprove}
        />
      </View>
    </Page>
  );
}
