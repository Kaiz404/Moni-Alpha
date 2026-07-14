import { View, Pressable, Text } from 'react-native';

import type { QuickReplyOption } from '@/lib/ai/chat/messages';

const LABELS: Record<QuickReplyOption, string> = {
  log_transaction: 'Log transaction',
  analyze_finances: 'Analyze finances',
};

type QuickReplyChipsProps = {
  options: QuickReplyOption[];
  onSelect: (option: QuickReplyOption) => void;
};

export function QuickReplyChips({ options, onSelect }: QuickReplyChipsProps) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          className="rounded-full border border-primary/40 bg-primary-muted px-3 py-1.5"
        >
          <Text className="text-sm font-medium text-primary">{LABELS[option]}</Text>
        </Pressable>
      ))}
    </View>
  );
}
