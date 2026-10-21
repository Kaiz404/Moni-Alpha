import { fireEvent, render, screen } from '@testing-library/react-native';

import { Text } from '@/components/ui/text';
import { InPlaceField, InPlaceGroup } from '@/components/transaction/in-place-field';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

function Fields({
  onAmount = jest.fn(),
  onName = jest.fn(),
}: {
  onAmount?: (value: number) => void;
  onName?: (value: string) => void;
}) {
  return (
    <InPlaceGroup>
      <InPlaceField
        screen="txn"
        name="merchant"
        label="name"
        kind="name"
        value="Shell"
        onSave={onName}
      >
        <Text>Shell</Text>
      </InPlaceField>
      <InPlaceField
        screen="txn"
        name="amount"
        label="amount"
        kind="amount"
        prefix="−RM"
        value={30.4}
        onSave={onAmount}
      >
        <Text>−RM30.40</Text>
      </InPlaceField>
    </InPlaceGroup>
  );
}

describe('InPlaceField', () => {
  it('shows the input with the current value when the pencil is pressed', () => {
    render(<Fields />);
    expect(screen.queryByTestId('txn.amount.input')).toBeNull();
    fireEvent.press(screen.getByTestId('txn.amount.pencil'));
    expect(screen.getByTestId('txn.amount.input').props.value).toBe('30.40');
    expect(screen.queryByText('−RM30.40')).toBeNull();
  });

  it('saves 12.5 as a number and closes the field', () => {
    const onAmount = jest.fn();
    render(<Fields onAmount={onAmount} />);
    fireEvent.press(screen.getByTestId('txn.amount.pencil'));
    fireEvent.changeText(screen.getByTestId('txn.amount.input'), '12.5');
    fireEvent.press(screen.getByTestId('txn.amount.save'));
    expect(onAmount).toHaveBeenCalledWith(12.5);
    expect(screen.queryByTestId('txn.amount.input')).toBeNull();
  });

  it('calls nothing on cancel', () => {
    const onAmount = jest.fn();
    render(<Fields onAmount={onAmount} />);
    fireEvent.press(screen.getByTestId('txn.amount.value'));
    fireEvent.changeText(screen.getByTestId('txn.amount.input'), '99');
    fireEvent.press(screen.getByTestId('txn.amount.cancel'));
    expect(onAmount).not.toHaveBeenCalled();
    expect(screen.getByText('−RM30.40')).toBeTruthy();
  });

  it('closes the first field when a second one opens', () => {
    const onName = jest.fn();
    render(<Fields onName={onName} />);
    fireEvent.press(screen.getByTestId('txn.merchant.pencil'));
    fireEvent.changeText(screen.getByTestId('txn.merchant.input'), 'Shell Damansara');
    fireEvent.press(screen.getByTestId('txn.amount.pencil'));
    expect(screen.queryByTestId('txn.merchant.input')).toBeNull();
    expect(screen.getByTestId('txn.amount.input')).toBeTruthy();
    expect(onName).not.toHaveBeenCalled();
  });

  it('will not save an amount that is not a positive number', () => {
    const onAmount = jest.fn();
    render(<Fields onAmount={onAmount} />);
    fireEvent.press(screen.getByTestId('txn.amount.pencil'));
    fireEvent.changeText(screen.getByTestId('txn.amount.input'), '0');
    fireEvent.press(screen.getByTestId('txn.amount.save'));
    expect(onAmount).not.toHaveBeenCalled();
    expect(screen.getByTestId('txn.amount.input')).toBeTruthy();
  });
});
