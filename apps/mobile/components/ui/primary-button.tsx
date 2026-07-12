import { Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type PrimaryButtonProps = TouchableOpacityProps & {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

export function PrimaryButton({
  label,
  loading,
  loadingLabel,
  icon,
  disabled,
  className,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 ${isDisabled ? 'opacity-60' : ''} ${className ?? ''}`}
      disabled={isDisabled}
      activeOpacity={0.88}
      {...props}>
      {loading ? (
        <Text className="text-base font-semibold text-primary-foreground">
          {loadingLabel ?? 'Please wait…'}
        </Text>
      ) : (
        <>
          {icon ? <MaterialIcons name={icon} size={20} color="#ffffff" /> : null}
          <Text className="text-base font-semibold text-primary-foreground">{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
