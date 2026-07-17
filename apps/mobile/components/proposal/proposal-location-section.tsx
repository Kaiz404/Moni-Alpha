import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';

export function ProposalLocationSection({
  proposalId,
}: {
  proposalId: string;
}) {
  const tokens = useThemeTokens();
  const [expanded, setExpanded] = useState(false);
  const snapshot = useMemo(
    () => getProposalLocationSnapshot(proposalId),
    [proposalId],
  );

  const region = useMemo(() => {
    if (!snapshot) return null;
    return {
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
    };
  }, [snapshot]);

  if (!snapshot || !region) return null;

  return (
    <View className="mb-4">
      <TouchableOpacity
        className="flex-row items-center"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
          Captured location {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <View className="mt-2">
          <View
            className="overflow-hidden rounded-2xl border border-border bg-background-muted"
            style={styles.locationMapBox}
          >
            <MapView
              style={styles.locationMap}
              initialRegion={region}
              provider="google"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: snapshot.latitude,
                  longitude: snapshot.longitude,
                }}
                pinColor={tokens.primary}
              />
            </MapView>
          </View>
          {snapshot.name ? (
            <Text
              className="mt-2 text-xs text-muted"
              numberOfLines={3}
            >
              {snapshot.name}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locationMapBox: {
    height: 200,
    width: '100%',
  },
  locationMap: {
    ...StyleSheet.absoluteFillObject,
  },
});
