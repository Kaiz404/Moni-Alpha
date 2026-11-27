import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { RangeSheet } from '@/components/activity/range-sheet';
import { PlaceSheet } from '@/components/capture/place-sheet';
import { DeleteAccountSheet } from '@/components/profile/delete-account-sheet';
import { CaptureChooserSheet } from '@/components/nav/capture-chooser';
import { BalanceSheet } from '@/components/sheets/balance-sheet';
import { CategoryPickerSheet } from '@/components/sheets/category-picker-sheet';
import { ConfirmSheet } from '@/components/sheets/confirm-sheet';
import { GridPickerSheet } from '@/components/sheets/grid-picker-sheet';
import { NotificationAccessSheet } from '@/components/sheets/notification-access-sheet';
import {
  ActivityKindSheet,
  ChoicesSheet,
  CurrencySheet,
  DateSheet,
  NotificationAppSheet,
  PersonSheet,
  TransactionTypeSheet,
  WalletSheet,
  WalletsSheet,
  WalletTypeSheet,
} from '@/components/sheets/option-picker-sheet';
import type { SheetFrameProps } from '@/components/ui/sheet/sheet';
import {
  dismissSheet,
  useOpenSheet,
  type OpenSheet,
  type SheetKind,
} from '@/lib/sheet/sheet-store';

/**
 * Sheets that drop away under the page they open (V2A-CaptureFlow-VA): the
 * tabs layout hosts them, so a pushed page slides in above the falling sheet.
 */
const UNDER_PAGES: ReadonlySet<SheetKind> = new Set(['chooser']);

function renderSheet(sheet: OpenSheet, frame: SheetFrameProps) {
  switch (sheet.kind) {
    case 'category':
      return (
        <CategoryPickerSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
          onCreate={() => {
            sheet.settle(null);
            sheet.request.onCreate?.();
          }}
          onTransfer={() => {
            sheet.settle(null);
            sheet.request.onTransfer?.();
          }}
          onDebtPayment={() => {
            sheet.settle(null);
            sheet.request.onDebtPayment?.();
          }}
        />
      );
    case 'wallet':
      return (
        <WalletSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'wallets':
      return (
        <WalletsSheet
          {...frame}
          request={sheet.request}
          onApply={sheet.settle}
        />
      );
    case 'currency':
      return (
        <CurrencySheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'walletType':
      return (
        <WalletTypeSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'transactionType':
      return (
        <TransactionTypeSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'choices':
      return (
        <ChoicesSheet
          {...frame}
          request={sheet.request}
          onApply={sheet.settle}
        />
      );
    case 'activityKind':
      return (
        <ActivityKindSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'date':
      return (
        <DateSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'notificationApp':
      return (
        <NotificationAppSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'chooser':
      return (
        <CaptureChooserSheet
          {...frame}
          onPick={sheet.settle}
        />
      );
    case 'activityRange':
      return (
        <RangeSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'person':
      return (
        <PersonSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'place':
      return (
        <PlaceSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
        />
      );
    case 'balance':
      return (
        <BalanceSheet
          {...frame}
          request={sheet.request}
          onSave={sheet.settle}
        />
      );
    case 'notificationAccess':
      return (
        <NotificationAccessSheet
          {...frame}
          onConfirm={() => sheet.settle(true)}
        />
      );
    case 'gridPicker':
      return (
        <GridPickerSheet
          {...frame}
          title={sheet.request.title}
          layout={sheet.request.layout}
          selectedId={sheet.request.selected}
          startPage={sheet.request.startPage}
          onPick={sheet.settle}
        />
      );
    case 'deleteAccount':
      return (
        <DeleteAccountSheet
          {...frame}
          request={sheet.request}
          onDeleted={() => sheet.settle(true)}
        />
      );
    case 'confirm':
      return (
        <ConfirmSheet
          {...frame}
          request={sheet.request}
          onConfirm={() => sheet.settle(true)}
        />
      );
  }
}

/**
 * Renders the store's one open sheet. The `root` layer sits above the root
 * Stack, so its scrim covers every page and the tab bar; the `tabs` layer sits
 * above the tab bar but under pushed pages, and holds the UNDER_PAGES kinds. A
 * closed sheet stays mounted until its exit finishes; touches pass through to
 * the page meanwhile.
 */
export function SheetHost({
  layer = 'root',
}: {
  layer?: 'root' | 'tabs';
}) {
  const latest = useOpenSheet();
  const open =
    latest && UNDER_PAGES.has(latest.kind) === (layer === 'tabs')
      ? latest
      : null;
  const [shown, setShown] = useState<OpenSheet | null>(open);

  if (open && open !== shown) setShown(open);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        dismissSheet();
        return true;
      },
    );
    return () => subscription.remove();
  }, [open]);

  const onExited = useCallback(() => {
    setShown((current) => (current === open ? current : null));
  }, [open]);

  if (!shown) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'auto' : 'none'}
      // Without this, Fabric flattens the View while it is 'auto' and builds it for 'none', which
      // moves the closing sheet to a new parent. A Google MapView re-attached that way builds new
      // map renderers that are never destroyed, about 10 MB each.
      collapsable={false}
    >
      <View
        key={shown.id}
        style={StyleSheet.absoluteFill}
      >
        {renderSheet(shown, {
          open: shown === open,
          onDismiss: dismissSheet,
          onExited,
        })}
      </View>
    </View>
  );
}
