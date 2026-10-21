import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// From a worklet, call these through scheduleOnRN.
function fire(android: Haptics.AndroidHaptics, ios?: () => Promise<void>): void {
  if (Platform.OS === 'android') void Haptics.performAndroidHapticsAsync(android);
  else if (ios) void ios();
}

const lightImpact = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

export const keypadTap = () => fire(Haptics.AndroidHaptics.Keyboard_Tap);

export const approve = () =>
  fire(Haptics.AndroidHaptics.Confirm, () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );

export const notMine = () => fire(Haptics.AndroidHaptics.Reject, lightImpact);

/** A swipe crosses the commit threshold. */
export const thresholdOn = () => fire(Haptics.AndroidHaptics.Toggle_On, lightImpact);

/** A swipe falls back under the commit threshold. */
export const thresholdOff = () => fire(Haptics.AndroidHaptics.Toggle_Off, lightImpact);

/** Chart scrub step, segmented change, sheet detent. */
export const scrubStep = () => fire(Haptics.AndroidHaptics.Segment_Tick, Haptics.selectionAsync);

export const toggleOn = () => fire(Haptics.AndroidHaptics.Toggle_On, Haptics.selectionAsync);

export const toggleOff = () => fire(Haptics.AndroidHaptics.Toggle_Off, Haptics.selectionAsync);

export const holdCommit = () =>
  fire(Haptics.AndroidHaptics.Confirm, () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
