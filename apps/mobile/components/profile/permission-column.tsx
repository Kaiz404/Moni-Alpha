import { Text, TouchableOpacity, View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type PermissionColumnProps = {
  title: string;
  statusLabel: string;
  granted?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  icon: IconSymbolName;
  iconTint: string;
  muted?: boolean;
  showAction: boolean;
  /** Supports legacy grid callers; Profile uses a full-width grouped row. */
  widthClassName?: string;
};

/** A readable permission cell for the Capture sources settings group. */
export function PermissionColumn({
  title,
  statusLabel,
  granted,
  actionLabel,
  onAction,
  actionDisabled,
  icon,
  iconTint,
  muted,
  showAction,
  widthClassName = 'w-full',
}: PermissionColumnProps) {
  const tokens = useThemeTokens();
  const stateLabel = muted
    ? 'Unavailable on this device'
    : granted
      ? 'Enabled'
      : statusLabel;

  return (
    <View
      className={`min-h-18 flex-row items-center px-4 py-3.5 ${widthClassName}`}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: iconTint }}
      >
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.primaryForeground}
        />
      </View>
      <View className="ml-3 flex-1 pr-3">
        <Text
          className="text-[17px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="mt-0.5 text-[13px] leading-[17px] text-muted"
          numberOfLines={2}
        >
          {stateLabel}
        </Text>
      </View>
      {muted ? (
        <Text className="text-[13px] font-semibold text-muted">
          Not available
        </Text>
      ) : granted ? (
        <View className="rounded-xl bg-success/15 px-3 py-2">
          <Text className="text-[13px] font-semibold text-success">On</Text>
        </View>
      ) : showAction && actionLabel && onAction ? (
        <TouchableOpacity
          className="rounded-xl bg-primary px-3 py-2"
          onPress={onAction}
          disabled={actionDisabled}
          activeOpacity={0.85}
        >
          <Text
            className="text-center text-[13px] font-semibold text-primary-foreground"
            numberOfLines={1}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="rounded-xl bg-surface-2 px-3 py-2">
          <Text className="text-[13px] font-semibold text-muted">Off</Text>
        </View>
      )}
    </View>
  );
}
