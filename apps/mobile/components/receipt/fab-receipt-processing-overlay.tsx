import { ActivityIndicator, Modal, Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useFabReceiptProcessing } from '@/lib/receipts/fab-receipt-processing';

/** Full-screen loading state shown after FAB receipt capture while AI extraction runs. */
export function FabReceiptProcessingOverlay() {
  const tokens = useThemeTokens();
  const { active } = useFabReceiptProcessing();

  if (!active) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View className="w-full max-w-xs items-center rounded-2xl bg-card px-8 py-7">
          <ActivityIndicator
            size="large"
            color={tokens.primary}
          />
          <Text className="mt-4 text-center text-sm font-medium text-foreground">
            Reading receipt…
          </Text>
          <Text className="mt-1 text-center text-xs text-muted">
            This usually takes a few seconds
          </Text>
        </View>
      </View>
    </Modal>
  );
}
