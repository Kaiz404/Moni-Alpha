import type { MinorAmount } from '@repo/types';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { useState } from 'react';
import { Keyboard, View } from 'react-native';

import {
  InPlaceField,
  InPlaceGroup,
  parseAmountDraft,
} from '@/components/ui/in-place-field';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { tid, type TestId } from '@/lib/test-ids';
import {
  dismissToast,
  undoToast,
  useToast,
} from '@/lib/toast/toast-store';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const rm = (minor: number) => minor as MinorAmount;

function ToastText() {
  const toast = useToast();
  return toast ? (
    <Text
      testID={tid('nav', 'toast')}
    >{`${toast.tone}: ${toast.text}`}</Text>
  ) : null;
}

function Fields({
  onAmount = jest.fn(),
  onName = jest.fn(),
}: {
  onAmount?: (value: MinorAmount) => void;
  onName?: (value: string) => void;
}) {
  return (
    <InPlaceGroup>
      <InPlaceField
        testID={tid('txn', 'merchant')}
        label="Name"
        kind="text"
        required
        value="Shell"
        onSave={onName}
      >
        <Text>Shell</Text>
      </InPlaceField>
      <InPlaceField
        testID={tid('txn', 'amount')}
        label="Amount"
        kind="amount"
        prefix="−RM"
        value={rm(3040)}
        onSave={onAmount}
      >
        <Text>−RM30.40</Text>
      </InPlaceField>
      <ToastText />
    </InPlaceGroup>
  );
}

afterEach(() => {
  act(() => dismissToast());
});

