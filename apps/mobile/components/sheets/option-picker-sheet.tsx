import { useValue } from '@legendapp/state/react';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { sameName } from '@/components/debts/past-people';
import { PersonAvatar } from '@/components/debts/person-avatar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press, PressRows } from '@/components/ui/press';
import { SearchField } from '@/components/ui/search-field';
import {
  Sheet,
  SheetFlatList,
  SHEET_ROWS_STYLE,
  type SheetFrameProps,
} from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import {
  NotificationAppIcon,
  useInstalledApps,
} from '@/components/wallets/notification-source';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import {
  CURRENCY_OPTIONS,
  resolveCurrencyOption,
} from '@/constants/currencies';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { WALLET_TYPE_OPTIONS } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  currencySymbol,
  formatMoney,
} from '@/lib/finance/format-money';
import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS } from '@/lib/finance/activity-filter';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { walletBalanceMinor$ } from '@/lib/finance/selectors';
import { getCachedAppIcon, saveAppIcon } from '@/lib/notifications/app-icon-cache';
import { appPickerRows } from '@/lib/notifications/app-picker';
import { curatedPackagesEquivalent } from '@/lib/notifications/notification-package-aliases';
import type {
  SheetRequestOf,
  SheetResult,
  WalletOption,
} from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import {
  TRANSACTION_TYPE_COPY,
  TRANSACTION_TYPES,
} from '@/lib/transactions/type-change';

export type PickerOption = {
  id: string;
  name: string;
  meta?: string;
  leading?: ReactNode;
  /** The Mint-tinted Suggested row (XA-Review's wallet sheet). */
  suggested?: boolean;
};

