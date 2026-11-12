import { View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { FieldBubble } from '@/components/capture/field-bubble';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { LocationFieldState } from '@/lib/capture/entry-place';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

const WORDS: Record<Exclude<LocationFieldState['kind'], 'place'>, string> = {
  finding: 'Finding',
  empty: 'Add place',
  off: 'Not saved',
};

const SWAP_IN = FadeIn.duration(180);
const ACCEPT_IN = ZoomIn.springify()
  .stiffness(springs.control.stiffness)
  .damping(springs.control.damping);

/** A shop the user paid at near here, offered until they type a shop or pick a place. */
export type LocationOffer = { merchant: string; categoryName: string | null };

/**
 * The capture pages' Location field, shaped like the `PickerField size="capture"` beside it:
 * the place saved with the entry, and a tap opens the place sheet. Near a shop the user paid at
 * before, it reads "Been here?" with the shop and a check that fills it in.
 */
export function LocationField({
  state,
  offer,
  onOpen,
  onAccept,
}: {
  state: LocationFieldState;
  offer: LocationOffer | null;
  onOpen: () => void;
  onAccept: () => void;
}) {
  const tokens = useThemeTokens();
  const value = state.kind === 'place' ? state.name : WORDS[state.kind];
  const quiet = state.kind === 'empty' || state.kind === 'off';
  const label = offer ? 'Been here?' : 'Location';
  const shown = offer ? offer.merchant : value;
  const offerWords = offer
    ? offer.categoryName
      ? `${offer.merchant}, ${offer.categoryName}`
      : offer.merchant
    : '';
  return (
    <Press
      testID={tid('capture', 'location')}
      accessibilityLabel={
        offer
          ? `You paid at ${offer.merchant} near here before. Location, ${value}`
          : `Location, ${value}`
      }
      accessibilityHint="Opens a map to choose a place"
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-[60px] min-w-0 flex-1 flex-row items-center gap-2.5 bg-sand px-2.5"
      onPress={onOpen}
    >
      <FieldBubble color={tokens.card}>
        <IconSymbol
          name={state.kind === 'off' && !offer ? 'map-marker-off-outline' : 'map-marker-outline'}
          size={17}
          color={tokens.foreground}
        />
      </FieldBubble>
      <Animated.View
        key={`${label}:${shown}`}
        entering={SWAP_IN}
        className="min-w-0 flex-1 gap-px"
      >
        <Text
          className="text-[12px] leading-[16px] text-ink-2"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className={`text-[15px] leading-[20px] font-display-semibold ${quiet && !offer ? 'text-muted' : 'text-foreground'}`}
          numberOfLines={1}
        >
          {shown}
        </Text>
      </Animated.View>
      {offer ? (
        <Animated.View entering={ACCEPT_IN}>
          <Press
            testID={tid('capture', 'location', 'accept')}
            accessibilityLabel={`Use ${offerWords}`}
            hitSlop={6}
            className="h-8 w-8 items-center justify-center rounded-full bg-block-mint"
            pressedClassName="bg-mint-pressed"
            onPress={onAccept}
          >
            <IconSymbol
              name="check"
              size={18}
              color={tokens.onPastel}
            />
          </Press>
        </Animated.View>
      ) : (
        <View pointerEvents="none">
          <IconSymbol
            name="chevron-down"
            size={20}
            color={tokens.ink2}
          />
        </View>
      )}
    </Press>
  );
}
