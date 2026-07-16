import { Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

type PermissionColumnProps = {
  title: string;
  statusLabel: string;
  granted?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconTint: string;
  muted?: boolean;
  showAction: boolean;
  /** e.g. `w-[48%]` when using a 2×2 grid */
  widthClassName?: string;
};

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
  widthClassName = 'flex-1 min-w-0',
}: PermissionColumnProps) {
  return (
    <View className={`rounded-2xl border border-border bg-card p-3 ${widthClassName}`}>
      <View
        className="mx-auto h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconTint }}>
        <MaterialIcons name={icon} size={20} color="#fff" />
      </View>
      <Text
        className="mt-2 text-center text-xs font-semibold text-foreground"
        numberOfLines={2}>
        {title}
      </Text>
      <Text
        className="mt-1 text-center text-[10px] leading-tight text-muted"
        numberOfLines={2}>
        {statusLabel}
      </Text>
      {muted ? (
        <Text className="mt-2 text-center text-[10px] text-muted">—</Text>
      ) : granted ? (
        <View className="mt-2 rounded-lg bg-success/15 py-2">
          <Text className="text-center text-[10px] font-semibold text-success">On</Text>
        </View>
      ) : showAction && actionLabel && onAction ? (
        <TouchableOpacity
          className="mt-2 rounded-lg bg-primary px-1.5 py-2"
          onPress={onAction}
          disabled={actionDisabled}
          activeOpacity={0.85}>
          <Text
            className="text-center text-[10px] font-semibold leading-tight text-white"
            numberOfLines={2}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="mt-2 rounded-lg bg-background-muted py-2">
          <Text className="text-center text-[10px] font-semibold text-muted">Off</Text>
        </View>
      )}
    </View>
  );
}