function Bubble({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <View
      className={`h-[42px] w-[42px] items-center justify-center rounded-full ${color ? '' : 'bg-sand'}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </View>
  );
}

const MARK_IN = FadeIn.duration(120);

/** One picker row: its leading bubble, name and meta, and a radio mark, or a checkbox where several can be picked. */
function OptionRow({
  option,
  selected,
  onPress,
  mark = 'radio',
}: {
  option: PickerOption;
  selected: boolean;
  onPress: () => void;
  mark?: 'radio' | 'checkbox';
}) {
  const tokens = useThemeTokens();
  const icon =
    mark === 'radio'
      ? selected
        ? 'radiobox-marked'
        : 'radiobox-blank'
      : selected
        ? 'checkbox-marked'
        : 'checkbox-blank-outline';
  return (
    <Press
      testID={tid('sheet', 'option', option.id)}
      accessibilityRole={mark}
      accessibilityState={mark === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={option.meta ? `${option.name}, ${option.meta}` : option.name}
      radius={option.suggested ? { rest: 26, pressed: 16 } : undefined}
      className={`min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3 ${option.suggested ? 'bg-primary-muted' : ''}`}
      onPress={onPress}
    >
      {option.leading}
      <View className="min-w-0 flex-1">
        <Text
          className="text-base leading-[22px] font-display-semibold text-foreground"
          numberOfLines={1}
        >
          {option.name}
        </Text>
        {option.meta ? (
          <Text
            className="text-[13px] leading-[18px] text-muted"
            numberOfLines={1}
          >
            {option.meta}
          </Text>
        ) : null}
      </View>
      <Animated.View
        key={icon}
        entering={mark === 'checkbox' ? MARK_IN : undefined}
      >
        <IconSymbol
          name={icon}
          size={24}
          color={selected ? tokens.foreground : tokens.muted}
        />
      </Animated.View>
    </Press>
  );
}

type OptionPickerSheetProps = SheetFrameProps & {
  title: string;
  note?: string;
  options: PickerOption[];
  selectedId: string | null;
  onPick: (id: string) => void;
  /** Shows the search field and filters on name and meta. */
  searchPlaceholder?: string;
  size?: 'fit' | 'large';
  /** Below the rows, such as while more of them load. */
  footer?: ReactNode;
};

/** Option rows with a radio mark, straight on the sheet. Tapping a row saves and closes. */
export function OptionPickerSheet({
  title,
  note,
  options,
  selectedId,
  onPick,
  searchPlaceholder,
  size = 'fit',
  footer,
  ...frame
}: OptionPickerSheetProps) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      `${option.name} ${option.meta ?? ''}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Sheet
      {...frame}
      size={size}
      title={title}
      note={note}
      closeLabel="Close"
    >
      {searchPlaceholder ? (
        <View className="pb-3">
          <SearchField
            testID={tid('sheet', 'search')}
            accessibilityLabel={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      ) : null}
      <PressRows>
        <SheetFlatList
          data={shown}
          keyExtractor={(option) => option.id}
          style={size === 'fit' ? [SHEET_ROWS_STYLE, { flexGrow: 0 }] : SHEET_ROWS_STYLE}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          ListFooterComponent={footer ? <>{footer}</> : undefined}
          ListEmptyComponent={
            <View className="mx-[18px] rounded-tile border-[1.5px] border-dashed border-hairline p-4">
              <Text className="text-center text-[15px] font-display-semibold text-foreground">
                Nothing matches “{query.trim()}”.
              </Text>
            </View>
          }
          renderItem={({ item: option }) => (
            <OptionRow
              option={option}
              selected={option.id === selectedId}
              onPress={() => onPick(option.id)}
            />
          )}
        />
      </PressRows>
    </Sheet>
  );
}

type KindSheetProps<
  K extends
    | 'wallet'
    | 'currency'
    | 'walletType'
    | 'transactionType'
    | 'activityKind'
    | 'date'
    | 'notificationApp'
    | 'person',
> = SheetFrameProps & {
  request: SheetRequestOf<K>;
  onPick: (result: SheetResult<K>) => void;
};

const NONE = 'none';

function useWalletOptions(
  wallets: readonly WalletOption[],
  suggestedId?: string | null,
): PickerOption[] {
  const balances = useValue(() =>
    wallets.map((wallet) => walletBalanceMinor$(wallet.id).get()),
  );
  return wallets.map((wallet, index) => {
    const style = getWalletCardStyle(wallet.cardStyleId);
    const suggested = wallet.id === suggestedId;
    const balance = formatMoney(balances[index] ?? 0, wallet.currency);
    return {
      id: wallet.id,
      name: wallet.name,
      meta: suggested ? `${balance} · Suggested` : balance,
      suggested,
      leading: (
        <Bubble color={wallet.color ?? style.swatchHex}>
          <WalletIcon
            color={style.contentColor}
            icon={wallet.icon}
            type={wallet.type}
            size={20}
          />
        </Bubble>
      ),
    };
  });
}

export function WalletSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'wallet'>) {
  const options = useWalletOptions(request.wallets, request.suggestedId);
  if (request.noneLabel)
    options.unshift({ id: NONE, name: request.noneLabel });
  return (
    <OptionPickerSheet
      {...frame}
      title={request.title}
      note={
        request.wallets.length === 0
          ? request.emptyMessage
          : request.note
      }
      options={options}
      selectedId={
        request.selectedId ?? (request.noneLabel ? NONE : null)
      }
      onPick={(id) => onPick({ walletId: id === NONE ? null : id })}
    />
  );
}

/**
 * Several wallets at once: rows tick and untick, and nothing changes until Apply. No filter opens
 * with every wallet ticked; Select all and Clear sit in the title row, and ticking every wallet
 * applies as no filter.
 */
export function WalletsSheet({
  request,
  onApply,
  ...frame
}: SheetFrameProps & {
  request: SheetRequestOf<'wallets'>;
  onApply: (result: SheetResult<'wallets'>) => void;
}) {
  const [draft, setDraft] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        request.selectedIds.length > 0
          ? request.selectedIds
          : request.wallets.map((wallet) => wallet.id),
      ),
  );
  const options = useWalletOptions(request.wallets);
  const every = request.wallets.every((wallet) => draft.has(wallet.id));
  const toggle = (id: string) => {
    const next = new Set(draft);
    if (!next.delete(id)) next.add(id);
    setDraft(next);
  };
  return (
    <Sheet
      {...frame}
      size="fit"
      title={request.title}
      headerAction={
        <Chip
          testID={tid('sheet', 'select-all')}
          label={every ? 'Clear' : 'Select all'}
          onPress={() =>
            setDraft(new Set(every ? [] : request.wallets.map((wallet) => wallet.id)))
          }
        />
      }
      actions={
        <>
          <Button
            testID={tid('sheet', 'cancel')}
            className="flex-1"
            pinned
            variant="secondary"
            label="Cancel"
            onPress={frame.onDismiss}
          />
          <Button
            testID={tid('sheet', 'apply')}
            className="flex-1"
            pinned
            label="Apply"
            disabled={draft.size === 0}
            onPress={() =>
              onApply({
                walletIds: every
                  ? []
                  : request.wallets.filter((wallet) => draft.has(wallet.id)).map((wallet) => wallet.id),
              })
            }
          />
        </>
      }
    >
      <PressRows>
        <SheetFlatList
          data={options}
          keyExtractor={(option) => option.id}
          style={[SHEET_ROWS_STYLE, { flexGrow: 0 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: option }) => (
            <OptionRow
              option={option}
              mark="checkbox"
              selected={draft.has(option.id)}
              onPress={() => toggle(option.id)}
            />
          )}
        />
      </PressRows>
    </Sheet>
  );
}

