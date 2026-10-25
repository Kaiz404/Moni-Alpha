import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { View } from 'react-native';

import { PickerChip, type ChipLook } from '@/components/review/picker-chip';
import { ResultPill, type BudgetLine } from '@/components/review/result-pill';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { Press } from '@/components/ui/press';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatSignedMoney } from '@/lib/finance/format-money';
import type { EditField as EditFieldName } from '@/lib/proposals/review-card-state';
import { tid } from '@/lib/test-ids';

const FIELD = { merchant: tid('review', 'merchant'), amount: tid('review', 'amount') } as const;

/** Everything the card shows, already resolved from the store and this card's edits. */
export type ReviewCardModel = {
  proposal: ProposedTransaction;
  sourceLabel: string;
  time: string;
  /** "Needs a wallet", "Maybe a duplicate". Only facts the app knows. */
  status: { tone: 'near' | 'review'; label: string } | null;
  quote: string | null;
  merchant: string;
  amountMinor: MinorAmount;
  category: ChipLook | null;
  wallet: ChipLook | null;
  /** Transfers only: the wallet the money moves to. */
  destination: ChipLook | null | undefined;
  evidence: string | null;
  similar: boolean | null;
  budget: BudgetLine | null;
};

export type ReviewCardHandlers = {
  onEdit: (field: EditFieldName) => void;
  onCancelEdit: () => void;
  onSaveMerchant: (value: string) => void;
  onSaveAmount: (value: MinorAmount) => void;
  onPickCategory: () => void;
  onPickWallet: () => void;
  onPickDestination: () => void;
  onToggleSimilar: () => void;
};

const SOURCE: Record<
  ProposedTransaction['sourceType'],
  { icon: IconSymbolName; tint: string }
> = {
  notification: { icon: 'bell-outline', tint: 'bg-lemon' },
  text: { icon: 'creation', tint: 'bg-lilac' },
  image: { icon: 'receipt-text-outline', tint: 'bg-peach' },
};

function moneyDirection(type: ProposedTransaction['type']) {
  return type === 'income' || type === 'transfer' ? type : 'expense';
}

/** The `XA-Review` card body. The deck owns the gesture; this only draws and edits. */
export function ReviewCard({
  model,
  editing,
  handlers,
}: {
  model: ReviewCardModel;
  editing: EditFieldName | null;
  handlers: ReviewCardHandlers;
}) {
  const tokens = useThemeTokens();
  const { proposal } = model;
  const source = SOURCE[proposal.sourceType];
  const amountText = formatSignedMoney(
    moneyDirection(proposal.type),
    model.amountMinor,
    proposal.currency,
  );
  const transfer = proposal.type === 'transfer';

  return (
    <View
      className="flex-1 gap-2.5 overflow-hidden rounded-card bg-card p-[18px]"
      accessibilityLabel={`${model.merchant}, ${amountText}, from ${model.sourceLabel}`}
    >
      <View className="flex-row items-center gap-2.5">
        <View
          className={`h-9 w-9 items-center justify-center rounded-[12px] ${source.tint}`}
        >
          <IconSymbol
            name={source.icon}
            size={20}
            color={tokens.onPastel}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-[15px] leading-[20px] font-display-semibold text-foreground"
            numberOfLines={1}
          >
            {model.sourceLabel}
          </Text>
          <Text
            variant="meta"
            className="text-muted"
          >
            {model.time}
          </Text>
        </View>
        {model.status ? (
          <StatusPill
            tone={model.status.tone}
            label={model.status.label}
          />
        ) : null}
      </View>

      {model.quote ? (
        <View className="rounded-field bg-sand-light px-3 py-2">
          <Text
            className="text-[14px] leading-[20px] text-ink-2"
            numberOfLines={3}
          >
            {`“${model.quote}”`}
          </Text>
        </View>
      ) : null}

      <InPlaceGroup
        editing={editing ? FIELD[editing] : null}
        onEditingChange={(id) => {
          const field = id === FIELD.merchant ? 'merchant' : id === FIELD.amount ? 'amount' : null;
          if (field) handlers.onEdit(field);
          else handlers.onCancelEdit();
        }}
      >
        <View>
          {transfer ? null : (
            <InPlaceField
              testID={tid('review', 'merchant')}
              label="Merchant name"
              kind="text"
              required
              maxLength={40}
              value={model.merchant}
              onSave={handlers.onSaveMerchant}
            >
              {({ editable, editor }) =>
                editor ??
                editable(
                  <Text
                    variant="rowTitle"
                    className="text-foreground"
                    numberOfLines={2}
                  >
                    {model.merchant}
                  </Text>,
                  { accessibilityLabel: `Merchant ${model.merchant}. Edit name` },
                )
              }
            </InPlaceField>
          )}
          <InPlaceField
            testID={tid('review', 'amount')}
            label="Amount"
            kind="amount"
            prefix={amountText.replace(/[\d.,]/g, '')}
            value={model.amountMinor}
            onSave={handlers.onSaveAmount}
          >
            {({ editable, editor }) =>
              editor ??
              editable(
                <Text
                  className="text-[44px] leading-[50px] font-display-bold text-foreground"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {amountText}
                </Text>,
                { accessibilityLabel: `Amount ${amountText}. Edit amount` },
              )
            }
          </InPlaceField>
        </View>
      </InPlaceGroup>

      <View className="flex-row flex-wrap gap-2">
        {transfer ? null : (
          <PickerChip
            testID={tid('review', 'category')}
            look={model.category}
            tinted
            accessibilityLabel={`Category ${model.category?.name ?? 'none'}. Change category`}
            onPress={handlers.onPickCategory}
          />
        )}
        <PickerChip
          testID={tid('review', 'wallet')}
          look={model.wallet}
          accessibilityLabel={model.wallet ? `Wallet ${model.wallet.name}. Change wallet` : 'Pick a wallet'}
          onPress={handlers.onPickWallet}
        />
        {transfer ? (
          <PickerChip
            testID={tid('review', 'destination')}
            look={model.destination ?? null}
            accessibilityLabel={
              model.destination
                ? `Moves to ${model.destination.name}. Change wallet`
                : 'Pick a wallet'
            }
            onPress={handlers.onPickDestination}
          />
        ) : null}
      </View>

      {model.evidence ? (
        <View className="flex-row gap-2">
          <IconSymbol
            name="creation"
            size={16}
            color={tokens.deepMint}
          />
          <Text
            variant="meta"
            className="min-w-0 flex-1 text-ink-2"
            numberOfLines={3}
          >
            {model.evidence}
          </Text>
        </View>
      ) : null}

      {model.similar !== null ? (
        <Press
          testID={tid('review', 'similar')}
          onPress={handlers.onToggleSimilar}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: model.similar }}
          accessibilityLabel="Don't ask about similar"
          pressedScale={1}
          radius={{ rest: 12, pressed: 12 }}
          className="-ml-1 min-h-11 flex-row items-center gap-2.5 self-start pl-1 pr-2"
        >
          <View
            className={`h-[22px] w-[22px] items-center justify-center rounded-[6px] border-2 border-foreground ${model.similar ? 'bg-primary' : ''}`}
          >
            {model.similar ? (
              <IconSymbol
                name="check"
                size={16}
                color={tokens.primaryForeground}
              />
            ) : null}
          </View>
          <Text className="text-[15px] leading-[20px] font-display-semibold text-foreground">
            Don&apos;t ask about similar
          </Text>
        </Press>
      ) : null}

      {model.budget ? <ResultPill line={model.budget} /> : null}
    </View>
  );
}
