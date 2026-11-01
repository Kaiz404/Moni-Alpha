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
  type RefObject,
} from 'react';
import {
  BackHandler,
  Keyboard,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native';
import Animated, {
  Easing,
  LayoutAnimationConfig,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePageLift } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

const FADE_OUT_MS = 160;
const FADE_IN = {
  duration: 200,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.Never,
};
// Linear, against a strong ease-out coming in: what the two faces share, such as a label, barely dips.
const FADE_OUT = {
  duration: FADE_OUT_MS,
  easing: Easing.linear,
  reduceMotion: ReduceMotion.Never,
};

/**
 * Fades run under Reduce Motion. Travel does not: its spring keeps the System default, which jumps
 * to the end on the first frame.
 */
function appear({
  scale = 1,
  x = 0,
  delay = 0,
}: { scale?: number; x?: number; delay?: number } = {}) {
  return () => {
    'worklet';
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateX: x }, { scale }],
      },
      animations: {
        opacity: withDelay(delay, withTiming(1, FADE_IN)),
        transform: [
          { translateX: withDelay(delay, withSpring(0, springs.sheet)) },
          { scale: withDelay(delay, withSpring(1, springs.sheet)) },
        ],
      },
    };
  };
}

/** A timing, never a spring: the view stays in the way of touches until its animation ends. */
const FADES_OUT = () => {
  'worklet';
  return {
    initialValues: { opacity: 1 },
    animations: { opacity: withTiming(0, FADE_OUT) },
  };
};

const REST_IN = appear({ scale: 0.985 });
const EDIT_IN = appear();
const FIELD_IN = appear({ scale: 0.98 });
const CANCEL_IN = appear({ x: 12, delay: 30 });
const SAVE_IN = appear({ x: 12, delay: 70 });
const HINT_IN = appear({ delay: 60 });

const GROWS_FROM_VALUE = { transformOrigin: 'left center' };
const UNMEASURED = -1;

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
  /**
   * The pressed fill for a value that fills a whole row, such as `bg-sand-light`; the row
   * then squishes to 0.97 like any row. A bare value has no fill and no squish.
   */
  pressedClassName?: string;
  accessibilityLabel?: string;
};

export type InPlaceSlots = {
  /** The value with the pencil 8 after it. Pressing either opens the field. */
  editable: (
    value: ReactNode,
    options?: EditableOptions,
  ) => ReactElement;
  /**
   * The open field with cancel and save, or null at rest. What the render function returns is
   * one face: when `editor` comes or goes the two faces cross-fade and the height springs between them.
   */
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
  const cleaned = draft
    .trim()
    .replaceAll(',', '')
    .replace('−', '-')
    .replace(/^(-?)\./, (_, sign: string) => `${sign}0.`)
    .replace(/\.$/, '');
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
 * tokens.md "In-place edit": a 32 Sand pencil after the value; pressing it or the value grows
 * a Paper field with a 2 ink border out of it on the phone's own keyboard, then cancel and save. Back,
 * the keyboard closing, or a tap outside cancels. A save that hands back `{ undo }` shows the saved
 * toast with Undo; a save that throws shows its message.
 *
 * The frame's height is always a number once measured, so a face commits under the old height and
 * siblings reflow with the spring. It only clips while moving: at rest a value may reach outside it.
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

  const height = useSharedValue(UNMEASURED);
  const target = useSharedValue(UNMEASURED);
  const frame = useAnimatedStyle(() => {
    const now = height.get();
    if (now === UNMEASURED) return {};
    return {
      height: now,
      overflow: now === target.get() ? 'visible' : 'hidden',
    };
  });
  const refitRef = useRef<(() => void) | null>(null);
  const afterMotion = useCallback(() => refitRef.current?.(), []);
  const measured = useRef(false);
  const onFaceLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    target.set(next);
    if (!measured.current) {
      measured.current = true;
      height.set(next);
      return;
    }
    height.set(
      withSpring(next, springs.sheet, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(afterMotion);
      }),
    );
  };

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
        pressedScale={options.pressedClassName ? 0.97 : 1}
        pressedClassName={
          options.pressedClassName ?? 'bg-transparent'
        }
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
        {options.pencil === false ? null : (
          <Animated.View
            className="h-8 w-8 items-center justify-center rounded-full bg-sand"
            style={{
              opacity: busy ? 0 : 1,
              transitionProperty: 'opacity',
              transitionDuration: FADE_OUT_MS,
            }}
          >
            <IconSymbol
              name="pencil-outline"
              size={16}
              color={tokens.foreground}
            />
          </Animated.View>
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
      refitRef={refitRef}
    />
  ) : null;

  return (
    <LayoutAnimationConfig
      skipEntering
      skipExiting
    >
      <Animated.View style={frame}>
        <Animated.View
          key={editing ? 'editing' : 'rest'}
          onLayout={onFaceLayout}
          entering={editing ? EDIT_IN : REST_IN}
          exiting={FADES_OUT}
          style={GROWS_FROM_VALUE}
        >
          {typeof props.children === 'function'
            ? props.children({
                editable,
                editor,
                open,
                draft,
                setDraft,
              })
            : (editor ?? editable(props.children))}
        </Animated.View>
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

/**
 * Back, or the keyboard closing after this field opened it, cancels. Moving from one field to
 * another can close and reopen the keyboard, so a hide before this field's own show does not count.
 */
function useCancelOnDismiss(cancel: () => void) {
  // Subscribed once per open field: a fresh subscription would forget the keyboard already shown.
  const latest = useRef(cancel);
  useEffect(() => {
    latest.current = cancel;
  });
  useEffect(() => {
    let shown = false;
    const show = Keyboard.addListener('keyboardDidShow', () => {
      shown = true;
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (shown) latest.current();
    });
    const back = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        latest.current();
        return true;
      },
    );
    return () => {
      show.remove();
      hide.remove();
      back.remove();
    };
  }, []);
}

