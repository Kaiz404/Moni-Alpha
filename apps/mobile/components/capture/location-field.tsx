import { View } from 'react-native';

import { FieldBubble } from '@/components/capture/field-bubble';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { placeLabel } from '@/lib/finance/places';
import { tid } from '@/lib/test-ids';
import type { EntryLocation } from '@/lib/transactions/prefetch-location';

function placeWords(
  here: Exclude<EntryLocation, { status: 'none' }>,
  removed: boolean,
): string {
  if (removed) return 'Not saved';
  if (here.status === 'finding') return 'Finding';
  return placeLabel(here.location.name)?.name ?? 'Saved here';
}

/**
 * Type it's Location field, shaped like the fields beside it (V2A-CaptureType): shows where this
 * entry is being saved, and one tap takes the location off the entry or puts it back.
 */
export function LocationField({
  here,
  removed,
  onToggle,
}: {
  here: Exclude<EntryLocation, { status: 'none' }>;
  removed: boolean;
  onToggle: () => void;
}) {
  const tokens = useThemeTokens();
  const words = placeWords(here, removed);
  return (
    <Press
      testID={tid('capture', 'location')}
      accessibilityLabel={
        removed
          ? 'Location not saved with this entry. Add it back.'
          : `Location, ${words}. Remove it from this entry.`
      }
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-[60px] flex-row items-center gap-2.5 bg-sand px-2.5"
      onPress={onToggle}
    >
      <FieldBubble color={tokens.card}>
        <IconSymbol
          name={removed ? 'map-marker-off-outline' : 'map-marker-outline'}
          size={17}
          color={tokens.foreground}
        />
      </FieldBubble>
      <View className="min-w-0 flex-1 gap-px">
        <Text
          className="text-[12px] leading-[16px] text-ink-2"
          numberOfLines={1}
        >
          Location
        </Text>
        <Text
          className={`text-[15px] leading-[20px] font-display-semibold ${removed ? 'text-muted' : 'text-foreground'}`}
          numberOfLines={1}
        >
          {words}
        </Text>
      </View>
      <View pointerEvents="none">
        <IconSymbol
          name={removed ? 'undo' : 'close'}
          size={20}
          color={tokens.ink2}
        />
      </View>
    </Press>
  );
}
