import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { MonthSheet } from '@/components/budget/month-sheet';
import { CaptureChooserSheet } from '@/components/nav/capture-chooser';
import { CategoryPickerSheet } from '@/components/sheets/category-picker-sheet';
import { ConfirmSheet } from '@/components/sheets/confirm-sheet';
import {
  CurrencySheet,
  DateSheet,
  NotificationAppSheet,
  WalletSheet,
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
    case 'month':
      return (
        <MonthSheet
          {...frame}
          request={sheet.request}
          onPick={sheet.settle}
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
