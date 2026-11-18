import 'react-native-gesture-handler/jestSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { NotificationAccessSheet } from '../notification-access-sheet';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({
    height: { get: () => 0 },
    state: { get: () => 0 },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/constants/links', () => ({
  PRIVACY_POLICY_URL: 'https://moni.example/privacy',
}));

it('says what Moni sees, keeps and stores, links the policy, and continues only on Open settings', () => {
  const onConfirm = jest.fn();
  const onDismiss = jest.fn();
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  render(
    <NotificationAccessSheet
      open
      onDismiss={onDismiss}
      onExited={() => {}}
      onConfirm={onConfirm}
    />,
  );

  expect(screen.getByText('Let Moni read alerts?')).toBeTruthy();
  expect(
    screen.getByText(
      'Moni can see every notification on this phone. It checks them here and keeps only alerts from the apps you link.',
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "The alerts it keeps go to Moni's AI, when it's on, to read the payment, and are saved to Moni's cloud database with your account.",
    ),
  ).toBeTruthy();

  fireEvent.press(screen.getByTestId('sheet.privacy-policy'));
  expect(openURL).toHaveBeenCalledWith('https://moni.example/privacy');
  expect(onConfirm).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId('sheet.cancel'));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId('sheet.confirm'));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
