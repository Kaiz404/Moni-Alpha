import { describe, expect, it } from 'vitest';
import { settingsPlace } from '../settings-nav';

describe('settingsPlace', () => {
  it('reads each Settings path as its section, its phone title and where Back goes', () => {
    expect(settingsPlace('/settings')).toEqual({ section: 'profile', index: true, phoneTitle: 'Settings', back: '/home' });
    expect(settingsPlace('/settings/merchants')).toEqual({ section: 'merchants', index: false, phoneTitle: 'Merchant names', back: '/settings' });
    expect(settingsPlace('/settings/import/')).toEqual({ section: 'import', index: false, phoneTitle: 'Import and export', back: '/settings' });
    expect(settingsPlace('/settings/ai')).toEqual({ section: 'ai', index: false, phoneTitle: "Moni's AI", back: '/settings' });
  });
});
