import { ActivityIndicator, Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { IconSymbol, type IconSymbolName } from './icon-symbol';

type FeedbackStateProps = {
  title: string;
  icon?: IconSymbolName;
  mode?: 'empty' | 'loading' | 'error';
  className?: string;
};

/** Calm empty/loading/error treatment for a full content area or list. */
export function FeedbackState({
  title,
  icon = 'inbox',
  mode = 'empty',
  className,
}: FeedbackStateProps) {
  const tokens = useThemeTokens();
  const tint = mode === 'error' ? tokens.danger : tokens.primary;

  return (
    <View
      className={`items-center justify-center px-6 py-10 ${className ?? ''}`}
      accessibilityLiveRegion="polite"
    >
      <View
        className={`mb-4 h-14 w-14 items-center justify-center rounded-full ${
          mode === 'error' ? 'bg-danger/10' : 'bg-primary-muted'
        }`}
      >
        {mode === 'loading' ? (
          <ActivityIndicator color={tint} />
        ) : (
          <IconSymbol
            name={icon}
            size={26}
            color={tint}
          />
        )}
      </View>
      <Text className="text-center text-lg font-bold text-foreground">
        {title}
      </Text>
    </View>
  );
}
