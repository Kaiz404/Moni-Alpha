import { useValue } from '@legendapp/state/react';
import {
  categoryIconNames,
  categoryNameMaxLength,
  customCategoryColors,
  type CategoryIconName,
  type CustomCategoryColor,
} from '@repo/types';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { categoriesForUser$ } from '@/lib/finance/selectors';
import { openSheet } from '@/lib/sheet/sheet-store';
import {
  archiveCategory,
  createCategory,
  updateCategory,
} from '@/lib/supabase/categories';
import { tid } from '@/lib/test-ids';

type Kind = 'expense' | 'income';

const KINDS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
] as const;
const GAP = 8;

function isIcon(value: string | null | undefined): value is CategoryIconName {
  return (categoryIconNames as readonly string[]).includes(value ?? '');
}

function isColour(value: string | null | undefined): value is CustomCategoryColor {
  return (customCategoryColors as readonly string[]).includes(value ?? '');
}

export default function CategoryFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    type?: Kind;
    returnTo?: string;
  }>();
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const { width } = useWindowDimensions();
  const categories = useValue(categoriesForUser$(user?.id ?? null));
  const existing =
    categories.find(
      (category) => category.id === params.id && category.userId === user?.id,
    ) ?? null;
  const [kind, setKind] = useState<Kind>(
    existing?.type === 'income' || params.type === 'income' ? 'income' : 'expense',
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<CategoryIconName>(
    isIcon(existing?.icon) ? existing.icon : 'package-variant',
  );
  const [colour, setColour] = useState<CustomCategoryColor>(
    isColour(existing?.color) ? existing.color : customCategoryColors[8],
  );
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(existing !== null);
  useEffect(() => {
    if (!existing || hydrated.current) return;
    hydrated.current = true;
    setKind(existing.type === 'income' ? 'income' : 'expense');
    setName(existing.name);
    if (isIcon(existing.icon)) setIcon(existing.icon);
    if (isColour(existing.color)) setColour(existing.color);
  }, [existing]);
  const named = name.trim().length > 0;
  const waiting = Boolean(params.id) && !existing;
  const iconSize = Math.floor((width - 40 - GAP * 6) / 7);
  const swatch = Math.floor((width - 40 - GAP * 7) / 8);

  const leave = (id: string) => {
    if (params.returnTo)
      router.dismissTo({
        pathname: params.returnTo,
        params: { categoryId: id },
      } as Href);
    else router.back();
  };

  const save = async () => {
    if (!named) return;
    setSaving(true);
    try {
      if (existing) {
        await updateCategory(existing.id, { name, icon, color: colour });
        leave(existing.id);
      } else leave(await createCategory({ name, icon, color: colour, type: kind }));
    } catch (error) {
      Alert.alert(
        'Not saved',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!existing) return;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Archive ${existing.name}?`,
      message: 'It is hidden from new transactions. Rows already filed under it keep it.',
      confirmLabel: 'Archive',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await archiveCategory(existing.id);
      router.back();
    } catch (error) {
      Alert.alert('Not saved', error instanceof Error ? error.message : 'Try again.');
    }
  };

  return (
    <Page
      screen="activity"
      kind="pushed"
      title={existing || params.id ? 'Edit category' : 'New category'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 px-screen pb-6"
      >
        {existing || params.id ? null : (
          <Segmented
            screen="activity"
            name="category-kind"
            options={KINDS}
            value={kind}
            onChange={setKind}
            accessibilityLabel="Category type"
          />
        )}
        <View className="gap-2">
          <Text variant="caps" className="text-muted">
            Name
          </Text>
          <View className="h-[60px] flex-row items-center gap-3 rounded-tile border-[1.5px] border-foreground bg-card pl-2 pr-4">
            <View
              className="h-[42px] w-[42px] items-center justify-center rounded-full"
              style={{ backgroundColor: colour }}
            >
              <IconSymbol name={icon} size={20} color={tokens.onPastel} />
            </View>
            <TextInput
              testID={tid('activity', 'category-form', 'name')}
              accessibilityLabel="Name"
              value={name}
              onChangeText={(text) => setName(text.slice(0, categoryNameMaxLength))}
              maxLength={categoryNameMaxLength}
              placeholder="e.g. Pet care"
              placeholderTextColor={tokens.muted}
              returnKeyType="done"
              className="h-full min-w-0 flex-1 font-display-semibold text-[17px] text-foreground"
            />
            <Text
              variant="meta"
              className={name.length >= categoryNameMaxLength ? 'text-state-destructive' : 'text-muted'}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${name.length} / ${categoryNameMaxLength}`}
            </Text>
          </View>
          <Text variant="meta" className="text-muted">
            {named ? 'Shows like this in lists and charts' : 'Give it a name to save'}
          </Text>
        </View>

        <View className="gap-2">
          <Text variant="caps" className="text-muted">
            Icon
          </Text>
          <View
            accessibilityLabel="Icon"
            className="flex-row flex-wrap"
            style={{ gap: GAP }}
          >
            {categoryIconNames.map((glyph) => {
              const selected = glyph === icon;
              return (
                <Press
                  key={glyph}
                  testID={tid('activity', 'category-form', 'icon', glyph)}
                  accessibilityLabel={`Icon ${glyph.replaceAll('-', ' ')}`}
                  accessibilityState={{ selected }}
                  pressedClassName={selected ? 'bg-primary-pressed' : 'bg-sand-light'}
                  className={`items-center justify-center rounded-[14px] ${selected ? 'bg-primary' : 'bg-card'}`}
                  style={{ width: iconSize, height: iconSize }}
                  onPress={() => setIcon(glyph)}
                >
                  <IconSymbol
                    name={glyph}
                    size={22}
                    color={selected ? tokens.primaryForeground : tokens.foreground}
                  />
                </Press>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Text variant="caps" className="text-muted">
            Colour
          </Text>
          <View
            accessibilityLabel="Colour"
            className="flex-row flex-wrap"
            style={{ gap: GAP }}
          >
            {customCategoryColors.map((hex, index) => {
              const selected = hex === colour;
              return (
                <Press
                  key={hex}
                  testID={tid('activity', 'category-form', 'colour', index)}
                  accessibilityLabel={`Colour ${hex}`}
                  accessibilityState={{ selected }}
                  pressedScale={0.94}
                  pressedClassName="bg-transparent"
                  className={`items-center justify-center rounded-full ${selected ? 'border-2 border-foreground' : ''}`}
                  style={{ width: swatch, height: swatch }}
                  onPress={() => setColour(hex)}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: selected ? swatch - 8 : swatch,
                      height: selected ? swatch - 8 : swatch,
                      backgroundColor: hex,
                    }}
                  >
                    {selected ? (
                      <IconSymbol name="check" size={18} color={tokens.onPastel} />
                    ) : null}
                  </View>
                </Press>
              );
            })}
          </View>
        </View>

        {existing ? (
          <Button
            testID={tid('activity', 'category-form', 'archive')}
            variant="tertiary"
            icon="archive-outline"
            label="Archive category"
            className="self-start"
            onPress={() => void archive()}
          />
        ) : null}
      </ScrollView>
      <View className="border-t border-sand-light px-screen pt-3">
        <Button
          testID={tid('activity', 'category-form', 'save')}
          icon="check"
          label={existing ? 'Save changes' : 'Create category'}
          loading={saving}
          disabled={!named || waiting}
          pinned
          onPress={() => void save()}
        />
      </View>
    </Page>
  );
}
