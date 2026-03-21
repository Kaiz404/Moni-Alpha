import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Linking, Platform, Pressable } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTransactionPinmap, type TransactionPinPoint } from '@/hooks/use-transaction-heatmap';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function HeatmapScreen() {
  const { pinPoints, mapRegion, isLoading, error } = useTransactionPinmap();
  const colorScheme = useColorScheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedPin, setSelectedPin] = useState<TransactionPinPoint | null>(null);
  
  const mapRef = React.useRef<MapView>(null);

  const isDark = colorScheme === 'dark';

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
            pinColor={'#1e88e5'}
            onSelect={() => setSelectedPin(point)}
            onPress={() => setSelectedPin(point)}
          />
        ))}
      </MapView>

      <View style={[styles.legend, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)' }] }>
        <Text style={[styles.legendTitle, { color: isDark ? '#ffffff' : '#000000' }]}> 
          Pinmap
        </Text>
        <Text style={[styles.legendInstruction, { color: isDark ? '#cccccc' : '#666666' }]}> 
          Tap a pin to view transaction details.
        </Text>
        <Text style={[styles.info, { color: isDark ? '#999999' : '#999999' }]}> 
          {pinPoints.length} pinned location(s)
        </Text>
      </View>

      {selectedPin ? (
        <Pressable
          style={styles.backdrop}
          onPress={() => setSelectedPin(null)}
        />
      ) : null}

      {selectedPin ? (
        <View style={[styles.bottomCard, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.92)' : 'rgba(255, 255, 255, 0.98)' }]}>
          <Pressable
            style={styles.closeButton}
            onPress={() => setSelectedPin(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <Text style={[styles.bottomCardTitle, { color: isDark ? '#ffffff' : '#000000' }]}>{selectedPin.locationName}</Text>
          <Text style={[styles.bottomCardLine, { color: isDark ? '#dddddd' : '#333333' }]}>Description: {selectedPin.description}</Text>
          <Text style={[styles.bottomCardLine, { color: isDark ? '#dddddd' : '#333333' }]}>Amount: ${selectedPin.amount.toFixed(2)}</Text>
          <Text style={[styles.bottomCardLine, { color: isDark ? '#aaaaaa' : '#666666' }]}>{selectedPin.transactionCount} transaction(s) at this location</Text>

          <Pressable
            style={({ pressed }) => [styles.navigateButton, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => openInMaps(selectedPin.latitude, selectedPin.longitude, selectedPin.locationName)}
          >
            <Text style={styles.navigateButtonText}>Open in Map App</Text>
          </Pressable>
        </View>
      ) : null}
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
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
    backgroundColor: 'rgba(120,120,120,0.25)',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 16,
  },
  bottomCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    paddingRight: 28,
  },
  bottomCardLine: {
    fontSize: 12,
    marginBottom: 4,
  },
  navigateButton: {
    marginTop: 8,
    backgroundColor: '#1e88e5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
