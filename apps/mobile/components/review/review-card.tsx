import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { CategoryIcon } from '@/components/categories/category-icon';
import { EditableValue, EditField } from '@/components/review/in-place-edit';
import { ResultPill, type BudgetLine } from '@/components/review/result-pill';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatSignedMoney } from '@/lib/finance/format-money';
import type { EditField as EditFieldName } from '@/lib/proposals/review-card-state';
import { tid } from '@/lib/test-ids';

export type ChipLook = { name: string; icon: string | null; color: string | null };

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
  onSaveAmount: (value: string) => void;
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

function PickerChip({
  name,
  look,
  label,
  tinted = false,
  onPress,
}: {
  name: string;
  look: ChipLook | null;
  label: string;
  /** The category chip takes its category's tint; wallet chips stay Sand. */
  tinted?: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  if (!look) {
    return (
      <Press
        testID={tid('review', name)}
        onPress={onPress}
        accessibilityLabel={label}
        radius={{ rest: 22, pressed: 16 }}
        className="h-11 flex-row items-center gap-1.5 bg-lemon pl-3 pr-2.5"
      >
        <IconSymbol
          name="wallet-outline"
          size={18}
          color={tokens.onPastel}
        />
        <Text className="text-[14px] leading-[19px] font-display-bold text-on-pastel">
          Pick a wallet
        </Text>
        <IconSymbol
          name="chevron-down"
          size={16}
          color={tokens.onPastel}
        />
      </Press>
    );
  }
  return (
    <Press
      testID={tid('review', name)}
      onPress={onPress}
      accessibilityLabel={label}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 min-w-0 shrink flex-row items-center gap-1 bg-sand pl-1.5 pr-2"
      style={
        tinted && look.color
          ? { backgroundColor: `${look.color}${dark ? '38' : '73'}` }
          : undefined
      }
    >
      <View
        className="h-7 w-7 items-center justify-center rounded-full bg-card"
        style={look.color ? { backgroundColor: look.color } : undefined}
      >
        <CategoryIcon
          icon={look.icon}
          color={look.color ? tokens.onPastel : tokens.foreground}
          size={16}
        />
      </View>
      <Text
        className="min-w-0 shrink text-[14px] leading-[19px] font-display-semibold text-foreground"
        numberOfLines={1}
      >
        {look.name}
      </Text>
      <IconSymbol
        name="chevron-down"
        size={16}
        color={tokens.foreground}
      />
    </Press>
  );
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

      <View>
        {editing === 'merchant' ? (
          <EditField
            field="merchant"
            initial={model.merchant}
            onCancel={handlers.onCancelEdit}
            onSave={handlers.onSaveMerchant}
          />
        ) : transfer ? null : (
          <EditableValue
            field="merchant"
            label={`Merchant ${model.merchant}. Edit name`}
            showPencil={!editing}
            onEdit={() => handlers.onEdit('merchant')}
          >
            <Text
              variant="rowTitle"
              className="text-foreground"
              numberOfLines={2}
            >
              {model.merchant}
            </Text>
          </EditableValue>
        )}
        {editing === 'amount' ? (
          <EditField
            field="amount"
            initial={(Number(model.amountMinor) / 100).toFixed(2)}
            prefix={amountText.replace(/[\d.,]/g, '')}
            onCancel={handlers.onCancelEdit}
            onSave={handlers.onSaveAmount}
          />
        ) : (
          <EditableValue
            field="amount"
            label={`Amount ${amountText}. Edit amount`}
            showPencil={!editing}
            onEdit={() => handlers.onEdit('amount')}
          >
            <Text
              className="text-[44px] leading-[50px] font-display-bold text-foreground"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {amountText}
            </Text>
          </EditableValue>
        )}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {transfer ? null : (
          <PickerChip
            name="category"
            look={model.category}
            tinted
            label={`Category ${model.category?.name ?? 'none'}. Change category`}
            onPress={handlers.onPickCategory}
          />
        )}
        <PickerChip
          name="wallet"
          look={model.wallet}
          label={model.wallet ? `Wallet ${model.wallet.name}. Change wallet` : 'Pick a wallet'}
          onPress={handlers.onPickWallet}
        />
        {transfer ? (
          <PickerChip
            name="destination"
            look={model.destination ?? null}
            label={
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
