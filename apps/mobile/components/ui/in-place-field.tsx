import {
  decimalToMinor,
  minorToDecimal,
  type MinorAmount,
} from '@repo/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  Keyboard,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

type Group = {
  editing: TestId | null;
  setEditing: (id: TestId | null) => void;
};

const GroupContext = createContext<Group | null>(null);

/**
 * One field edits at a time inside a group, and every pencil in it hides while one does.
 * Pass `editing` and `onEditingChange` when the page opens a field itself or needs to know
 * which one is open.
 */
export function InPlaceGroup({
  editing: controlled,
  onEditingChange,
  children,
}: {
  editing?: TestId | null;
  onEditingChange?: (id: TestId | null) => void;
  children: ReactNode;
}) {
  const [own, setOwn] = useState<TestId | null>(null);
  const editing = controlled === undefined ? own : controlled;
  const setEditing = useCallback(
    (id: TestId | null) => {
      if (controlled === undefined) setOwn(id);
      onEditingChange?.(id);
    },
    [controlled, onEditingChange],
  );
  const group = useMemo(
    () => ({ editing, setEditing }),
    [editing, setEditing],
  );
  return (
    <GroupContext.Provider value={group}>
      {children}
    </GroupContext.Provider>
  );
}

function useGroup(): Group {
  const group = useContext(GroupContext);
  if (!group)
    throw new Error('InPlaceField needs an InPlaceGroup above it');
  return group;
}

/** What a save hands back for the toast: Undo restores the old value. */
export type Saved = { undo: () => void; text?: string };
type Save<T> = (value: T) => Saved | void | Promise<Saved | void>;
type Hint<T> = ReactNode | ((value: T | null) => ReactNode);

type EditableOptions = {
  /** Classes for the press that holds the value and the pencil, for a value that is a whole row. */
  className?: string;
  /** False leaves the pencil off, for a value that already reads as an invitation. */
  pencil?: boolean;
  accessibilityLabel?: string;
};

export type InPlaceSlots = {
  /** The value with the pencil 8 after it. Pressing either opens the field. */
  editable: (
    value: ReactNode,
    options?: EditableOptions,
  ) => ReactElement;
  /** The open field with cancel and save, or null at rest. */
  editor: ReactElement | null;
  open: () => void;
  draft: string;
  setDraft: (text: string) => void;
};

type Common = {
  /** Parts are `<testID>.edit`, `.input`, `.cancel` and `.save`. */
  testID: TestId;
  /** Sentence-case noun: TalkBack reads "Edit amount" and "Amount, editing"; the toast says "Amount saved". */
  label: string;
  onCancel?: () => void;
  /**
   * The value at rest. A node gets the pencil and gives way to the field. A function places
   * `editable(value)` and `editor` itself, for a field that replaces a whole row or opens below one.
   */
  children: ReactNode | ((slots: InPlaceSlots) => ReactNode);
};

export type AmountFieldProps = Common & {
  kind: 'amount';
  value: MinorAmount | null;
  /** Sign and currency symbol before the digits, 28/700 Meta. */
  prefix: string;
  whole?: boolean;
  /** Zero and negative amounts are allowed, as on a wallet balance. */
  signed?: boolean;
  /** Amounts must stay below this, in minor units. */
  max?: number;
  hint?: Hint<MinorAmount>;
  /** Reports the typed amount while the field is open, and null when it closes. Pass a state setter. */
  onDraftChange?: (value: MinorAmount | null) => void;
  onSave: Save<MinorAmount>;
};

export type TextFieldProps = Common & {
  /** `note` is multiline and keeps its buttons under the field. */
  kind: 'text' | 'note';
  value: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  hint?: Hint<string>;
  onSave: Save<string>;
};

export type InPlaceFieldProps = AmountFieldProps | TextFieldProps;

export function parseAmountDraft(
  draft: string,
  {
    whole = false,
    signed = false,
    max,
  }: { whole?: boolean; signed?: boolean; max?: number },
): MinorAmount | null {
  const cleaned = draft.trim().replaceAll(',', '').replace('−', '-');
  if (!cleaned || (whole && !/^-?\d+$/.test(cleaned))) return null;
  let minor: MinorAmount;
  try {
    minor = decimalToMinor(cleaned);
  } catch {
    return null;
  }
  if (!signed && minor <= 0) return null;
  if (max !== undefined && Math.abs(minor) >= max) return null;
  return minor;
}

