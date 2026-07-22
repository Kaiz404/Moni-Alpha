import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { BrandHeader } from '@/components/ui/brand-header';
import { FormField } from '@/components/ui/form-field';
import { ScreenShell } from '@/components/ui/screen-shell';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Surface } from '@/components/ui/surface';
import {
  getDraftExtras,
  setDraftExtras,
} from '@/lib/transactions/draft-extras';

/** Optional fields kept off the quick-add screen to avoid overloading it (Apple HIG: progressive disclosure). */
export default function NewTransactionDetailsScreen() {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ type?: string | string[] }>();
  const type = useMemo(() => {
    const t = params.type;
    return (Array.isArray(t) ? t[0] : t) ?? 'expense';
  }, [params.type]);
  const isTransfer = type === 'transfer';

  const initial = getDraftExtras();
  const [merchant, setMerchant] = useState(initial.merchant);
  const [description, setDescription] = useState(initial.description);
  const [locationSnapshot, setLocationSnapshot] = useState(
    initial.locationSnapshot,
  );
  const [locationLoading, setLocationLoading] = useState(
    !isTransfer && !initial.locationSnapshot,
  );
  const [locationUnavailable, setLocationUnavailable] =
    useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    if (isTransfer || initial.locationSnapshot) return;
    let cancelled = false;
    (async () => {
      setLocationLoading(true);
      setLocationUnavailable(false);
      try {
        const permission =
          await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (!cancelled) setLocationUnavailable(true);
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        let locationName: string | null = null;
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
          const first = addresses[0];
          if (first) {
            locationName =
              [first.name, first.street, first.city, first.region]
                .filter(Boolean)
                .join(', ')
                .trim() || null;
          }
        } catch {
          // keep coords without a label
        }
        if (!cancelled) {
          setLocationSnapshot({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            name: locationName,
          });
        }
      } catch {
        if (!cancelled) setLocationUnavailable(true);
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransfer]);

  const handleSave = () => {
    setDraftExtras({ merchant, description, locationSnapshot });
    router.back();
  };

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="More details" />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-4 pt-4 pb-2"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-foreground">
          A little context
        </Text>
        <Text className="mt-2 text-[15px] leading-5 text-muted">
          Optional details help you recognize this entry later.
        </Text>
        <Surface className="mt-6 p-5">
          {!isTransfer ? (
            <FormField
              label="Merchant"
              hint="Optional"
              placeholder="Store or payee"
              value={merchant}
              onChangeText={setMerchant}
              autoCapitalize="words"
            />
          ) : null}
          <FormField
            label="Notes"
            hint="Optional"
            className="min-h-24 text-sm"
            placeholder="Add a note"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Surface>

        {!isTransfer ? (
          locationLoading ? (
            <Surface
              tone="muted"
              className="mt-6 flex-row items-center gap-3 p-4"
            >
              <ActivityIndicator
                size="small"
                color={tokens.primary}
              />
              <Text className="text-xs text-muted">
                Finding transaction location…
              </Text>
            </Surface>
          ) : locationUnavailable || !locationSnapshot ? (
            <Surface
              tone="muted"
              className="mt-6 p-4"
            >
              <Text className="text-sm leading-5 text-muted">
                Location unavailable. Enable location access to attach
                this transaction to where you are now.
              </Text>
            </Surface>
          ) : (
            <Surface className="mt-6 p-4">
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
              {locationSnapshot.name ? (
                <Text
                  className="mb-1 text-xs text-muted"
                  numberOfLines={mapExpanded ? 4 : 2}
                >
                  {locationSnapshot.name}
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
                      latitude: locationSnapshot.latitude,
                      longitude: locationSnapshot.longitude,
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
                        latitude: locationSnapshot.latitude,
                        longitude: locationSnapshot.longitude,
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
            className="mt-6 p-4"
          >
            <Text className="text-sm leading-5 text-muted">
              Transfers move money between your wallets without
              changing your overall net worth.
            </Text>
          </Surface>
        )}
      </ScrollView>

      <View
        className="border-t border-border bg-canvas px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <PrimaryButton
          label="Save details"
          icon="check"
          onPress={handleSave}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  locationMapBox: { height: 200, width: '100%' },
  locationMap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
