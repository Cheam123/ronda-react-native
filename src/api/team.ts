import { api } from './client';

/**
 * The manager's Team tab: DashboardService::summary() as the web's team
 * dashboard shows it, the latest Morning Round-Up, and what waits in Review.
 */

/** An overdue or at-risk task in the summary's attention lists. */
export interface AttentionItem {
  id: number;
  reference: string | null;
  title: string;
  lead: string | null;
  subscriber: string | null;
  status: string;
  level: 'overdue' | 'at_risk';
  reason: string | null;
  due_at: string | null;
  due_label: string;
}

export interface TeamPerson {
  user_id: number;
  name: string;
  role: string;
  open: number;
  overdue: number;
  at_risk: number;
  done_7d: number;
  visits_7d: number;
  forms_7d: number;
  orders_7d: number;
  /** Their two most urgent tasks. */
  urgent: AttentionItem[];
}

export interface DashboardSummary {
  scope: 'team' | 'personal';
  generated_at: string;
  tasks: { open: number; new: number; in_progress: number; overdue: number; at_risk: number; due_today: number; created_7d: number; done_7d: number; completed_7d: number };
  forms: { submitted_7d: number; pending: number; approved: number; rejected: number };
  visits: { last_7d: number; today: number; daily: { date: string; count: number; label: string }[] };
  orders: { month_count: number; month_value: number; last_7d: number; change_pct: number | null };
  attention: AttentionItem[];
  trend: { date: string; created: number; done: number; label: string }[];
  team: TeamPerson[];
}

export interface Digest {
  date_label: string;
  /** "bedrock" when Claude wrote it, "template" otherwise. */
  source: string;
  content: string;
  digest_date: string | null;
  written_at: string | null;
}

export interface Team {
  summary: DashboardSummary;
  digest: Digest | null;
  review: { forms: number; visits: number };
}

export interface PersonView {
  person: { id: number; name: string; email: string | null; mobile: string | null; role: string };
  summary: DashboardSummary;
}

export const teamKeys = {
  team: ['team'] as const,
  person: (id: number) => ['team', 'person', id] as const,
};

export async function fetchTeam(): Promise<Team> {
  return api.get<Team>('team');
}

export async function fetchPerson(userId: number): Promise<PersonView> {
  return api.get<PersonView>('team/person', { userID: userId });
}

/** The Round-Up's sections ("Summary:", "Focus alerts:", …) as titled blocks of lines. */
export function digestSections(content: string): { title: string; lines: string[] }[] {
  const sections: { title: string; lines: string[] }[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^([A-Z][A-Za-z ]{1,40}):$/.exec(line);
    if (heading) sections.push({ title: heading[1], lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line.replace(/^[-•]\s*/, ''));
    else sections.push({ title: 'Summary', lines: [line] });
  }
  return sections;
}
