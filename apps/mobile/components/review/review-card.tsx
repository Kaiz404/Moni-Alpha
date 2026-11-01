import type { MinorAmount, ProposedTransaction, TransactionType } from '@repo/types';
import { memo, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';

import { FieldRow, FieldRows } from '@/components/review/field-row';
import type { ChipLook } from '@/components/review/picker-chip';
import { SourcePill } from '@/components/review/source-pill';
import {
  getNotificationAppIconUri,
  NotificationAppIcon,
} from '@/components/wallets/notification-source';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatSignedMoney } from '@/lib/finance/format-money';
import { getCachedInstalledAppsMap, getInstalledAppInfo } from '@/lib/notifications/installed-apps';
import {
  cardFit,
  type EditField as EditFieldName,
  type ReviewDecision,
} from '@/lib/proposals/review-card-state';
import type { ReviewStatus } from '@/lib/proposals/review-status';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { TRANSACTION_TYPE_COPY } from '@/lib/transactions/type-change';

const FIELD = { merchant: tid('review', 'merchant'), amount: tid('review', 'amount') } as const;

/** A wallet row shows the compact name; the screen reader hears the full one (`XA-Review`). */
export type WalletLook = ChipLook & { fullName: string };

/** Everything the card shows, already resolved from the store and this card's edits. */
export type ReviewCardModel = {
  proposal: ProposedTransaction;
  /** The type as it will be written, the user's correction applied. */
  type: TransactionType | null;
  sourceLabel: string;
  time: string;
  status: ReviewStatus | null;
  quote: string | null;
  merchant: string;
  amountMinor: MinorAmount;
  category: ChipLook | null;
  wallet: WalletLook | null;
  /** Approve has a wallet to write to. Without one it asks for one instead. */
  canApprove: boolean;
  /** Transfers only: the wallet the money moves to. */
  destination: WalletLook | null | undefined;
  /** Why this card might be the same money as another: the duplicate or pairing it found. */
  evidence: string | null;
  /** What the user can do about a likely duplicate, or a pair Moni already counted once. */
  pair: {
    kind: 'same-payment' | 'its-a-transfer' | 'not-same-payment' | 'not-a-transfer';
    label: string;
    hint: string | null;
  } | null;
  similar: boolean | null;
};

export type ReviewCardHandlers = {
  onEdit: (field: EditFieldName) => void;
  onCancelEdit: () => void;
  onSaveMerchant: (value: string) => void;
  onSaveAmount: (value: MinorAmount) => void;
  onPickType: () => void;
  onPickCategory: () => void;
  onPickWallet: () => void;
  onPickDestination: () => void;
  onToggleSimilar: () => void;
  onPair: () => void;
  onDecide: (decision: ReviewDecision) => void;
};

const SOURCE: Record<
  ProposedTransaction['sourceType'],
  { icon: IconSymbolName; tint: string; onPastel: boolean }
> = {
  notification: { icon: 'bell-outline', tint: 'bg-attention-fill', onPastel: false },
  text: { icon: 'creation', tint: 'bg-pending-fill', onPastel: false },
  image: { icon: 'receipt-text-outline', tint: 'bg-peach', onPastel: true },
};

/** The app's icon from the caches, or from the phone when they are cold. Null until one is known. */
function useAppIcon(packageName: string | null): string | null {
  const [loaded, setLoaded] = useState<string | null>(null);
  // The icon cache parses all its stored icons on each read, so a card reads it once.
  const cached = useMemo(
    () => getNotificationAppIconUri(packageName, getCachedInstalledAppsMap() ?? new Map()),
    [packageName],
  );
  useEffect(() => {
    if (!packageName || cached) return;
    let cancelled = false;
    void getInstalledAppInfo(packageName).then((app) => {
      if (!cancelled && app?.iconUri) setLoaded(app.iconUri);
    });
    return () => {
      cancelled = true;
    };
  }, [packageName, cached]);
  return cached ?? loaded;
}