describe('InPlaceField', () => {
  it('opens on the current value, with the prefix and the system decimal keyboard', () => {
    render(<Fields />);
    expect(screen.queryByTestId('txn.amount.input')).toBeNull();
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    const input = screen.getByTestId('txn.amount.input');
    expect(input.props.value).toBe('30.40');
    expect(input.props.keyboardType).toBe('decimal-pad');
    expect(screen.getByText('−RM')).toBeTruthy();
    expect(screen.queryByText('−RM30.40')).toBeNull();
  });

  it('saves 12.5 as 1250 minor units and closes the field', () => {
    const onAmount = jest.fn();
    render(<Fields onAmount={onAmount} />);
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    fireEvent.changeText(
      screen.getByTestId('txn.amount.input'),
      '12.5',
    );
    fireEvent.press(screen.getByTestId('txn.amount.save'));
    expect(onAmount).toHaveBeenCalledWith(1250);
    expect(screen.queryByTestId('txn.amount.input')).toBeNull();
    expect(screen.getByText('−RM30.40')).toBeTruthy();
  });

  it('saves from the keyboard Done key', () => {
    const onName = jest.fn();
    render(<Fields onName={onName} />);
    fireEvent.press(screen.getByTestId('txn.merchant.edit'));
    fireEvent.changeText(
      screen.getByTestId('txn.merchant.input'),
      '  Shell Damansara ',
    );
    fireEvent(
      screen.getByTestId('txn.merchant.input'),
      'submitEditing',
    );
    expect(onName).toHaveBeenCalledWith('Shell Damansara');
  });

  it('calls nothing on cancel and reopens on the saved value', () => {
    const onAmount = jest.fn();
    render(<Fields onAmount={onAmount} />);
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    fireEvent.changeText(
      screen.getByTestId('txn.amount.input'),
      '99',
    );
    fireEvent.press(screen.getByTestId('txn.amount.cancel'));
    expect(onAmount).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    expect(screen.getByTestId('txn.amount.input').props.value).toBe(
      '30.40',
    );
  });

  it('cancels when the input loses focus, but not after a save', () => {
    const onAmount = jest.fn();
    const onCancel = jest.fn();
    render(
      <InPlaceGroup>
        <InPlaceField
          testID={tid('budget', 'cap')}
          label="Budget"
          kind="amount"
          prefix="RM"
          whole
          value={rm(12000)}
          onCancel={onCancel}
          onSave={onAmount}
        >
          <Text>RM120</Text>
        </InPlaceField>
      </InPlaceGroup>,
    );
    fireEvent.press(screen.getByTestId('budget.cap.edit'));
    fireEvent.press(screen.getByTestId('budget.cap.save'));
    fireEvent.press(screen.getByTestId('budget.cap.edit'));
    fireEvent(screen.getByTestId('budget.cap.input'), 'blur');
    expect(onAmount).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('budget.cap.input')).toBeNull();
  });

  it('edits one field at a time: the other pencils hide and their values do not open', () => {
    render(<Fields />);
    fireEvent.press(screen.getByTestId('txn.merchant.edit'));
    const amount = screen.getByTestId('txn.amount.edit');
    expect(amount.props.accessibilityState).toEqual({
      disabled: true,
    });
    fireEvent.press(amount);
    expect(screen.queryByTestId('txn.amount.input')).toBeNull();
    expect(screen.getByTestId('txn.merchant.input')).toBeTruthy();
  });

  it('keeps save off for an amount that is not a positive number', () => {
    const onAmount = jest.fn();
    render(<Fields onAmount={onAmount} />);
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    fireEvent.changeText(screen.getByTestId('txn.amount.input'), '0');
    expect(
      screen.getByTestId('txn.amount.save').props.accessibilityState,
    ).toEqual({
      disabled: true,
    });
    fireEvent.press(screen.getByTestId('txn.amount.save'));
    expect(onAmount).not.toHaveBeenCalled();
    expect(screen.getByTestId('txn.amount.input')).toBeTruthy();
  });

  it('keeps save off for a required name left blank', () => {
    const onName = jest.fn();
    render(<Fields onName={onName} />);
    fireEvent.press(screen.getByTestId('txn.merchant.edit'));
    fireEvent.changeText(
      screen.getByTestId('txn.merchant.input'),
      '   ',
    );
    fireEvent.press(screen.getByTestId('txn.merchant.save'));
    expect(onName).not.toHaveBeenCalled();
  });

  it('shows the saved toast with Undo when the save hands back an undo', async () => {
    const undo = jest.fn();
    render(<Fields onAmount={() => ({ undo })} />);
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    fireEvent.changeText(
      screen.getByTestId('txn.amount.input'),
      '31',
    );
    fireEvent.press(screen.getByTestId('txn.amount.save'));
    expect(
      await screen.findByText('done: Amount saved'),
    ).toBeTruthy();
    act(() => undoToast());
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('uses the toast text a save hands back, after the save settles', async () => {
    render(
      <Fields
        onName={async () => ({
          undo: jest.fn(),
          text: 'Renamed to Shell Damansara',
        })}
      />,
    );
    fireEvent.press(screen.getByTestId('txn.merchant.edit'));
    fireEvent.changeText(
      screen.getByTestId('txn.merchant.input'),
      'Shell Damansara',
    );
    fireEvent.press(screen.getByTestId('txn.merchant.save'));
    expect(
      await screen.findByText('done: Renamed to Shell Damansara'),
    ).toBeTruthy();
  });

  it('shows a save that fails as a removed toast with its message', async () => {
    render(
      <Fields
        onName={() => {
          throw new Error('Offline. Not saved.');
        }}
      />,
    );
    fireEvent.press(screen.getByTestId('txn.merchant.edit'));
    fireEvent.press(screen.getByTestId('txn.merchant.save'));
    expect(
      await screen.findByText('removed: Offline. Not saved.'),
    ).toBeTruthy();
  });

  it('shows no toast when the save hands back nothing', () => {
    render(<Fields />);
    fireEvent.press(screen.getByTestId('txn.amount.edit'));
    fireEvent.press(screen.getByTestId('txn.amount.save'));
    expect(screen.queryByTestId('nav.toast')).toBeNull();
  });

  it('opens a multiline note with its buttons under it', () => {
    const onNote = jest.fn();
    render(
      <InPlaceGroup>
        <InPlaceField
          testID={tid('txn', 'note')}
          label="Note"
          kind="note"
          value=""
          placeholder="Who it was with"
          onSave={onNote}
        >
          <Text>Add a note</Text>
        </InPlaceField>
      </InPlaceGroup>,
    );
    fireEvent.press(screen.getByTestId('txn.note.edit'));
    const input = screen.getByTestId('txn.note.input');
    expect(input.props.multiline).toBe(true);
    expect(input.props.placeholder).toBe('Who it was with');
    fireEvent.changeText(input, 'Lunch with Mei\nat Pavilion');
    fireEvent.press(screen.getByTestId('txn.note.save'));
    expect(onNote).toHaveBeenCalledWith(
      'Lunch with Mei\nat Pavilion',
    );
  });

  it('places the editor where the render function puts it and shows a hint from the draft', () => {
    render(
      <InPlaceGroup>
        <InPlaceField
          testID={tid('budget', 'bill-amount')}
          label="Amount"
          kind="amount"
          prefix="RM"
          value={rm(5490)}
          max={10_000_000}
          hint={(value) =>
            value === null
              ? 'Type an amount above RM0.'
              : 'From Thu 15 Oct on.'
          }
          onSave={jest.fn()}
        >
          {({ editable, editor }) => (
            <View testID="row">
              <Text>Netflix</Text>
              {editor ?? editable(<Text>RM54.90</Text>)}
            </View>
          )}
        </InPlaceField>
      </InPlaceGroup>,
    );
    fireEvent.press(screen.getByTestId('budget.bill-amount.edit'));
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('From Thu 15 Oct on.')).toBeTruthy();
    fireEvent.changeText(
      screen.getByTestId('budget.bill-amount.input'),
      '100000',
    );
    expect(
      screen.getByText('Type an amount above RM0.'),
    ).toBeTruthy();
  });

  it('lets the page open a field and follow which one is open', () => {
    function Page() {
      const [editing, setEditing] = useState<TestId | null>(null);
      const [typed, setTyped] = useState<MinorAmount | null>(null);
      const id = tid('budget', 'edit', 'cap', 'food');
      return (
        <InPlaceGroup
          editing={editing}
          onEditingChange={setEditing}
        >
          <Press
            testID={tid('budget', 'edit', 'add')}
            onPress={() => setEditing(id)}
          />
          <Text>{`open ${editing ?? 'none'}, typed ${typed ?? 'none'}`}</Text>
          <InPlaceField
            testID={id}
            label="Food budget"
            kind="amount"
            prefix="RM"
            whole
            value={null}
            onDraftChange={setTyped}
            onSave={jest.fn()}
          >
            {({ editor }) => editor}
          </InPlaceField>
        </InPlaceGroup>
      );
    }
    render(<Page />);
    fireEvent.press(screen.getByTestId('budget.edit.add'));
    expect(
      screen.getByTestId('budget.edit.cap.food.input').props.value,
    ).toBe('');
    expect(
      screen.getByTestId('budget.edit.cap.food.input').props
        .keyboardType,
    ).toBe('number-pad');
    fireEvent.changeText(
      screen.getByTestId('budget.edit.cap.food.input'),
      '300',
    );
    expect(
      screen.getByText('open budget.edit.cap.food, typed 30000'),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByTestId('budget.edit.cap.food.cancel'),
    );
    expect(screen.getByText('open none, typed none')).toBeTruthy();
  });

  it('lets the page fill the draft, as a suggested name does', () => {
    const onName = jest.fn();
    render(
      <InPlaceGroup>
        <InPlaceField
          testID={tid('merchants', 'to-name', 'grab')}
          label="Name"
          kind="text"
          value=""
          onSave={onName}
        >
          {({ editable, editor, setDraft }) =>
            editor ? (
              <>
                {editor}
                <Press
                  testID={tid(
                    'merchants',
                    'to-name',
                    'grab',
                    'guess',
                  )}
                  onPress={() => setDraft('Grab Food')}
                />
              </>
            ) : (
              editable(<Text>GRAB*FOOD</Text>)
            )
          }
        </InPlaceField>
      </InPlaceGroup>,
    );
    fireEvent.press(
      screen.getByTestId('merchants.to-name.grab.edit'),
    );
    fireEvent.press(
      screen.getByTestId('merchants.to-name.grab.guess'),
    );
    expect(
      screen.getByTestId('merchants.to-name.grab.input').props.value,
    ).toBe('Grab Food');
    fireEvent.press(
      screen.getByTestId('merchants.to-name.grab.save'),
    );
    expect(onName).toHaveBeenCalledWith('Grab Food');
  });
});

