import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export function AiReasoningSection({
  reasoning,
  confidence,
}: {
  reasoning: string;
  confidence: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mt-4">
      <TouchableOpacity
        className="flex-row items-center"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <Text className="text-xs font-medium text-muted">AI analysis {expanded ? '▲' : '▼'}</Text>
        {confidence !== null ? (
          <View className="ml-2 rounded bg-background-muted px-2 py-0.5">
            <Text className="text-xs text-muted">{Math.round(confidence * 100)}% confidence</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {expanded ? <Text className="mt-2 text-xs leading-4 text-muted">{reasoning}</Text> : null}
    </View>
  );
}
