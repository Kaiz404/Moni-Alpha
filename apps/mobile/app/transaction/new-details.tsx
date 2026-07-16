import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import { PrimaryButton } from '@/components/ui/primary-button';
import { getDraftExtras, setDraftExtras } from '@/lib/transactions/draft-extras';

const inputClass = 'rounded-xl border border-border bg-card px-3 py-2.5 text-foreground';

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
  const [locationSnapshot, setLocationSnapshot] = useState(initial.locationSnapshot);
  const [locationLoading, setLocationLoading] = useState(!isTransfer && !initial.locationSnapshot);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    if (isTransfer || initial.locationSnapshot) return;
    let cancelled = false;
    (async () => {
      setLocationLoading(true);
      setLocationUnavailable(false);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (!cancelled) setLocationUnavailable(true);
          return;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        let locationName: string | null = null;
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
          const first = addresses[0];
          if (first) {
            locationName =
              [first.name, first.street, first.city, first.region].filter(Boolean).join(', ').trim() || null;
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
        showsVerticalScrollIndicator={false}>
        {!isTransfer ? (
          <>
            <View className="mb-1.5 flex-row items-baseline gap-1">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Merchant</Text>
              <Text className="text-[10px] text-muted">optional</Text>
            </View>
            <TextInput
              className={`mb-4 text-sm ${inputClass}`}
              placeholder="Store or payee"
              placeholderTextColor="#9CA3AF"
              value={merchant}
              onChangeText={setMerchant}
            />
          </>
        ) : null}

        <View className="mb-1.5 flex-row items-baseline gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Description</Text>
          <Text className="text-[10px] text-muted">optional</Text>
        </View>
        <TextInput
          className={`mb-4 min-h-[72px] text-sm ${inputClass}`}
          placeholder="Notes"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        {!isTransfer ? (
          locationLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color={tokens.primary} />
              <Text className="text-xs text-muted">Finding transaction location…</Text>
            </View>
          ) : locationUnavailable || !locationSnapshot ? (
            <Text className="text-xs text-muted">
              Location unavailable. Enable location access to attach this transaction to where you are now.
            </Text>
          ) : (
            <View>
              <TouchableOpacity
                className="flex-row items-center justify-between py-1"
                onPress={() => setMapExpanded(!mapExpanded)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={mapExpanded ? 'Hide map' : 'Show map'}>
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Transaction location {mapExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {locationSnapshot.name ? (
                <Text className="mb-1 text-xs text-muted" numberOfLines={mapExpanded ? 4 : 2}>
                  {locationSnapshot.name}
                </Text>
              ) : null}
              {mapExpanded ? (
                <View className="mt-1 overflow-hidden rounded-xl border border-border bg-card" style={styles.locationMapBox}>
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
                    pitchEnabled={false}>
                    <Marker
                      coordinate={{ latitude: locationSnapshot.latitude, longitude: locationSnapshot.longitude }}
                      pinColor={tokens.primary}
                    />
                  </MapView>
                </View>
              ) : null}
            </View>
          )
        ) : (
          <Text className="text-xs text-muted">
            Transfers move money between your wallets without changing your overall net worth.
          </Text>
        )}
      </ScrollView>

      <View
        className="border-t border-border bg-canvas px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <PrimaryButton label="Save details" icon="check" onPress={handleSave} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  locationMapBox: { height: 200, width: '100%' },
  locationMap: { ...StyleSheet.absoluteFillObject },
});
