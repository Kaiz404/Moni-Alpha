import { Text, View } from 'react-native';

type FinanceStateProps = {
  title: string;
  detail?: string;
  variant?: 'loading' | 'empty' | 'error';
};

/** Shared loading, empty, and error presentation for selector-backed finance lists. */
export function FinanceState({ title, detail, variant = 'empty' }: FinanceStateProps) {
  const tone = variant === 'error' ? 'border-destructive/40 bg-danger/10' : 'border-dashed border-border bg-card';
  return (
    <View className={`rounded-2xl border p-5 ${tone}`} accessibilityRole={variant === 'error' ? 'alert' : undefined}>
      <Text className="text-center font-semibold text-foreground">{title}</Text>
      {detail ? <Text className="mt-1 text-center text-sm text-muted">{detail}</Text> : null}
    </View>
  );
}
