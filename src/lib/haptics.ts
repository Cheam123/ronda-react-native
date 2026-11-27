import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One haptic per kind of moment (the "How it feels" board):
 *   selection  tabs, segments, chips
 *   light      start a task, stamp a location, lift a preview
 *   success    mark as done, send an order or a form, approve
 *   warning    send back, reject, cancel an entry
 *   error      something could not be saved
 *
 * On Android each moment uses the phone's own haptic feedback (the crisp
 * tick system controls use, and it follows the phone's touch-feedback
 * setting), as iOS does. impactAsync and friends are a vibration motor
 * buzz there. A phone too old for a constant (Confirm and Reject need
 * Android 11) falls back to the buzz.
 */
const safe = (fn: () => Promise<void>) => () => {
  fn().catch(() => {});
};

/** Android: the system constant (then `older`, then the buzz). iOS: the Taptic Engine call. */
const native = (type: Haptics.AndroidHaptics, ios: () => Promise<void>, older?: Haptics.AndroidHaptics) => () => {
  if (Platform.OS !== 'android') return ios();
  return Haptics.performAndroidHapticsAsync(type).catch(() => (older ? Haptics.performAndroidHapticsAsync(older).catch(ios) : ios()));
};

export const haptic = {
  // Segment tick is Android 14+; older phones get the clock tick, which every Android has.
  selection: safe(native(Haptics.AndroidHaptics.Segment_Tick, () => Haptics.selectionAsync(), Haptics.AndroidHaptics.Clock_Tick)),
  light: safe(native(Haptics.AndroidHaptics.Context_Click, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))),
  success: safe(native(Haptics.AndroidHaptics.Confirm, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
  warning: safe(native(Haptics.AndroidHaptics.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))),
  error: safe(native(Haptics.AndroidHaptics.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))),
};
