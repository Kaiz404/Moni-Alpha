import { useValue } from '@legendapp/state/react';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  approveDraft,
  laterDraft,
  notMineDraft,
  type DraftEdits,
} from '@/lib/ai/chat/draft-actions';
import { replaceMessage, type ChatMessage, type DraftOutcome } from '@/lib/ai/chat/messages';
import { financeTimezone, threadDay } from '@/lib/ai/chat/sessions';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { parseAmountInput } from '@/lib/finance/money';
import { financeProjection$ } from '@/lib/finance/projection';
import {
  budgetProgress$,
  categoriesForUser$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceProposal } from '@/lib/finance/types';
import { approve, notMine } from '@/lib/haptics';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { showToast, undoToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';


type DraftMessage = Extract<ChatMessage, { kind: 'assistant_draft' }>;
type Field = 'merchant' | 'amount';

function initialEdits(proposal: FinanceProposal): DraftEdits {
  return {
    merchant: proposal.merchant ?? proposal.description,
    amountMinor: proposal.amountMinor === null ? null : Number(proposal.amountMinor),
    categoryId: proposal.categoryId,
    walletId: proposal.walletId,
  };
}

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
  const [edits, setEdits] = useState<DraftEdits | null>(null);
  const [editing, setEditing] = useState<Field | null>(null);
  const [field, setField] = useState('');
  const [pending, setPending] = useState<DraftOutcome | null>(null);

  const settled = pending ?? message.outcome ?? null;
  if (settled)
    return (
      <DoneRow
        outcome={settled}
        undoable={pending !== null}
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

  const current = edits ?? initialEdits(proposal);
  const set = (patch: Partial<DraftEdits>) => setEdits({ ...current, ...patch });
  const currency = proposal.currency;
  const wallet = wallets.find((w) => w.id === current.walletId) ?? null;
  const category = categories.find((c) => c.id === current.categoryId) ?? null;
  const direction = proposal.type ?? 'expense';
  const amountText =
    current.amountMinor === null ? 'No amount' : formatSignedMoney(direction, current.amountMinor, currency);
  const title = current.merchant ?? category?.name ?? 'Capture';

  const budgetRow = progress.find(
    (row) => row.categoryId === current.categoryId && row.currency === currency,
  );
  const afterMinor =
    budgetRow?.budgetAmountMinor != null && direction === 'expense' && current.amountMinor
      ? Number(budgetRow.budgetAmountMinor) - Number(budgetRow.spentMinor) - current.amountMinor
      : null;

  const day = threadDay(message.createdAt);
  const settle = (outcome: DraftOutcome, toast: string, commit: () => Promise<void> | void) => {
    setEditing(null);
    setPending(outcome);
    showToast({
      text: toast,
      tone: outcome.kind === 'approved' ? 'done' : 'removed',
      undo: () => setPending(null),
      commit: () => {
        void (async () => {
          try {
            await commit();
            replaceMessage(day, message.id, { ...message, outcome });
          } catch (error) {
            console.warn('[chat] draft not saved', error);
            setPending(null);
            showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
          }
        })();
      },
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
    const edits = { ...current, walletId };
    const chosen = wallets.find((w) => w.id === walletId);
    approve();
    settle(
      {
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
      },
      `Added ${amountText}`,
      async () => {
        const result = await approveDraft(proposal, edits);
        if (result.status !== 'done') throw new Error(`needs ${result.field}`);
      },
    );
  };

  const save = () => {
    if (editing === 'merchant') set({ merchant: field.trim() || current.merchant });
    if (editing === 'amount') {
      try {
        set({ amountMinor: Number(parseAmountInput(field)) });
      } catch {
        return;
      }
    }
    setEditing(null);
  };

  const edit = (which: Field) => {
    setEditing(which);
    setField(
      which === 'merchant'
        ? (current.merchant ?? '')
        : current.amountMinor === null
          ? ''
          : (current.amountMinor / 100).toFixed(2),
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

      {editing === 'merchant' ? (
        <EditField
          value={field}
          onChange={setField}
          onCancel={() => setEditing(null)}
          onSave={save}
          label="Merchant name"
        />
      ) : (
        <EditableValue
          testID={tid('chat', 'draft', 'merchant')}
          label={`Rename ${title}`}
          onPress={() => edit('merchant')}
          showPencil={editing === null}
        >
          <Text
            variant="cardTitle"
            className="text-foreground"
            numberOfLines={1}
          >
            {title}
          </Text>
        </EditableValue>
      )}

      {editing === 'amount' ? (
        <EditField
          value={field}
          onChange={setField}
          onCancel={() => setEditing(null)}
          onSave={save}
          label="Amount"
          numeric
        />
      ) : (
        <EditableValue
          testID={tid('chat', 'draft', 'amount')}
          label="Edit amount"
          onPress={() => edit('amount')}
          showPencil={editing === null}
        >
          <Text
            testID={tid('chat', 'draft', 'amount-text')}
            variant="amountHero"
            className="text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {amountText}
          </Text>
        </EditableValue>
      )}

      <View className="flex-row flex-wrap gap-2">
        <ChipButton
          testID={tid('chat', 'draft', 'category')}
          label={category?.name ?? 'Pick a category'}
          icon={resolveTransactionIcon(category?.icon, direction)}
          fill={category ? 'bg-sand' : 'bg-lemon'}
          color={category?.color ?? undefined}
          accessibilityLabel={`Category: ${category?.name ?? 'none'}. Change`}
          onPress={() => void pickCategory()}
        />
        <ChipButton
          testID={tid('chat', 'draft', 'wallet')}
          label={wallet?.name ?? 'Pick a wallet'}
          icon={wallet ? 'wallet-outline' : 'wallet-plus-outline'}
          fill={wallet ? 'bg-sand' : 'bg-lemon'}
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
            notMine();
            settle(
              { kind: 'not_mine', title: '1 not mine', meta: 'Nothing was added' },
              '1 not mine',
              () => notMineDraft(proposal.id),
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
            settle(
              { kind: 'later', title: 'Saved for later', meta: 'It waits in Review, not counted yet' },
              'Saved for later',
              () => laterDraft(proposal.id),
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

function EditableValue({
  testID,
  label,
  onPress,
  showPencil,
  children,
}: {
  testID: ReturnType<typeof tid>;
  label: string;
  onPress: () => void;
  showPencil: boolean;
  children: React.ReactNode;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      pressedClassName="bg-transparent"
      className="flex-row items-center gap-2 self-start"
    >
      <View className="shrink">{children}</View>
      {showPencil ? (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-sand">
          <IconSymbol
            name="pencil-outline"
            size={16}
            color={tokens.foreground}
          />
        </View>
      ) : null}
    </Press>
  );
}

function EditField({
  value,
  onChange,
  onCancel,
  onSave,
  label,
  numeric = false,
}: {
  value: string;
  onChange: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
  label: string;
  numeric?: boolean;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        testID={tid('chat', 'draft', 'field')}
        accessibilityLabel={label}
        autoFocus
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSave}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        maxLength={numeric ? 12 : 40}
        className={`flex-1 rounded-field border-2 border-foreground bg-card px-4 font-display-bold text-foreground ${numeric ? 'h-16 text-[40px]' : 'h-[52px] text-[18px]'}`}
        placeholderTextColor={tokens.muted}
      />
      <Press
        testID={tid('chat', 'draft', 'cancel')}
        accessibilityLabel="Cancel"
        onPress={onCancel}
        pressedClassName="bg-hairline"
        className="h-11 w-11 items-center justify-center rounded-full bg-sand"
      >
        <IconSymbol
          name="close"
          size={20}
          color={tokens.foreground}
        />
      </Press>
      <Press
        testID={tid('chat', 'draft', 'save')}
        accessibilityLabel={`Save ${label.toLowerCase()}`}
        onPress={onSave}
        pressedClassName="bg-primary-pressed"
        className="h-11 w-11 items-center justify-center rounded-full bg-primary"
      >
        <IconSymbol
          name="check"
          size={20}
          color={tokens.primaryForeground}
        />
      </Press>
    </View>
  );
}

/** Sand carries the page's ink; pastels and category colours always carry #17181A. */
function inkOn(fill: string, color: string | undefined, tokens: ReturnType<typeof useThemeTokens>) {
  return fill === 'bg-sand' && !color ? tokens.foreground : tokens.onPastel;
}

function ChipButton({
  testID,
  label,
  icon,
  fill,
  color,
  accessibilityLabel,
  onPress,
}: {
  testID: ReturnType<typeof tid>;
  label: string;
  icon: IconSymbolName;
  fill: string;
  /** The category's own colour, over `fill`. */
  color?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const ink = inkOn(fill, color, tokens);
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      className={`h-11 flex-row items-center gap-1.5 pl-2 pr-3 ${fill}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      <View className="h-7 w-7 items-center justify-center rounded-full bg-card/60">
        <IconSymbol
          name={icon}
          size={16}
          color={ink}
        />
      </View>
      <Text
        className="text-[15px] font-display-semibold"
        style={{ color: ink }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <IconSymbol
        name="chevron-down"
        size={18}
        color={ink}
      />
    </Press>
  );
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
