import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import { pickDate } from '@/lib/sheet/pick-date';

jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

describe('pickDate on Android', () => {
  const open = DateTimePickerAndroid.open as jest.Mock;
  beforeEach(() => {
    Platform.OS = 'android';
    open.mockReset();
  });

  it('opens the system calendar on the selected day and resolves the day chosen', async () => {
    const answer = pickDate('2026-10-14');
    const params = open.mock.calls[0][0];
    expect(params.mode).toBe('date');
    expect(params.value.getDate()).toBe(14);
    params.onChange({ type: 'set' }, new Date(2026, 9, 9, 12));
    await expect(answer).resolves.toBe('2026-10-09');
  });

  it('resolves null when dismissed', async () => {
    const answer = pickDate('2026-10-14');
    open.mock.calls[0][0].onChange({ type: 'dismissed' });
    await expect(answer).resolves.toBeNull();
  });
});
