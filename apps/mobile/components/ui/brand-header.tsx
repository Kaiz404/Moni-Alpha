import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { IconSymbol } from './icon-symbol';

type BrandHeaderProps = {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: ReactNode;
};

/** Minimal top bar used on form / stack screens — neutral background, one accent touch. */
export function BrandHeader({
  title,
  onBack,
  showBack = true,
  rightAction,
}: BrandHeaderProps) {
  const tokens = useThemeTokens();
  const handleBack = onBack ?? (() => router.back());

  return (
    <SafeAreaView
      edges={['top']}
      className="bg-canvas"
    >
      <View className="h-16 flex-row items-center border-b border-border-subtle bg-canvas pl-5 pr-5">
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-80"
          >
            <IconSymbol
              name="arrow-left"
              size={20}
              color={tokens.foreground}
            />
          </Pressable>
        ) : null}
        <Text
          className={`flex-1 text-lg font-semibold text-foreground ${showBack ? 'ml-3' : ''}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {rightAction ? (
          <View className="-mr-1 ml-2">{rightAction}</View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