export function CurrencySheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'currency'>) {
  const main = useMainCurrency();
  const selected = request.selected.toUpperCase();
  const options = useMemo(() => {
    const rank = (code: string) => (code === main ? 0 : 1);
    const known = CURRENCY_OPTIONS.some(
      (currency) => currency.code === selected,
    );
    return [
      ...(known ? [] : [resolveCurrencyOption(selected)]),
      ...CURRENCY_OPTIONS,
    ]
      .sort((a, b) => rank(a.code) - rank(b.code))
      .map(
        (currency): PickerOption => ({
          id: currency.code,
          name: `${currency.code} · ${currency.name}`,
          meta:
            currency.code === main ? 'Your main currency' : undefined,
          leading: (
            <Bubble>
              <Text className="text-[15px] font-display-bold text-foreground">
                {currencySymbol(currency.code)}
              </Text>
            </Bubble>
          ),
        }),
      );
  }, [main, selected]);
  return (
    <OptionPickerSheet
      {...frame}
      size="large"
      title="Currency"
      note="Each wallet keeps one. Moni never converts or adds them together."
      searchPlaceholder="Search currencies"
      options={options}
      selectedId={selected}
      onPick={onPick}
    />
  );
}

export function WalletTypeSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'walletType'>) {
  const tokens = useThemeTokens();
  const options: PickerOption[] = WALLET_TYPE_OPTIONS.map(
    (option) => ({
      id: option.value,
      name: option.label,
      leading: (
        <Bubble>
          <WalletIcon
            color={tokens.foreground}
            icon={option.icon}
            size={20}
          />
        </Bubble>
      ),
    }),
  );
  return (
    <OptionPickerSheet
      {...frame}
      title="Wallet type"
      note="Changes the icon and where it sits in Wallets."
      options={options}
      selectedId={request.selected}
      onPick={(id) => {
        const picked = WALLET_TYPE_OPTIONS.find(
          (option) => option.value === id,
        );
        if (picked) onPick(picked.value);
      }}
    />
  );
}

export function TransactionTypeSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'transactionType'>) {
  const tokens = useThemeTokens();
  const options: PickerOption[] = TRANSACTION_TYPES.map((type) => ({
    id: type,
    name: TRANSACTION_TYPE_COPY[type].label,
    meta: TRANSACTION_TYPE_COPY[type].meta,
    leading: (
      <Bubble>
        <IconSymbol
          name={resolveTransactionIcon(null, type)}
          size={20}
          color={tokens.foreground}
        />
      </Bubble>
    ),
  }));
  return (
    <OptionPickerSheet
      {...frame}
      title="Type"
      note="A new type clears the category, so you choose one that fits."
      options={options}
      selectedId={request.selected}
      onPick={(id) => {
        const picked = TRANSACTION_TYPES.find((type) => type === id);
        if (picked) onPick(picked);
      }}
    />
  );
}

export function ActivityKindSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'activityKind'>) {
  const tokens = useThemeTokens();
  const options: PickerOption[] = ACTIVITY_KINDS.map((kind) => ({
    id: kind,
    name: ACTIVITY_KIND_LABELS[kind],
    leading: (
      <Bubble>
        <IconSymbol
          name={kind === 'all' ? 'format-list-bulleted' : resolveTransactionIcon(null, kind)}
          size={20}
          color={tokens.foreground}
        />
      </Bubble>
    ),
  }));
  return (
    <OptionPickerSheet
      {...frame}
      title="Type"
      options={options}
      selectedId={request.selected}
      onPick={(id) => {
        const picked = ACTIVITY_KINDS.find((kind) => kind === id);
        if (picked) onPick(picked);
      }}
    />
  );
}

