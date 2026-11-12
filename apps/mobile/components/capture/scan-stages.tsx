import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type {
  CaptureQuote,
  ReadFailure,
} from '@/lib/capture/capture-stage';
import { tid } from '@/lib/test-ids';

import { AddedTick } from './added-tick';
import { HeardQuote, ScanningReceipt } from './reading-motion';

/** V2A-CaptureScan `reading`: what the user gave Moni, centred and moving while Moni reads it. */
export function CaptureReading({ quote }: { quote: CaptureQuote }) {
  const camera = quote.source === 'camera';
  return (
    <Page
      screen="capture"
      kind="task"
      title={camera ? 'Reading the receipt' : 'Reading what you said'}
    >
      <View
        className="flex-1 items-center justify-center px-5 pb-16"
        accessibilityLabel={camera ? 'Moni is reading the receipt' : 'Moni is reading what you said'}
        accessibilityRole="progressbar"
      >
        {camera ? <ScanningReceipt imageUri={quote.imageUri} /> : <HeardQuote text={quote.text} />}
      </View>
    </Page>
  );
}

/** V2A-CaptureScan `approved`: the tick, where it went, and two ways on, centred on the page. */
export function CaptureAdded({
  categoryName,
  another,
}: {
  categoryName: string | null;
  another: { label: string; onPress: () => void };
}) {
  return (
    <Page
      screen="capture"
      kind="task"
      title=""
    >
      <View className="flex-1 items-center justify-center gap-2 px-5 pb-10">
        <AddedTick />
        <Animated.View entering={FadeInDown.delay(380).duration(320)}>
          <Text
            variant="screenTitle"
            className="text-center text-foreground"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            {categoryName ? `Added to ${categoryName}` : 'Added'}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(480).duration(320)}>
          <Text
            variant="body"
            className="text-center text-ink-2"
          >
            It counts in your totals now.
          </Text>
        </Animated.View>
      </View>
      <View className="gap-1 px-5 pb-3">
        <Button
          testID={tid('capture', 'added', 'home')}
          pinned
          label="Back to Home"
          onPress={() => router.dismissTo('/')}
        />
        <Button
          testID={tid('capture', 'added', 'another')}
          variant="tertiary"
          label={another.label}
          onPress={another.onPress}
        />
      </View>
    </Page>
  );
}

const SCAN_TIPS: { icon: IconSymbolName; text: string }[] = [
  {
    icon: 'crop-free',
    text: 'Whole receipt in frame, top to bottom',
  },
  { icon: 'flash', text: 'Good light, no shadow' },
  {
    icon: 'receipt-text-outline',
    text: 'Lay it flat on a dark surface',
  },
];

/** V2A-CaptureScanFailed: nothing was added; tips, Try again, Type it instead. */
export function CaptureFailed({
  quote,
  failure,
  title,
  onRetry,
  onKeep,
  onTypeIt,
}: {
  quote: CaptureQuote;
  failure: ReadFailure;
  title: string;
  /** `unavailable` reads the same capture again; `unreadable` captures it again. */
  onRetry: () => void;
  onKeep: () => void;
  onTypeIt: () => void;
}) {
  const tokens = useThemeTokens();
  const camera = quote.source === 'camera';
  const unavailable = failure === 'unavailable';
  return (
    <Page
      screen="capture"
      kind="task"
      title={title}
    >
      <View className="flex-1 gap-3.5 px-5">
        <View className="items-center gap-2.5 pt-1.5">
          {camera ? (
            <Image
              source={{ uri: quote.imageUri }}
              contentFit="cover"
              accessibilityLabel="The scanned receipt"
              style={{ width: 84, height: 108, borderRadius: 12 }}
            />
          ) : quote.text ? (
            <Text
              variant="body"
              className="max-w-[310px] text-center text-foreground"
            >
              {`“${quote.text}”`}
            </Text>
          ) : null}
          <StatusPill
            tone="near"
            size="compact"
            align="center"
            label={
              unavailable
                ? "Couldn't reach Moni"
                : "Couldn't read it"
            }
          />
          <Text
            variant="screenTitle"
            className="text-center text-foreground"
          >
            {unavailable
              ? "Moni can't read it right now"
              : camera
                ? "Moni couldn't find a total"
                : "Moni couldn't hear an amount"}
          </Text>
          <Text
            variant="body"
            className="max-w-[310px] text-center text-ink-2"
          >
            {unavailable
              ? `Moni kept ${camera ? 'your receipt' : 'what you said'}. Try again, or keep it and it goes to Review once Moni reads it. Nothing was added.`
              : 'Nothing was added.'}
          </Text>
        </View>
        {camera && failure === 'unreadable' ? (
          <View className="rounded-card bg-card px-[18px] py-1.5">
            {SCAN_TIPS.map((tip) => (
              <View
                key={tip.text}
                className="min-h-[54px] flex-row items-center gap-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-sand">
                  <IconSymbol
                    name={tip.icon}
                    size={18}
                    color={tokens.foreground}
                  />
                </View>
                <Text
                  variant="body"
                  className="flex-1 text-foreground"
                >
                  {tip.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View className="gap-2 px-5 pb-3">
        <Button
          testID={tid('capture', 'failed', 'retry')}
          pinned
          icon={unavailable ? 'refresh' : camera ? 'camera-retake-outline' : 'microphone'}
          label="Try again"
          onPress={onRetry}
        />
        {unavailable ? (
          <Button
            testID={tid('capture', 'failed', 'keep')}
            pinned
            variant="secondary"
            icon="tray-arrow-down"
            label="Keep it for Review"
            onPress={onKeep}
          />
        ) : null}
        <Button
          testID={tid('capture', 'failed', 'type-it')}
          pinned
          variant="secondary"
          icon="dialpad"
          label="Type it instead"
          onPress={onTypeIt}
        />
      </View>
    </Page>
  );
}
