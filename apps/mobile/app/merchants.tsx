import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { MerchantRow, type MerchantSection } from '@/components/merchants/merchant-row';
import { useMerchantNames, type MerchantRow as MerchantRowData } from '@/components/merchants/use-merchant-names';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceGroup, type Saved } from '@/components/ui/in-place-field';
import { ListSection } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { forgetMerchantName, nameMerchant } from '@/lib/supabase/merchant-aliases';
import type { TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

function failed(error: unknown) {
  showToast({ text: error instanceof Error ? error.message : "Couldn't save the name." });
}

export default function MerchantsScreen() {
  const tokens = useThemeTokens();
  const { toName, named } = useMerchantNames();
  const [editing, setEditing] = useState<TestId | null>(null);
  const [risen, setRisen] = useState<string | null>(null);

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
      tone: 'removed',
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

  return (
    <Page
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
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="body"
          className="px-1 text-ink-2"
        >
          Banks send codes, not shop names. Name a code once and Moni uses your name on every
          payment from it.
        </Text>

        {toName.length > 0 ? (
          <ListSection label={`To name · ${toName.length}`}>{rows(toName, 'to-name')}</ListSection>
        ) : (
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

        {named.length > 0 ? (
          <ListSection label={`Named · ${named.length}`}>{rows(named, 'named')}</ListSection>
        ) : null}
      </ScrollView>
      </InPlaceGroup>
    </Page>
  );
}
