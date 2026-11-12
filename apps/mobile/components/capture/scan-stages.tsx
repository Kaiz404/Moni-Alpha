import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import {
  TransactionRowBody,
  rowAmount,
  rowMeta,
} from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type {
  CaptureQuote,
  ReadFailure,
} from '@/lib/capture/capture-stage';
import { itemsLabel } from '@/lib/capture/read-capture';
import type { TransactionRowData } from '@/lib/transactions/row';
import { tid } from '@/lib/test-ids';

import {
  HeardQuote,
  ReadingSteps,
  RECEIPT_STEPS,
  ScanningReceipt,
  VOICE_STEPS,
} from './reading-motion';

/** V2A-CaptureScan `reading`: what the user gave Moni, alive, over the steps Moni works through. */
export function CaptureReading({ quote }: { quote: CaptureQuote }) {
  const camera = quote.source === 'camera';
  return (
    <Page
      screen="capture"
      kind="task"
      title={camera ? 'Reading the receipt' : 'Reading what you said'}
    >
      <View
        className="gap-6 px-5 pt-2"
        accessibilityLabel={camera ? 'Moni is reading the receipt' : 'Moni is reading what you said'}
        accessibilityRole="progressbar"
      >
        {camera ? <ScanningReceipt imageUri={quote.imageUri} /> : <HeardQuote text={quote.text} />}
        <ReadingSteps steps={camera ? RECEIPT_STEPS : VOICE_STEPS} />
      </View>
    </Page>
  );
}

/** V2A-CaptureScan `approved`: the row Approve just added and two ways on. */
export function CaptureAdded({
  row,
  categoryName,
  itemCount,
  another,
}: {
  row: TransactionRowData;
  categoryName: string | null;
  /** The receipt's item count, joined to the row's meta. */
  itemCount: number | null;
  another: { label: string; onPress: () => void };
}) {
  const tokens = useThemeTokens();
  return (
    <Page
      screen="capture"
      kind="task"
      title="Added"
    >
      <View className="flex-1 items-center gap-3 px-5 pt-10">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-block-mint">
          <IconSymbol
            name="check"
            size={52}
            color={tokens.onPastel}
          />
        </View>
        <Text
          variant="screenTitle"
          className="pt-2 text-center text-foreground"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {categoryName ? `Added to ${categoryName}` : 'Added'}
        </Text>
        <Text
          variant="body"
          className="text-center text-ink-2"
        >
          It counts in your totals now.
        </Text>
        <ListCard className="mt-3 self-stretch">
          <TransactionRowBody
            row={row}
            meta={[rowMeta(row, 'date'), itemCount && itemsLabel(itemCount)]
              .filter(Boolean)
              .join(' · ')}
            amount={rowAmount(row)}
          />
        </ListCard>
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
