import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { updatePushToken } from '../api/auth';

/**
 * Push notifications. The server sends through Firebase Cloud Messaging, so
 * the phone's device token (an FCM token on Android) goes to updateFCMToken.
 * Getting that token needs the Firebase app config (google-services.json);
 * without it the app works as before and Focus alerts still list everything.
 */

const ASKED_KEY = 'ronda.pushAsked';
export const ALERTS_CHANNEL = 'alerts';

// A push that arrives while Ronda is open shows as a banner, quietly.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushState = 'on' | 'off' | 'not-set-up';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL, {
    name: 'Focus alerts',
    description: 'At-risk tasks, messages and forms waiting for you',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#0D729E',
  });
}

/**
 * Turn push on after sign-in. Asks for permission once only (never again
 * after a "Don't allow"); after that, Me → Notifications opens the settings.
 */
export async function setUpPush({ ask }: { ask: boolean }): Promise<PushState> {
  try {
    await ensureChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask && !(await AsyncStorage.getItem(ASKED_KEY).catch(() => null))) {
      await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'off';
    const token = await Notifications.getDevicePushTokenAsync();
    await updatePushToken(String(token.data));
    return 'on';
  } catch {
    // No Firebase config yet, or no network: Focus alerts still work.
    return 'not-set-up';
  }
}

/** Is push allowed for Ronda right now? (Me → Notifications.) */
export async function pushAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Me → Notifications. Off and Android still lets us ask: ask. Otherwise open
 * Ronda's settings, where it can be turned on or off.
 */
export async function askForPush(): Promise<PushState> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted' && current.canAskAgain) {
    await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
    const next = await Notifications.requestPermissionsAsync();
    return next.status === 'granted' ? setUpPush({ ask: false }) : 'off';
  }
  await Linking.openSettings();
  return current.status === 'granted' ? 'on' : 'off';
}
