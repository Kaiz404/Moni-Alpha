import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { NotificationAppIcon, useNotificationSourceData } from '@/components/wallets/notification-source';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { CURRENCY_OPTIONS, resolveCurrencyOption } from '@/constants/currencies';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { WALLET_TYPE_OPTIONS } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel, toLocalDateInput } from '@/lib/dates/local-date-input';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { currencySymbol } from '@/lib/finance/format-money';
import type { SheetRequestOf, SheetResult } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

export type PickerOption = {
  id: string;
  name: string;
  meta?: string;
  leading?: ReactNode;
};

/** The 52 Paper capsule search field shared by the picker sheets. */
export function SheetSearchField({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="h-[52px] flex-row items-center gap-2.5 rounded-full bg-card px-4">
      <IconSymbol name="magnify" size={20} color={tokens.muted} />
      <TextInput
        testID={tid('sheet', 'search')}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        className="h-11 flex-1 font-display text-[15px] text-foreground"
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function Bubble({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <View
      className={`h-[42px] w-[42px] items-center justify-center rounded-full ${color ? '' : 'bg-sand'}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </View>
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
};

/** A Paper list card of option rows with a radio mark. Tapping a row saves and closes. */
export function OptionPickerSheet({
  title,
  note,
  options,
  selectedId,
  onPick,
  searchPlaceholder,
  size = 'fit',
  ...frame
}: OptionPickerSheetProps) {
  const tokens = useThemeTokens();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      `${option.name} ${option.meta ?? ''}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Sheet {...frame} size={size} title={title} note={note} closeLabel="Close">
      {searchPlaceholder ? (
        <View className="pb-3">
          <SheetSearchField
            placeholder={searchPlaceholder}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      ) : null}
      <ScrollView
        style={size === 'fit' ? { flexGrow: 0 } : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {shown.length === 0 ? (
          <View className="rounded-tile border-[1.5px] border-dashed border-hairline p-4">
            <Text className="text-center text-[15px] font-display-semibold text-foreground">
              Nothing matches “{query.trim()}”.
            </Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-card bg-card py-1.5">
            {shown.map((option) => {
              const selected = option.id === selectedId;
              return (
                <Press
                  key={option.id}
                  testID={tid('sheet', 'option', option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.meta ? `${option.name}, ${option.meta}` : option.name}
                  className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
                  onPress={() => onPick(option.id)}
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
                      <Text className="text-[13px] leading-[18px] text-muted" numberOfLines={1}>
                        {option.meta}
                      </Text>
                    ) : null}
                  </View>
                  <IconSymbol
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={24}
                    color={selected ? tokens.foreground : tokens.muted}
                  />
                </Press>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

type KindSheetProps<K extends 'wallet' | 'currency' | 'walletType' | 'date' | 'notificationApp'> =
  SheetFrameProps & {
    request: SheetRequestOf<K>;
    onPick: (result: SheetResult<K>) => void;
  };

const NONE = 'none';

export function WalletSheet({ request, onPick, ...frame }: KindSheetProps<'wallet'>) {
  const options: PickerOption[] = request.wallets.map((wallet) => {
    const style = getWalletCardStyle(wallet.cardStyleId);
    return {
      id: wallet.id,
      name: wallet.name,
      meta: wallet.currency.toUpperCase(),
      leading: (
        <Bubble color={wallet.color ?? style.swatchHex}>
          <WalletIcon color={style.contentColor} icon={wallet.icon} type={wallet.type} size={20} />
        </Bubble>
      ),
    };
  });
  if (request.noneLabel) options.unshift({ id: NONE, name: request.noneLabel });
  return (
    <OptionPickerSheet
      {...frame}
      title={request.title}
      note={request.wallets.length === 0 ? request.emptyMessage : undefined}
      options={options}
      selectedId={request.selectedId ?? (request.noneLabel ? NONE : null)}
      onPick={(id) => onPick({ walletId: id === NONE ? null : id })}
    />
  );
}

export function CurrencySheet({ request, onPick, ...frame }: KindSheetProps<'currency'>) {
  const main = useMainCurrency();
  const selected = request.selected.toUpperCase();
  const options = useMemo(() => {
    const rank = (code: string) => (code === main ? 0 : 1);
    const known = CURRENCY_OPTIONS.some((currency) => currency.code === selected);
    return [...(known ? [] : [resolveCurrencyOption(selected)]), ...CURRENCY_OPTIONS]
      .sort((a, b) => rank(a.code) - rank(b.code))
      .map(
        (currency): PickerOption => ({
          id: currency.code,
          name: `${currency.code} · ${currency.name}`,
          meta: currency.code === main ? 'Your main currency' : undefined,
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
      note="Moni never converts currencies or adds them together."
      searchPlaceholder="Search currencies"
      options={options}
      selectedId={selected}
      onPick={onPick}
    />
  );
}

export function WalletTypeSheet({ request, onPick, ...frame }: KindSheetProps<'walletType'>) {
  const tokens = useThemeTokens();
  const options: PickerOption[] = WALLET_TYPE_OPTIONS.map((option) => ({
    id: option.value,
    name: option.label,
    leading: (
      <Bubble>
        <WalletIcon color={tokens.foreground} icon={option.icon} size={20} />
      </Bubble>
    ),
  }));
  return (
    <OptionPickerSheet
      {...frame}
      title="Wallet type"
      note="Changes the wallet's icon."
      options={options}
      selectedId={request.selected}
      onPick={(id) => {
        const picked = WALLET_TYPE_OPTIONS.find((option) => option.value === id);
        if (picked) onPick(picked.value);
      }}
    />
  );
}

const DATE_RANGE_DAYS = 31;

export function DateSheet({ request, onPick, ...frame }: KindSheetProps<'date'>) {
  const options = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DATE_RANGE_DAYS }, (_, back): PickerOption => {
      const day = toLocalDateInput(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - back),
      );
      return { id: day, name: dayLabel(day, today) };
    });
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

export function NotificationAppSheet({
  request,
  onPick,
  ...frame
}: KindSheetProps<'notificationApp'>) {
  const tokens = useThemeTokens();
  const { apps, unavailableReason } = useNotificationSourceData();
  const options: PickerOption[] = [
    ...apps.map((app) => ({
      id: app.packageName,
      name: app.label,
      meta: app.region,
      leading: <NotificationAppIcon iconUri={app.iconUri} size={42} />,
    })),
    {
      id: NONE,
      name: "Don't link",
      meta: 'Add spending yourself or with Moni',
      leading: (
        <Bubble>
          <IconSymbol name="link-variant-off" size={20} color={tokens.foreground} />
        </Bubble>
      ),
    },
  ];
  return (
    <OptionPickerSheet
      {...frame}
      title="Alerts from"
      note={unavailableReason ?? 'Moni reads spending alerts only from the app you pick.'}
      options={options}
      selectedId={request.selected ?? NONE}
      onPick={(id) => {
        const app = apps.find((candidate) => candidate.packageName === id);
        onPick({ app: app ? { packageName: app.packageName, label: app.label } : null });
      }}
    />
  );
}
