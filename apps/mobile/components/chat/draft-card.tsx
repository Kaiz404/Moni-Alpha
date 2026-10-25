import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PickerChip } from '@/components/review/picker-chip';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { replaceMessage, type ChatMessage, type DraftOutcome } from '@/lib/ai/chat/messages';
import { financeTimezone, threadDay } from '@/lib/ai/chat/sessions';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { financeProjection$ } from '@/lib/finance/projection';
import {
  budgetProgress$,
  categoriesForUser$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import * as haptics from '@/lib/haptics';
import {
  approve,
  editedProposal,
  later,
  notMine,
  undo,
  type ReviewEdits,
  type ReviewOutcome,
  type ReviewResult,
} from '@/lib/proposals/review-actions';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast, undoToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

type DraftMessage = Extract<ChatMessage, { kind: 'assistant_draft' }>;

/** A chat capture as the compact Review card: edit in place, then Not mine, Later, or Approve. */
export function DraftCard({ message }: { message: DraftMessage }) {
  const tokens = useThemeTokens();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const proposal = useValue(
    () => financeProjection$.proposalsById[message.proposalId].get() ?? null,
  );
  const wallets = useValue(walletsForUser$(userId));
  // Empty until the category table has synced once.
  const categories = useValue(categoriesForUser$(userId)) ?? [];
  const progress = useValue(budgetProgress$(userId, financeTimezone()));
  const [edits, setEdits] = useState<ReviewEdits>({});
  const [editing, setEditing] = useState<TestId | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoable, setUndoable] = useState(false);
  const [shown, setShown] = useState<DraftOutcome | null>(null);

  const settled = shown ?? message.outcome ?? null;
  if (settled)
    return (
      <DoneRow
        outcome={settled}
        undoable={undoable}
        id={message.proposalId}
      />
    );
  if (!proposal)
    return (
      <Text
        variant="meta"
        className="mb-4 text-muted"
      >
        This capture was settled in Review.
      </Text>
    );

  const current = editedProposal(proposal, edits);
  const set = (patch: ReviewEdits) => setEdits({ ...edits, ...patch });
  const currency = proposal.currency;
  const wallet = wallets.find((w) => w.id === current.walletId) ?? null;
  const category = categories.find((c) => c.id === current.categoryId) ?? null;
  const direction = proposal.type ?? 'expense';
  const amountText =
    current.amountMinor === null ? 'No amount' : formatSignedMoney(direction, current.amountMinor, currency);
  const title = current.merchant ?? proposal.description ?? category?.name ?? 'Capture';

  const budgetRow = progress.find(
    (row) => row.categoryId === current.categoryId && row.currency === currency,
  );
  const afterMinor =
    budgetRow?.budgetAmountMinor != null && direction === 'expense' && current.amountMinor
      ? Number(budgetRow.budgetAmountMinor) - Number(budgetRow.spentMinor) - Number(current.amountMinor)
      : null;

  const day = threadDay(message.createdAt);
  const decide = async (
    run: () => Promise<ReviewResult>,
    view: (outcome: ReviewOutcome) => DraftOutcome,
    toast: (outcome: ReviewOutcome) => string,
  ) => {
    if (busy) return;
    setEditing(null);
    setBusy(true);
    const result = await run();
    setBusy(false);
    if (result.status === 'needsInput') {
      router.push({ pathname: '/review', params: { id: proposal.id } });
      return;
    }
    if (result.status === 'error') {
      showToast({ text: result.message, tone: 'removed' });
      return;
    }
    const { outcome } = result;
    const { outcome: _, ...draft } = message;
    const done = view(outcome);
    setShown(done);
    replaceMessage(day, message.id, { ...draft, outcome: done });
    setUndoable(outcome.action !== 'later');
    showToast({
      text: toast(outcome),
      tone: outcome.action === 'approve' || outcome.action === 'later' ? 'done' : 'removed',
      undo:
        outcome.action === 'later'
          ? undefined
          : () => {
              setUndoable(false);
              setShown(null);
              undo(outcome)
                .then(() => replaceMessage(day, message.id, draft))
                .catch(() => {
                  setShown(done);
                  showToast({ text: "Couldn't undo that.", tone: 'removed' });
                });
            },
      commit: () => setUndoable(false),
    });
  };

  const pickWallet = async () => {
    const sameCurrency = wallets.filter((w) => w.currency === currency);
    const picked = await openSheet({
      kind: 'wallet',
      title: 'Which wallet paid?',
      wallets: (sameCurrency.length ? sameCurrency : wallets).map((w) => ({
        id: w.id,
        name: w.name,
        currency: w.currency,
        type: w.type,
        icon: w.icon,
        color: w.color,
        cardStyleId: w.cardStyleId,
      })),
      selectedId: current.walletId,
    });
    if (picked?.walletId) set({ walletId: picked.walletId });
    return picked?.walletId ?? null;
  };

  const pickCategory = async () => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Category',
      currency,
      categories: toCategoryTiles(
        categories.filter((c) => c.isActive && c.type === direction),
        progress,
        currency,
      ),
      selectedId: current.categoryId,
    });
    if (picked) set({ categoryId: picked });
  };

  const onApprove = async () => {
    const walletId = current.walletId ?? (await pickWallet());
    if (!walletId) return;
    const chosen = wallets.find((w) => w.id === walletId);
    haptics.approve();
    await decide(
      () => approve(proposal, { ...edits, walletId }),
      () => ({
        kind: 'approved',
        title: `Approved ${title} ${amountText}`,
        meta: [
          chosen?.name,
          afterMinor !== null && category
            ? `${category.name} now ${formatMoney(Math.abs(afterMinor), currency, { whole: true })} ${afterMinor < 0 ? 'over' : 'left'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
      }),
      () => `Added ${amountText}`,
    );
  };


  return (
    <View
      accessibilityLabel={`Moni's draft: ${title}, ${amountText}${wallet ? '' : ', no wallet yet'}`}
      className="mb-4 gap-3 rounded-card bg-card p-[18px]"
    >
      <Text
        variant="meta"
        className="text-muted"
      >
        {"Moni's draft · not counted yet"}
      </Text>

      <InPlaceGroup
        editing={editing}
        onEditingChange={setEditing}
      >
        <InPlaceField
          testID={tid('chat', 'draft', 'merchant')}
          label="Merchant name"
          kind="text"
          required
          maxLength={40}
          value={current.merchant ?? ''}
          onSave={(merchant) => set({ merchant })}
        >
          {({ editable, editor }) =>
            editor ??
            editable(
              <Text
                variant="cardTitle"
                className="text-foreground"
                numberOfLines={1}
              >
                {title}
              </Text>,
              { accessibilityLabel: `Rename ${title}` },
            )
          }
        </InPlaceField>
        <InPlaceField
          testID={tid('chat', 'draft', 'amount')}
          label="Amount"
          kind="amount"
          prefix={formatSignedMoney(direction, 0, currency).replace(/[\d.,]/g, '')}
          value={current.amountMinor}
          onSave={(amountMinor) => set({ amountMinor })}
        >
          <Text
            testID={tid('chat', 'draft', 'amount-text')}
            variant="amountHero"
            className="text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {amountText}
          </Text>
        </InPlaceField>
      </InPlaceGroup>

      <View className="flex-row flex-wrap gap-2">
        <PickerChip
          testID={tid('chat', 'draft', 'category')}
          look={
            category
              ? {
                  name: category.name,
                  icon: resolveTransactionIcon(category.icon, direction),
                  color: category.color,
                }
              : null
          }
          tinted
          empty={{ label: 'Pick a category', icon: 'shape-outline' }}
          accessibilityLabel={`Category: ${category?.name ?? 'none'}. Change`}
          onPress={() => void pickCategory()}
        />
        <PickerChip
          testID={tid('chat', 'draft', 'wallet')}
          look={
            wallet
              ? { name: wallet.name, icon: wallet.icon ?? 'wallet-outline', color: wallet.color }
              : null
          }
          empty={{ label: 'Pick a wallet', icon: 'wallet-plus-outline' }}
          accessibilityLabel={wallet ? `Wallet: ${wallet.name}. Change` : 'Pick a wallet'}
          onPress={() => void pickWallet()}
        />
      </View>

      {proposal.aiReasoning ? (
        <View className="flex-row gap-2">
          <IconSymbol
            name="creation"
            size={16}
            color={tokens.deepMint}
          />
          <Text
            variant="meta"
            className="flex-1 text-ink-2"
          >
            {proposal.aiReasoning}
          </Text>
        </View>
      ) : null}

      {afterMinor !== null && category ? (
        <View
          className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${afterMinor < 0 ? 'bg-destructive-fill' : 'bg-sand'}`}
        >
          <Text
            variant="meta"
            className={`font-display-semibold ${afterMinor < 0 ? 'text-over' : 'text-ink-2'}`}
          >
            {`${category.name}: ${formatMoney(Math.abs(afterMinor), currency, { whole: true })} ${afterMinor < 0 ? 'over' : 'left'} after this`}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <ActionButton
          testID={tid('chat', 'draft', 'not-mine')}
          label="Not mine"
          icon="close"
          fill="bg-sand"
          accessibilityLabel="Not mine. Nothing gets added"
          onPress={() => {
            haptics.notMine();
            void decide(
              () => notMine(proposal),
              () => ({ kind: 'not_mine', title: '1 not mine', meta: 'Nothing was added' }),
              () => '1 not mine',
            );
          }}
        />
        <ActionButton
          testID={tid('chat', 'draft', 'later')}
          label="Later"
          icon="clock-outline"
          fill="bg-sand"
          accessibilityLabel="Later. It waits in Review"
          onPress={() =>
            void decide(
              () => later(proposal),
              () => ({ kind: 'later', title: 'Saved for later', meta: 'It waits in Review, not counted yet' }),
              () => 'Saved for later',
            )
          }
        />
        <ActionButton
          testID={tid('chat', 'draft', 'approve')}
          label={wallet ? 'Approve' : 'Pick wallet'}
          icon={wallet ? 'check' : 'wallet-plus-outline'}
          fill={wallet ? 'bg-mint' : 'bg-lemon'}
          accessibilityLabel={wallet ? `Approve ${amountText}` : 'Pick a wallet first'}
          onPress={() => void onApprove()}
        />
      </View>
    </View>
  );
}

function DoneRow({
  outcome,
  undoable,
  id,
}: {
  outcome: DraftOutcome;
  undoable: boolean;
  id: string;
}) {
  const tokens = useThemeTokens();
  const icon: IconSymbolName =
    outcome.kind === 'approved' ? 'check' : outcome.kind === 'later' ? 'clock-outline' : 'close';
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      className="mb-4 flex-row items-center gap-3 rounded-tile border-[1.5px] border-hairline py-2.5 pl-3 pr-2.5"
    >
      <View
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${outcome.kind === 'approved' ? 'bg-mint' : 'bg-sand'}`}
      >
        <IconSymbol
          name={icon}
          size={20}
          color={outcome.kind === 'approved' ? tokens.onPastel : tokens.foreground}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          testID={tid('chat', 'draft', 'done', id)}
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {outcome.title}
        </Text>
        {outcome.meta ? (
          <Text
            variant="meta"
            className="text-muted"
            numberOfLines={1}
          >
            {outcome.meta}
          </Text>
        ) : null}
      </View>
      {undoable ? (
        <Press
          testID={tid('chat', 'draft', 'undo')}
          onPress={undoToast}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-hairline"
          className="h-11 justify-center bg-sand px-4"
        >
          <Text className="text-[15px] font-display-semibold text-foreground">Undo</Text>
        </Press>
      ) : null}
    </View>
  );
}

/** Sand carries the page's ink; pastels and category colours always carry #17181A. */
function inkOn(fill: string, color: string | undefined, tokens: ReturnType<typeof useThemeTokens>) {
  return fill === 'bg-sand' && !color ? tokens.foreground : tokens.onPastel;
}

function ActionButton({
  testID,
  label,
  icon,
  fill,
  accessibilityLabel,
  onPress,
}: {
  testID: ReturnType<typeof tid>;
  label: string;
  icon: IconSymbolName;
  fill: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const ink = inkOn(fill, undefined, tokens);
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      radius={{ rest: 26, pressed: 16 }}
      className={`h-[52px] flex-1 flex-row items-center justify-center gap-1.5 ${fill}`}
    >
      <IconSymbol
        name={icon}
        size={18}
        color={ink}
      />
      <Text
        className="text-[15px] font-display-semibold"
        style={{ color: ink }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Press>
  );
}
