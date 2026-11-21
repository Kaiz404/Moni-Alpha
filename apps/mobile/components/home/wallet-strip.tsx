import { Fragment } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedRef, useScrollOffset } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { ReorderItem, useReorder, type EdgeScroll } from '@/components/wallets/reorder';
import { WALLET_CARD_HEIGHT, WALLET_CARD_WIDTH, WalletCard } from '@/components/wallets/wallet-card';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';
import { compactWalletNames, formatMoney, moveWallet, type WalletGroup } from '@repo/core';
import type { MinorAmount } from '@repo/types';

const GAP = 10;
const STEP = WALLET_CARD_WIDTH + GAP;
const PAD = 20;
/** The divider's 1.5 line with 2 either side, between two gaps. */
const DIVIDER_SPAN = GAP + 2 + 1.5 + 2 + GAP;
const TILE = 96;

type Props = {
  groups: readonly WalletGroup[];
  balances: Readonly<Record<string, MinorAmount>>;
  onOpen: (walletId: string) => void;
  onAdd: () => void;
  onReorder: (order: string[]) => void;
};

/** Where each currency's cards start and end in the strip's content, and the New wallet tile after them. */
function stripLayout(groups: readonly WalletGroup[]) {
  let x = PAD;
  const spans = groups.map((group) => {
    const start = x;
    const end = start + group.wallets.length * STEP - GAP;
    x = end + DIVIDER_SPAN;
    return { start, end };
  });
  const tile = x - DIVIDER_SPAN + GAP;
  const snaps = [
    ...spans.flatMap((span, i) => groups[i]!.wallets.map((_, card) => span.start + card * STEP - PAD)),
    tile - PAD,
  ];
  return { spans, contentWidth: tile + TILE + PAD, snaps };
}

/**
 * V2H-Home's wallet strip under net worth: the main currency's cards, then each other currency's behind a
 * divider, then New wallet. Hold a card to lift it and drag it within its currency (XW-WalletCards-Reorder).
 */
export function WalletStrip({ groups, balances, onOpen, onAdd, onReorder }: Props) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(ref);
  const { spans, contentWidth, snaps } = stripLayout(groups);
  const names = compactWalletNames(groups.flatMap((group) => group.wallets));
  return (
    <Animated.ScrollView
      ref={ref}
      horizontal
      accessibilityLabel="Wallets"
      className="-mx-5"
      contentContainerStyle={{ paddingHorizontal: PAD, gap: GAP, alignItems: 'center' }}
      showsHorizontalScrollIndicator={false}
      snapToOffsets={snaps}
      decelerationRate="fast"
    >
      {groups.map((group, i) => (
        <Fragment key={group.currency}>
          {i > 0 ? <View className="mx-0.5 h-[76px] w-[1.5px] rounded-full bg-hairline" /> : null}
          <StripGroup
            group={group}
            names={names}
            balances={balances}
            onOpen={onOpen}
            onMove={(ids) => onReorder(groups.flatMap((other) => (other === group ? ids : other.wallets.map((wallet) => wallet.id))))}
            edge={{ ref, offset, start: spans[i]!.start, end: spans[i]!.end, contentWidth, pad: PAD }}
          />
        </Fragment>
      ))}
      <NewWalletTile onPress={onAdd} />
    </Animated.ScrollView>
  );
}

function StripGroup({
  group,
  names,
  balances,
  onOpen,
  onMove,
  edge,
}: {
  group: WalletGroup;
  names: Record<string, string>;
  balances: Props['balances'];
  onOpen: (walletId: string) => void;
  onMove: (ids: string[]) => void;
  edge: EdgeScroll;
}) {
  const ids = group.wallets.map((wallet) => wallet.id);
  const reorder = useReorder({
    ids,
    step: STEP,
    axis: 'x',
    start: 'hold',
    liftScale: 1.05,
    dim: true,
    gestureId: (id) => tid('home', 'wallets', id, 'hold'),
    onMove,
    edge,
  });
  return (
    <View style={{ width: ids.length * STEP - GAP, height: WALLET_CARD_HEIGHT }}>
      {group.wallets.map((wallet, index) => (
        <ReorderItem
          key={wallet.id}
          reorder={reorder}
          id={wallet.id}
          index={index}
        >
          <WalletCard
            testID={tid('home', 'wallets', 'card', wallet.id)}
            wallet={wallet}
            name={names[wallet.id] ?? wallet.name}
            balance={formatMoney(balances[wallet.id] ?? 0, wallet.currency)}
            onPress={() => onOpen(wallet.id)}
            accessibilityActions={[
              { name: 'decrement', label: 'Move left' },
              { name: 'increment', label: 'Move right' },
            ]}
            onAccessibilityAction={(event) =>
              onMove(moveWallet([group], wallet.id, index + (event.nativeEvent.actionName === 'increment' ? 1 : -1)))
            }
          />
        </ReorderItem>
      ))}
    </View>
  );
}

function NewWalletTile({ onPress }: { onPress: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('home', 'wallets', 'new')}
      onPress={onPress}
      className="h-[96px] w-[96px] items-center justify-center gap-1.5 rounded-[22px] border-[1.5px] border-dashed border-border-strong"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name="plus"
          size={20}
          color={tokens.foreground}
        />
      </View>
      <Text className="text-[13px] leading-4 font-display-semibold text-foreground">New wallet</Text>
    </Press>
  );
}
