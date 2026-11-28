import { Linking, View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import {
  Sheet,
  type SheetFrameProps,
} from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { PRIVACY_POLICY_URL } from '@/constants/links';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/**
 * Google Play's prominent disclosure, shown in the app before Android's settings page. Each line
 * must stay true: `notification-filter.core.js` drops other apps and one-time codes on the phone,
 * and run-extraction sends the rest to the Go backend's model and saves the result in Supabase.
 */
const POINTS: { icon: IconSymbolName; text: string }[] = [
  {
    icon: 'bell-outline',
    text: 'Moni can see every notification on this phone. It checks them here and keeps only alerts from the apps you link.',
  },
  {
    icon: 'lock-outline',
    text: 'One-time codes never leave this phone.',
  },
  {
    icon: 'cloud-outline',
    text: "The alerts it keeps go to Moni's AI, when it's on, to read the payment, and are saved to Moni's cloud database with your account.",
  },
];

/** "Let Moni read alerts?": what Moni does with notifications, then Open settings. */
export function NotificationAccessSheet({
  onConfirm,
  ...frame
}: SheetFrameProps & { onConfirm: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Sheet
      {...frame}
      size="fit"
      title="Let Moni read alerts?"
      actions={
        <>
          <Button
            testID={tid('sheet', 'cancel')}
            className="flex-1"
            pinned
            variant="secondary"
            label="Not now"
            onPress={frame.onDismiss}
          />
          <Button
            testID={tid('sheet', 'confirm')}
            className="flex-1"
            pinned
            label="Open settings"
            onPress={onConfirm}
          />
        </>
      }
    >
      <View className="gap-3.5">
        {POINTS.map((point) => (
          <View
            key={point.icon}
            className="flex-row items-start gap-3"
          >
            <View className="h-[36px] w-[36px] items-center justify-center rounded-full bg-sand">
              <IconSymbol
                name={point.icon}
                size={20}
                color={tokens.foreground}
              />
            </View>
            <Text className="min-w-0 flex-1 text-[15px] leading-[21px] text-ink-2">
              {point.text}
            </Text>
          </View>
        ))}
        <Button
          testID={tid('sheet', 'privacy-policy')}
          variant="tertiary"
          className="self-start"
          label="Read the privacy policy"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        />
      </View>
    </Sheet>
  );
}
