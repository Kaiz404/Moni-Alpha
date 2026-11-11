import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

export type ThemeReveal = {
  /**
   * Covers the window with a screenshot of itself. False when one is already up or the copy
   * failed, and then nothing covers the window.
   */
  capture(): Promise<boolean>;
  /** Opens a circle in the screenshot from `x`, `y` (window dp) until it is gone, then removes it. */
  reveal(x: number, y: number, durationMs: number): Promise<void>;
};

function load(): ThemeReveal | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<ThemeReveal>('MoniThemeReveal');
  } catch {
    return null;
  }
}

/** Null on iOS, web, Expo Go, and a dev client built before the module existed. */
export const themeReveal = load();
