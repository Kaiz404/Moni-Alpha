import { useValue } from '@legendapp/state/react';
import type { ProposedTransaction } from '@repo/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DraftOutcome } from '@/lib/ai/chat/messages';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { walletsForUser$ } from '@/lib/finance/selectors';
import * as haptics from '@/lib/haptics';
import { captureSourceLabel } from '@/lib/proposals/capture-source';
import {
  approve,
  later,
  notMine,
  undo,
  type ReviewOutcome,
  type ReviewResult,
} from '@/lib/proposals/review-actions';
import { isAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

import { InkCardLabel, SoftBubble, useOnInk } from './ink-card';
import { pickWallet } from './pick-wallet';

type Settled = DraftOutcome['kind'];

const STATUS: Record<Settled, string> = { approved: 'Approved', later: 'Later', not_mine: 'Not mine' };

function Circle({
  testID,
  label,
  icon,
  fill,
  ink,
  onPress,
}: {
  testID: ReturnType<typeof tid>;
  label: string;
  icon: IconSymbolName;
  fill: string;
  ink: string;
  onPress: () => void;
}) {
  return (
    <Press
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-full ${fill}`}
    >
      <IconSymbol
        name={icon}
        size={20}
        color={ink}
      />
    </Press>
  );
}

function CaptureRow({
  proposal,
  settled,
  onSettle,
}: {
  proposal: ProposedTransaction;
  settled: { kind: Settled; outcome: ReviewOutcome | null } | null;
  onSettle: (next: { kind: Settled; outcome: ReviewOutcome } | null) => void;
}) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  const { user } = useAuth();
  const wallets = useValue(walletsForUser$(user?.id ?? null));
  const category = useValue(() =>
    proposal.categoryId ? (financeProjection$.categoriesById[proposal.categoryId].get() ?? null) : null,
  );
  const direction = proposal.type ?? 'expense';
  const title = proposal.merchant ?? proposal.description ?? category?.name ?? 'Capture';
  const amount =
    proposal.amountMinor === null
      ? 'No amount'
      : formatSignedMoney(direction, proposal.amountMinor, proposal.currency);
  const meta = `${amount} · ${proposal.walletId ? captureSourceLabel(proposal) : 'no wallet yet'}`;

  const decide = async (kind: Settled, run: () => Promise<ReviewResult>) => {
    const result = await run();
    if (result.status === 'needsInput') {
      router.push({ pathname: '/review', params: { id: proposal.id } });
      return;
    }
    if (result.status === 'error') {
      showToast({ text: result.message, tone: 'removed' });
      return;
    }
    onSettle({ kind, outcome: result.outcome });
  };

  const onApprove = async () => {
    const walletId = proposal.walletId ?? (await pickWallet(wallets, proposal.currency, null));
    if (!walletId) return;
    haptics.approve();
    await decide('approved', () => approve(proposal, { walletId }));
  };

  return (
    <View className="min-h-14 flex-row items-center gap-2.5">
      <SoftBubble
        icon={resolveTransactionIcon(category?.icon, direction)}
        tint={{ color: category?.color ?? null }}
        size={36}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] leading-[20px] font-display-semibold text-primary-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="meta"
          className={onInk.meta}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      {settled ? (
        <Press
          testID={tid('chat', 'captures', 'undo', proposal.id)}
          accessibilityLabel={`Undo: ${STATUS[settled.kind]}`}
          disabled={!settled.outcome}
          onPress={() => {
            const outcome = settled.outcome;
            if (!outcome) return;
            onSettle(null);
            undo(outcome).catch(() => {
              onSettle({ kind: settled.kind, outcome });
              showToast({ text: "Couldn't undo that.", tone: 'removed' });
            });
          }}
          radius={{ rest: 16, pressed: 12 }}
          className={`h-8 flex-row items-center gap-1.5 px-2.5 ${settled.kind === 'approved' ? 'bg-primary-muted' : 'bg-sand'}`}
        >
          <View
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: settled.kind === 'approved' ? tokens.states.approved : tokens.ink2 }}
          />
          <Text
            className="text-[12px] leading-[16px] font-display-bold"
            style={{ color: settled.kind === 'approved' ? tokens.states.approved : tokens.ink2 }}
          >
            {STATUS[settled.kind]}
          </Text>
          {settled.outcome ? (
            <IconSymbol
              name="undo"
              size={14}
              color={settled.kind === 'approved' ? tokens.states.approved : tokens.ink2}
            />
          ) : null}
        </Press>
      ) : (
        <View className="flex-row gap-1.5">
          <Circle
            testID={tid('chat', 'captures', 'not-mine', proposal.id)}
            label={`Not mine: ${title}`}
            icon="close"
            fill="bg-sand"
            ink={tokens.foreground}
            onPress={() => {
              haptics.notMine();
              void decide('not_mine', () => notMine(proposal));
            }}
          />
          <Circle
            testID={tid('chat', 'captures', 'later', proposal.id)}
            label={`Later: ${title}`}
            icon="clock-outline"
            fill="bg-sand"
            ink={tokens.foreground}
            onPress={() => void decide('later', () => later(proposal))}
          />
          <Circle
            testID={tid('chat', 'captures', 'approve', proposal.id)}
            label={proposal.walletId ? `Approve ${title}` : `Pick a wallet for ${title}`}
            icon={proposal.walletId ? 'check' : 'wallet-outline'}
            fill={proposal.walletId ? 'bg-mint' : 'bg-lemon'}
            ink={tokens.onPastel}
            onPress={() => void onApprove()}
          />
        </View>
      )}
    </View>
  );
}

/** "Show my 3 captures": the waiting captures on an Ink card, each settled in place. */
export function CapturesCard({ proposalIds }: { proposalIds: readonly string[] }) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  const currency = useMainCurrency();
  const [settled, setSettled] = useState<Record<string, { kind: Settled; outcome: ReviewOutcome | null }>>({});
  const proposals = useValue(() =>
    proposalIds.flatMap((id) => {
      const proposal = financeProjection$.proposalsById[id].get();
      return proposal ? [proposal] : [];
    }),
  );
  const now = new Date();
  const rows = proposals.filter((proposal) => settled[proposal.id] || isAwaitingReview(proposal, now));
  const open = rows.filter((proposal) => !settled[proposal.id]);
  const oneCurrency = open.every((proposal) => proposal.currency === currency);
  const total = open.reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);
  const title = open.length
    ? `${open.length} ${open.length === 1 ? 'capture' : 'captures'}${oneCurrency ? `, ${formatMoney(total, currency)}` : ''}`
    : 'All sorted';

  return (
    <View
      accessibilityLabel={`Moni's answer: captures to review. ${title}`}
      className="gap-2.5 rounded-card bg-primary p-[18px]"
    >
      <InkCardLabel label="Moni" />
      <View className="gap-1">
        <Text
          testID={tid('chat', 'answer', 'title')}
          variant="sectionTitle"
          className="text-primary-foreground"
        >
          {title}
        </Text>
        <Text
          variant="body"
          className={onInk.body}
        >
          None of these count in your totals until you say yes.
        </Text>
      </View>
      <View>
        {rows.map((proposal) => (
          <CaptureRow
            key={proposal.id}
            proposal={proposal}
            settled={settled[proposal.id] ?? null}
            onSettle={(next) =>
              setSettled((all) => {
                const { [proposal.id]: _, ...rest } = all;
                return next ? { ...rest, [proposal.id]: next } : rest;
              })
            }
          />
        ))}
      </View>
      <Press
        testID={tid('chat', 'answer', 'open-review')}
        onPress={() => router.push('/review')}
        radius={{ rest: 22, pressed: 16 }}
        className="h-11 flex-row items-center gap-0.5 self-start bg-card pl-4 pr-2.5"
      >
        <Text className="text-[15px] font-display-semibold text-foreground">Open Review</Text>
        <IconSymbol
          name="chevron-right"
          size={20}
          color={tokens.foreground}
        />
      </Press>
    </View>
  );
}
