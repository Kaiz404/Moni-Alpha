import { View } from 'react-native';

import { PermissionRow } from '@/components/capture-sources/permission-row';
import { useBatteryExemption } from '@/components/capture-sources/use-battery-exemption';
import type { AccessState } from '@/components/capture-sources/use-phone-access';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListSection } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  askForBatteryExemption,
  hasAutostartSetting,
  openAutostart,
  openBatterySettings,
  phoneBrand,
  type BatteryExemption,
} from '@/lib/notifications/battery';
import { tid } from '@/lib/test-ids';

const BATTERY_ACCESS: Record<BatteryExemption | 'checking', AccessState> = {
  exempt: 'on',
  not_exempt: 'off',
  unavailable: 'unavailable',
  checking: 'checking',
};

/** The two phone settings that decide whether Android lets Moni keep reading alerts. */
export function KeepCaptureRunning() {
  const tokens = useThemeTokens();
  const exemption = useBatteryExemption();
  return (
    <ListSection label="Keep capture running">
      <PermissionRow
        testID={tid('sources', 'battery')}
        icon="battery-charging-outline"
        title="Battery"
        meta="Lets Moni read bank notifications while the phone sleeps"
        state={BATTERY_ACCESS[exemption]}
        onChange={() =>
          void (exemption === 'exempt' ? openBatterySettings() : askForBatteryExemption())
        }
      />
      {hasAutostartSetting(phoneBrand()) ? (
        <Press
          testID={tid('sources', 'autostart')}
          onPress={() => void openAutostart()}
          accessibilityLabel="Autostart, open the setting"
          className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
        >
          <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
            <IconSymbol
              name="restart"
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
              Autostart
            </Text>
            <Text
              variant="meta"
              className="text-muted"
            >
              {"Your phone can stop Moni after a restart. Moni can't check this setting, so make sure it's on."}
            </Text>
          </View>
          <IconSymbol
            name="chevron-right"
            size={20}
            color={tokens.muted}
          />
        </Press>
      ) : null}
    </ListSection>
  );
}
