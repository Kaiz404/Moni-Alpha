import { Text, View } from 'react-native';

type BudgetProgressBarProps = {
  percentage: number | null;
  color: string;
  label: string;
};

/** A text-backed progress treatment for budget use; it is never colour-only. */
export function BudgetProgressBar({
  percentage,
  color,
  label,
}: BudgetProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage ?? 0));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ now: clamped, min: 0, max: 100, text: label }}>
      <View className="h-2 overflow-hidden rounded-full bg-surface-2">
        <View
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </View>
      <Text className="mt-1.5 text-xs font-medium text-muted">{label}</Text>
    </View>
  );
}
