import { openSheet } from '@/lib/sheet/sheet-store';

import { askForNotificationAccess } from '../permission';

jest.mock('@/lib/sheet/sheet-store', () => ({ openSheet: jest.fn(async () => null) }));

describe('asking for notification access', () => {
  it('says what happens to alerts in one sentence, in the app, first', async () => {
    await askForNotificationAccess();
    expect(openSheet).toHaveBeenCalledWith({
      kind: 'confirm',
      title: 'Let Moni read bank alerts?',
      message:
        'One-time codes never leave this phone, and other payment alerts from the apps you link go to a cloud AI model that reads them.',
      confirmLabel: 'Open settings',
      cancelLabel: 'Not now',
    });
  });
});
