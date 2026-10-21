import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Text } from '@/components/ui/text';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useValue } from '@legendapp/state/react';
import { useAuth } from '@/lib/auth/auth-context';
import { budgetProgress$ } from '@/lib/finance/selectors';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import {
  getTransactionById,
  updateTransaction,
} from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { AmountInput } from '@/components/finance/amount-input';
import { Segmented } from '@/components/ui/segmented';
import { NotFound } from '@/components/ui/empty-tile';
import { FormField } from '@/components/ui/form-field';
import { PickerField } from '@/components/ui/picker-field';
import {
  minorToDecimal,
  parseAmountInput,
} from '@/lib/finance/money';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

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
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

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
          router.replace('/debts');
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

  const walletOptions = (list: any[]) =>
    list.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency ?? 'USD',
      type: wallet.type ?? null,
      icon: wallet.icon ?? null,
      color: wallet.color ?? null,
      cardStyleId: wallet.cardStyleId ?? null,
    }));

  const pickWallet = async (role: 'source' | 'destination') => {
    const destination = role === 'destination';
    const pick = await openSheet({
      kind: 'wallet',
      title: destination
        ? 'Move to'
        : isTransfer
          ? 'From wallet'
          : 'Paid from',
      wallets: walletOptions(
        destination ? destinationWallets : wallets,
      ),
      selectedId:
        (destination ? transferToWalletId : walletId) || null,
    });
    if (!pick?.walletId) return;
    if (destination) setTransferToWalletId(pick.walletId);
    else setWalletId(pick.walletId);
  };

  const pickCategory = async () => {
    const currency = (
      wallets.find((wallet) => wallet.id === walletId)?.currency ??
      'USD'
    ).toUpperCase();
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency,
      categories: toCategoryTiles(categories, progress, currency),
      selectedId: categoryId || null,
    });
    if (picked) setCategoryId(picked);
  };

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
      <Page
        screen="txn"
        kind="pushed"
        title="Transaction"
      >
        <NotFound
          icon="receipt-text"
          title="This spend isn't here any more"
          body="It may have been deleted on another phone. Your totals already leave it out."
        />
      </Page>
    );
  }

  if (loadingTx) {
    return (
      <Page
        screen="txn"
        kind="bare"
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={tokens.primary}
          />
        </View>
      </Page>
    );
  }

  if (loadError) {
    return (
      <Page
        screen="txn"
        kind="pushed"
        title="Transaction"
      >
        <NotFound
          icon="alert-circle-outline"
          title="Couldn't open this transaction"
        />
        <View className="px-5 pb-5">
          <Button
            testID={tid('txn', 'go-back')}
            label="Go back"
            onPress={() => router.back()}
          />
        </View>
      </Page>
    );
  }

  return (
    <Page
      screen="txn"
      kind="pushed"
      title="Edit Transaction"
    >
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
            <Text className="text-2xl font-display-bold text-foreground">
              Edit transaction
            </Text>
            <View className="rounded-card bg-sand mb-6 mt-4 p-4 overflow-hidden">
              <Text className="text-xs font-display-semibold uppercase tracking-wide text-muted">
                Date &amp; time
              </Text>
              <Text className="mt-1 text-sm font-display-semibold text-foreground">
                {readOnlyDate}
              </Text>
              {readOnlyLocation ? (
                <Text className="mt-1 text-xs text-muted">
                  Location: {readOnlyLocation}
                </Text>
              ) : null}
            </View>

            {isTransfer ? (
              <View className="rounded-card bg-sand-light mb-6 p-4 overflow-hidden">
                <Text className="text-sm leading-5 text-foreground">
                  Transfer between your wallets — does not affect your
                  overall net worth.
                </Text>
              </View>
            ) : null}

            <View className="mb-4 gap-2">
              <PickerField
                testID={tid('txn', 'wallet')}
                label={isTransfer ? 'From wallet' : 'Paid from'}
                value={
                  wallets.find((w) => w.id === walletId)?.name ?? ''
                }
                onPress={() => void pickWallet('source')}
              />
              {isTransfer ? (
                <PickerField
                  testID={tid('txn', 'destination')}
                  label="Move to"
                  value={
                    wallets.find((w) => w.id === transferToWalletId)
                      ?.name ?? ''
                  }
                  onPress={() => void pickWallet('destination')}
                />
              ) : null}
            </View>

            {isTransfer ? (
              <View className="mb-4 flex-row gap-3">
                <View className="flex-1 min-w-[120px]">
                  <Text className="mb-1.5 text-xs font-display-semibold uppercase tracking-wide text-muted">
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
                  <Text className="mb-1.5 text-xs font-display-semibold uppercase tracking-wide text-muted">
                    Type
                  </Text>
                  <Segmented
                    screen="txn"
                    name="type"
                    accessibilityLabel="Type"
                    options={[
                      { value: 'income', label: 'Income' },
                      { value: 'expense', label: 'Expense' },
                    ]}
                    value={type === 'income' ? 'income' : 'expense'}
                    onChange={setType}
                  />
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="mb-1.5 text-xs font-display-semibold uppercase tracking-wide text-muted">
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
                <PickerField
                  testID={tid('txn', 'category')}
                  className="mb-4"
                  label="Category"
                  value={
                    categories.find((c) => c.id === categoryId)
                      ?.name ?? ''
                  }
                  onPress={() => void pickCategory()}
                />

                <FormField
                  testID={tid('txn', 'merchant')}
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
              testID={tid('txn', 'notes')}
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
                    <Text className="text-xs font-display-semibold uppercase tracking-wide text-muted">
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
            <Button
              testID={tid('txn', 'save-changes')}
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
    </Page>
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
