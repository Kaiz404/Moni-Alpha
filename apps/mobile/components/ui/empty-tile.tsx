import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type EmptyTileProps = {
  icon: IconSymbolName;
  title: string;
  body: string;
  action?: {
    testID: TestId;
    label: string;
    icon?: IconSymbolName;
    onPress: () => void;
  };
  className?: string;
};

export function EmptyTile({
  icon,
  title,
  body,
  action,
  className,
}: EmptyTileProps) {
  const tokens = useThemeTokens();
  return (
    <View
      className={`items-start gap-2.5 rounded-tile border-[1.5px] border-dashed border-border-strong px-[18px] py-[22px] ${className ?? ''}`}
    >
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.foreground}
        />
      </View>
      <Text
        variant="cardTitle"
        className="text-foreground"
      >
        {title}
      </Text>
      <Text className="text-[14px] leading-[20px] text-ink-2">
        {body}
      </Text>
      {action ? (
        <Press
          testID={action.testID}
          onPress={action.onPress}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-hairline"
          className="h-11 flex-row items-center gap-1.5 bg-sand px-[18px]"
        >
          {action.icon ? (
            <IconSymbol
              name={action.icon}
              size={18}
              color={tokens.foreground}
            />
          ) : null}
          <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
            {action.label}
          </Text>
        </Press>
      ) : null}
    </View>
  );
}

export function NotFound({
  icon,
  title,
  body,
}: {
  icon: IconSymbolName;
  title: string;
  body?: string;
}) {
  const tokens = useThemeTokens();
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-1 items-center justify-center gap-3 px-8"
    >
      <View className="h-14 w-14 items-center justify-center rounded-tile bg-sand">
        <IconSymbol
          name={icon}
          size={24}
          color={tokens.foreground}
        />
      </View>
      <Text
        variant="sectionTitle"
        className="text-center text-foreground"
      >
        {title}
      </Text>
      {body ? (
        <Text className="text-center text-[14px] leading-[20px] text-ink-2">
          {body}
        </Text>
      ) : null}
    </View>
  );
}
