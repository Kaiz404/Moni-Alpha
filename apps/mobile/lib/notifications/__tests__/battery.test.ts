import { autostartFallbackMessage, hasAutostartSetting } from '../battery';

describe('Autostart', () => {
  it.each(['Xiaomi', 'Redmi', 'POCO', ' redmi '])('applies to %s', (brand) => {
    expect(hasAutostartSetting(brand)).toBe(true);
  });

  it.each(['samsung', 'google', '', undefined])('does not apply to %s', (brand) => {
    expect(hasAutostartSetting(brand)).toBe(false);
  });

  it('says nothing when the real page opened', () => {
    expect(autostartFallbackMessage('autostart')).toBeNull();
  });

  it('is honest when the page could not open', () => {
    expect(autostartFallbackMessage('app_details')).toBe(
      "This phone has no Autostart page Moni can open. Look for Autostart on Moni's App info page.",
    );
    expect(autostartFallbackMessage('none')).toBe(
      "Moni couldn't open Settings. Open Settings and search for Autostart.",
    );
  });
});
