import type { AlertTarget } from '../api/alerts';
import { navigationRef } from '../navigation/ref';

/**
 * Open what an alert or a push is about. The server's push data says what
 * (task, chat, lead, formtask, formentry) and its id. Returns false when
 * there is nothing to open (a test push, a deleted task), so the caller can
 * fall back to Focus alerts.
 */
export function openTarget(type: AlertTarget | string | null | undefined, id: string | number | null | undefined): boolean {
  const n = Number(id);
  if (!navigationRef.isReady() || !Number.isFinite(n) || n <= 0) return false;
  switch (type) {
    case 'task':
      navigationRef.navigate('Task', { id: n });
      return true;
    case 'chat':
      navigationRef.navigate('TaskMessages', { id: n });
      return true;
    case 'lead':
      navigationRef.navigate('Outlet', { id: n });
      return true;
    case 'formtask':
    case 'formentry':
      navigationRef.navigate('Record', { id: n });
      return true;
    default:
      return false;
  }
}
