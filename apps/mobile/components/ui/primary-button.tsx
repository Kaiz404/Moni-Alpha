import {
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { IconSymbol, type IconSymbolName } from './icon-symbol';

type PrimaryButtonProps = TouchableOpacityProps & {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  icon?: IconSymbolName;
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet';
};

export function PrimaryButton({
  label,
  loading,
  loadingLabel,
  icon,
  variant = 'primary',
  disabled,
  className,
  ...props
}: PrimaryButtonProps) {
  const tokens = useThemeTokens();
  const isDisabled = disabled || loading;
  const styles = {
    primary: {
      container: 'bg-primary',
      text: 'text-primary-foreground',
      icon: tokens.primaryForeground,
    },
    secondary: {
      container: 'bg-surface-2',
      text: 'text-foreground',
      icon: tokens.foreground,
    },
    destructive: {
      container: 'bg-danger',
      text: 'text-primary-foreground',
      icon: tokens.primaryForeground,
    },
    quiet: {
      container: 'bg-primary-muted',
      text: 'text-primary',
      icon: tokens.primary,
    },
  }[variant];

  return (
    <TouchableOpacity
      className={`min-h-13 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3.5 ${styles.container} ${isDisabled ? 'opacity-60' : ''} ${className ?? ''}`}
      disabled={isDisabled}
      activeOpacity={0.88}
      {...props}
    >
      {loading ? (
        <Text className={`text-base font-bold ${styles.text}`}>
          {loadingLabel ?? 'Please wait…'}
        </Text>
      ) : (
        <>
          {icon ? (
            <IconSymbol
              name={icon}
              size={20}
              color={styles.icon}
            />
          ) : null}
          <Text className={`text-base font-bold ${styles.text}`}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
