import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { GridCell, GridLayout } from '@/lib/dates/grid-pages';
import { tid } from '@/lib/test-ids';

const PAGE_IN = FadeIn.duration(160);

function Arrow({
  direction,
  label,
  disabled,
  onPress,
}: {
  direction: 'previous' | 'next';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('sheet', 'page', direction)}
      accessibilityLabel={label}
      disabled={disabled}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-sand-light"
      className="h-11 w-11 items-center justify-center bg-sand"
      onPress={onPress}
    >
      <IconSymbol
        name={direction === 'previous' ? 'chevron-left' : 'chevron-right'}
        size={22}
        color={disabled ? tokens.muted : tokens.foreground}
      />
    </Press>
  );
}

function Cell({
  cell,
  selected,
  onPress,
}: {
  cell: GridCell;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      testID={tid('sheet', 'option', cell.id)}
      accessibilityRole="radio"
      accessibilityLabel={cell.accessibilityLabel}
      accessibilityState={{ selected, disabled: cell.disabled }}
      disabled={cell.disabled}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName={selected ? 'bg-primary-pressed' : 'bg-sand'}
      className={`h-11 flex-1 items-center justify-center ${selected ? 'bg-primary' : ''}`}
      onPress={onPress}
    >
      <Text
        className={`text-[16px] leading-[22px] font-display-semibold ${cell.disabled ? 'text-muted' : selected ? 'text-primary-foreground' : 'text-foreground'}`}
      >
        {cell.label}
      </Text>
    </Press>
  );
}

type GridPickerProps = {
  title: string;
  layout: GridLayout;
  selectedId: string | null;
  startPage: number;
  onPick: (id: string) => void;
  /** Under the grid, such as No date. */
  footer?: ReactNode;
};

/**
 * A compact picker for a fixed set: months, a decade of years, or a month of days, a page at a
 * time with arrows between pages. Tapping a cell picks it and closes.
 */
export function GridPickerSheet({
  title,
  layout,
  selectedId,
  startPage,
  onPick,
  footer,
  ...frame
}: SheetFrameProps & GridPickerProps) {
  const [index, setIndex] = useState(startPage);
  const page = layout.pages[index] ?? layout.pages[0];
  const rows: (GridCell | null)[][] = [];
  for (let at = 0; at < page.cells.length; at += layout.columns) {
    const row = page.cells.slice(at, at + layout.columns);
    rows.push([...row, ...Array<null>(layout.columns - row.length).fill(null)]);
  }
  const paged = layout.pages.length > 1;

  return (
    <Sheet
      {...frame}
      size="fit"
      title={title}
      closeLabel="Close"
    >
      <View className="gap-3 pb-1">
        {paged ? (
          <View className="flex-row items-center gap-3">
            <Arrow
              direction="previous"
              label="Earlier"
              disabled={index === 0}
              onPress={() => setIndex(index - 1)}
            />
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              className="flex-1 text-center text-[17px] leading-[24px] font-display-semibold text-foreground"
            >
              {page.label}
            </Text>
            <Arrow
              direction="next"
              label="Later"
              disabled={index === layout.pages.length - 1}
              onPress={() => setIndex(index + 1)}
            />
          </View>
        ) : null}
        {layout.heads ? (
          <View
            className="flex-row gap-1"
            importantForAccessibility="no-hide-descendants"
          >
            {layout.heads.map((head, at) => (
              <Text
                key={at}
                className="flex-1 text-center text-[12px] leading-4 font-display-bold text-muted"
              >
                {head}
              </Text>
            ))}
          </View>
        ) : null}
        <Animated.View
          key={index}
          entering={paged ? PAGE_IN : undefined}
          className="gap-1"
        >
          {rows.map((row, at) => (
            <View
              key={at}
              className="flex-row gap-1"
            >
              {row.map((cell, column) =>
                cell ? (
                  <Cell
                    key={cell.id}
                    cell={cell}
                    selected={cell.id === selectedId}
                    onPress={() => onPick(cell.id)}
                  />
                ) : (
                  <View
                    key={`blank-${column}`}
                    className="h-11 flex-1"
                  />
                ),
              )}
            </View>
          ))}
        </Animated.View>
        {footer}
      </View>
    </Sheet>
  );
}

/**
 * The grid picker mounted by a page rather than the sheet host, for the due dates: the host's
 * `date` kind only lists past days. It stays mounted through its exit, and Back closes it.
 */
export function PageGridPicker({
  open,
  onDismiss,
  ...picker
}: GridPickerProps & {
  open: boolean;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [open, onDismiss]);

  if (!mounted) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <GridPickerSheet
        {...picker}
        open={open}
        onDismiss={onDismiss}
        onExited={() => setMounted(false)}
      />
    </View>
  );
}
