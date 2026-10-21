import { ActivityIndicator, View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { approve, notMine } from '@/lib/haptics';
import type { TestId } from '@/lib/test-ids';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'approve'
  | 'notMine'
  | 'destructive';

type Tokens = ReturnType<typeof useThemeTokens>;

type Look = {
  fill: string;
  pressed: string;
  text: string;
  ink: (tokens: Tokens) => string;
  tall: boolean;
  haptic?: () => void;
};

// V2F-Components "Buttons": rest fill, pressed fill one step darker, text colour.
const looks: Record<ButtonVariant, Look> = {
  primary: {
    fill: 'bg-primary',
    pressed: 'bg-primary-pressed',
    text: 'text-primary-foreground',
    ink: (t) => t.primaryForeground,
    tall: true,
  },
  secondary: {
    fill: 'bg-sand',
    pressed: 'bg-hairline',
    text: 'text-foreground',
    ink: (t) => t.foreground,
    tall: true,
  },
  tertiary: {
    fill: '',
    pressed: 'bg-sand-light',
    text: 'text-deep-mint',
    ink: (t) => t.deepMint,
    tall: false,
  },
  approve: {
    fill: 'bg-mint',
    pressed: 'bg-mint-pressed',
    text: 'text-on-pastel',
    ink: (t) => t.onPastel,
    tall: true,
    haptic: approve,
  },
  notMine: {
    fill: 'bg-sand',
    pressed: 'bg-hairline',
    text: 'text-foreground',
    ink: (t) => t.foreground,
    tall: true,
    haptic: notMine,
  },
  destructive: {
    fill: 'bg-destructive-fill',
    pressed: 'bg-destructive-pressed',
    text: 'text-state-destructive',
    ink: (t) => t.states.destructive,
    tall: true,
  },
};

export type ButtonProps = {
  testID: TestId;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconSymbolName;
  loading?: boolean;
  /** Replaces the label while loading, such as "Saving". */
  loadingLabel?: string;
  disabled?: boolean;
  /** Layout only (margins, flex, width); the variant owns colour and size. */
  className?: string;
  accessibilityLabel?: string;
  /** A sheet's pinned action is 56 tall. */
  pinned?: boolean;
};

/** The v2 capsule: 52 tall (tertiary 44), 15/600 label, one variant per role. */
export function Button({
  testID,
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  className,
  accessibilityLabel,
  pinned = false,
}: ButtonProps) {
  const tokens = useThemeTokens();
  const look = looks[variant];
  const inactive = disabled || loading;
  const height = pinned ? 56 : look.tall ? 52 : 44;
  const ink = disabled ? tokens.muted : look.ink(tokens);
  const glyph = loading ? (
    <ActivityIndicator
      size={18}
      color={ink}
    />
  ) : icon ? (
    <View pointerEvents="none">
      <IconSymbol
        name={icon}
        size={variant === 'tertiary' ? 18 : 20}
        color={ink}
      />
    </View>
  ) : null;

  return (
    <Press
      testID={testID}
      onPress={() => {
        look.haptic?.();
        onPress();
      }}
      disabled={inactive}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      radius={{ rest: height / 2, pressed: 16 }}
      pressedClassName={look.pressed}
      className={`flex-row items-center justify-center ${look.tall ? 'gap-2 px-6' : 'gap-0.5 px-3.5'} ${disabled ? 'bg-sand-light' : look.fill} ${className ?? ''}`}
      style={{ height }}
    >
      {variant === 'tertiary' ? null : glyph}
      <Text
        className={`text-[15px] leading-[21px] font-display-semibold ${disabled ? 'text-muted' : look.text}`}
        numberOfLines={1}
      >
        {loading ? (loadingLabel ?? label) : label}
      </Text>
      {variant === 'tertiary' ? glyph : null}
    </Press>
  );
}