describe('InPlaceField and the keyboard', () => {
  type Listener = () => void;
  let listeners: Record<string, Listener[]>;

  beforeEach(() => {
    listeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      listener: Listener,
    ) => {
      (listeners[event] ??= []).push(listener);
      return {
        remove: () => {
          listeners[event] = listeners[event].filter(
            (held) => held !== listener,
          );
        },
      };
    }) as unknown as typeof Keyboard.addListener);
  });
  afterEach(() => jest.restoreAllMocks());

  const emit = (event: string) =>
    act(() => listeners[event]?.forEach((listener) => listener()));

  it('cancels when the keyboard closes, even after typing re-rendered the page', () => {
    const onCancel = jest.fn();
    function Page() {
      const [, setTyped] = useState<MinorAmount | null>(null);
      return (
        <InPlaceGroup>
          <InPlaceField
            testID={tid('budget', 'cap', 'food')}
            label="Food budget"
            kind="amount"
            prefix="RM"
            whole
            value={rm(30000)}
            onDraftChange={setTyped}
            onCancel={() => onCancel()}
            onSave={jest.fn()}
          >
            <Text>RM300</Text>
          </InPlaceField>
        </InPlaceGroup>
      );
    }
    render(<Page />);
    fireEvent.press(screen.getByTestId('budget.cap.food.edit'));
    emit('keyboardDidShow');
    fireEvent.changeText(
      screen.getByTestId('budget.cap.food.input'),
      '350',
    );
    fireEvent.changeText(
      screen.getByTestId('budget.cap.food.input'),
      '360',
    );
    emit('keyboardDidHide');
    expect(screen.queryByTestId('budget.cap.food.input')).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the field focused when Done is pressed on a value it cannot take', () => {
    render(<Fields />);
    fireEvent.press(screen.getByTestId('txn.merchant.edit'));
    const input = screen.getByTestId('txn.merchant.input');
    expect(input.props.submitBehavior).toBe('submit');
    fireEvent.changeText(input, ' ');
    fireEvent(input, 'submitEditing');
    expect(screen.getByTestId('txn.merchant.input')).toBeTruthy();
  });
});