/** Today and the year before it. */
const DATE_RANGE_DAYS = 366;

export function DateSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'date'>) {
  const options = useMemo(() => {
    const today = new Date();
    return Array.from(
      { length: DATE_RANGE_DAYS },
      (_, back): PickerOption => {
        const day = toLocalDateInput(
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - back,
          ),
        );
        return { id: day, name: dayLabel(day, today) };
      },
    );
  }, []);
  return (
    <OptionPickerSheet
      {...frame}
      size="large"
      title="Date"
      options={options}
      selectedId={request.selected}
      onPick={onPick}
    />
  );
}

export function PersonSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'person'>) {
  const options: PickerOption[] = request.people.map((name) => ({
    id: name,
    name,
    leading: <PersonAvatar name={name} />,
  }));
  return (
    <OptionPickerSheet
      {...frame}
      title={request.title}
      options={options}
      selectedId={
        request.people.find((name) =>
          sameName(name, request.selected),
        ) ?? null
      }
      onPick={onPick}
    />
  );
}

const APP_LISTING_NOTE: Record<'not_android' | 'needs_rebuild', string> = {
  not_android: 'Linking an app works on Android only.',
  needs_rebuild: 'Listing the apps on this phone needs a new build of Moni.',
};

export function NotificationAppSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'notificationApp'>) {
  const tokens = useThemeTokens();
  const listing = useInstalledApps();
  const installed = listing.kind === 'listed' ? listing.apps : null;
  const { selected, selectedLabel } = request;
  const rows = useMemo(
    () =>
      appPickerRows(
        installed?.values() ?? [],
        selected
          ? {
              packageName: selected,
              label: selectedLabel ?? labelForNotificationPackage(selected),
              iconUri: getCachedAppIcon(selected),
            }
          : null,
      ),
    [installed, selected, selectedLabel],
  );
  const options: PickerOption[] = [
    {
      id: NONE,
      name: "Don't link",
      meta: 'Add spending yourself or with Moni',
      leading: (
        <Bubble>
          <IconSymbol
            name="link-variant-off"
            size={20}
            color={tokens.foreground}
          />
        </Bubble>
      ),
    },
    ...rows.map(
      (app): PickerOption => ({
        id: app.packageName,
        name: app.label,
        meta: app.missing ? 'Not found on this phone' : app.suggested ? 'Suggested' : undefined,
        leading: (
          <NotificationAppIcon
            iconUri={app.iconUri}
            size={42}
          />
        ),
      }),
    ),
  ];
  const searchable = listing.kind === 'loading' || listing.kind === 'listed';
  return (
    <OptionPickerSheet
      {...frame}
      size="large"
      title="Alerts from"
      note={
        listing.kind === 'not_android' || listing.kind === 'needs_rebuild'
          ? APP_LISTING_NOTE[listing.kind]
          : listing.kind === 'listed' && !listing.everyApp
            ? 'This build of Moni lists only the finance apps it knows. A new build lists every app.'
            : 'Moni reads spending alerts only from the app you pick.'
      }
      searchPlaceholder={searchable ? 'Search apps' : undefined}
      options={options}
      selectedId={
        rows.find(
          (app) => selected && curatedPackagesEquivalent(app.packageName, selected),
        )?.packageName ?? NONE
      }
      footer={
        listing.kind === 'loading' ? (
          <View className="flex-row items-center gap-3 px-[18px] py-4">
            <ActivityIndicator color={tokens.muted} />
            <Text
              variant="meta"
              className="text-muted"
            >
              Looking for the apps on this phone
            </Text>
          </View>
        ) : undefined
      }
      onPick={(id) => {
        const app = rows.find((row) => row.packageName === id);
        if (!app) {
          onPick({ app: null });
          return;
        }
        saveAppIcon(app.packageName, app.iconUri);
        onPick({ app: { packageName: app.packageName, label: app.label } });
      }}
    />
  );
}
