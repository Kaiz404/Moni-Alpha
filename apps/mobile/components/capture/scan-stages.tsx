import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
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
import type { TransactionRowData } from '@/lib/transactions/row';
import { tid } from '@/lib/test-ids';

/** V2A-CaptureScan `reading`: the receipt thumbnail, a Lilac pill and field-shaped blocks. */
export function CaptureReading({ quote }: { quote: CaptureQuote }) {
  const tokens = useThemeTokens();
  const camera = quote.source === 'camera';
  return (
    <Page
      screen="capture"
      kind="task"
      title={camera ? 'Reading the receipt' : 'Reading what you said'}
    >
      <View
        className="gap-3 px-5"
        accessibilityLabel={
          camera
            ? 'Moni is reading the receipt'
            : 'Moni is reading it'
        }
        accessibilityRole="progressbar"
      >
        <View className="flex-row items-center gap-3">
          {camera ? (
            <Image
              source={{ uri: quote.imageUri }}
              contentFit="cover"
              style={{ width: 52, height: 64, borderRadius: 12 }}
            />
          ) : (
            <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-sand">
              <IconSymbol
                name="microphone"
                size={24}
                color={tokens.foreground}
              />
            </View>
          )}
          <StatusPill
            tone="review"
            size="compact"
            align="center"
            label={
              camera
                ? 'Moni is reading the receipt'
                : 'Moni is reading what you said'
            }
          />
        </View>
        <View className="h-[52px] w-[220px] rounded-field bg-sand" />
        <View className="gap-2">
          <View className="h-16 rounded-field bg-sand" />
          <View className="flex-row gap-2">
            <View className="h-16 flex-1 rounded-field bg-sand" />
            <View className="h-16 flex-1 rounded-field bg-sand" />
          </View>
        </View>
      </View>
    </Page>
  );
}

/** V2A-CaptureScan `approved`: the row Approve just added and two ways on. */
export function CaptureAdded({
  row,
  categoryName,
  another,
}: {
  row: TransactionRowData;
  categoryName: string | null;
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
        <View className="h-24 w-24 items-center justify-center rounded-full bg-mint">
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
        <View className="mt-3 self-stretch rounded-card bg-card py-1.5">
          <TransactionRowBody
            row={row}
            meta={rowMeta(row, 'date')}
            amount={rowAmount(row)}
          />
        </View>
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
}: {
  quote: CaptureQuote;
  failure: ReadFailure;
  title: string;
  onRetry: () => void;
}) {
  const tokens = useThemeTokens();
  const camera = quote.source === 'camera';
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
          ) : null}
          <StatusPill
            tone="near"
            size="compact"
            align="center"
            label={
              failure === 'unavailable'
                ? "Couldn't reach Moni"
                : "Couldn't read it"
            }
          />
          <Text
            variant="screenTitle"
            className="text-center text-foreground"
          >
            {failure === 'unavailable'
              ? "Moni can't read it right now"
              : camera
                ? "Moni couldn't find a total"
                : "Moni couldn't hear an amount"}
          </Text>
          <Text
            variant="body"
            className="max-w-[310px] text-center text-ink-2"
          >
            {failure === 'unavailable'
              ? 'Check your connection and try again. Nothing was added.'
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
          icon={camera ? 'camera-retake-outline' : 'microphone'}
          label="Try again"
          onPress={onRetry}
        />
        <Button
          testID={tid('capture', 'failed', 'type-it')}
          pinned
          variant="secondary"
          icon="dialpad"
          label="Type it instead"
          onPress={() => router.replace('/transaction/new')}
        />
      </View>
    </Page>
  );
}
