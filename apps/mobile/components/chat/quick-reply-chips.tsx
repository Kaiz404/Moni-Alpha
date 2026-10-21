import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { QuickReplyOption } from '@/lib/ai/chat/messages';
import { Press } from '@/components/ui/press';
import { tid } from '@/lib/test-ids';

const LABELS: Record<QuickReplyOption, string> = {
  log_transaction: 'Review transaction',
  analyze_finances: 'Analyze finances',
};

type QuickReplyChipsProps = {
  options: QuickReplyOption[];
  onSelect: (option: QuickReplyOption) => void;
};

/** Explicit suggested actions, not decorative chat chips. */
export function QuickReplyChips({
  options,
  onSelect,
}: QuickReplyChipsProps) {
  return (
    <View className="mt-3 gap-2">
      {options.map((option) => (
        <Press
          testID={tid('chat', 'select', option)}
          pressedClassName="bg-hairline"
          key={option}
          onPress={() => onSelect(option)}
          className="self-start rounded-xl bg-primary-muted px-3 py-2"
          accessibilityLabel={LABELS[option]}
        >
          <Text className="text-[13px] font-display-semibold text-primary">
            {LABELS[option]}
          </Text>
        </Press>
      ))}
    </View>
  );
}
