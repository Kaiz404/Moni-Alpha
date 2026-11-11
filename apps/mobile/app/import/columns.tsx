import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ColumnSheet } from '@/components/import/column-sheet';
import { Button } from '@/components/ui/button';
import { EmptyTile } from '@/components/ui/empty-tile';
import { Page, PageScroll } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth/auth-context';
import {
  mappingIsComplete,
  type DateOrder,
  type MappedField,
} from '@/lib/backup/generic-csv';
import { getImportSession, setImportSession } from '@/lib/backup/import-session';
import { walletsForUser$ } from '@/lib/finance/selectors';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

const NOT_IN_FILE = 'none';

const FIELDS: { field: MappedField; label: string }[] = [
  { field: 'date', label: 'Date' },
  { field: 'amount', label: 'Amount' },
  { field: 'moneyOut', label: 'Money out' },
  { field: 'moneyIn', label: 'Money in' },
  { field: 'merchant', label: 'Merchant' },
  { field: 'category', label: 'Category' },
  { field: 'note', label: 'Note' },
  { field: 'type', label: 'Type' },
  { field: 'currency', label: 'Currency' },
];

const ORDERS = [
  { value: 'dmy', label: 'Day first' },
  { value: 'mdy', label: 'Month first' },
] as const;

/** The column-mapping step of a generic CSV: which wallet, and which column holds what. */
export default function ImportColumnsScreen() {
  const { user } = useAuth();
  const wallets = useValue(walletsForUser$(user?.id ?? null));
  const session = getImportSession();
  const generic = session?.kind === 'generic' ? session : null;
  const [choices, setChoices] = useState(generic?.choices ?? null);
  const [picking, setPicking] = useState<(typeof FIELDS)[number] | null>(null);
  const dismiss = useCallback(() => setPicking(null), []);

  const headers = generic?.table.headers;
  const firstRow = generic?.table.rows[0]?.cells;
  const options = useMemo(
    () => [
      { id: NOT_IN_FILE, name: 'Not in this file' },
      ...(headers ?? []).map((header, index) => ({
        id: String(index),
        name: header || `Column ${index + 1}`,
        meta: firstRow?.[index] || undefined,
      })),
    ],
    [headers, firstRow],
  );

  if (!generic || !choices) {
    return (
      <Page
        screen="import"
        kind="pushed"
        title="Match columns"
      >
        <View className="px-5">
          <EmptyTile
            icon="file-outline"
            tone="notice"
            title="No file chosen"
            body="Go back and choose a CSV."
          />
        </View>
      </Page>
    );
  }

  const { mapping, wallet } = choices;
  const chooseWallet = async () => {
    const picked = await openSheet({
      kind: 'wallet',
      title: 'Add to',
      wallets: wallets.map((item) => ({
        id: item.id,
        name: item.name,
        currency: item.currency,
        type: item.type,
        icon: item.icon,
        color: item.color,
        cardStyleId: item.cardStyleId,
      })),
      selectedId: wallet?.id ?? null,
    });
    const chosen = wallets.find((item) => item.id === picked?.walletId);
    if (chosen) {
      setChoices({ ...choices, wallet: { id: chosen.id, currency: chosen.currency } });
    }
  };
  const missing = !wallet
    ? 'Choose a wallet'
    : !mappingIsComplete(mapping)
      ? 'Choose the date and amount'
      : null;
  const check = () => {
    setImportSession({ ...generic, choices });
    router.push('/import/preview');
  };

  return (
    <Page
      headerScrolls
      screen="import"
      kind="pushed"
      title="Match columns"
      subtitle={generic.fileName}
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <PickerField
          testID={tid('import', 'wallet')}
          label="Add to"
          placeholder="Choose a wallet"
          value={wallets.find((item) => item.id === wallet?.id)?.name ?? ''}
          onPress={() => void chooseWallet()}
        />
        {FIELDS.map((item) => {
          const column = mapping[item.field];
          return (
            <PickerField
              key={item.field}
              testID={tid('import', 'column', item.field)}
              label={item.label}
              placeholder="Not in this file"
              value={column === null ? '' : generic.table.headers[column] || `Column ${column + 1}`}
              onPress={() => setPicking(item)}
            />
          );
        })}
        {choices.orderSettled ? null : (
          <View className="gap-2">
            <Text
              variant="caps"
              className="text-muted"
            >
              Dates like 03/04/2026
            </Text>
            <Segmented
              screen="import"
              name="date-order"
              options={ORDERS}
              value={choices.order}
              onChange={(order: DateOrder) => setChoices({ ...choices, order })}
              accessibilityLabel="Which comes first in a date"
            />
          </View>
        )}
        <Button
          testID={tid('import', 'check')}
          label={missing ?? `Check ${generic.table.rows.length} rows`}
          disabled={missing !== null}
          onPress={check}
          className="mt-2"
        />
      </PageScroll>
      <ColumnSheet
        open={picking !== null}
        title={picking?.label ?? ''}
        options={options}
        selectedId={
          picking && mapping[picking.field] !== null
            ? String(mapping[picking.field])
            : NOT_IN_FILE
        }
        onPick={(id) => {
          if (!picking) return;
          const next = { ...mapping, [picking.field]: id === NOT_IN_FILE ? null : Number(id) };
          setChoices({ ...choices, mapping: next });
          setPicking(null);
        }}
        onDismiss={dismiss}
      />
    </Page>
  );
}
