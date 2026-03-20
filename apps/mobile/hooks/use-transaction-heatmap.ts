import { useCallback, useState, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { getTransactions } from '@/lib/supabase/transactions';

export interface TransactionPinPoint {
  latitude: number;
  longitude: number;
  transactionCount: number;
  locationName: string;
  description: string;
  amount: number;
}

export function useTransactionPinmap() {
  const [pinPoints, setPinPoints] = useState<TransactionPinPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const transactions = await getTransactions();
      
      const locationCounts: {
        [key: string]: {
          lat: number;
          lng: number;
          count: number;
          locationName: string;
          description: string;
          amount: number;
        };
      } = {};
      
      transactions.forEach((transaction) => {
        if (transaction.locationLatitude && transaction.locationLongitude) {
          const key = `${transaction.locationLatitude.toFixed(4)},${transaction.locationLongitude.toFixed(4)}`;
          
          if (!locationCounts[key]) {
            locationCounts[key] = {
              lat: transaction.locationLatitude,
              lng: transaction.locationLongitude,
              count: 0,
              locationName: transaction.locationName?.trim() || 'Saved Transaction Location',
              description: transaction.description?.trim() || 'No description',
              amount: transaction.amount,
            };
          }
          locationCounts[key].count += 1;
        }
      });

      const points: TransactionPinPoint[] = Object.values(locationCounts).map((location) => ({
        latitude: location.lat,
        longitude: location.lng,
        transactionCount: location.count,
        locationName: location.locationName,
        description: location.description,
        amount: location.amount,
      }));

      setPinPoints(points);
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

  const mapRegion = useMemo(() => {
    if (pinPoints.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 180,
        longitudeDelta: 360,
      };
    }

    const latitudes = pinPoints.map((point) => point.latitude);
    const longitudes = pinPoints.map((point) => point.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latitudeDelta = Math.max(maxLat - minLat, 0.1) * 1.2;
    const longitudeDelta = Math.max(maxLng - minLng, 0.1) * 1.2;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta,
      longitudeDelta,
    };
  }, [pinPoints]);

  return {
    pinPoints,
    mapRegion,
    isLoading,
    error,
    refresh: load,
  };
}

export const useTransactionHeatmap = useTransactionPinmap;
