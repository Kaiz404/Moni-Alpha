import type { MinorAmount } from '@repo/types';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ReviewDeck, useReviewSession } from '@/components/review/deck';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';

/** `XA-Review`: the card deck. `id` puts that capture first. */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const firstId = Array.isArray(params.id) ? params.id[0] : params.id;
  const session = useReviewSession(firstId);
  const mainCurrency = useMainCurrency();
  const { queue, results } = session;
  const decided = results.length;
  const total = decided + queue.length;

  const pendingMinor = queue
    .filter((p) => p.currency === mainCurrency && p.type === 'expense')
    .reduce((sum, p) => sum + Number(p.amountMinor ?? 0), 0);
  const subtitle =
    total === 0
      ? 'All clear'
      : queue.length === 0
        ? 'All reviewed'
        : `${formatMoney(pendingMinor as MinorAmount, mainCurrency)} not counted yet`;
  const count = total === 0 ? '0 left' : queue.length === 0 ? 'Done' : `${decided + 1} of ${total}`;

  return (
    <Page
      screen="review"
      kind="task"
      title="Review captures"
      subtitle={subtitle}
      trailing={
        <View className="h-8 justify-center rounded-full bg-sand px-3">
          <Text className="text-[13px] leading-[18px] font-display-bold text-foreground">
            {count}
          </Text>
        </View>
      }
    >
      {total > 0 ? (
        <View
          className="flex-row gap-1.5 px-5 pb-3"
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < decided ? 'bg-primary' : i === decided ? 'bg-inactive' : 'bg-sand-light'}`}
            />
          ))}
        </View>
      ) : null}
      <ReviewDeck session={session} />
    </Page>
  );
}
