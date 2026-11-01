import { View } from 'react-native';

import { ReportRow } from '@/components/budget/report-row';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceField, type Saved } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { MerchantSpend } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

type MerchantListProps<M extends MerchantSpend> = {
  merchants: readonly M[];
  /** Shown beside the title, such as "3 merchants". */
  note?: string;
  currency: string;
  walletNames: Record<string, string>;
  look: (merchant: M) => {
    icon: string | null;
    color: string | null;
  };
  onOpen: (merchant: M) => void;
  /** "See all" beside the title, opening these payments in Activity. */
  onSeeAll?: () => void;
  /** The merchant key of a bank code still to name, or null when the row is already a name. */
  codeKey?: (merchant: M) => string | null;
  onName?: (key: string, raw: string, name: string) => Promise<Saved | void>;
};

/** "Top merchants": who got the most of this spending, with payment counts. */
export function MerchantList<M extends MerchantSpend>({
  merchants,
  note,
  currency,
  walletNames,
  look,
  onOpen,
  onSeeAll,
  codeKey,
  onName,
}: MerchantListProps<M>) {
  const tokens = useThemeTokens();
  if (!merchants.length) return null;
  return (
    <View className="gap-2">
      <View
        className={`flex-row justify-between ${onSeeAll ? 'items-center' : 'items-baseline'}`}
      >
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Top merchants
        </Text>
        {onSeeAll ? (
          <Button
            testID={tid('budget', 'merchants', 'see-all')}
            variant="tertiary"
            label="See all"
            icon="chevron-right"
            accessibilityLabel="See all payments in Activity"
            onPress={onSeeAll}
            className="-mr-3.5"
          />
        ) : note ? (
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
          const key = onName ? (codeKey?.(merchant) ?? null) : null;
          if (!key || !onName)
            return (
              <ReportRow
                key={merchant.name}
                testID={tid('budget', 'merchant', merchant.name)}
                icon={icon}
                color={color}
                title={merchant.name}
                meta={meta}
                amount={amount}
                onPress={() => onOpen(merchant)}
              />
            );
          return (
            <InPlaceField
              key={merchant.name}
              testID={tid('budget', 'merchant', key)}
              label={`Name for ${merchant.name}`}
              kind="text"
              required
              maxLength={30}
              autoCapitalize="words"
              placeholder="What is it?"
              value=""
              hint={
                <Text
                  variant="meta"
                  className="px-1 text-muted"
                >
                  {`The alert says ${merchant.name}. Moni uses your name for every ${merchant.name} payment.`}
                </Text>
              }
              onSave={(typed) => onName(key, merchant.name, typed)}
            >
              {({ editable, editor }) =>
                editor ? (
                  <View className="px-3.5 py-2.5">{editor}</View>
                ) : (
                  <View className="h-[66px] flex-row items-center gap-3.5 pl-[18px] pr-1.5">
                    <TintBubble
                      icon={resolveTransactionIcon(icon, 'expense')}
                      color={color}
                    />
                    <View className="min-w-0 flex-1">
                      {editable(
                        <Text
                          variant="rowTitle"
                          className="shrink text-foreground"
                          numberOfLines={1}
                        >
                          {merchant.name}
                        </Text>,
                        {
                          accessibilityLabel: `Name this merchant, ${merchant.name}`,
                        },
                      )}
                      <Text
                        variant="meta"
                        className="text-muted"
                        numberOfLines={1}
                      >
                        {meta}
                      </Text>
                    </View>
                    <Press
                      testID={tid('budget', 'merchant', key, 'open')}
                      accessibilityLabel={`${merchant.name}, ${meta}, ${amount}`}
                      accessibilityHint="Opens these payments"
                      radius={{ rest: 22, pressed: 16 }}
                      pressedClassName="bg-hairline"
                      className="h-11 flex-row items-center gap-1 pl-2.5 pr-1.5"
                      onPress={() => onOpen(merchant)}
                    >
                      <Text
                        variant="rowTitle"
                        className="text-foreground"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {amount}
                      </Text>
                      <IconSymbol
                        name="chevron-right"
                        size={20}
                        color={tokens.muted}
                      />
                    </Press>
                  </View>
                )
              }
            </InPlaceField>
          );
        })}
      </ListCard>
    </View>
  );
}
