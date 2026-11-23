import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { SPLASH_BLUE } from '../theme/tokens';
import { useUndo } from '../undo/UndoProvider';

/**
 * Over-the-air updates (expo-updates with EAS Update).
 *
 * expo-updates already asks the update server on every cold start, downloads a new update in
 * the background, and runs the newest downloaded update on the next cold start. On top of that:
 * - a check when the app comes back to the front, at most every 30 minutes, so a phone that
 *   keeps Ronda open all day still gets fixes;
 * - a message with Restart once an update has downloaded. Ronda never restarts on its own,
 *   since that would lose a half-filled visit or form. If the message is missed, the update
 *   runs the next time Ronda starts.
 *
 * expo-updates is off in development builds and Expo Go, so none of this runs there.
 */

const UPDATES_ON = !__DEV__ && Updates.isEnabled;
const CHECK_EVERY_MS = 30 * 60 * 1000;
const MESSAGE_MS = 10_000;
// When this JS started: a cold start (where expo-updates has just checked) or a restart into an update.
const STARTED_AT = Date.now();

/** Restart into the downloaded update. Splash blue covers the swap until the animated splash draws. */
export function restartIntoUpdate() {
  return Updates.reloadAsync({
    reloadScreenOptions: { backgroundColor: SPLASH_BLUE, spinner: { enabled: false }, fade: true },
  });
}

/** `canAsk`: signed in with the splash gone, so the message lands on a screen the user is using. */
export function OtaUpdates({ canAsk }: { canAsk: boolean }) {
  const { notify } = useUndo();
  const { isStartupProcedureRunning, isChecking, isDownloading, isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  // The first check of our own waits a full interval after the start.
  const lastCheck = useRef(STARTED_AT);
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!UPDATES_ON) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || isStartupProcedureRunning || isChecking || isDownloading || isUpdatePending) return;
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      (async () => {
        try {
          const result = await Updates.checkForUpdateAsync();
          // A roll back to the build's own code downloads and restarts the same way.
          if (result.isAvailable || result.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
        } catch {
          // Offline, or the update server did not answer. The next check tries again.
        }
      })();
    });
    return () => sub.remove();
  }, [isStartupProcedureRunning, isChecking, isDownloading, isUpdatePending]);

  // One message per downloaded update. A roll back has no update ID, so it goes by its time.
  const pending = isUpdatePending && downloadedUpdate ? (downloadedUpdate.updateId || `rollback-${downloadedUpdate.createdAt.getTime()}`) : null;

  useEffect(() => {
    if (!UPDATES_ON || !canAsk || !pending || askedFor.current === pending) return;
    askedFor.current = pending;
    notify('A new version of Ronda is ready.', 'info', {
      ms: MESSAGE_MS,
      action: {
        label: 'Restart',
        accessibilityLabel: 'Restart Ronda',
        accessibilityHint: 'Opens the new version. Anything you have not saved will be lost.',
        onPress: () => {
          restartIntoUpdate().catch(() => notify('Ronda could not restart. Close and open the app to get the new version.', 'error', { ms: 6000 }));
        },
      },
    });
  }, [canAsk, pending, notify]);

  return null;
}
