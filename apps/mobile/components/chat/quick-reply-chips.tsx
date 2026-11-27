import { View } from 'react-native';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import type { QuickReplyOption } from '@/lib/ai/chat/messages';
import { tid, type TestId } from '@/lib/test-ids';

const LABELS: Record<QuickReplyOption, string> = {
  log_transaction: 'Add it',
  analyze_finances: 'Ask about it',
};

/** Answers to tap under Moni's words, as capsules on Moni's bubble. */
export function ReplyChips<T>({
  replies,
  onSelect,
}: {
  replies: { value: T; label: string; testID: TestId }[];
  onSelect: (value: T) => void;
}) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {replies.map((reply) => (
        <Press
          testID={reply.testID}
          key={reply.testID}
          onPress={() => onSelect(reply.value)}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-on-moni-card-body"
          className="min-h-11 justify-center bg-moni-card-action px-4 py-2.5"
          accessibilityLabel={reply.label}
        >
          <Text className="text-[15px] leading-[20px] font-display-semibold text-on-moni-card-action">
            {reply.label}
          </Text>
        </Press>
      ))}
    </View>
  );
}

/** The two answers to "add or ask?". */
export function QuickReplyChips({
  options,
  onSelect,
}: {
  options: QuickReplyOption[];
  onSelect: (option: QuickReplyOption) => void;
}) {
  return (
    <ReplyChips
      replies={options.map((option) => ({
        value: option,
        label: LABELS[option],
        testID: tid('chat', 'select', option),
      }))}
      onSelect={onSelect}
    />
  );
}
