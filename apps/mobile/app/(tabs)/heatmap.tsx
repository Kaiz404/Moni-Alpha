import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import MapView, { Heatmap } from 'react-native-maps';
import { useTransactionHeatmap } from '@/hooks/use-transaction-heatmap';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function HeatmapScreen() {
  const { heatmapPoints, mapRegion, isLoading, error } = useTransactionHeatmap();
  const colorScheme = useColorScheme();
  const [isMapReady, setIsMapReady] = useState(false);
  
  const mapRef = React.useRef<MapView>(null);

  const isDark = colorScheme === 'dark';

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

  if (heatmapPoints.length === 0) {
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
        <Heatmap
          points={heatmapPoints}
          radius={30}
          opacity={0.8}
          gradient={{
            colors: [
              '#0000FF', // Blue - cold
              '#00FF00', // Green - cool
              '#FFFF00', // Yellow - warm
              '#FF7700', // Orange - hot
              '#FF0000', // Red - very hot
            ],
            startPoints: [0, 0.25, 0.5, 0.75, 1],
            colorMapSize: 256,
          }}
        />
      </MapView>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)' }]}>
        <Text style={[styles.legendTitle, { color: isDark ? '#ffffff' : '#000000' }]}>
          Transaction Heat Map
        </Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#0000FF' }]} />
            <Text style={[styles.legendLabel, { color: isDark ? '#cccccc' : '#666666' }]}>
              Low
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FFFF00' }]} />
            <Text style={[styles.legendLabel, { color: isDark ? '#cccccc' : '#666666' }]}>
              Medium
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF0000' }]} />
            <Text style={[styles.legendLabel, { color: isDark ? '#cccccc' : '#666666' }]}>
              High
            </Text>
          </View>
        </View>
        <Text style={[styles.info, { color: isDark ? '#999999' : '#999999' }]}>
          {heatmapPoints.length} location(s) with transactions
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
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 12,
  },
  info: {
    fontSize: 12,
    marginTop: 4,
  },
});
