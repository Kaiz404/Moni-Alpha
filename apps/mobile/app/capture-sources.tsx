import { router, type Href } from 'expo-router';
import { Platform, View } from 'react-native';

import { NotificationsDenied, PermissionRow } from '@/components/capture-sources/permission-row';
import { KeepCaptureRunning } from '@/components/capture-sources/keep-capture-running';
import { useCaptureAlert } from '@/components/capture-sources/use-capture-alert';
import { useCaptureHealth } from '@/components/capture-sources/use-capture-health';
import { useLinkedApps } from '@/components/capture-sources/use-linked-apps';
import { usePhoneAccess } from '@/components/capture-sources/use-phone-access';
import { Banner } from '@/components/ui/banner';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ListCard, ListSection } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { retryCaptures } from '@/lib/ai/background-processor';
import { tid, type TestId } from '@/lib/test-ids';

function LinkRow({
  testID,
  icon,
  tint,
  title,
  href,
}: {
  testID: TestId;
  icon: IconSymbolName;
  tint: string;
  title: string;
  href: Href;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={() => router.push(href)}
      accessibilityLabel={title}
      className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
    >
      <View className={`h-[42px] w-[42px] items-center justify-center rounded-full ${tint}`}>
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.foreground}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}

export default function CaptureSourcesScreen() {
  const { access, change } = usePhoneAccess();
  const { apps } = useLinkedApps();
  const { unreached } = useCaptureHealth();
  const captureAlert = useCaptureAlert();
  const denied = Platform.OS === 'android' && access.notifications === 'off';

  return (
    <Page
      headerScrolls
      screen="sources"
      kind="pushed"
      title="Permissions"
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {captureAlert && captureAlert.alert.kind !== 'access_off' ? (
          <Banner
            tone="syncError"
            title={captureAlert.title}
            body={captureAlert.body}
            action={{
              testID: tid('sources', 'capture-alert', 'fix'),
              label: captureAlert.actionLabel,
              onPress: captureAlert.fix,
            }}
          />
        ) : null}

        {unreached.total > 0 ? (
          <Banner
            tone="syncError"
            title={`${unreached.total} ${unreached.total === 1 ? "capture couldn't" : "captures couldn't"} reach Moni.`}
            body="Moni tried for 7 days and stopped. Nothing was added."
            action={{
              testID: tid('sources', 'unreached', 'retry'),
              label: 'Retry',
              onPress: () => void retryCaptures().catch(() => {}),
            }}
          />
        ) : null}

        <View className="gap-2">
          <ListSection label="Phone access">
            {denied ? (
              <NotificationsDenied
                onOpenSettings={() => void change('notifications')}
                onByHand={() => router.push('/transaction/new')}
              />
            ) : (
              <PermissionRow
                testID={tid('sources', 'notifications')}
                icon="bell-outline"
                title="Notifications"
                state={access.notifications}
                onChange={() => void change('notifications')}
              />
            )}
            <PermissionRow
              testID={tid('sources', 'location')}
              icon="map-marker"
              title="Location"
              state={access.location}
              onChange={() => void change('location')}
            />
            <PermissionRow
              testID={tid('sources', 'camera')}
              icon="camera-outline"
              title="Camera"
              state={access.camera}
              onChange={() => void change('camera')}
            />
            <PermissionRow
              testID={tid('sources', 'microphone')}
              icon="microphone"
              title="Microphone"
              state={access.microphone}
              onChange={() => void change('microphone')}
            />
          </ListSection>
        </View>

        {Platform.OS === 'android' && apps.length === 0 ? (
          <ListCard>
            <LinkRow
              testID={tid('sources', 'link-app')}
              icon="link-variant"
              tint="bg-sand"
              title="Link an app"
              href="/wallets"
            />
          </ListCard>
        ) : null}

        {Platform.OS === 'android' && (apps.length > 0 || access.notifications === 'on') ? (
          <KeepCaptureRunning />
        ) : null}

        <ListCard>
          <LinkRow
            testID={tid('sources', 'capture-log')}
            icon="cellphone-message"
            tint="bg-pending-fill"
            title="Capture log"
            href="/capture-log"
          />
          <LinkRow
            testID={tid('sources', 'places')}
            icon="map-marker"
            tint="bg-primary-muted"
            title="Places"
            href="/map"
          />
        </ListCard>
      </PageScroll>
    </Page>
  );
}
