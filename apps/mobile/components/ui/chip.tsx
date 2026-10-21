import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type ChipProps = {
  testID: TestId;
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  icon?: IconSymbolName;
};

/** A 36-tall capsule for filters and picks, with a 44 hit area. Selected is Ink. */
export function Chip({
  testID,
  label,
  onPress,
  selected = false,
  disabled = false,
  icon,
}: ChipProps) {
  const tokens = useThemeTokens();
  const ink = disabled
    ? tokens.muted
    : selected
      ? tokens.primaryForeground
      : tokens.foreground;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      radius={{ rest: 18, pressed: 16 }}
      pressedClassName={
        selected ? 'bg-primary-pressed' : 'bg-hairline'
      }
      className={`h-9 flex-row items-center gap-1.5 self-start px-3.5 ${disabled ? 'bg-sand-light' : selected ? 'bg-primary' : 'bg-sand'}`}
    >
      {icon ? (
        <IconSymbol
          name={icon}
          size={16}
          color={ink}
        />
      ) : null}
      <Text
        className={`text-[14px] leading-[19px] font-display-semibold ${disabled ? 'text-muted' : selected ? 'text-primary-foreground' : 'text-foreground'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Press>
  );
}
