import { router, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PlusButton,
  plusRingBottom,
  plusTop,
  RING_SIZE,
} from '@/components/nav/plus-button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import {
  Sheet,
  type SheetFrameProps,
} from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import {
  openSheet,
  type CaptureChoice,
} from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

type Choice = {
  label: string;
  icon: IconSymbolName;
  bubble: string;
  glyph: 'onPastel' | 'moniGlyph';
  href: Href;
};

const CHOICES = {
  type: {
    label: 'Type it',
    icon: 'dialpad',
    bubble: 'bg-mint',
    glyph: 'onPastel',
    href: '/transaction/new',
  },
  scan: {
    label: 'Scan a receipt',
    icon: 'line-scan',
    bubble: 'bg-peach',
    glyph: 'onPastel',
    href: '/capture/scan',
  },
  say: {
    label: 'Say it',
    icon: 'microphone',
    bubble: 'bg-sky',
    glyph: 'onPastel',
    href: '/capture/say',
  },
  ask: {
    label: 'Ask Moni',
    icon: 'creation',
    bubble: 'bg-primary',
    glyph: 'moniGlyph',
    href: '/chat',
  },
} as const satisfies Record<CaptureChoice, Choice>;

const ORDER = [
  'type',
  'scan',
  'say',
  'ask',
] as const satisfies readonly CaptureChoice[];

const RISE = 8;
const RISE_DELAY = 120;
const RISE_STAGGER = 50;
const RISE_FADE = { duration: 200 };

/** A row rises 8 and fades in, 120 after the sheet starts and 50 apart (V2F-Nav, "The + opening"). */
function RiseIn({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const settled = useSharedValue(0);

  useEffect(() => {
    const delay = RISE_DELAY + index * RISE_STAGGER;
    shown.set(withDelay(delay, withTiming(1, RISE_FADE)));
    if (!reduceMotion) {
      settled.set(withDelay(delay, withSpring(1, springs.control)));
    }
  }, [index, reduceMotion, settled, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [
      {
        translateY: reduceMotion ? 0 : RISE * (1 - settled.get()),
      },
    ],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The circle's top sits 23 below the last row, as V2A-Capture draws it. */
const ROWS_TO_CLOSE = 23;
/** The sheet's own bottom padding above the inset. */
const SHEET_BOTTOM_PADDING = 20;

/**
 * The + opens the chooser. A pick settles the sheet, which starts its drop, and
 * the push follows in the same task, so the page slides in while the sheet
 * falls (V2A-CaptureFlow-VA) with no frame of the bare origin between them.
 */
export async function openCaptureChooser() {
  const choice = await openSheet({ kind: 'chooser' });
  if (choice) router.push(CHOICES[choice].href);
}

type CaptureChooserSheetProps = SheetFrameProps & {
  onPick: (choice: CaptureChoice) => void;
};

/**
 * "Add a transaction" from V2A-Capture: four Paper capsule rows over a scrim
 * that covers the tab bar. Only the + stays above it, turned into the ×.
 */
export function CaptureChooserSheet({
  onPick,
  ...frame
}: CaptureChooserSheetProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();

  return (
    <>
      <Sheet
        {...frame}
        size="fit"
        title="Add a transaction"
        gap={16}
        growFromBottom={
          plusRingBottom(insets.bottom) + RING_SIZE / 2
        }
      >
        <View className="gap-2">
          {ORDER.map((id, index) => {
            const choice = CHOICES[id];
            return (
              <RiseIn
                key={id}
                index={index}
              >
                <Press
                  testID={tid('nav', 'chooser', id)}
                  accessibilityLabel={choice.label}
                  radius={{ rest: 30, pressed: 16 }}
                  className="h-[60px] flex-row items-center gap-3.5 bg-card pl-2 pr-5"
                  onPress={() => onPick(id)}
                >
                  <View
                    className={`h-11 w-11 items-center justify-center rounded-full ${choice.bubble}`}
                  >
                    <IconSymbol
                      name={choice.icon}
                      size={22}
                      color={tokens[choice.glyph]}
                    />
                  </View>
                  <Text
                    variant="cardTitle"
                    className="flex-1 text-foreground"
                  >
                    {choice.label}
                  </Text>
                  <IconSymbol
                    name="chevron-right"
                    size={22}
                    color={tokens.muted}
                  />
                </Press>
              </RiseIn>
            );
          })}
        </View>
        <View
          style={{
            height:
              plusTop(insets.bottom) +
              ROWS_TO_CLOSE -
              SHEET_BOTTOM_PADDING -
              insets.bottom,
          }}
        />
      </Sheet>
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 items-center"
        style={{ bottom: plusRingBottom(insets.bottom) }}
      >
        <PlusButton
          testID={tid('nav', 'chooser', 'close')}
          open={frame.open}
          onPress={frame.onDismiss}
        />
      </View>
    </>
  );
}
