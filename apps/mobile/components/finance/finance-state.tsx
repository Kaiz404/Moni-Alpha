import { FeedbackState } from '@/components/ui/feedback-state';
import { Surface } from '@/components/ui/surface';

type FinanceStateProps = {
  title: string;
  detail?: string;
  variant?: 'loading' | 'empty' | 'error';
};

/** Shared loading, empty, and error presentation for selector-backed finance lists. */
export function FinanceState({
  title,
  detail,
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
        description={detail}
        mode={variant}
        icon={variant === 'error' ? 'error-outline' : 'receipt-long'}
        className="py-8"
      />
    </Surface>
  );
}
