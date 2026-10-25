import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import type { FinanceProposal } from '@/lib/finance/types';
import { tid } from '@/lib/test-ids';

const sourceIcon: Record<FinanceProposal['sourceType'], IconSymbolName> = {
  notification: 'bell-outline',
  text: 'message-text-outline',
  image: 'receipt-text-outline',
};

/** Lilac block over the captures waiting for a decision; hidden when none wait. */
export function ReviewBlock({
  proposals,
  currency,
  onPress,
}: {
  proposals: readonly FinanceProposal[];
  currency: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  if (!proposals.length) return null;
  const count = proposals.length;
  const title = `${count} ${count === 1 ? 'capture' : 'captures'} to review`;
  const waitingMinor = proposals
    .filter((proposal) => proposal.currency === currency)
    .reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);
  const waiting = `${formatMoney(waitingMinor, currency)} waiting`;

  return (
    <Press
      testID={tid('home', 'review')}
      accessibilityLabel={`${title}, ${waiting}. Review`}
      onPress={onPress}
      pressedClassName="bg-lilac"
      className="flex-row items-center gap-3 rounded-card bg-lilac py-3 pl-[18px] pr-3.5"
    >
      <View className="min-w-0 flex-1 gap-1.5">
        <Text
          variant="cardTitle"
          className="text-on-pastel"
        >
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="h-[26px] flex-row items-center">
            {proposals.slice(0, 3).map((proposal, index) => (
              <View
                key={proposal.id}
                className="h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-lilac bg-card"
                style={{ marginLeft: index ? -10 : -2 }}
              >
                <IconSymbol
                  name={sourceIcon[proposal.sourceType]}
                  size={14}
                  color={tokens.onPastel}
                />
              </View>
            ))}
          </View>
          <Text
            variant="meta"
            className="text-on-lilac"
          >
            {waiting}
          </Text>
        </View>
      </View>
      <View className="h-11 flex-row items-center gap-0.5 rounded-full bg-primary pl-4 pr-2.5">
        <Text className="text-[15px] font-display-semibold text-primary-foreground">Review</Text>
        <IconSymbol
          name="chevron-right"
          size={20}
          color={tokens.primaryForeground}
        />
      </View>
    </Press>
  );
}
