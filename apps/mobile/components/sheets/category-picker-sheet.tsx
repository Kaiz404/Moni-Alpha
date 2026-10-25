import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { CategoryIcon } from '@/components/categories/category-icon';
import { Press } from '@/components/ui/press';
import { SearchField } from '@/components/ui/search-field';
import {
  Sheet,
  type SheetFrameProps,
} from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  budgetNote,
  type BudgetNote,
} from '@/lib/finance/budget-note';
import type {
  CategoryTile,
  SheetRequestOf,
} from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

type CategoryPickerSheetProps = SheetFrameProps & {
  request: SheetRequestOf<'category'>;
  onPick: (categoryId: string) => void;
  onCreate: () => void;
};

const NOTE_TONE: Record<BudgetNote['tone'], string> = {
  plain: 'text-foreground',
  near: 'text-warning',
  over: 'text-over',
  quiet: 'text-muted',
};

function Tile({
  tile,
  currency,
  selected,
  onPick,
}: {
  tile: CategoryTile;
  currency: string;
  selected: boolean;
  onPick: () => void;
}) {
  const tokens = useThemeTokens();
  const note = budgetNote(
    tile.spentMinor,
    tile.budgetMinor,
    currency,
  );
  return (
    <Press
      testID={tid('sheet', 'category', tile.id)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${tile.name}, ${note.label}`}
      className="min-w-0 flex-1 items-center gap-1 rounded-tile bg-card px-1.5 py-2"
      onPress={onPick}
    >
      <View
        className={`rounded-full border-2 p-0.5 ${selected ? 'border-foreground' : 'border-transparent'}`}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-full bg-sand"
          style={
            tile.color ? { backgroundColor: tile.color } : undefined
          }
        >
          <CategoryIcon
            color={tokens.onPastel}
            icon={tile.icon}
            size={22}
          />
        </View>
      </View>
      <Text
        className="text-center text-sm leading-[18px] font-display-semibold text-foreground"
        numberOfLines={2}
      >
        {tile.name}
      </Text>
      {note.ratio === null ? null : (
        <View className="h-1 w-14 overflow-hidden rounded-full bg-sand">
          <View
            className={`h-1 rounded-full ${note.tone === 'over' ? 'bg-coral' : 'bg-ink-2'}`}
            style={{ width: `${Math.round(note.ratio * 100)}%` }}
          />
        </View>
      )}
      <Text
        className={`text-xs leading-4 font-display-bold ${NOTE_TONE[note.tone]}`}
        numberOfLines={1}
      >
        {note.label}
      </Text>
    </Press>
  );
}

/** V2A-CategoryPick: search, three columns of Paper tiles with this month's budget bar. Tapping a tile saves and closes. */
export function CategoryPickerSheet({
  request,
  onPick,
  onCreate,
  ...frame
}: CategoryPickerSheetProps) {
  const tokens = useThemeTokens();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const tiles = useMemo(
    () =>
      request.categories.filter((tile) =>
        tile.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [request.categories, q],
  );
  const cells: (CategoryTile | 'new')[] = request.onCreate
    ? [...tiles, 'new']
    : tiles;
  const rows: (CategoryTile | 'new' | null)[][] = [];
  for (let i = 0; i < cells.length; i += 3) {
    const row: (CategoryTile | 'new' | null)[] = cells.slice(
      i,
      i + 3,
    );
    while (row.length < 3) row.push(null);
    rows.push(row);
  }

  return (
    <Sheet
      {...frame}
      size="large"
      title={request.title}
      closeLabel="Close"
    >
      <View className="pb-3">
        <SearchField
          testID={tid('sheet', 'search')}
          accessibilityLabel="Search categories"
          placeholder="Search categories"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView
        accessibilityLabel="Categories"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-3"
      >
        {rows.map((row, index) => (
          <View
            key={index}
            className="flex-row gap-2"
          >
            {row.map((cell, column) =>
              cell === null ? (
                <View
                  key={`empty-${column}`}
                  className="flex-1"
                />
              ) : cell === 'new' ? (
                <Press
                  key="new"
                  testID={tid('sheet', 'new-category')}
                  className="min-w-0 flex-1 items-center justify-center gap-1 rounded-tile border-[1.5px] border-hairline px-1.5 py-2"
                  onPress={onCreate}
                >
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-sand">
                    <CategoryIcon
                      color={tokens.foreground}
                      icon="plus"
                      size={22}
                    />
                  </View>
                  <Text className="text-center text-sm leading-[18px] font-display-semibold text-foreground">
                    New category
                  </Text>
                </Press>
              ) : (
                <Tile
                  key={cell.id}
                  tile={cell}
                  currency={request.currency}
                  selected={cell.id === request.selectedId}
                  onPick={() => onPick(cell.id)}
                />
              ),
            )}
          </View>
        ))}
        {tiles.length === 0 && q ? (
          <View className="rounded-tile border-[1.5px] border-dashed border-hairline p-4">
            <Text className="text-center text-[15px] font-display-semibold text-foreground">
              No category called “{q}” yet.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
