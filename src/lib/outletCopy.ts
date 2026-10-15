import type { OutletRow } from '../api/outlets';
import type { ToneName } from '../theme/tokens';
import { formatShortDay, parseDate, plural, relativeDay } from './format';

/** The outlet's own name: the shop name when there is one, else the company. */
export function outletName(o: { business_name?: string | null; name?: string | null } | null | undefined): string {
  return (o?.business_name || o?.name || 'Outlet').trim();
}

/** The company name, when it differs from the shop name. */
export function outletCompany(o: { business_name?: string | null; name?: string | null }): string | null {
  return o.business_name && o.name && o.name !== o.business_name ? o.name : null;
}

export function kindLabel(kind: 'customer' | 'prospect'): string {
  return kind === 'customer' ? 'Customer' : 'Prospect';
}

/** "visited 28 Sep", "visited today", "not visited yet". */
export function visitedLabel(lastVisitAt: string | null): string {
  if (!lastVisitAt) return 'not visited yet';
  const day = relativeDay(lastVisitAt);
  return `visited ${day}`;
}

export interface OutletTag {
  text: string;
  tone: ToneName;
}

/** The open-work tags on an outlet row, most urgent first. */
export function outletTags(o: OutletRow): OutletTag[] {
  const tags: OutletTag[] = [];
  if (o.overdue) tags.push({ text: `${o.overdue} overdue`, tone: 'critical' });
  if (o.at_risk) tags.push({ text: `${o.at_risk} at risk`, tone: 'serious' });
  if (o.due_today && !o.overdue && !o.at_risk) tags.push({ text: `${o.due_today} due today`, tone: 'brand' });
  const calm = o.open_tasks - o.overdue - o.at_risk - (o.overdue || o.at_risk ? 0 : o.due_today);
  if (calm > 0 && tags.length === 0) {
    const next = parseDate(o.next_due_at);
    tags.push({ text: `${plural(calm, 'task')}${next ? `, due ${formatShortDay(next).split(' ')[0]}` : ''}`, tone: 'neutral' });
  }
  if (o.suggested_count) tags.push({ text: `${o.suggested_count} suggested`, tone: 'suggest' });
  return tags;
}
