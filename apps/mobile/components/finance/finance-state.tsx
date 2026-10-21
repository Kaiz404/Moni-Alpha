import { FeedbackState } from '@/components/ui/feedback-state';
import { View } from 'react-native';

type FinanceStateProps = {
  title: string;
  variant?: 'loading' | 'empty' | 'error';
};

/** Shared loading, empty, and error presentation for selector-backed finance lists. */
export function FinanceState({
  title,
  variant = 'empty',
}: FinanceStateProps) {
  return (
    <View
      className={`rounded-card ${variant === 'error' ? 'border-danger/40 bg-sand' : 'bg-card'}`}
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
    >
      <FeedbackState
        title={title}
        mode={variant}
        icon={
          variant === 'error'
            ? 'alert-circle-outline'
            : 'receipt-text'
        }
        className="py-8"
      />
    </View>
  );
}
