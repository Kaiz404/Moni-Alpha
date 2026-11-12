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

/** Segmented change, sheet detent, a pick among a few. */
export const scrubStep = () => fire(Haptics.AndroidHaptics.Segment_Tick, Haptics.selectionAsync);

/**
 * The scrub reaches a new point on a chart, or the tooltip first appears. Points packed closer
 * than a fingertip can tell apart play the lighter frequent tick, so a fast drag hums, not rattles.
 */
export const chartStep = (dense: boolean) =>
  fire(
    dense ? Haptics.AndroidHaptics.Segment_Frequent_Tick : Haptics.AndroidHaptics.Segment_Tick,
    Haptics.selectionAsync,
  );

/** A held segmented pill lifts under the finger. */
export const glidePickUp = () => fire(Haptics.AndroidHaptics.Drag_Start, lightImpact);

/** A glided segmented pill lands on its option. */
export const glideSnap = () => fire(Haptics.AndroidHaptics.Gesture_End, lightImpact);

export const toggleOn = () => fire(Haptics.AndroidHaptics.Toggle_On, Haptics.selectionAsync);

export const toggleOff = () => fire(Haptics.AndroidHaptics.Toggle_Off, Haptics.selectionAsync);

export const holdCommit = () =>
  fire(Haptics.AndroidHaptics.Confirm, () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