function initialDraft(props: InPlaceFieldProps): string {
  if (props.kind !== 'amount') return props.value;
  if (props.value === null) return '';
  return props.whole
    ? String(Math.trunc(props.value / 100))
    : minorToDecimal(props.value);
}

type Bound = {
  hint: ReactNode;
  /** Null while the draft is not a value the field can take: save stays off. */
  commit: (() => ReturnType<Save<never>>) | null;
  typed: MinorAmount | null;
};

function bind(props: InPlaceFieldProps, draft: string): Bound {
  if (props.kind === 'amount') {
    const value = parseAmountDraft(draft, props);
    return {
      hint:
        typeof props.hint === 'function'
          ? props.hint(value)
          : props.hint,
      commit: value === null ? null : () => props.onSave(value),
      typed: value,
    };
  }
  const text = draft.trim();
  const value = props.required && !text ? null : text;
  return {
    hint:
      typeof props.hint === 'function'
        ? props.hint(value)
        : props.hint,
    commit: value === null ? null : () => props.onSave(value),
    typed: null,
  };
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * tokens.md "In-place edit": a 32 Sand pencil after the value; pressing it or the value swaps in
 * a Paper field with a 2 ink border on the phone's own keyboard, then cancel and save. Back, the
 * keyboard closing, or a tap outside cancels. A save that hands back `{ undo }` shows the saved
 * toast with Undo; a save that throws shows its message.
 */
export function InPlaceField(props: InPlaceFieldProps) {
  const tokens = useThemeTokens();
  const group = useGroup();
  const { testID, label } = props;
  const editing = group.editing === testID;
  const [draft, setDraft] = useState(() => initialDraft(props));
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setDraft(initialDraft(props));
  }

  const bound = bind(props, draft);
  const { setEditing } = group;
  const open = useCallback(
    () => setEditing(testID),
    [setEditing, testID],
  );
  const { onCancel } = props;
  const cancel = useCallback(() => {
    setEditing(null);
    onCancel?.();
  }, [setEditing, onCancel]);

  const { commit } = bound;
  const save = commit
    ? () => {
        setEditing(null);
        const fail = (error: unknown) =>
          showToast({
            text:
              error instanceof Error
                ? error.message
                : "Couldn't save that",
            tone: 'removed',
          });
        try {
          void Promise.resolve(commit()).then((saved) => {
            if (saved)
              showToast({
                text: saved.text ?? `${label} saved`,
                undo: saved.undo,
              });
          }, fail);
        } catch (error) {
          fail(error);
        }
      }
    : null;

  const editable: InPlaceSlots['editable'] = (
    value,
    options = {},
  ) => {
    const busy = group.editing !== null;
    return (
      <Press
        testID={tid(testID, 'edit')}
        accessibilityLabel={
          options.accessibilityLabel ?? `Edit ${lowerFirst(label)}`
        }
        accessibilityHint="Opens the keyboard"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        pressedScale={1}
        pressedClassName="bg-transparent"
        className={
          options.className ??
          'min-h-11 max-w-full flex-row items-center gap-2 self-start'
        }
        onPress={open}
      >
        <View
          className={
            options.className
              ? 'min-w-0 flex-1'
              : 'min-w-0 flex-shrink'
          }
        >
          {value}
        </View>
        {busy || options.pencil === false ? null : (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-sand">
            <IconSymbol
              name="pencil-outline"
              size={16}
              color={tokens.foreground}
            />
          </View>
        )}
      </Press>
    );
  };

  const editor = editing ? (
    <Editor
      field={props}
      draft={draft}
      onDraft={setDraft}
      bound={bound}
      onCancel={cancel}
      onSave={save}
    />
  ) : null;

  if (typeof props.children === 'function')
    return props.children({
      editable,
      editor,
      open,
      draft,
      setDraft,
    });
  return editor ?? editable(props.children);
}

/**
 * Back, or the keyboard closing after this field opened it, cancels. Moving from one field to
 * another can close and reopen the keyboard, so a hide before this field's own show does not count.
 */
function useCancelOnDismiss(cancel: () => void) {
  useEffect(() => {
    let shown = false;
    const show = Keyboard.addListener('keyboardDidShow', () => {
      shown = true;
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (shown) cancel();
    });
    const back = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        cancel();
        return true;
      },
    );
    return () => {
      show.remove();
      hide.remove();
      back.remove();
    };
  }, [cancel]);
}

