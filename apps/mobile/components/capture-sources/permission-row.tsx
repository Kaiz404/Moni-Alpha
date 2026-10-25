import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Toggle } from '@/components/ui/toggle';
import type { AccessState } from '@/components/capture-sources/use-phone-access';
import { Button } from '@/components/ui/button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid, type TestId } from '@/lib/test-ids';

const PREFIX: Partial<Record<AccessState, string>> = {
  off: 'Off · ',
  not_set_up: 'Not set up · ',
};

function RowBubble({ icon, on }: { icon: IconSymbolName; on: boolean }) {
  const tokens = useThemeTokens();
  return (
    <View
      className={`h-[42px] w-[42px] items-center justify-center rounded-full ${on ? 'bg-primary-muted' : 'bg-sand'}`}
    >
      <IconSymbol
        name={icon}
        size={20}
        color={tokens.foreground}
      />
    </View>
  );
}

/** A phone access row: what the permission is for, its state, and a switch. */
export function PermissionRow({
  testID,
  icon,
  title,
  meta,
  state,
  onChange,
  children,
}: {
  testID: TestId;
  icon: IconSymbolName;
  title: string;
  meta: string;
  state: AccessState;
  onChange: () => void;
  /** Rows that belong to this permission, such as location per banking app. */
  children?: ReactNode;
}) {
  const on = state === 'on';
  const unavailable = state === 'unavailable';
  return (
    <View>
      <View className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3">
        <RowBubble
          icon={icon}
          on={on}
        />
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
          >
            {unavailable ? `Not on this phone · ${meta}` : `${PREFIX[state] ?? ''}${meta}`}
          </Text>
        </View>
        <Toggle
          testID={testID}
          accessibilityLabel={title}
          value={on}
          disabled={unavailable || state === 'checking'}
          onChange={onChange}
        />
      </View>
      {children}
    </View>
  );
}

/** Location from notifications for one linked banking app, nested under the Location row. */
export function AppLocationRow({
  testID,
  label,
  wallets,
  on,
  onChange,
}: {
  testID: TestId;
  label: string;
  wallets: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-3.5 py-1.5 pl-[74px] pr-3">
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] leading-[21px] font-display-semibold text-foreground"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {on ? `Pins payments · ${wallets}` : `Off · ${wallets}`}
        </Text>
      </View>
      <Toggle
        testID={testID}
        accessibilityLabel={`Location from ${label} notifications`}
        value={on}
        onChange={onChange}
      />
    </View>
  );
}

/** The permission-denied state from `V2F-States` in place of the notifications row. */
export function NotificationsDenied({
  apps,
  onOpenSettings,
  onByHand,
}: {
  apps: string;
  onOpenSettings: () => void;
  onByHand: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="gap-2.5 px-[18px] py-3">
      <View className="flex-row items-center justify-between">
        <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-pending-fill">
          <IconSymbol
            name="bell-off-outline"
            size={20}
            color={tokens.foreground}
          />
        </View>
        <View className="h-6 justify-center rounded-full bg-sand px-2.5">
          <Text className="text-[12px] leading-[16px] font-display-bold text-foreground">
            Android
          </Text>
        </View>
      </View>
      <Text
        variant="cardTitle"
        className="text-foreground"
      >
        {"Moni can't see bank notifications"}
      </Text>
      <Text className="text-[14px] leading-[20px] text-ink-2">
        {apps
          ? `Turn on notification access and ${apps} spends add themselves. Moni only reads apps you link to a wallet.`
          : 'Turn on notification access and spends from your banking apps add themselves. Moni only reads apps you link to a wallet.'}
      </Text>
      <Button
        testID={tid('sources', 'notifications', 'open-settings')}
        label="Open settings"
        onPress={onOpenSettings}
      />
      <Button
        testID={tid('sources', 'notifications', 'by-hand')}
        label="Add spends by hand"
        variant="tertiary"
        onPress={onByHand}
      />
    </View>
  );
}
