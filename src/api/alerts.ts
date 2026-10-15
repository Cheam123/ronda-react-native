import { api } from './client';

/** Focus alerts: every push the server sent, saved (backend AlertInbox). */

/** What a tap opens. The server's push data uses the same words. */
export type AlertTarget = 'task' | 'chat' | 'lead' | 'formtask' | 'formentry' | 'test';

export interface Alert {
  id: string;
  title: string;
  body: string;
  type: AlertTarget | null;
  target_id: string | null;
  read: boolean;
  created_at: string | null;
}

export interface AlertList {
  alerts: Alert[];
  unread: number;
}

/**
 * Task and outlet pushes keep the old system's titles ("Sales Task Fallback",
 * "Sales Task KIV"). The inbox says them in plain words. Everyone on the task
 * gets the same alert, including whoever acted, so none says "you".
 */
const PLAIN_TITLES: Record<string, string> = {
  'New Sales Task': 'New task',
  'Sales Task Accepted': 'Task started',
  'Sales Task Done': 'Task done',
  'Sales Task Verified': 'Task verified',
  'Sales Task Completed': 'Task completed',
  'Sales Task KIV': 'Task kept in view',
  'Sales Task Rejected': 'Task rejected',
  'Sales Task Fallback': 'Task sent back',
  'Sales Task Detail Updated': 'Task changed',
  'Sales Task Deleted': 'Task deleted',
  'Sales Task Rating': 'Task rated',
  'New Lead': 'New outlet',
};

export function plainTitle(title: string): string {
  return PLAIN_TITLES[title.trim()] ?? title;
}

export const alertKeys = {
  list: ['alerts'] as const,
};

export async function fetchAlerts(): Promise<AlertList> {
  const body = await api.get<AlertList>('alerts', { per_page: 100 });
  return { alerts: (body.alerts ?? []).map((a) => ({ ...a, title: plainTitle(a.title) })), unread: body.unread ?? 0 };
}

/** Mark some alerts read, or all of them. Returns how many are still unread. */
export async function markAlertsRead(ids: string[] | 'all'): Promise<number> {
  const body = await api.post<{ unread: number }>('alerts/read', ids === 'all' ? { all: true } : { ids });
  return body.unread ?? 0;
}
