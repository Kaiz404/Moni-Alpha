import type { MinorAmount } from '@repo/types';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';

const sen = (minor: number) => minor as MinorAmount;

function fill() {
  const node = screen.getByRole('progressbar').children[0];
  if (typeof node === 'string')
    throw new Error('progress bar has no fill');
  return {
    width: StyleSheet.flatten(node.props.style)?.width,
    className: node.props.className,
  };
}

describe('ProgressBar', () => {
  it('fills the whole track and says how much over when spent passes the budget', () => {
    render(
      <ProgressBar
        title="Transport"
        spentMinor={sen(12000)}
        budgetMinor={sen(10000)}
        currency="MYR"
      />,
    );
    expect(screen.getByText('RM20 over')).toBeTruthy();
    expect(fill().width).toBe('100%');
    expect(fill().className).toContain('bg-coral');
    expect(
      screen.getByRole('progressbar').props.accessibilityValue.now,
    ).toBe(100);
  });

  it('fills spent over budget and says what is left, rounded down', () => {
    render(
      <ProgressBar
        spentMinor={sen(7850)}
        budgetMinor={sen(10000)}
        currency="MYR"
      />,
    );
    expect(screen.getByText('RM21 left')).toBeTruthy();
    expect(fill().width).toBe('78.5%');
    expect(fill().className).toContain('bg-ink-2');
  });
});
