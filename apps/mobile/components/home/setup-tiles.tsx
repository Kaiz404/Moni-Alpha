import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

export type SetupStep = {
  key: 'wallet' | 'budget' | 'alerts';
  title: string;
  body: string;
  done: boolean;
  onPress: () => void;
};

/** V2H-HomeFirstRun: the three setup steps; the first one not done is filled. */
export function SetupTiles({ steps }: { steps: readonly SetupStep[] }) {
  const tokens = useThemeTokens();
  const current = steps.findIndex((step) => !step.done);
  return (
    <View
      accessibilityLabel="Setup steps"
      className="rounded-card bg-mint py-1.5 pl-[18px] pr-3"
    >
      {steps.map((step, index) => {
        const filled = step.done || index === current;
        return (
          <Press
            key={step.key}
            testID={tid('home', 'setup', step.key)}
            accessibilityLabel={`Step ${index + 1}, ${step.title}${step.done ? ', done' : ''}`}
            onPress={step.onPress}
            pressedClassName="bg-mint-pressed"
            className="min-h-14 flex-row items-center gap-3 rounded-tile"
          >
            <View
              className={`h-8 w-8 items-center justify-center rounded-full ${filled ? 'bg-primary' : 'border-[1.5px] border-on-pastel/40'}`}
            >
              {step.done ? (
                <IconSymbol
                  name="check"
                  size={16}
                  color={tokens.primaryForeground}
                />
              ) : (
                <Text
                  className={`text-[13px] font-display-bold ${filled ? 'text-primary-foreground' : 'text-on-pastel'}`}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text
                variant="rowTitle"
                className={`text-on-pastel ${step.done ? 'line-through opacity-60' : ''}`}
              >
                {step.title}
              </Text>
              <Text
                variant="meta"
                className="text-on-mint"
              >
                {step.body}
              </Text>
            </View>
            <IconSymbol
              name="chevron-right"
              size={20}
              color={tokens.onPastel}
            />
          </Press>
        );
      })}
    </View>
  );
}
