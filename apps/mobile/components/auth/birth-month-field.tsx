import { View } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

export type BirthPick = { month: number | null; year: number | null };

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** W2-Auth lists this year back to 100 years ago. */
const YEARS_SHOWN = 101;

function Box({
  part,
  label,
  value,
  icon,
  disabled,
  onPress,
}: {
  part: 'month' | 'year';
  label: string;
  value: string | null;
  icon?: IconSymbolName;
  disabled: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('auth', 'birth', part)}
      accessibilityLabel={`Birth ${part}, ${value ?? 'not chosen'}`}
      accessibilityHint="Opens a picker"
      disabled={disabled}
      pressedClassName="bg-sand-light"
      className="h-[55px] min-w-0 flex-1 flex-row items-center gap-2.5 rounded-field border-[1.5px] border-hairline bg-card px-[18px]"
      onPress={onPress}
    >
      {icon ? (
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.muted}
        />
      ) : null}
      <Text
        className={`min-w-0 flex-1 text-[16px] ${value ? 'text-foreground' : 'text-muted'}`}
        numberOfLines={1}
      >
        {value ?? label}
      </Text>
      <IconSymbol
        name="chevron-down"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}

/** W2-Auth's Date of birth: a month and a year, never the day, with the 18+ line under them. */
export function BirthMonthField({
  value,
  onChange,
  thisYear,
  disabled = false,
}: {
  value: BirthPick;
  onChange: (next: BirthPick) => void;
  thisYear: number;
  disabled?: boolean;
}) {
  const pickMonth = async () => {
    const picked = await openSheet({
      kind: 'choice',
      title: 'Birth month',
      options: MONTHS.map((name, index) => ({
        id: String(index + 1),
        name,
      })),
      selected: value.month === null ? null : String(value.month),
    });
    if (picked) onChange({ ...value, month: Number(picked) });
  };

  const pickYear = async () => {
    const picked = await openSheet({
      kind: 'choice',
      title: 'Birth year',
      options: Array.from({ length: YEARS_SHOWN }, (_, index) => {
        const year = String(thisYear - index);
        return { id: year, name: year };
      }),
      selected: value.year === null ? null : String(value.year),
    });
    if (picked) onChange({ ...value, year: Number(picked) });
  };

  return (
    <View className="gap-2">
      <Text className="text-[13px] leading-[18px] font-display-semibold text-ink-2">
        Date of birth
      </Text>
      <View className="flex-row gap-2.5">
        <Box
          part="month"
          label="Month"
          icon="calendar-blank-outline"
          value={value.month === null ? null : (MONTHS[value.month - 1] ?? null)}
          disabled={disabled}
          onPress={() => void pickMonth()}
        />
        <Box
          part="year"
          label="Year"
          value={value.year === null ? null : String(value.year)}
          disabled={disabled}
          onPress={() => void pickYear()}
        />
      </View>
      <Text
        variant="meta"
        className="text-muted"
      >
        Moni is for people 18 and over. We keep only the month and year.
      </Text>
    </View>
  );
}

/** `YYYY-MM` once both halves are picked. */
export function birthMonthOf(pick: BirthPick): string | null {
  if (pick.month === null || pick.year === null) return null;
  return `${pick.year}-${String(pick.month).padStart(2, '0')}`;
}
