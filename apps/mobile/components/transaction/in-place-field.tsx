import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, Keyboard, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid, type Screen } from '@/lib/test-ids';

type Editing = {
  editing: string | null;
  begin: (name: string) => void;
  end: (name: string) => void;
};

const EditingContext = createContext<Editing | null>(null);

function useEditing(): Editing {
  const [editing, setEditing] = useState<string | null>(null);
  const end = useCallback(
    (name: string) => setEditing((current) => (current === name ? null : current)),
    [],
  );
  return useMemo(() => ({ editing, begin: setEditing, end }), [editing, end]);
}

/**
 * Back, or the keyboard closing after this field opened it, cancels. Moving from one
 * field to another can close and reopen the keyboard, so a hide before this field's
 * own show does not count.
 */
function useCancelOnDismiss(active: boolean, cancel: () => void) {
  useEffect(() => {
    if (!active) return;
    let shown = false;
    const show = Keyboard.addListener('keyboardDidShow', () => {
      shown = true;
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (shown) cancel();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      cancel();
      return true;
    });
    return () => {
      show.remove();
      hide.remove();
      back.remove();
    };
  }, [active, cancel]);
}

export function InPlaceGroup({ children }: { children: ReactNode }) {
  return <EditingContext.Provider value={useEditing()}>{children}</EditingContext.Provider>;
}

type Shared = {
  screen: Screen;
  name: string;
  /** Lowercase noun for TalkBack: "Edit amount". */
  label: string;
  hint?: string;
  children: ReactNode;
  pencil?: boolean;
};

export type InPlaceFieldProps = Shared &
  (
    | { kind: 'amount'; prefix: string; value: number; onSave: (value: number) => void }
    | {
        kind: 'name' | 'note';
        value: string;
        placeholder?: string;
        maxLength?: number;
        onSave: (value: string) => void;
      }
  );

function parseAmount(draft: string): number | null {
  const cleaned = draft.trim().replaceAll(',', '');
  if (!/^\d*\.?\d{0,2}$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * tokens.md "In-place edit": a 32 Sand pencil after the value swaps in a Paper
 * field with a 2 Ink border, a cancel circle and a save circle, on the system
 * keyboard. Back, the keyboard closing, or a tap outside cancels.
 */
export function InPlaceField(props: InPlaceFieldProps) {
  const tokens = useThemeTokens();
  const local = useEditing();
  const group = useContext(EditingContext) ?? local;
  const { screen, name, label } = props;
  const editing = group.editing === name;
  const initial = props.kind === 'amount' ? props.value.toFixed(2) : props.value;
  const [draft, setDraft] = useState(initial);

  const { end } = group;
  const cancel = useCallback(() => end(name), [end, name]);
  useCancelOnDismiss(editing, cancel);

  const begin = () => {
    setDraft(initial);
    group.begin(name);
  };

  const parsed =
    props.kind === 'amount'
      ? parseAmount(draft)
      : props.kind === 'name'
        ? draft.trim() || null
        : draft.trim();

  const save = () => {
    if (parsed === null) return;
    group.end(name);
    if (props.kind === 'amount') {
      if (parsed !== props.value) props.onSave(parsed as number);
    } else if (parsed !== props.value) props.onSave(parsed as string);
  };

  if (!editing) {
    return (
      <View className="flex-row items-center gap-2">
        <Press
          testID={tid(screen, name, 'value')}
          accessibilityLabel={`Edit ${label}`}
          accessibilityHint="Opens the keyboard"
          pressedScale={1}
          pressedClassName="bg-transparent"
          className="min-w-0 flex-shrink"
          onPress={begin}
        >
          {props.children}
        </Press>
        {props.pencil === false ? null : (
          <Press
            testID={tid(screen, name, 'pencil')}
            accessibilityLabel={`Edit ${label}`}
            hitSlop={6}
            pressedClassName="bg-hairline"
            className="h-8 w-8 items-center justify-center rounded-full bg-sand"
            onPress={begin}
          >
            <IconSymbol name="pencil-outline" size={16} color={tokens.foreground} />
          </Press>
        )}
      </View>
    );
  }

  const buttons = (
    <>
      <Press
        testID={tid(screen, name, 'cancel')}
        accessibilityLabel="Cancel"
        pressedClassName="bg-hairline"
        className="h-11 w-11 items-center justify-center rounded-full bg-sand"
        onPress={() => group.end(name)}
      >
        <IconSymbol name="close" size={20} color={tokens.foreground} />
      </Press>
      <Press
        testID={tid(screen, name, 'save')}
        accessibilityLabel="Save"
        accessibilityState={{ disabled: parsed === null }}
        disabled={parsed === null}
        pressedClassName="bg-primary-pressed"
        className={`h-11 w-11 items-center justify-center rounded-full ${parsed === null ? 'bg-hairline' : 'bg-primary'}`}
        onPress={save}
      >
        <IconSymbol name="check" size={20} color={tokens.primaryForeground} />
      </Press>
    </>
  );

  const input = (
    <TextInput
      testID={tid(screen, name, 'input')}
      accessibilityLabel={label}
      autoFocus
      value={draft}
      onChangeText={setDraft}
      onBlur={() => group.end(name)}
      onSubmitEditing={props.kind === 'note' ? undefined : save}
      returnKeyType={props.kind === 'note' ? 'default' : 'done'}
      keyboardType={props.kind === 'amount' ? 'decimal-pad' : 'default'}
      multiline={props.kind === 'note'}
      maxLength={props.kind === 'amount' ? 12 : props.maxLength}
      placeholder={props.kind === 'amount' ? undefined : props.placeholder}
      placeholderTextColor={tokens.muted}
      selectionColor={tokens.foreground}
      className={
        props.kind === 'amount'
          ? 'h-full min-w-0 flex-1 font-display-bold text-[40px] leading-[44px] text-foreground'
          : props.kind === 'name'
            ? 'h-full min-w-0 flex-1 font-display-semibold text-[18px] text-foreground'
            : 'min-h-[96px] font-display text-[15px] leading-[21px] text-foreground'
      }
      style={props.kind === 'note' ? { textAlignVertical: 'top' } : undefined}
    />
  );

  return (
    <View className="gap-1.5">
      {props.kind === 'note' ? (
        <>
          <View className="rounded-field border-2 border-foreground bg-card px-4 py-3">{input}</View>
          <View className="flex-row justify-end gap-2">{buttons}</View>
        </>
      ) : (
        <View className="flex-row items-center gap-2">
          <View
            className={`min-w-0 flex-1 flex-row items-center gap-1.5 rounded-field border-2 border-foreground bg-card px-4 ${props.kind === 'amount' ? 'h-16' : 'h-[52px]'}`}
          >
            {props.kind === 'amount' ? (
              <Text className="text-[28px] leading-[32px] font-display-bold text-muted">
                {props.prefix}
              </Text>
            ) : null}
            {input}
          </View>
          {buttons}
        </View>
      )}
      {props.hint ? (
        <Text variant="smallest" className="text-muted">
          {props.hint}
        </Text>
      ) : null}
    </View>
  );
}
