import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { alertKeys } from '../api/alerts';
import { useAuth } from '../auth/AuthProvider';
import { openTarget } from '../lib/openTarget';
import { setUpPush } from '../lib/push';
import { navigationRef } from './ref';

/**
 * Signed in: turn push on (asking once), keep Focus alerts fresh when a push
 * lands, and open what a tapped notification is about. Renders nothing.
 */
export function PushRouting({ navigationReady }: { navigationReady: boolean }) {
  const { status, needsLocationIntro } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = status === 'signedIn' && !needsLocationIntro;

  // After the location question, never on top of it.
  useEffect(() => {
    if (signedIn) setUpPush({ ask: true });
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !navigationReady) return;

    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = (response.notification.request.content.data ?? {}) as { type?: string; id?: string | number };
      queryClient.invalidateQueries({ queryKey: alertKeys.list });
      if (!openTarget(data.type, data.id) && navigationRef.isReady()) navigationRef.navigate('Alerts');
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };

    // Opened from a notification while Ronda was closed.
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});

    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: alertKeys.list });
    });
    return () => {
      tapped.remove();
      received.remove();
    };
  }, [signedIn, navigationReady, queryClient]);

  return null;
}
