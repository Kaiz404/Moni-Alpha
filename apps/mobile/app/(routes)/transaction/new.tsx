import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useAuth } from '@/lib/auth/auth-context';
import { createTransaction, createTransfer } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { createTransactionSchema } from '@repo/types';

const inputClass =
  'rounded-xl bg-white/95 px-3 py-2.5 text-slate-900 dark:bg-slate-800/95 dark:text-white';

export default function NewTransactionScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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
    if (wallets.length > 0) {
      if (paramWalletId && wallets.some((w) => w.id === paramWalletId)) {
        setWalletId(paramWalletId);
      } else if (!walletId) {
        setWalletId(wallets[0].id);
      }
      if (!transferToWalletId) {
        const other = wallets.find((w) => w.id !== (paramWalletId ?? wallets[0].id));
        if (other) setTransferToWalletId(other.id);
      }
    }
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

  const chipBase =
    'py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800';
  const chipActive = 'border-[#6367FF] bg-[#6367FF]/12 dark:bg-[#6367FF]/25 dark:border-[#8494FF]';

  return (
    <View className="flex-1 bg-[#C9BEFF] dark:bg-gray-900">
      <SafeAreaView edges={['top']} className="bg-[#6367FF]">
        <View className="bg-[#6367FF] h-25 border rounded-b-2xl border-transparent shadow-xl/50 shadow-[#6367FF] flex-row items-center justify-start pl-7 pr-5">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-[#8494FF] active:opacity-80">
            <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>
          <Text className="ml-3 flex-1 text-2xl font-medium text-white dark:text-white" numberOfLines={1}>
            New Transaction
          </Text>
        </View>
      </SafeAreaView>

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
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {type === 'transfer' ? 'From wallet' : 'Wallet'}
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {wallets.map((w) => (
              <TouchableOpacity
                key={w.id}
                className={`${chipBase} ${walletId === w.id ? chipActive : ''}`}
                onPress={() => setWalletId(w.id)}
                activeOpacity={0.85}>
                <Text
                  className={`text-sm ${walletId === w.id ? 'font-semibold text-[#4f54c4] dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}
                  numberOfLines={1}>
                  {w.icon} {w.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {type === 'transfer' ? (
            <>
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                To wallet
              </Text>
              <View className="mb-4 flex-row flex-wrap gap-1.5">
                {destinationWallets.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    className={`${chipBase} ${transferToWalletId === w.id ? chipActive : ''}`}
                    onPress={() => setTransferToWalletId(w.id)}
                    activeOpacity={0.85}>
                    <Text
                      className={`text-sm ${transferToWalletId === w.id ? 'font-semibold text-[#4f54c4] dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}
                      numberOfLines={1}>
                      {w.icon} {w.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <View className="mb-4 flex-row gap-3">
            <View className="flex-1 min-w-[140px]">
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Type
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                <TouchableOpacity
                  className={`flex-1 min-w-[30%] ${chipBase} items-center py-2 ${type === 'income' ? chipActive : ''}`}
                  onPress={() => setType('income')}
                  activeOpacity={0.85}>
                  <Text
                    className={`text-sm font-medium ${type === 'income' ? 'text-[#4f54c4] dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>
                    Income
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 min-w-[30%] ${chipBase} items-center py-2 ${type === 'expense' ? chipActive : ''}`}
                  onPress={() => setType('expense')}
                  activeOpacity={0.85}>
                  <Text
                    className={`text-sm font-medium ${type === 'expense' ? 'text-[#4f54c4] dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 min-w-[30%] ${chipBase} items-center py-2 ${type === 'transfer' ? chipActive : ''}`}
                  onPress={() => setType('transfer')}
                  activeOpacity={0.85}>
                  <Text
                    className={`text-sm font-medium ${type === 'transfer' ? 'text-[#4f54c4] dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>
                    Transfer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View className="flex-1 min-w-[120px]">
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Category
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-1.5">
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                className={`${chipBase} ${categoryId === c.id ? chipActive : ''}`}
                onPress={() => setCategoryId(c.id)}
                activeOpacity={0.85}>
                <Text
                  className={`text-xs ${categoryId === c.id ? 'font-semibold text-[#4f54c4] dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}
                  numberOfLines={1}>
                  {c.icon} {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mb-1.5 flex-row items-baseline gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Merchant
            </Text>
            <Text className="text-[10px] text-slate-400 dark:text-slate-500">optional</Text>
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
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Description
            </Text>
            <Text className="text-[10px] text-slate-400 dark:text-slate-500">optional</Text>
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

          <View className=" bg-[#C9BEFF] pt-2 dark:bg-gray-900">
            {type !== 'transfer' ? (
            <>
            {locationLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#6367FF" />
                <Text className="text-xs text-slate-600 dark:text-slate-400">Finding transaction location…</Text>
              </View>
            ) : locationUnavailable || !locationSnapshot ? (
              <Text className="text-xs text-slate-600 dark:text-slate-400">
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
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Transaction location {mapExpanded ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {locationSnapshot.name ? (
                  <Text
                    className="text-xs text-slate-600 dark:text-slate-300 mb-1"
                    numberOfLines={mapExpanded ? 4 : 2}>
                    {locationSnapshot.name}
                  </Text>
                ) : null}
                {mapExpanded ? (
                  <View
                    className="mt-1 rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80"
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
                        pinColor="#6367FF"
                      />
                    </MapView>
                  </View>
                ) : null}
              </View>
            )}
            </>
            ) : (
              <Text className="text-xs text-slate-600 dark:text-slate-400">
                Transfers move money between your wallets without changing your overall net worth.
              </Text>
            )}
          </View>
          </ScrollView>



          <View
            className="border-t border-slate-400/20 bg-[#C9BEFF] px-4 pt-3 dark:border-slate-600/30 dark:bg-gray-900"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <TouchableOpacity
              className={`flex-row items-center justify-center gap-2 rounded-xl bg-[#6367FF] py-3.5 dark:bg-blue-600 ${loading ? 'opacity-60' : ''}`}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.88}>
              {loading ? (
                <Text className="text-base font-semibold text-white">Creating…</Text>
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#ffffff" />
                  <Text className="text-base font-semibold text-white">Create transaction</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
