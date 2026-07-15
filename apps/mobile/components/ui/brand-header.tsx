import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type BrandHeaderProps = {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
};

/** Minimal top bar used on form / stack screens — neutral background, one accent touch. */
export function BrandHeader({ title, onBack, showBack = true }: BrandHeaderProps) {
  const tokens = useThemeTokens();
  const handleBack = onBack ?? (() => router.back());

  return (
    <SafeAreaView edges={['top']} className="bg-background">
      <View className="h-16 flex-row items-center border-b border-border bg-background pl-4 pr-5">
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-background-muted active:opacity-80">
            <MaterialIcons name="arrow-back" size={20} color={tokens.foreground} />
          </Pressable>
        ) : null}
        <Text
          className={`flex-1 text-lg font-semibold text-foreground ${showBack ? 'ml-3' : ''}`}
          numberOfLines={1}>
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
}
