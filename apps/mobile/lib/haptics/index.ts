import * as Haptics from 'expo-haptics';

/** Hold-to-speak or long-press voice capture started. */
export function hapticVoiceStart(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Hold-to-speak released. */
export function hapticVoiceStop(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Custom numeric keypad key press. */
export function hapticKeypadPress(): void {
  void Haptics.selectionAsync();
}
