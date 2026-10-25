import { router, type Href } from 'expo-router';
import { View } from 'react-native';
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
import { RiseIn, RiseInGroup } from '@/components/ui/rise-in';
import {
  Sheet,
  type SheetFrameProps,
} from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
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
    href: { pathname: '/chat', params: { focus: '1' } },
  },
} as const satisfies Record<CaptureChoice, Choice>;

const ORDER = [
  'type',
  'scan',
  'say',
  'ask',
] as const satisfies readonly CaptureChoice[];

/** The circle's top sits 23 below the last row, as V2A-Capture draws it. */
const ROWS_TO_CLOSE = 23;
/** The sheet's own bottom padding above the inset. */
const SHEET_BOTTOM_PADDING = 20;

/**
 * The + opens the chooser. A pick settles the sheet, which starts its drop, and
 * the push follows in the same task, so the page slides in over the falling
 * sheet (V2A-CaptureFlow-VA): the tabs layout hosts the chooser, under pushed
 * pages, with no frame of the bare origin between them.
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
        growFromBottom={plusRingBottom(insets.bottom) + RING_SIZE / 2}
      >
        <RiseInGroup
          delay={120}
          stagger={50}
          spring="control"
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
        </RiseInGroup>
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
