import { View } from 'react-native';

import { ListCard } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import type { MerchantSpend } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

type MerchantListProps = {
  merchants: readonly MerchantSpend[];
  /** Shown beside the title, such as "3 merchants". */
  note?: string;
  currency: string;
  walletNames: Record<string, string>;
  look: (merchant: MerchantSpend) => { icon: string | null; color: string | null };
};

/** "Top merchants": who got the most of this spending, with payment counts. */
export function MerchantList({ merchants, note, currency, walletNames, look }: MerchantListProps) {
  if (!merchants.length) return null;
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Top merchants
        </Text>
        {note ? (
          <Text
            variant="meta"
            className="text-muted"
          >
            {note}
          </Text>
        ) : null}
      </View>
      <ListCard>
        {merchants.map((merchant) => {
          const { icon, color } = look(merchant);
          const meta = `${merchant.payments === 1 ? '1 payment' : `${merchant.payments} payments`} · ${walletNames[merchant.walletId] ?? 'Wallet'}`;
          const amount = formatMoney(merchant.spentMinor, currency);
          return (
            <View
              key={merchant.name}
              accessible
              accessibilityLabel={`${merchant.name}, ${meta}, ${amount}`}
              className="h-[66px] flex-row items-center gap-3.5 px-[18px]"
            >
              <TintBubble
                icon={resolveTransactionIcon(icon, 'expense')}
                color={color}
              />
              <View className="min-w-0 flex-1">
                <Text
                  variant="rowTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {merchant.name}
                </Text>
                <Text
                  variant="meta"
                  className="text-muted"
                  numberOfLines={1}
                >
                  {meta}
                </Text>
              </View>
              <Text
                variant="rowTitle"
                className="text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {amount}
              </Text>
            </View>
          );
        })}
      </ListCard>
    </View>
  );
}
