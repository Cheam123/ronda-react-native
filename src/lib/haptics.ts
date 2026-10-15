import * as Haptics from 'expo-haptics';

/**
 * One haptic per kind of moment (the "How it feels" board):
 *   selection  tabs, segments, chips
 *   light      start a task, stamp a location, lift a preview
 *   success    mark as done, send an order or a form, approve
 *   warning    send back, reject, cancel an entry
 *   error      something could not be saved
 */
const safe = (fn: () => Promise<void>) => () => {
  fn().catch(() => {});
};

export const haptic = {
  selection: safe(() => Haptics.selectionAsync()),
  light: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
