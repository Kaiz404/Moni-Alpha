import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/** The Lilac "AI" label (W2-Parts, "The AI label") on Moni chat and on Moni's AI pages. */
export function AiTag() {
  return (
    <View
      className="h-5 flex-none items-center justify-center rounded-[7px] bg-pending-fill px-[7px]"
      accessible
      accessibilityLabel="AI"
    >
      <Text className="font-display-bold text-[11px] leading-[14px] tracking-[0.44px] text-on-lilac">AI</Text>
    </View>
  );
}
