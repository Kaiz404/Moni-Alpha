import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

export type ThemeReveal = {
  /**
   * Covers the window with a screenshot of itself. False when one is already up or the copy
   * failed, and then nothing covers the window.
   */
  capture(): Promise<boolean>;
  /**
   * Opens a circle in the screenshot from `x`, `y` (window dp) until it is gone, then removes it.
   * `curve` is a cubic bezier's two control points, `[x1, y1, x2, y2]`, applied to the radius.
   */
  reveal(x: number, y: number, durationMs: number, curve: readonly number[]): Promise<void>;
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
