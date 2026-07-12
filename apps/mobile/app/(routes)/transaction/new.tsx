import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '@/lib/auth/auth-context';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { PrimaryButton } from '@/components/ui/primary-button';
import { createTransaction, createTransfer } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { createTransactionSchema } from '@repo/types';

const inputClass =
  'rounded-xl border border-border bg-card px-3 py-2.5 text-foreground';

export default function NewTransactionScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ walletId?: string | string[] }>();
  const paramWalletId = useMemo(() => {
    const w = params.walletId;
    if (Array.isArray(w)) return w[0];
    return w;
  }, [params.walletId]);

  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [locationSnapshot, setLocationSnapshot] = useState<{
    latitude: number;
    longitude: number;
    name: string | null;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocationLoading(true);
      setLocationUnavailable(false);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (!cancelled) {
            setLocationSnapshot(null);
            setLocationUnavailable(true);
          }
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
              [first.name, first.street, first.city, first.region].filter(Boolean).join(', ').trim() ||
              null;
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
        if (!cancelled) {
          setLocationSnapshot(null);
          setLocationUnavailable(true);
        }
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    getWallets().then(setWallets);
    if (type !== 'transfer') {
      getCategories(type).then(setCategories);
    }
  }, [user, type]);

  useEffect(() => {
    if (wallets.length === 0) return;

    if (paramWalletId && wallets.some((w) => w.id === paramWalletId)) {
      setWalletId(paramWalletId);
    } else {
      setWalletId((current) => current || wallets[0].id);
    }

    setTransferToWalletId((current) => {
      if (current) return current;
      const other = wallets.find((w) => w.id !== (paramWalletId ?? wallets[0].id));
      return other?.id ?? current;
    });
  }, [wallets, paramWalletId]);

  const destinationWallets = useMemo(
    () => wallets.filter((w) => w.id !== walletId),
    [wallets, walletId],
  );

  const handleSubmit = async () => {
    if (!user || !walletId) return;

    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) {
      Alert.alert('Error', 'Enter a valid positive amount.');
      return;
    }

    setLoading(true);
    try {
      if (type === 'transfer') {
        if (!transferToWalletId) {
          Alert.alert('Error', 'Select a destination wallet.');
          return;
        }
        await createTransfer({
          fromWalletId: walletId,
          toWalletId: transferToWalletId,
          amount: parsedAmount,
          description: description.trim() || null,
        });
      } else {
        const locationPayload: {
          locationLatitude?: number | null;
          locationLongitude?: number | null;
          locationName?: string | null;
        } =
          locationSnapshot != null
            ? {
                locationLatitude: locationSnapshot.latitude,
                locationLongitude: locationSnapshot.longitude,
                locationName: locationSnapshot.name,
              }
            : {};

        const parsed = createTransactionSchema.safeParse({
          walletId,
          amount: parsedAmount,
          type,
          categoryId: categoryId || null,
          merchant: merchant.trim() || null,
          description: description.trim() || null,
          transactionDate: new Date().toISOString(),
          ...locationPayload,
        });
        if (!parsed.success) {
          Alert.alert('Error', parsed.error.errors[0]?.message ?? 'Invalid input');
          return;
        }
        await createTransaction(parsed.data);
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="New Transaction" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-4 pt-4 pb-2"
            showsVerticalScrollIndicator={false}>
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {type === 'transfer' ? 'From wallet' : 'Wallet'}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {wallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  className={chipClass(walletId === w.id)}
                  onPress={() => setWalletId(w.id)}
                  activeOpacity={0.85}>
                  <Text className={`text-sm ${chipTextClass(walletId === w.id)}`} numberOfLines={1}>
                    {w.icon} {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {type === 'transfer' ? (
              <>
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  To wallet
                </Text>
                <View className="mb-4 flex-row flex-wrap gap-1.5">
                  {destinationWallets.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      className={chipClass(transferToWalletId === w.id)}
                      onPress={() => setTransferToWalletId(w.id)}
                      activeOpacity={0.85}>
                      <Text className={`text-sm ${chipTextClass(transferToWalletId === w.id)}`} numberOfLines={1}>
                        {w.icon} {w.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1 min-w-[140px]">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Type
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  <TouchableOpacity
                    className={`${chipClass(type === 'income')} flex-1 min-w-[30%] items-center py-2`}
                    onPress={() => setType('income')}
                    activeOpacity={0.85}>
                    <Text className={`text-sm font-medium ${chipTextClass(type === 'income')}`}>Income</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`${chipClass(type === 'expense')} flex-1 min-w-[30%] items-center py-2`}
                    onPress={() => setType('expense')}
                    activeOpacity={0.85}>
                    <Text className={`text-sm font-medium ${chipTextClass(type === 'expense')}`}>Expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`${chipClass(type === 'transfer')} flex-1 min-w-[30%] items-center py-2`}
                    onPress={() => setType('transfer')}
                    activeOpacity={0.85}>
                    <Text className={`text-sm font-medium ${chipTextClass(type === 'transfer')}`}>Transfer</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="flex-1 min-w-[120px]">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Amount
                </Text>
                <TextInput
                  className={`text-base ${inputClass}`}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {type !== 'transfer' ? (
              <>
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Category
                </Text>
                <View className="mb-4 flex-row flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      className={chipClass(categoryId === c.id)}
                      onPress={() => setCategoryId(c.id)}
                      activeOpacity={0.85}>
                      <Text className={`text-xs ${chipTextClass(categoryId === c.id)}`} numberOfLines={1}>
                        {c.icon} {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View className="mb-1.5 flex-row items-baseline gap-1">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Merchant
                  </Text>
                  <Text className="text-[10px] text-muted">optional</Text>
                </View>
                <TextInput
                  className={`mb-3 text-sm ${inputClass}`}
                  placeholder="Store or payee"
                  placeholderTextColor="#9CA3AF"
                  value={merchant}
                  onChangeText={setMerchant}
                />
              </>
            ) : null}

            <View className="mb-1.5 flex-row items-baseline gap-1">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                Description
              </Text>
              <Text className="text-[10px] text-muted">optional</Text>
            </View>
            <TextInput
              className={`mb-1 min-h-[72px] text-sm ${inputClass}`}
              placeholder="Notes"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <View className="pt-2">
              {type !== 'transfer' ? (
                <>
                  {locationLoading ? (
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
                        <View
                          className="mt-1 overflow-hidden rounded-xl border border-border bg-card"
                          style={styles.locationMapBox}>
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
                              coordinate={{
                                latitude: locationSnapshot.latitude,
                                longitude: locationSnapshot.longitude,
                              }}
                              pinColor={tokens.primary}
                            />
                          </MapView>
                        </View>
                      ) : null}
                    </View>
                  )}
                </>
              ) : (
                <Text className="text-xs text-muted">
                  Transfers move money between your wallets without changing your overall net worth.
                </Text>
              )}
            </View>
          </ScrollView>

          <View
            className="border-t border-border bg-canvas px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <PrimaryButton
              label="Create transaction"
              loading={loading}
              loadingLabel="Creating..."
              icon="check"
              onPress={handleSubmit}
              disabled={loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
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
