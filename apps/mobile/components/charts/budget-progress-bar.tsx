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
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        now: clamped,
        min: 0,
        max: 100,
        text: label,
      }}
    >
      <View className="h-5 overflow-hidden rounded-full bg-surface-2">
        <View
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
        <Text
          pointerEvents="none"
          className="absolute inset-y-0 left-2 right-2 flex-row items-center align-middle text-right text-[10px] font-bold text-muted"
          accessibilityElementsHidden
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