/** The gap kept between an open field's controls and the top of the keyboard. */
const KEYBOARD_GAP = 12;

/**
 * Lifts the page while the keyboard would cover the open field's cancel and save. Measures again
 * when the height settles (`refitRef`). A measure can land mid-spring, so it asks where the controls
 * sit with no lift at all: repeating one never lifts further.
 */
function useClearKeyboard(refitRef: RefObject<(() => void) | null>) {
  const controls = useRef<View>(null);
  const lift = usePageLift();
  const latestLift = useRef(lift);
  latestLift.current = lift;
  const lifted = useRef(0);
  const fit = useCallback(() => {
    const keyboard = Keyboard.metrics();
    if (!keyboard) return;
    controls.current?.measureInWindow((_x, y, _width, height) => {
      const needed =
        y +
        latestLift.current.current() +
        height +
        KEYBOARD_GAP -
        keyboard.screenY;
      if (needed <= lifted.current) return;
      lifted.current = needed;
      latestLift.current.to(needed);
    });
  }, []);
  useEffect(() => {
    refitRef.current = fit;
    const show = Keyboard.addListener('keyboardDidShow', fit);
    return () => {
      refitRef.current = null;
      show.remove();
      latestLift.current.to(0);
    };
  }, [fit, refitRef]);
  return { controls, onControlsLayout: fit };
}

function Editor({
  field,
  draft,
  onDraft,
  bound: { hint, typed },
  onCancel,
  onSave,
  refitRef,
}: {
  field: InPlaceFieldProps;
  draft: string;
  onDraft: (text: string) => void;
  bound: Bound;
  onCancel: () => void;
  onSave: (() => void) | null;
  refitRef: RefObject<(() => void) | null>;
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
  const { controls, onControlsLayout } = useClearKeyboard(refitRef);

  const onDraftChange =
    field.kind === 'amount' ? field.onDraftChange : undefined;
  useEffect(() => {
    onDraftChange?.(typed);
  }, [onDraftChange, typed]);
  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const buttons = (
    <>
      <Animated.View entering={CANCEL_IN}>
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
      </Animated.View>
      <Animated.View entering={SAVE_IN}>
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
      </Animated.View>
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
      submitBehavior={note ? 'newline' : 'submit'}
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
            ? 'min-h-[63px] p-0 font-display text-[15px] leading-[21px] text-foreground'
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
          <Animated.View
            entering={FIELD_IN}
            className="rounded-field border-2 border-foreground bg-card px-3 py-2.5"
            style={GROWS_FROM_VALUE}
          >
            {input}
          </Animated.View>
          <View
            ref={controls}
            onLayout={onControlsLayout}
            className="flex-row justify-end gap-2"
          >
            {buttons}
          </View>
        </>
      ) : (
        <View
          ref={controls}
          onLayout={onControlsLayout}
          className="flex-row items-center gap-2"
        >
          <Animated.View
            entering={FIELD_IN}
            className={`min-w-0 flex-1 flex-row items-center gap-1 rounded-field border-2 border-foreground bg-card px-3.5 ${amount ? 'h-16' : 'h-[52px]'}`}
            style={GROWS_FROM_VALUE}
          >
            {field.kind === 'amount' ? (
              <Text className="font-display-bold text-[28px] leading-[32px] text-muted">
                {field.prefix}
              </Text>
            ) : null}
            {input}
          </Animated.View>
          {buttons}
        </View>
      )}
      {hint ? (
        <Animated.View
          entering={HINT_IN}
          exiting={FADES_OUT}
        >
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
        </Animated.View>
      ) : null}
    </View>
  );
}
