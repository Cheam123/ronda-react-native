import type { RiskLevel, TaskStatus } from '../api/types';
import type { Palette, TaskStatusKey, ToneName } from '../theme/tokens';
import { combineDateTime, dayDiff, formatDate, formatTime, isSameDay, parseDate, plural, relativeDay } from './format';

/** Status in words, sentence case. Colour only helps. */
export function statusLabel(status: TaskStatus | number): string {
  switch (status) {
    case 1:
      return 'New';
    case 2:
      return 'In progress';
    case 3:
      return 'Done';
    case 4:
      return 'Verified';
    case 5:
      return 'Completed';
    case 6:
      return 'Kept in view';
    case 7:
      return 'Rejected';
    case 8:
      return 'On hold';
    default:
      return 'Task';
  }
}

export function statusKey(status: TaskStatus | number): TaskStatusKey {
  switch (status) {
    case 1:
      return 'new';
    case 2:
      return 'progress';
    case 3:
      return 'done';
    case 4:
      return 'verified';
    case 5:
      return 'completed';
    case 7:
      return 'rejected';
    default:
      return 'parked';
  }
}

export function statusColors(colors: Palette, status: TaskStatus | number) {
  return colors.status[statusKey(status)];
}

export interface DueInput {
  status: TaskStatus | number;
  risk: RiskLevel;
  /** "2026-10-06 17:00:00" (due_at), or a date plus a time. */
  dueAt?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
}

export function dueMoment(t: DueInput): Date | null {
  return parseDate(t.dueAt ?? null) ?? combineDateTime(t.dueDate ?? null, t.dueTime ?? null);
}

export function toneFor(risk: RiskLevel): ToneName {
  return risk === 'overdue' ? 'critical' : risk === 'at_risk' ? 'serious' : 'neutral';
}

/**
 * The short due note on a task row.
 *   overdue       "4 days overdue" / "overdue since 2:00 PM"
 *   at risk       "5:00 PM, at risk" / "5:00 PM, not started"
 *   on track      "6:00 PM" today, "Fri 9 Oct" later
 * With `prefix`, notes that start with a time read "due 5:00 PM, …" (Today).
 */
export function dueNote(t: DueInput, { prefix = false, now = new Date() }: { prefix?: boolean; now?: Date } = {}): string {
  const due = dueMoment(t);
  if (!due) return 'no due date';
  const days = dayDiff(due, now);
  const hasTime = !!(t.dueTime || (t.dueAt && !/ 23:59:59$/.test(t.dueAt)));
  const when = isSameDay(due, now) ? (hasTime ? formatTime(due) : 'today') : days === 1 ? `tomorrow${hasTime ? `, ${formatTime(due)}` : ''}` : relativeDay(due, now);
  const lead = prefix ? `due ${when}` : when;

  if (t.risk === 'overdue') {
    if (days >= 1) return `${plural(days, 'day')} overdue`;
    return hasTime ? `overdue since ${formatTime(due)}` : 'overdue';
  }
  if (t.risk === 'at_risk') return `${lead}, ${Number(t.status) === 1 ? 'not started' : 'at risk'}`;
  return lead;
}

/** "Overdue · 4 days" style chip text for a task header. */
export function riskChip(t: DueInput, now = new Date()): string | null {
  const due = dueMoment(t);
  if (!due || t.risk === 'on_track') return null;
  if (t.risk === 'overdue') {
    const days = dayDiff(due, now);
    return days >= 1 ? `Overdue · ${plural(days, 'day')}` : 'Overdue';
  }
  return 'At risk';
}

/** "2 Oct 2026, 5:00 PM", without a time when the task has none. */
export function formatDue(t: DueInput): string {
  const due = dueMoment(t);
  if (!due) return 'No due date';
  const hasTime = !!t.dueTime && !/^23:59/.test(t.dueTime);
  return hasTime ? `${formatDate(due)}, ${formatTime(due)}` : formatDate(due);
}

/** Today, Tomorrow or a date, plus a time ("Today, 10:00 AM"). */
export function friendlyDateTime(value: string | null | undefined, now = new Date()): string {
  const d = parseDate(value ?? null);
  if (!d) return '';
  const day = relativeDay(d, now);
  const label = day === 'today' ? 'Today' : day === 'tomorrow' ? 'Tomorrow' : day === 'yesterday' ? 'Yesterday' : day;
  return `${label}, ${formatTime(d)}`;
}

export type GroupKey = 'overdue' | 'today' | 'later';

/** Which group an open task sits in on the Tasks tab. */
export function groupFor(t: DueInput, now = new Date()): GroupKey {
  if (t.risk === 'overdue') return 'overdue';
  const due = dueMoment(t);
  if (due && isSameDay(due, now)) return 'today';
  return 'later';
}

/** "done today, 9:10 AM", "done yesterday", "done Fri 9 Oct" (the manager's To check list). */
export function doneNote(doneDate: string | null | undefined, now = new Date()): string {
  const d = parseDate(doneDate ?? null);
  if (!d) return 'done';
  const day = relativeDay(d, now);
  return day === 'today' ? `done today, ${formatTime(d)}` : `done ${day}`;
}
