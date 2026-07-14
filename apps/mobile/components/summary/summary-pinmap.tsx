import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useTransactionPinmap } from '@/hooks/use-transaction-heatmap';

export function SummaryPinmap() {
  const tokens = useThemeTokens();
  const router = useRouter();
  const { pinPoints, mapRegion } = useTransactionPinmap();

  if (pinPoints.length === 0) {
    return (
      <View className="h-56 items-center justify-center px-3">
        <Text className="text-center text-muted">No transaction locations available yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={mapRegion}
        provider="google"
        onPress={() => router.push('/heatmap')}
      >
        {pinPoints.map((point, index) => (
          <Marker
            key={`${point.latitude}-${point.longitude}-${index}`}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            pinColor={tokens.primary}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
});
