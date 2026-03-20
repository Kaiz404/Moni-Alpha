import { useCallback, useState, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { getTransactions } from '@/lib/supabase/transactions';

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight?: number;
}

export function useTransactionHeatmap() {
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const transactions = await getTransactions();
      
      // Filter transactions with location data and group by location
      const locationCounts: { [key: string]: { lat: number; lng: number; count: number } } = {};
      
      transactions.forEach((transaction) => {
        if (transaction.locationLatitude && transaction.locationLongitude) {
          // Round coordinates to 4 decimal places to group nearby transactions
          const key = `${transaction.locationLatitude.toFixed(4)},${transaction.locationLongitude.toFixed(4)}`;
          
          if (!locationCounts[key]) {
            locationCounts[key] = {
              lat: transaction.locationLatitude,
              lng: transaction.locationLongitude,
              count: 0,
            };
          }
          locationCounts[key].count += 1;
        }
      });

      // Convert to heatmap points with weights
      const points: HeatmapPoint[] = Object.values(locationCounts).map((location) => ({
        latitude: location.lat,
        longitude: location.lng,
        weight: Math.min(1, location.count / 10), // Normalize weight (cap at 10 transactions)
      }));

      setHeatmapPoints(points);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transaction locations');
      console.error('Error loading heatmap data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Calculate the map region to fit all heatmap points
  const mapRegion = useMemo(() => {
    if (heatmapPoints.length === 0) {
      // Default to a world view
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 180,
        longitudeDelta: 360,
      };
    }

    const latitudes = heatmapPoints.map((p) => p.latitude);
    const longitudes = heatmapPoints.map((p) => p.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latitudeDelta = Math.max(maxLat - minLat, 0.1) * 1.2; // Add 20% padding
    const longitudeDelta = Math.max(maxLng - minLng, 0.1) * 1.2;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta,
      longitudeDelta,
    };
  }, [heatmapPoints]);

  return {
    heatmapPoints,
    mapRegion,
    isLoading,
    error,
    refresh: load,
  };
}
