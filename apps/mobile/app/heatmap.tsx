import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Linking,
  Platform,
  Pressable,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useTransactionPinmap,
  type TransactionPinPoint,
} from '@/hooks/use-transaction-heatmap';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMinorAmount } from '@/lib/finance/money';
import { Surface } from '@/components/ui/surface';

export default function HeatmapScreen() {
  const { pinPoints, mapRegion, isLoading, error } =
    useTransactionPinmap();
  const tokens = useThemeTokens();
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedPin, setSelectedPin] =
    useState<TransactionPinPoint | null>(null);

  const mapRef = React.useRef<MapView>(null);

  const openInMaps = async (
    latitude: number,
    longitude: number,
    locationName: string,
  ) => {
    const encodedLabel = encodeURIComponent(locationName);
    const latLng = `${latitude},${longitude}`;

    const appUrl =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${latLng}&dirflg=d`
        : `geo:0,0?q=${latLng}(${encodedLabel})`;

    const fallbackWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

    try {
      const canOpenApp = await Linking.canOpenURL(appUrl);
      if (canOpenApp) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(fallbackWebUrl);
    } catch {
      await Linking.openURL(fallbackWebUrl);
    }
  };

  if (!isMapReady && isLoading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        style={{ flex: 1 }}
      >
        <ActivityIndicator
          size="large"
          color={tokens.primary}
        />
        <Text className="mt-3 text-base text-foreground">
          Loading transaction locations...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        style={{ flex: 1 }}
      >
        <Text className="px-5 text-center text-base text-danger">
          Error: {error}
        </Text>
      </SafeAreaView>
    );
  }

  if (pinPoints.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        style={{ flex: 1 }}
      >
        <Text className="px-5 text-center text-base text-muted">
          No transactions with location data found. Start adding
          locations to your transactions!
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-background"
      style={{ flex: 1 }}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        onLayout={() => setIsMapReady(true)}
        provider="google"
      >
        {pinPoints.map((point, index) => (
          <Marker
            key={`${point.latitude}-${point.longitude}-${index}`}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            pinColor={tokens.primary}
            onSelect={() => setSelectedPin(point)}
            onPress={() => setSelectedPin(point)}
          />
        ))}
      </MapView>

      <Surface
        tone="tray"
        className="absolute bottom-5 left-5 right-5 p-3"
      >
        <Text className="mb-2 text-sm font-bold text-foreground">
          Pinmap
        </Text>
        <Text className="mt-1 text-xs text-muted">
          {pinPoints.length} pinned location(s)
        </Text>
      </Surface>

      {selectedPin ? (
        <Pressable
          style={styles.backdrop}
          onPress={() => setSelectedPin(null)}
        />
      ) : null}

      {selectedPin ? (
        <Surface
          tone="aqua"
          style={styles.bottomCard}
          className="p-3.5"
        >
          <Pressable
            style={[
              styles.closeButton,
              { backgroundColor: `${tokens.muted}33` },
            ]}
            onPress={() => setSelectedPin(null)}
          >
            <Text
              style={[
                styles.closeButtonText,
                { color: tokens.foreground },
              ]}
            >
              ✕
            </Text>
          </Pressable>
          <Text className="mb-1.5 pr-7 text-[15px] font-bold text-foreground">
            {selectedPin.locationName}
          </Text>
          <Text className="mb-1 text-xs text-foreground">
            Description: {selectedPin.description}
          </Text>
          <Text className="mb-1 text-xs text-foreground">
            Amount:{' '}
            {selectedPin.amountsByCurrency
              .map(({ currency, amountMinor }) =>
                formatMinorAmount(amountMinor, currency),
              )
              .join(' · ')}
          </Text>
          <Text className="mb-1 text-xs text-muted">
            {selectedPin.transactionCount} transaction(s) at this
            location
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.navigateButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() =>
              openInMaps(
                selectedPin.latitude,
                selectedPin.longitude,
                selectedPin.locationName,
              )
            }
            className="bg-primary"
          >
            <Text className="text-[13px] font-semibold text-primary-foreground">
              Open in Map App
            </Text>
          </Pressable>
        </Surface>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFill,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    // This compact map detail card deliberately retains its original 12px
    // radius instead of inheriting the standard 22px grouped-surface shape.
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  navigateButton: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
