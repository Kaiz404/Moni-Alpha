import { router, type Href } from 'expo-router';
import { Platform, View } from 'react-native';

import { NotificationsDenied, PermissionRow } from '@/components/capture-sources/permission-row';
import { useAutoAddRules, type AutoAddRuleRow } from '@/components/capture-sources/use-auto-add-rules';
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
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { retryCaptures } from '@/lib/ai/background-processor';
import { NOTIFICATION_ACCESS_DISCLOSURE } from '@/lib/notifications/permission';
import { createAutoAddRule, deleteAutoAddRule } from '@/lib/supabase/auto-add-rules';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

function failed(error: unknown) {
  showToast({ text: error instanceof Error ? error.message : "Couldn't save that change." });
}

function askAgain({ rule, name }: AutoAddRuleRow) {
  try {
    deleteAutoAddRule(rule.id);
  } catch (error) {
    failed(error);
    return;
  }
  showToast({
    text: `Moni will ask about ${name} again`,
    undo: () => {
      void createAutoAddRule({
        merchantKey: rule.merchantKey,
        sourceApp: rule.sourceApp,
        walletId: rule.walletId,
        categoryId: rule.categoryId,
      }).catch(failed);
    },
  });
}

function LinkRow({
  testID,
  icon,
  tint,
  title,
  meta,
  href,
}: {
  testID: TestId;
  icon: IconSymbolName;
  tint: string;
  title: string;
  meta: string;
  href: Href;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={() => router.push(href)}
      accessibilityLabel={`${title}, ${meta}`}
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
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {meta}
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
  const tokens = useThemeTokens();
  const { access, change } = usePhoneAccess();
  const { apps } = useLinkedApps();
  const { unreached } = useCaptureHealth();
  const captureAlert = useCaptureAlert();
  const rules = useAutoAddRules();
  const denied = Platform.OS === 'android' && access.notifications === 'off';

  return (
    <Page
      headerScrolls
      screen="sources"
      kind="pushed"
      title="Capture sources"
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
                meta="Reads alerts from the apps you link on your wallets"
                state={access.notifications}
                onChange={() => void change('notifications')}
              />
            )}
            <PermissionRow
              testID={tid('sources', 'location')}
              icon="map-marker"
              title="Location"
              meta="From notifications, to pin each payment"
              state={access.location}
              onChange={() => void change('location')}
            />
            <PermissionRow
              testID={tid('sources', 'camera')}
              icon="camera-outline"
              title="Camera"
              meta="Receipts, only while scanning"
              state={access.camera}
              onChange={() => void change('camera')}
            />
            <PermissionRow
              testID={tid('sources', 'microphone')}
              icon="microphone"
              title="Microphone"
              meta="Say it instead of typing"
              state={access.microphone}
              onChange={() => void change('microphone')}
            />
          </ListSection>
          <View className="flex-row gap-2 px-1">
            <IconSymbol
              name="shield-check-outline"
              size={16}
              color={tokens.deepMint}
              style={{ lineHeight: 18 }}
            />
            <Text
              variant="meta"
              className="min-w-0 flex-1 text-ink-2"
            >
              Moni saves a place only when a payment arrives, and never tracks where you go.
              {denied ? '' : ` ${NOTIFICATION_ACCESS_DISCLOSURE}`}
            </Text>
          </View>
        </View>

        {Platform.OS === 'android' && apps.length === 0 ? (
          <ListCard>
            <LinkRow
              testID={tid('sources', 'link-app')}
              icon="link-variant"
              tint="bg-sand"
              title="Link an app"
              meta="On a wallet page"
              href="/wallets"
            />
          </ListCard>
        ) : null}

        {Platform.OS === 'android' && (apps.length > 0 || access.notifications === 'on') ? (
          <KeepCaptureRunning />
        ) : null}

        <View className="gap-2">
          {rules.length > 0 ? (
            <ListSection label="Added without asking">
              {rules.map((row) => (
                <View
                  key={row.rule.id}
                  className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
                >
                  <TintBubble
                    icon={row.icon}
                    color={row.color}
                  />
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {row.name}
                    </Text>
                    <Text
                      variant="meta"
                      className="text-muted"
                      numberOfLines={1}
                    >
                      {row.meta}
                    </Text>
                  </View>
                  <Press
                    testID={tid('sources', 'rule', row.rule.merchantKey, 'ask-again')}
                    onPress={() => askAgain(row)}
                    accessibilityLabel={`Ask again about ${row.name}`}
                    radius={{ rest: 22, pressed: 16 }}
                    pressedClassName="bg-hairline"
                    className="h-11 justify-center bg-sand px-3"
                  >
                    <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
                      Ask again
                    </Text>
                  </Press>
                </View>
              ))}
            </ListSection>
          ) : (
            <View className="gap-2">
              <Text
                variant="caps"
                className="pl-1 text-muted"
                accessibilityRole="header"
              >
                Added without asking
              </Text>
              <View className="rounded-tile border-[1.5px] border-dashed border-hairline px-[18px] py-3.5">
                <Text
                  variant="body"
                  className="text-ink-2"
                >
                  Moni asks about every capture.
                </Text>
              </View>
            </View>
          )}
          <Text
            variant="meta"
            className="px-1 text-muted"
          >
            {"Tick “Don't ask about similar” on a capture in Review to add one here."}
          </Text>
        </View>

        <ListCard>
          <LinkRow
            testID={tid('sources', 'capture-log')}
            icon="cellphone-message"
            tint="bg-pending-fill"
            title="Capture log"
            meta="Every alert Moni read, and what it did"
            href="/capture-log"
          />
          <LinkRow
            testID={tid('sources', 'places')}
            icon="map-marker"
            tint="bg-primary-muted"
            title="Places"
            meta="Where your payments happened"
            href="/map"
          />
        </ListCard>
      </PageScroll>
    </Page>
  );
}