describe('parseAmountDraft', () => {
  it('reads ringgit and sen into minor units', () => {
    expect(parseAmountDraft('1,234.5', {})).toBe(123450);
    expect(parseAmountDraft('12.345', {})).toBeNull();
    expect(parseAmountDraft('abc', {})).toBeNull();
    expect(parseAmountDraft('', {})).toBeNull();
  });

  it('takes a leading or trailing point as the phone keyboard types it', () => {
    expect(parseAmountDraft('.5', {})).toBe(50);
    expect(parseAmountDraft('12.', {})).toBe(1200);
    expect(parseAmountDraft('.', {})).toBeNull();
  });

  it('takes only whole ringgit when whole', () => {
    expect(parseAmountDraft('300', { whole: true })).toBe(30000);
    expect(parseAmountDraft('300.50', { whole: true })).toBeNull();
  });

  it('takes zero and negatives only when signed', () => {
    expect(parseAmountDraft('0', {})).toBeNull();
    expect(parseAmountDraft('−12.40', {})).toBeNull();
    expect(parseAmountDraft('0', { signed: true })).toBe(0);
    expect(parseAmountDraft('−12.40', { signed: true })).toBe(-1240);
  });

  it('stays below max', () => {
    expect(parseAmountDraft('99999', { max: 10_000_000 })).toBe(
      9_999_900,
    );
    expect(
      parseAmountDraft('100000', { max: 10_000_000 }),
    ).toBeNull();
  });
});
