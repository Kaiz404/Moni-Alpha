import * as Haptics from 'expo-haptics';

/** Hold-to-speak or long-press voice capture started. */
export function hapticVoiceStart(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Hold-to-speak released. */
export function hapticVoiceStop(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
