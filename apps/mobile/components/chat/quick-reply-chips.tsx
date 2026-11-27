import { View } from 'react-native';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import type { QuickReplyOption } from '@/lib/ai/chat/messages';
import { tid } from '@/lib/test-ids';

const LABELS: Record<QuickReplyOption, string> = {
  log_transaction: 'Add it',
  analyze_finances: 'Ask about it',
};

/** The two answers to "add or ask?", as capsules on Moni's bubble. */
export function QuickReplyChips({
  options,
  onSelect,
}: {
  options: QuickReplyOption[];
  onSelect: (option: QuickReplyOption) => void;
}) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {options.map((option) => (
        <Press
          testID={tid('chat', 'select', option)}
          key={option}
          onPress={() => onSelect(option)}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-on-moni-card-body"
          className="h-11 justify-center bg-moni-card-action px-4"
          accessibilityLabel={LABELS[option]}
        >
          <Text className="text-[15px] font-display-semibold text-on-moni-card-action">{LABELS[option]}</Text>
        </Press>
      ))}
    </View>
  );
}
