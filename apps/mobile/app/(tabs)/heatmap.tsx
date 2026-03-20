import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Linking, Platform } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useTransactionHeatmap } from '@/hooks/use-transaction-heatmap';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function HeatmapScreen() {
  const { pinPoints, mapRegion, isLoading, error } = useTransactionHeatmap();
  const colorScheme = useColorScheme();
  const [isMapReady, setIsMapReady] = useState(false);
  
  const mapRef = React.useRef<MapView>(null);

  const isDark = colorScheme === 'dark';

  const getPinColor = (transactionCount: number) => {
    if (transactionCount >= 15) return '#d32f2f';
    if (transactionCount >= 8) return '#f57c00';
    if (transactionCount >= 4) return '#fbc02d';
    if (transactionCount >= 2) return '#43a047';
    return '#1e88e5';
  };

  const openInMaps = async (latitude: number, longitude: number, locationName: string) => {
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
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text style={[styles.loadingText, { color: isDark ? '#ffffff' : '#000000' }]}>
          Loading transaction locations...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <Text style={[styles.errorText, { color: '#ff4444' }]}>
          Error: {error}
        </Text>
      </View>
    );
  }

  if (pinPoints.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <Text style={[styles.emptyText, { color: isDark ? '#cccccc' : '#666666' }]}>
          No transactions with location data found.
          Start adding locations to your transactions!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            pinColor={getPinColor(point.transactionCount)}
            onPress={() => openInMaps(point.latitude, point.longitude, point.locationName)}
          >
            <Callout>
              <View style={styles.calloutContent}>
                <Text style={styles.calloutTitle}>{point.locationName}</Text>
                <Text style={styles.calloutSubtitle}>{point.transactionCount} transaction(s)</Text>
                <Text style={styles.calloutHint}>Opening directions...</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={[styles.legend, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)' }]}>
        <Text style={[styles.legendTitle, { color: isDark ? '#ffffff' : '#000000' }]}>
          Transaction Pin Map
        </Text>
        <Text style={[styles.legendInstruction, { color: isDark ? '#cccccc' : '#666666' }]}>
          Tap any pin to open directions in your maps app.
        </Text>
        <Text style={[styles.info, { color: isDark ? '#999999' : '#999999' }]}>
          {pinPoints.length} pinned location(s)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendInstruction: {
    fontSize: 12,
    marginBottom: 8,
  },
  info: {
    fontSize: 12,
    marginTop: 4,
  },
  calloutContent: {
    maxWidth: 220,
    paddingVertical: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  calloutSubtitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  calloutHint: {
    fontSize: 12,
    color: '#1e88e5',
  },
});
