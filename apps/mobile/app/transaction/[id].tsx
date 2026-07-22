import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { ColorValue } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getTransactionById,
  updateTransaction,
} from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { BrandHeader } from '@/components/ui/brand-header';
import { AmountInput } from '@/components/finance/amount-input';
import { ScreenShell } from '@/components/ui/screen-shell';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { Surface } from '@/components/ui/surface';
import {
  minorToDecimal,
  parseAmountInput,
} from '@/lib/finance/money';

const inputClass =
  'min-h-13 rounded-2xl bg-surface-2 px-4 py-3 text-foreground';

export default function EditTransactionScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const txId = useMemo(() => {
    const x = params.id;
    if (Array.isArray(x)) return x[0];
    return x;
  }, [params.id]);

  const [loadingTx, setLoadingTx] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(
    'expense',
  );
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [readOnlyDate, setReadOnlyDate] = useState('');
  const [readOnlyLocation, setReadOnlyLocation] = useState<
    string | null
  >(null);
  const [savedLocationCoords, setSavedLocationCoords] = useState<{
    latitude: number;
    longitude: number;
    name: string | null;
  } | null>(null);
  const [mapExpanded, setMapExpanded] = useState(true);
  const [isTransfer, setIsTransfer] = useState(false);

  useEffect(() => {
    if (!user || !txId) return;
    let cancelled = false;

    (async () => {
      setLoadingTx(true);
      setLoadError(null);
      try {
        const [tx, walletList] = await Promise.all([
          getTransactionById(txId),
          getWallets(),
        ]);
        if (cancelled) return;
        if (!tx) {
          setLoadError('Transaction not found.');
          setLoadingTx(false);
          return;
        }
        if (tx.debtActivityId) {
          router.replace('/debts' as any);
          return;
        }
        setWallets(walletList);

        const transfer = tx.type === 'transfer';
        setIsTransfer(transfer);

        setReadOnlyDate(
          tx.transactionDate
            ? new Date(tx.transactionDate).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—',
        );
        setReadOnlyLocation(tx.locationName ?? null);

        const lat = tx.locationLatitude;
        const lng = tx.locationLongitude;
        if (
          lat != null &&
          lng != null &&
          !Number.isNaN(lat) &&
          !Number.isNaN(lng)
        ) {
          setSavedLocationCoords({
            latitude: lat,
            longitude: lng,
            name: tx.locationName ?? null,
          });
        } else {
          setSavedLocationCoords(null);
        }
        setMapExpanded(true);

        setWalletId(tx.walletId);
        setTransferToWalletId(tx.transferToWalletId ?? '');
        setAmount(minorToDecimal(tx.amountMinor));
        if (
          tx.type === 'income' ||
          tx.type === 'expense' ||
          tx.type === 'transfer'
        ) {
          setType(tx.type);
        } else {
          setType('expense');
        }
        setCategoryId(tx.categoryId ?? '');
        setMerchant(tx.merchant ?? '');
        setDescription(tx.description ?? tx.notes ?? '');
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? e.message
              : 'Failed to load transaction',
          );
        }
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, txId]);

  useEffect(() => {
    if (!user || isTransfer) return;
    getCategories(type === 'income' ? 'income' : 'expense').then(
      setCategories,
    );
  }, [user, type, isTransfer]);

  const destinationWallets = useMemo(
    () => wallets.filter((w) => w.id !== walletId),
    [wallets, walletId],
  );

  const handleSubmit = useCallback(async () => {
    if (!user || !txId) return;

    let amountMinor: ReturnType<typeof parseAmountInput>;
    try {
      amountMinor = parseAmountInput(amount);
    } catch {
      Alert.alert('Error', 'Enter a valid positive amount.');
      return;
    }

    setLoading(true);
    try {
      if (isTransfer) {
        if (!transferToWalletId) {
          Alert.alert('Error', 'Select a destination wallet.');
          return;
        }
        if (walletId === transferToWalletId) {
          Alert.alert(
            'Error',
            'Source and destination wallets must differ.',
          );
          return;
        }
        const fromWallet = wallets.find((w) => w.id === walletId);
        const toWallet = wallets.find(
          (w) => w.id === transferToWalletId,
        );
        if (fromWallet && toWallet) {
          const fromCur = (
            fromWallet.currency ?? 'USD'
          ).toUpperCase();
          const toCur = (toWallet.currency ?? 'USD').toUpperCase();
          if (fromCur !== toCur) {
            Alert.alert(
              'Error',
              'Transfers require both wallets to use the same currency.',
            );
            return;
          }
        }
        await updateTransaction(txId, {
          walletId,
          transferToWalletId,
          amountMinor,
          type: 'transfer',
          categoryId: null,
          merchant: null,
          description: description.trim() || null,
        });
      } else {
        await updateTransaction(txId, {
          walletId,
          amountMinor,
          type,
          categoryId: categoryId || null,
          merchant: merchant.trim() || null,
          description: description.trim() || null,
          transferToWalletId: null,
        });
      }
      router.back();
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error
          ? e.message
          : 'Failed to update transaction',
      );
    } finally {
      setLoading(false);
    }
  }, [
    user,
    txId,
    isTransfer,
    walletId,
    transferToWalletId,
    amount,
    type,
    categoryId,
    merchant,
    description,
    wallets,
  ]);

  if (!txId) {
    return (
      <ScreenShell variant="canvas">
        <BrandHeader title="Transaction" />
        <FeedbackState
          className="flex-1"
          icon="receipt-text"
          title="Missing transaction"
        />
      </ScreenShell>
    );
  }

  if (loadingTx) {
    return (
      <ScreenShell variant="canvas">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={tokens.primary}
          />
        </View>
      </ScreenShell>
    );
  }

  if (loadError) {
    return (
      <ScreenShell variant="canvas">
        <BrandHeader title="Transaction" />
        <FeedbackState
          className="flex-1"
          icon="alert-circle-outline"
          mode="error"
          title="Couldn’t open this transaction"
        />
        <View className="px-5 pb-5">
          <PrimaryButton
            label="Go back"
            onPress={() => router.back()}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Edit Transaction" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-4 pt-4 pb-2"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-2xl font-bold text-foreground">
              Edit transaction
            </Text>
            <Surface
              tone="muted"
              className="mb-6 mt-4 p-4"
            >
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                Date &amp; time
              </Text>
              <Text className="mt-1 text-sm font-semibold text-foreground">
                {readOnlyDate}
              </Text>
              {readOnlyLocation ? (
                <Text className="mt-1 text-xs text-muted">
                  Location: {readOnlyLocation}
                </Text>
              ) : null}
            </Surface>

            {isTransfer ? (
              <Surface
                tone="tray"
                className="mb-6 p-4"
              >
                <Text className="text-sm leading-5 text-foreground">
                  Transfer between your wallets — does not affect your
                  overall net worth.
                </Text>
              </Surface>
            ) : null}

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {isTransfer ? 'From wallet' : 'Wallet'}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {wallets.map((w) => {
                const selected = walletId === w.id;
                const iconColor: ColorValue = selected
                  ? tokens.primary
                  : tokens.foreground;
                return (
                  <TouchableOpacity
                    key={w.id}
                    className={chipClass(walletId === w.id)}
                    onPress={() => setWalletId(w.id)}
                    activeOpacity={0.85}
                  >
                    <View className="flex-row items-center gap-1.5">
                      <WalletIcon
                        color={iconColor}
                        icon={w.icon}
                        size={16}
                        type={w.type}
                      />
                      <Text
                        className={`text-sm ${chipTextClass(walletId === w.id)}`}
                        numberOfLines={1}
                      >
                        {w.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isTransfer ? (
              <>
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  To wallet
                </Text>
                <View className="mb-4 flex-row flex-wrap gap-1.5">
                  {destinationWallets.map((w) => {
                    const selected = transferToWalletId === w.id;
                    const iconColor: ColorValue = selected
                      ? tokens.primary
                      : tokens.foreground;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        className={chipClass(
                          transferToWalletId === w.id,
                        )}
                        onPress={() => setTransferToWalletId(w.id)}
                        activeOpacity={0.85}
                      >
                        <View className="flex-row items-center gap-1.5">
                          <WalletIcon
                            color={iconColor}
                            icon={w.icon}
                            size={16}
                            type={w.type}
                          />
                          <Text
                            className={`text-sm ${chipTextClass(transferToWalletId === w.id)}`}
                            numberOfLines={1}
                          >
                            {w.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {isTransfer ? (
              <View className="mb-4 flex-row gap-3">
                <View className="flex-1 min-w-[120px]">
                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Amount
                  </Text>
                  <AmountInput
                    className={`text-base ${inputClass}`}
                    placeholder="0.00"
                    placeholderTextColor={tokens.muted}
                    value={amount}
                    onChangeValue={setAmount}
                    currency={
                      wallets.find((wallet) => wallet.id === walletId)
                        ?.currency
                    }
                  />
                </View>
              </View>
            ) : (
              <View className="mb-4 flex-row gap-3">
                <View className="flex-1 min-w-[140px]">
                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Type
                  </Text>
                  <View className="flex-row gap-1.5">
                    <TouchableOpacity
                      className={`${chipClass(type === 'income')} flex-1 items-center py-2 ${isTransfer ? 'opacity-50' : ''}`}
                      onPress={() => !isTransfer && setType('income')}
                      activeOpacity={0.85}
                      disabled={isTransfer}
                    >
                      <Text
                        className={`text-sm font-medium ${chipTextClass(type === 'income')}`}
                      >
                        Income
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`${chipClass(type === 'expense')} flex-1 items-center py-2 ${isTransfer ? 'opacity-50' : ''}`}
                      onPress={() =>
                        !isTransfer && setType('expense')
                      }
                      activeOpacity={0.85}
                      disabled={isTransfer}
                    >
                      <Text
                        className={`text-sm font-medium ${chipTextClass(type === 'expense')}`}
                      >
                        Expense
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Amount
                  </Text>
                  <AmountInput
                    className={`text-base ${inputClass}`}
                    placeholder="0.00"
                    placeholderTextColor={tokens.muted}
                    value={amount}
                    onChangeValue={setAmount}
                    currency={
                      wallets.find((wallet) => wallet.id === walletId)
                        ?.currency
                    }
                  />
                </View>
              </View>
            )}

            {!isTransfer ? (
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
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-xs ${chipTextClass(categoryId === c.id)}`}
                        numberOfLines={1}
                      >
                        {c.icon} {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FormField
                  label="Merchant"
                  hint="Optional"
                  placeholder="Store or payee"
                  value={merchant}
                  onChangeText={setMerchant}
                  autoCapitalize="words"
                />
              </>
            ) : null}

            <FormField
              label="Notes"
              hint="Optional"
              className="min-h-24 text-sm"
              placeholder="Add a note"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <View className="pt-2">
              {!savedLocationCoords ? (
                <Text className="text-xs text-muted">
                  No location saved for this transaction.
                </Text>
              ) : (
                <View>
                  <TouchableOpacity
                    className="flex-row items-center justify-between py-1"
                    onPress={() => setMapExpanded(!mapExpanded)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      mapExpanded ? 'Hide map' : 'Show map'
                    }
                  >
                    <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Transaction location {mapExpanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {savedLocationCoords.name ? (
                    <Text
                      className="mb-1 text-xs text-muted"
                      numberOfLines={mapExpanded ? 4 : 2}
                    >
                      {savedLocationCoords.name}
                    </Text>
                  ) : null}
                  {mapExpanded ? (
                    <View
                      className="mt-3 overflow-hidden rounded-2xl bg-card"
                      style={styles.locationMapBox}
                    >
                      <MapView
                        style={styles.locationMap}
                        initialRegion={{
                          latitude: savedLocationCoords.latitude,
                          longitude: savedLocationCoords.longitude,
                          latitudeDelta: 0.006,
                          longitudeDelta: 0.006,
                        }}
                        provider="google"
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                      >
                        <Marker
                          coordinate={{
                            latitude: savedLocationCoords.latitude,
                            longitude: savedLocationCoords.longitude,
                          }}
                          pinColor={tokens.primary}
                        />
                      </MapView>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </ScrollView>

          <View
            className="border-t border-border bg-canvas px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <PrimaryButton
              label="Save changes"
              loading={loading}
              loadingLabel="Saving..."
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
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
