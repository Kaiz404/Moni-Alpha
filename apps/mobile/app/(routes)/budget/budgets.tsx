import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { syncSystem } from '@/lib/powersync/Powersync';
import {
  deleteCategoryBudget,
  getCategoryBudgets,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';

type CatRow = { id: string; name: string; color: string | null };

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bg = isDark ? '#111827' : '#ffffff';
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CatRow[]>([]);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { db, supabaseConnector } = syncSystem;
      const userId = await supabaseConnector.getUserId();
      if (!userId) {
        setCategories([]);
        setAmountDraft({});
        return;
      }

      const [catRows, budgets] = await Promise.all([
        db
          .selectFrom('categories')
          .select(['id', 'name', 'color'])
          .where('type', '=', 'expense')
          .where('is_active', '=', 1)
          .where((eb) => eb.or([eb('user_id', 'is', null), eb('user_id', '=', userId)]))
          .orderBy('display_order', 'asc')
          .orderBy('name', 'asc')
          .execute(),
        getCategoryBudgets(),
      ]);

      setCategories(
        catRows.map((c) => ({
          id: c.id,
          name: c.name ?? 'Category',
          color: c.color,
        })),
      );

      const draft: Record<string, string> = {};
      for (const b of budgets) {
        draft[b.categoryId] = String(b.amount);
      }
      for (const c of catRows) {
        if (draft[c.id] === undefined) draft[c.id] = '';
      }
      setAmountDraft(draft);
    } catch (e) {
      console.error('[BudgetsScreen] load failed', e);
      Alert.alert(
        'Could not load',
        e instanceof Error ? e.message : 'Check sync and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const saveBudget = async (categoryId: string) => {
    const raw = (amountDraft[categoryId] ?? '').trim();
    if (raw === '') {
      setSavingId(categoryId);
      try {
        await deleteCategoryBudget(categoryId);
        await load();
      } catch (e) {
        Alert.alert('Could not clear budget', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setSavingId(null);
      }
      return;
    }

    const n = parseFloat(raw.replace(/,/g, ''));
    if (Number.isNaN(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number or leave empty to remove the budget.');
      return;
    }

    setSavingId(categoryId);
    try {
      await upsertCategoryBudget(categoryId, n);
      await load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View
          style={[
            styles.headerRow,
            { borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={24} color="#64748b" />
          </Pressable>
          <Text
            style={[styles.headerTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}
            numberOfLines={1}
          >
            Category budgets
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.intro, { color: isDark ? '#94a3b8' : '#475569' }]}>
              Monthly limits apply to <Text style={styles.introBold}>all wallets</Text> combined. The
              budget coach compares this month&apos;s expenses (by category) to these caps.
            </Text>

            {categories.length === 0 ? (
              <Text style={[styles.empty, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                No expense categories available.
              </Text>
            ) : (
              categories.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.card,
                    {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : '#f8fafc',
                    },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {c.name}
                  </Text>
                  <View style={styles.row}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          borderColor: isDark ? '#475569' : '#cbd5e1',
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        },
                      ]}
                      placeholder="Monthly budget (empty = none)"
                      placeholderTextColor="#94a3b8"
                      keyboardType="decimal-pad"
                      value={amountDraft[c.id] ?? ''}
                      onChangeText={(t) => setAmountDraft((prev) => ({ ...prev, [c.id]: t }))}
                    />
                    <Pressable
                      onPress={() => saveBudget(c.id)}
                      disabled={savingId === c.id}
                      style={({ pressed }) => [
                        styles.saveBtn,
                        pressed && { opacity: 0.9 },
                        savingId === c.id && { opacity: 0.7 },
                      ]}
                    >
                      {savingId === c.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveBtnText}>Save</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backBtnPressed: {
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  introBold: {
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 15,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#8494FF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
