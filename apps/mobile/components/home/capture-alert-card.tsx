import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useCaptureAlert } from '@/components/capture-sources/use-capture-alert';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { tid } from '@/lib/test-ids';

/** In the check-in card's style, because it asks the same thing: is what Moni knows still right? */
export function CaptureAlertCard() {
  const model = useCaptureAlert();
  if (!model) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      className="gap-3 rounded-card bg-block-lemon p-[18px]"
    >
      <View className="gap-0.5">
        <Text
          variant="caps"
          className="text-on-lemon"
        >
          Bank alerts
        </Text>
        <Text
          variant="cardTitle"
          className="text-on-pastel"
          accessibilityRole="header"
        >
          {model.title}
        </Text>
        <Text className="text-[14px] leading-[20px] text-on-lemon">{model.body}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Press
          testID={tid('home', 'capture-alert', 'fix')}
          onPress={model.fix}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-mint-pressed"
          className="h-11 justify-center bg-block-mint px-3.5"
        >
          <Text className="text-[15px] font-display-semibold text-on-pastel">
            {model.actionLabel}
          </Text>
        </Press>
        <Press
          testID={tid('home', 'capture-alert', 'dismiss')}
          onPress={model.dismiss}
          pressedClassName="bg-transparent"
          className="ml-auto h-11 justify-center px-1"
        >
          <Text className="text-[15px] font-display-semibold text-on-pastel underline">
            {model.dismissLabel}
          </Text>
        </Press>
      </View>
    </Animated.View>
  );
}
