import type { CurrencyCode, MinorAmount } from '@repo/types';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import type { FinanceProposal } from '@/lib/finance/types';
import { tid } from '@/lib/test-ids';
import { plural, type CategoryLook } from './use-places';

export function PlaceHero({
  heading,
  totalMinor,
  count,
  days,
  currency,
  top,
  share,
}: {
  heading: string;
  totalMinor: MinorAmount;
  count: number;
  days: number;
  currency: CurrencyCode;
  top: boolean;
  share: number;
}) {
  const each = formatMoney(Math.round(totalMinor / count), currency);
  return (
    <View className="gap-1">
      <Text
        variant="caps"
        className="text-muted"
      >
        {heading}
      </Text>
      <Text
        variant="hero"
        className="text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatMoney(totalMinor, currency, { whole: true })}
      </Text>
      <Text
        variant="body"
        className="mt-1 text-ink-2"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {`${plural(count, 'payment')} on ${plural(days, 'day')} · ${each} each`}
      </Text>
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        {top ? (
          <StatusPill
            tone="review"
            label="Your top place"
          />
        ) : null}
        <Text
          variant="body"
          className="text-ink-2"
        >
          {`${share}% of spending at places`}
        </Text>
      </View>
    </View>
  );
}

function clock(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${date.getHours() < 12 ? 'am' : 'pm'}`;
}

function captureSource(proposal: FinanceProposal, walletName: string | null): string {
  if (proposal.sourceType === 'notification') return `a ${walletName ?? 'bank'} alert`;
  if (proposal.sourceType === 'image') return 'a receipt';
  return 'a capture';
}

/** Captures waiting for review that were pinned here, kept out of the totals. */
export function PendingHere({
  proposals,
  nameOf,
  walletName,
  onReview,
}: {
  proposals: FinanceProposal[];
  nameOf: (raw: string | null) => string | null;
  walletName: (walletId: string | null) => string | null;
  onReview: (proposal: FinanceProposal) => void;
}) {
  const first = proposals[0];
  if (!first) return null;
  const name = nameOf(first.merchant) ?? first.description ?? 'A capture';
  const amount = first.amountMinor ? ` ${formatMoney(first.amountMinor, first.currency)}` : '';
  const when = clock(first.notificationReceivedAt ?? first.createdAt);
  return (
    <View className="flex-row items-center gap-3.5 rounded-card bg-lilac p-[18px]">
      <View className="min-w-0 flex-1 gap-1">
        <Text
          variant="cardTitle"
          className="text-on-pastel"
        >
          {`${plural(proposals.length, 'capture')} here to review`}
        </Text>
        <Text
          className="text-[14px] leading-[20px] text-on-pastel"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`${name}${amount}, ${captureSource(first, walletName(first.walletId))} at ${when}. Not in these totals yet.`}
        </Text>
      </View>
      <Press
        testID={tid('map', 'place', 'review')}
        onPress={() => onReview(first)}
        radius={{ rest: 22, pressed: 16 }}
        pressedClassName="bg-primary-pressed"
        className="h-11 justify-center bg-primary px-[18px]"
      >
        <Text className="text-[14px] leading-[19px] font-display-semibold text-primary-foreground">Review</Text>
      </Press>
    </View>
  );
}

/** "What you bought": one bar split by category share, then a legend row each. */
export function WhatYouBought({
  categories,
  totalMinor,
  currency,
  look,
}: {
  categories: { categoryId: string | null; totalMinor: MinorAmount }[];
  totalMinor: MinorAmount;
  currency: CurrencyCode;
  look: (categoryId: string | null) => CategoryLook;
}) {
  const parts = categories.map((category) => ({
    ...category,
    look: look(category.categoryId),
    share: totalMinor > 0 ? Math.round((category.totalMinor / totalMinor) * 100) : 0,
  }));
  return (
    <View className="gap-3.5">
      <Text
        variant="sectionTitle"
        className="text-foreground"
        accessibilityRole="header"
      >
        What you bought
      </Text>
      <View
        accessibilityRole="image"
        accessibilityLabel={parts
          .map((part) => `${part.look.name} ${formatMoney(part.totalMinor, currency)}`)
          .join(', ')}
        className="h-3.5 flex-row gap-1"
      >
        {parts.map((part) => (
          <View
            key={part.categoryId ?? 'none'}
            className={`rounded-full ${part.look.color ? '' : 'bg-hairline'}`}
            style={{
              flex: part.totalMinor,
              backgroundColor: part.look.color ?? undefined,
            }}
          />
        ))}
      </View>
      <View className="gap-2">
        {parts.map((part) => (
          <View
            key={part.categoryId ?? 'none'}
            className="flex-row items-center gap-2.5"
          >
            <View
              className={`h-2.5 w-2.5 rounded-full ${part.look.color ? '' : 'bg-hairline'}`}
              style={part.look.color ? { backgroundColor: part.look.color } : undefined}
            />
            <Text
              variant="body"
              className="min-w-0 flex-1 text-foreground"
              numberOfLines={1}
            >
              {part.look.name}
            </Text>
            <Text
              className="text-[15px] leading-[21px] font-display-semibold text-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatMoney(part.totalMinor, currency)}
            </Text>
            <Text
              variant="meta"
              className="w-10 text-right text-muted"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${part.share}%`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The ink card with one thing Moni worked out about this place. */
export function MoniNoticed({ sentence, onAsk }: { sentence: string; onAsk: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('map', 'place', 'ask-moni')}
      onPress={onAsk}
      accessibilityLabel={`Moni noticed. ${sentence} Ask Moni about it`}
      pressedClassName="bg-primary-pressed"
      className="flex-row items-start gap-3 rounded-card bg-primary p-[18px]"
    >
      <IconSymbol
        name="creation"
        size={20}
        color={tokens.lilac}
      />
      <View className="min-w-0 flex-1 gap-1">
        <Text
          variant="caps"
          className="text-inactive"
        >
          Moni noticed
        </Text>
        <Text
          variant="body"
          className="text-primary-foreground"
        >
          {sentence}
        </Text>
        <View className="flex-row items-center gap-0.5">
          <Text className="text-[14px] leading-[19px] font-display-semibold text-on-ink-positive">
            Ask Moni about it
          </Text>
          <IconSymbol
            name="chevron-right"
            size={18}
            color={tokens.onInkPositive}
          />
        </View>
      </View>
    </Press>
  );
}
