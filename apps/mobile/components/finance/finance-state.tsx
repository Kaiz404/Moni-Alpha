import { FeedbackState } from '@/components/ui/feedback-state';
import { Surface } from '@/components/ui/surface';

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
    <Surface
      tone={variant === 'error' ? 'muted' : 'default'}
      className={
        variant === 'error' ? 'border-danger/40 bg-danger/10' : ''
      }
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
    </Surface>
  );
}
