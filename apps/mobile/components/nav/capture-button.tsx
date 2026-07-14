import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';

const captureCardStyle = getWalletCardStyle('emerald-grain');

/**
 * Floating center action on the tab bar.
 * Tap -> live receipt scanner. Long-press -> AI narration ("hold to speak").
 */
export function CaptureButton() {
  const longPressTriggeredRef = useRef(false);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: -28, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan a receipt. Hold to narrate a transaction instead."
        delayLongPress={420}
        onPressIn={() => {
          longPressTriggeredRef.current = false;
        }}
        onPress={() => {
          if (longPressTriggeredRef.current) return;
          router.push('/scan/receipt' as any);
        }}
        onLongPress={() => {
          longPressTriggeredRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/scan/listen' as any);
        }}
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 8,
        }}
      >
        <GradientCard
          cardStyle={captureCardStyle}
          className="h-16 w-16 items-center justify-center rounded-full border-[3px] border-background">
          <MaterialIcons name="camera-alt" size={26} color="#ffffff" />
        </GradientCard>
      </Pressable>
    </View>
  );
}
