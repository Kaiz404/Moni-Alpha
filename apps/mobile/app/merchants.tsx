import { useState } from 'react';
import { View } from 'react-native';

import { MerchantRow, type MerchantSection } from '@/components/merchants/merchant-row';
import { useMerchantNames, type MerchantRow as MerchantRowData } from '@/components/merchants/use-merchant-names';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceGroup, type Saved } from '@/components/ui/in-place-field';
import { ListSection } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { forgetMerchantName, nameMerchant } from '@/lib/supabase/merchant-aliases';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

function failed(error: unknown) {
  showToast({ text: error instanceof Error ? error.message : "Couldn't save the name." });
}

/**
 * Profile's Merchant names: the bank codes to name, then the names given, side by side (#140).
 * A month's spending by merchant is Budget's page, `/budget/merchants`.
 */
export default function MerchantNamesScreen() {
  const tokens = useThemeTokens();
  const { toName, named } = useMerchantNames();
  const [editing, setEditing] = useState<TestId | null>(null);
  const [risen, setRisen] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const words = query.trim().toLowerCase();
  const matches = (row: MerchantRowData) =>
    !words || [row.name, row.raw].some((text) => text?.toLowerCase().includes(words));
  const shownToName = toName.filter(matches);
  const shownNamed = named.filter(matches);

  const save = async (row: MerchantRowData, name: string): Promise<Saved | void> => {
    if (name === row.name) return;
    const previous = row.name;
    await nameMerchant(row.key, name);
    setRisen(row.key);
    return {
      text: `${row.raw} is now ${name}`,
      undo: () => {
        setRisen(row.key);
        void (previous ? nameMerchant(row.key, previous) : forgetMerchantName(row.key)).catch(
          failed,
        );
      },
    };
  };

  const forget = async (row: MerchantRowData) => {
    setEditing(null);
    const previous = row.name;
    try {
      await forgetMerchantName(row.key);
    } catch (error) {
      failed(error);
      return;
    }
    setRisen(row.key);
    if (!previous) return;
    showToast({
      text: 'Name forgotten',
      undo: () => {
        setRisen(row.key);
        void nameMerchant(row.key, previous).catch(failed);
      },
    });
  };

  const rows = (list: MerchantRowData[], section: MerchantSection) =>
    list.map((row) => (
      <MerchantRow
        key={row.key}
        row={row}
        section={section}
        rises={risen === row.key}
        onSave={(name) => save(row, name)}
        onForget={() => void forget(row)}
      />
    ));

  const nothingFound = words && !shownToName.length && !shownNamed.length;

  return (
    <Page
      headerScrolls
      screen="merchants"
      kind="pushed"
      title="Merchant names"
    >
      <InPlaceGroup
        editing={editing}
        onEditingChange={(id) => {
          if (id) setRisen(null);
          setEditing(id);
        }}
      >
        <PageScroll
          className="flex-1"
          contentContainerClassName="gap-5 px-5 pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SearchField
            compact
            testID={tid('merchants', 'search')}
            accessibilityLabel="Search merchant names"
            placeholder="Search a name or a bank code"
            value={query}
            onChangeText={setQuery}
          />

          {nothingFound ? (
            <EmptyTile
              mood="thinking"
              title={`No matches for "${query.trim()}"`}
              body="Try part of a name, or the code a bank alert shows."
              action={{
                testID: tid('merchants', 'clear-search'),
                label: 'Clear search',
                onPress: () => setQuery(''),
              }}
            />
          ) : null}

          {shownToName.length > 0 ? (
            <ListSection label={`${shownToName.length} ${shownToName.length === 1 ? 'code' : 'codes'} to name`}>
              {rows(shownToName, 'to-name')}
            </ListSection>
          ) : words ? null : (
            <View className="flex-row items-center gap-3 rounded-tile border-[1.5px] border-dashed border-hairline px-[18px] py-3.5">
              <IconSymbol
                name="check-circle"
                size={22}
                color={tokens.deepMint}
              />
              <Text
                variant="body"
                className="min-w-0 flex-1 text-foreground"
              >
                Nothing to name. Moni lists a code here once it shows up 3 times.
              </Text>
            </View>
          )}

          {shownNamed.length > 0 ? (
            <ListSection label={`${shownNamed.length} ${shownNamed.length === 1 ? 'code' : 'codes'} named`}>
              {rows(shownNamed, 'named')}
            </ListSection>
          ) : null}

          <Text
            variant="meta"
            className="px-1 text-muted"
          >
            You can also name a code on a transaction.
          </Text>
        </PageScroll>
      </InPlaceGroup>
    </Page>
  );
}
