import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type BrandHeaderProps = {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
};

/** Primary-colored top bar used on form / stack screens. */
export function BrandHeader({ title, onBack, showBack = true }: BrandHeaderProps) {
  const handleBack = onBack ?? (() => router.back());

  return (
    <SafeAreaView edges={['top']} className="bg-primary">
      <View className="h-25 flex-row items-center justify-start rounded-b-2xl border border-transparent bg-primary pl-7 pr-5 shadow-xl/50 shadow-primary">
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft active:opacity-80">
            <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>
        ) : null}
        <Text
          className={`flex-1 text-2xl font-medium text-primary-foreground ${showBack ? 'ml-3' : ''}`}
          numberOfLines={1}>
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
}