/** A notification capture shows the app that sent it. The tile is for the rest, and for an app with no known icon. */
function SourceIcon({ proposal }: { proposal: ProposedTransaction }) {
  const tokens = useThemeTokens();
  const source = SOURCE[proposal.sourceType];
  const iconUri = useAppIcon(proposal.sourceType === 'notification' ? proposal.sourceApp : null);
  if (iconUri) {
    return (
      <NotificationAppIcon
        iconUri={iconUri}
        size={36}
      />
    );
  }
  return (
    <View className={`h-9 w-9 items-center justify-center rounded-[12px] ${source.tint}`}>
      <IconSymbol
        name={source.icon}
        size={20}
        color={source.onPastel ? tokens.onPastel : tokens.foreground}
      />
    </View>
  );
}

function moneyDirection(type: TransactionType | null) {
  return type === 'income' || type === 'transfer' ? type : 'expense';
}

/** The `XA-Review` card body. The deck owns the gesture; this only draws and edits. */
export const ReviewCard = memo(function ReviewCard({
  model,
  editing,
  handlers,
  canDecide,
  height,
}: {
  model: ReviewCardModel;
  editing: EditFieldName | null;
  handlers: ReviewCardHandlers;
  /** Off while a field edits or a decision saves, and on the card waiting underneath. */
  canDecide: boolean;
  height: number;
}) {
  const tokens = useThemeTokens();
  const { fontScale } = useWindowDimensions();
  const { proposal } = model;
  const direction = moneyDirection(model.type);
  const typeLabel = TRANSACTION_TYPE_COPY[direction].label;
  const amountText = formatSignedMoney(direction, model.amountMinor, proposal.currency);
  const transfer = model.type === 'transfer';
  const fit = cardFit(
    {
      quote: !!model.quote,
      evidence: !!model.evidence,
      pair: !!model.pair,
      similar: model.similar !== null,
    },
    height,
    fontScale,
  );
  const evidence = fit.evidenceLines > 0 ? model.evidence : null;
  const similar = fit.similar ? model.similar : null;
  // A screen reader can't swipe, so the swipe's three decisions are this row's actions.
  const decisions: { name: ReviewDecision; label: string }[] = canDecide
    ? [
        { name: 'approve', label: model.canApprove ? `Approve ${amountText}` : 'Pick wallet' },
        { name: 'notMine', label: 'Not mine. Nothing gets added' },
        { name: 'later', label: 'Later. Save it for later' },
      ]
    : [];
  const onDecisionAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    const decision = decisions.find((d) => d.name === nativeEvent.actionName);
    if (decision) handlers.onDecide(decision.name);
  };

  return (
    <View
      testID={tid('review', 'body')}
      className="gap-3 overflow-hidden rounded-card bg-card p-[18px]"
      style={{ height }}
    >
      <View
        testID={tid('review', 'summary')}
        className="flex-row items-center gap-2.5"
        accessible
        accessibilityLabel={[
          `${model.merchant}, ${amountText}, from ${model.sourceLabel}, ${model.time}`,
          ...(model.status ? [model.status.label] : []),
        ].join('. ')}
        accessibilityActions={decisions}
        onAccessibilityAction={onDecisionAction}
      >
        <SourceIcon proposal={proposal} />
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
            numberOfLines={1}
          >
            {model.time}
          </Text>
        </View>
        {model.status ? (
          <SourcePill
            tone={model.status.tone}
            label={model.status.label}
          />
        ) : null}
      </View>

      {model.quote && fit.quoteLines > 0 ? (
        <View className="rounded-field bg-sand-light px-3 py-2">
          <Text
            className="text-[14px] leading-[20px] text-ink-2"
            numberOfLines={fit.quoteLines}
          >
            {`“${model.quote}”`}
          </Text>
        </View>
      ) : null}

      <View className="min-h-0 flex-1 justify-center">
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
                value={model.merchant}
                onSave={handlers.onSaveMerchant}
              >
                {({ editable, editor }) =>
                  editor ?? (
                    <View className="-my-1.5">
                      {editable(
                        <Text
                          variant="cardTitle"
                          className="text-foreground"
                          numberOfLines={1}
                        >
                          {model.merchant}
                        </Text>,
                        { accessibilityLabel: `Merchant ${model.merchant}. Edit name` },
                      )}
                    </View>
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
      </View>

      <FieldRows>
        <FieldRow
          testID={tid('review', 'type')}
          label="Type"
          look={{
            name: typeLabel,
            icon: resolveTransactionIcon(null, direction),
            color: null,
          }}
          accessibilityLabel={`Type ${typeLabel}. Change type`}
          onPress={handlers.onPickType}
        />
        {transfer ? null : (
          <FieldRow
            testID={tid('review', 'category')}
            label="Category"
            look={model.category}
            empty={{ label: 'Pick a category', icon: 'shape-outline' }}
            accessibilityLabel={`Category ${model.category?.name ?? 'none'}. Change category`}
            onPress={handlers.onPickCategory}
          />
        )}
        <FieldRow
          testID={tid('review', 'wallet')}
          label="Wallet"
          look={model.wallet}
          accessibilityLabel={model.wallet ? `Wallet ${model.wallet.fullName}. Change wallet` : 'Pick a wallet'}
          onPress={handlers.onPickWallet}
        />
        {transfer ? (
          <FieldRow
            testID={tid('review', 'destination')}
            label="Moves to"
            look={model.destination ?? null}
            accessibilityLabel={
              model.destination
                ? `Moves to ${model.destination.fullName}. Change wallet`
                : 'Pick a wallet'
            }
            onPress={handlers.onPickDestination}
          />
        ) : null}
      </FieldRows>

      {evidence || model.pair || similar !== null ? (
        <View className="gap-1.5">
          {evidence ? (
            <Text
              variant="meta"
              className="text-ink-2"
              numberOfLines={fit.evidenceLines}
            >
              {evidence}
            </Text>
          ) : null}

          {model.pair ? (
            <View className="h-10 flex-row items-center gap-2.5">
              <Press
                testID={tid('review', model.pair.kind)}
                onPress={handlers.onPair}
                accessibilityLabel={model.pair.label}
                accessibilityHint={model.pair.hint ?? undefined}
                hitSlop={4}
                radius={{ rest: 20, pressed: 14 }}
                pressedClassName="bg-hairline"
                className="h-10 flex-row items-center gap-1.5 bg-sand px-3.5"
              >
                <IconSymbol
                  name={
                    model.pair.kind === 'its-a-transfer' || model.pair.kind === 'not-a-transfer'
                      ? 'swap-horizontal'
                      : 'link-variant'
                  }
                  size={18}
                  color={tokens.foreground}
                />
                <Text
                  className="text-[14px] leading-[19px] font-display-semibold text-foreground"
                  numberOfLines={1}
                >
                  {model.pair.label}
                </Text>
              </Press>
              {model.pair.hint ? (
                <Text
                  variant="meta"
                  className="min-w-0 flex-1 text-muted"
                  numberOfLines={2}
                >
                  {model.pair.hint}
                </Text>
              ) : null}
            </View>
          ) : null}

          {similar !== null ? (
            <Press
              testID={tid('review', 'similar')}
              onPress={handlers.onToggleSimilar}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: similar }}
              accessibilityLabel="Don't ask about similar"
              pressedScale={1}
              radius={{ rest: 12, pressed: 12 }}
              className="-ml-1 h-11 flex-row items-center gap-2.5 self-start pl-1 pr-2"
            >
              <View
                className={`h-[22px] w-[22px] items-center justify-center rounded-[6px] border-2 border-foreground ${similar ? 'bg-primary' : ''}`}
              >
                {similar ? (
                  <IconSymbol
                    name="check"
                    size={16}
                    color={tokens.primaryForeground}
                  />
                ) : null}
              </View>
              <Text
                className="text-[15px] leading-[20px] font-display-semibold text-foreground"
                numberOfLines={1}
              >
                Don&apos;t ask about similar
              </Text>
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});
