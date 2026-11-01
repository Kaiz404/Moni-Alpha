import { fireEvent, render, screen } from '@testing-library/react-native';

import { useCaptureAlert } from '@/components/capture-sources/use-capture-alert';

import { CaptureAlertCard } from '../capture-alert-card';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('@/components/capture-sources/use-capture-alert', () => ({
  useCaptureAlert: jest.fn(),
}));

const fix = jest.fn();
const dismiss = jest.fn();

beforeEach(() => {
  fix.mockClear();
  dismiss.mockClear();
});

describe('CaptureAlertCard', () => {
  it('shows nothing while capture is healthy', () => {
    (useCaptureAlert as jest.Mock).mockReturnValue(null);
    render(<CaptureAlertCard />);
    expect(screen.toJSON()).toBeNull();
  });

  it('says what went quiet, and the fix and the dismissal each do their one thing', () => {
    (useCaptureAlert as jest.Mock).mockReturnValue({
      title: 'Maybank has gone quiet',
      body: 'Usually every day. Nothing for 4 days. Add anything Moni missed.',
      actionLabel: 'Add it',
      dismissLabel: 'Nothing missed',
      fix,
      dismiss,
    });
    render(<CaptureAlertCard />);

    expect(screen.getByText('Maybank has gone quiet')).toBeTruthy();
    expect(
      screen.getByText('Usually every day. Nothing for 4 days. Add anything Moni missed.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Add it'));
    expect(fix).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Nothing missed'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