function Editor({
  field,
  draft,
  onDraft,
  bound: { hint, typed },
  onCancel,
  onSave,
}: {
  field: InPlaceFieldProps;
  draft: string;
  onDraft: (text: string) => void;
  bound: Bound;
  onCancel: () => void;
  onSave: (() => void) | null;
}) {
  const tokens = useThemeTokens();
  const { testID, label } = field;
  const amount = field.kind === 'amount';
  const note = field.kind === 'note';

  // Saving unmounts the input, which can blur it; the blur must not cancel what was just saved.
  const settled = useRef(false);
  const finish = (action: (() => void) | null) => () => {
    if (settled.current || !action) return;
    settled.current = true;
    action();
  };
  const cancel = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  }, [onCancel]);
  useCancelOnDismiss(cancel);

  const onDraftChange =
    field.kind === 'amount' ? field.onDraftChange : undefined;
  useEffect(() => {
    onDraftChange?.(typed);
  }, [onDraftChange, typed]);
  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const buttons = (
    <>
      <Press
        testID={tid(testID, 'cancel')}
        accessibilityLabel="Cancel"
        pressedClassName="bg-hairline"
        className="h-11 w-11 items-center justify-center rounded-full bg-sand"
        onPress={cancel}
      >
        <IconSymbol
          name="close"
          size={20}
          color={tokens.foreground}
        />
      </Press>
      <Press
        testID={tid(testID, 'save')}
        accessibilityLabel="Save"
        accessibilityState={{ disabled: !onSave }}
        disabled={!onSave}
        pressedClassName="bg-primary-pressed"
        className={`h-11 w-11 items-center justify-center rounded-full ${onSave ? 'bg-primary' : 'bg-inactive'}`}
        onPress={finish(onSave)}
      >
        <IconSymbol
          name="check"
          size={22}
          color={tokens.primaryForeground}
        />
      </Press>
    </>
  );

  const input = (
    <TextInput
      testID={tid(testID, 'input')}
      accessibilityLabel={`${label}, editing`}
      autoFocus
      value={draft}
      onChangeText={onDraft}
      onBlur={cancel}
      onSubmitEditing={note ? undefined : finish(onSave)}
      returnKeyType={note ? 'default' : 'done'}
      keyboardType={
        field.kind !== 'amount'
          ? 'default'
          : field.signed
            ? 'numeric'
            : field.whole
              ? 'number-pad'
              : 'decimal-pad'
      }
      multiline={note}
      maxLength={field.kind === 'amount' ? 12 : field.maxLength}
      placeholder={
        field.kind === 'amount' ? undefined : field.placeholder
      }
      autoCapitalize={
        field.kind === 'amount' ? 'none' : field.autoCapitalize
      }
      placeholderTextColor={tokens.muted}
      cursorColor={tokens.foreground}
      selectionColor={tokens.foreground}
      className={
        amount
          ? 'h-full min-w-0 flex-1 p-0 font-display-bold text-[40px] leading-[44px] text-foreground'
          : note
            ? 'min-h-[96px] p-0 font-display text-[15px] leading-[21px] text-foreground'
            : 'h-full min-w-0 flex-1 p-0 font-display-semibold text-[18px] leading-[22px] text-foreground'
      }
      style={
        note
          ? { textAlignVertical: 'top' }
          : amount
            ? { fontVariant: ['tabular-nums'] }
            : undefined
      }
    />
  );

  return (
    <View className="gap-1.5">
      {note ? (
        <>
          <View className="rounded-field border-2 border-foreground bg-card px-3.5 py-3">
            {input}
          </View>
          <View className="flex-row justify-end gap-2">
            {buttons}
          </View>
        </>
      ) : (
        <View className="flex-row items-center gap-2">
          <View
            className={`min-w-0 flex-1 flex-row items-center gap-1 rounded-field border-2 border-foreground bg-card px-3.5 ${amount ? 'h-16' : 'h-[52px]'}`}
          >
            {field.kind === 'amount' ? (
              <Text className="font-display-bold text-[28px] leading-[32px] text-muted">
                {field.prefix}
              </Text>
            ) : null}
            {input}
          </View>
          {buttons}
        </View>
      )}
      {typeof hint === 'string' ? (
        <Text
          variant="meta"
          accessibilityLiveRegion="polite"
          className="text-muted"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {hint}
        </Text>
      ) : (
        hint
      )}
    </View>
  );
}
