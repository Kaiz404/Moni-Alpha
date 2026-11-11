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

/** Past this many points a drag crosses them faster than a tick can mean anything. */
const CHART_TICK_MOST_POINTS = 12;

/** A chart's point under the finger. Dense charts stay quiet. */
export const chartStep = (points: number) => {
  if (points <= CHART_TICK_MOST_POINTS) scrubStep();
};

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
