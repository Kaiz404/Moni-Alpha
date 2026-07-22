import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { FormField } from '@/components/ui/form-field';
import { IconAction } from '@/components/ui/icon-action';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Surface } from '@/components/ui/surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TransactionLocationSnapshot } from '@/lib/transactions/prefetch-location';

export type TransactionDetailsValue = {
  merchant: string;
  description: string;
  transactionDate: string;
  locationSnapshot: TransactionLocationSnapshot | null;
};

type TransactionDetailsSheetContentProps = {
  isTransfer: boolean;
  value: TransactionDetailsValue;
  locationLoading: boolean;
  locationUnavailable: boolean;
  onChange: (patch: Partial<TransactionDetailsValue>) => void;
  onClose: () => void;
};

/** Shared details sheet body for optional transaction metadata. */
export function TransactionDetailsSheetContent({
  isTransfer,
  value,
  locationLoading,
  locationUnavailable,
  onChange,
  onClose,
}: TransactionDetailsSheetContentProps) {
  const tokens = useThemeTokens();
  const [mapExpanded, setMapExpanded] = useState(false);

  return (
    <View className="flex-1">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-foreground">
            More details
          </Text>
        </View>
        <IconAction
          accessibilityLabel="Close details sheet"
          icon="close"
          onPress={onClose}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-3"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Surface className="p-4">
          {!isTransfer ? (
            <FormField
              label="Merchant"
              hint="Optional"
              placeholder="Store or payee"
              value={value.merchant}
              onChangeText={(merchant) => onChange({ merchant })}
              autoCapitalize="words"
            />
          ) : null}
          <FormField
            label="Notes"
            hint="Optional"
            className="min-h-20 text-sm"
            placeholder="Add a note"
            value={value.description}
            onChangeText={(description) => onChange({ description })}
            multiline
            textAlignVertical="top"
          />
          <FormField
            label="Date"
            hint="YYYY-MM-DD"
            placeholder="YYYY-MM-DD"
            value={value.transactionDate}
            onChangeText={(transactionDate) =>
              onChange({ transactionDate })
            }
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Surface>

        {!isTransfer ? (
          locationLoading ? (
            <Surface
              tone="muted"
              className="mt-4 flex-row items-center gap-3 p-4"
            >
              <ActivityIndicator
                size="small"
                color={tokens.primary}
              />
              <Text className="text-xs text-muted">
                Finding transaction location…
              </Text>
            </Surface>
          ) : locationUnavailable || !value.locationSnapshot ? (
            <Surface
              tone="muted"
              className="mt-4 p-4"
            >
              <Text className="text-sm leading-5 text-muted">
                Location unavailable. Enable location access to attach
                this transaction to where you are now.
              </Text>
            </Surface>
          ) : (
            <Surface className="mt-4 p-4">
              <TouchableOpacity
                className="flex-row items-center justify-between py-1"
                onPress={() => setMapExpanded(!mapExpanded)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  mapExpanded ? 'Hide map' : 'Show map'
                }
              >
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Transaction location {mapExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {value.locationSnapshot.name ? (
                <Text
                  className="mb-1 text-xs text-muted"
                  numberOfLines={mapExpanded ? 4 : 2}
                >
                  {value.locationSnapshot.name}
                </Text>
              ) : null}
              {mapExpanded ? (
                <View
                  className="mt-3 overflow-hidden rounded-2xl bg-card"
                  style={styles.locationMapBox}
                >
                  <MapView
                    style={styles.locationMap}
                    initialRegion={{
                      latitude: value.locationSnapshot.latitude,
                      longitude: value.locationSnapshot.longitude,
                      latitudeDelta: 0.006,
                      longitudeDelta: 0.006,
                    }}
                    provider="google"
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: value.locationSnapshot.latitude,
                        longitude: value.locationSnapshot.longitude,
                      }}
                      pinColor={tokens.primary}
                    />
                  </MapView>
                </View>
              ) : null}
            </Surface>
          )
        ) : (
          <Surface
            tone="muted"
            className="mt-4 p-4"
          >
            <Text className="text-sm leading-5 text-muted">
              Transfers move money between your wallets without
              changing your overall net worth.
            </Text>
          </Surface>
        )}
      </ScrollView>

      <PrimaryButton
        className="mt-3"
        icon="check"
        label="Done"
        onPress={onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  locationMapBox: { height: 180, width: '100%' },
  locationMap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
