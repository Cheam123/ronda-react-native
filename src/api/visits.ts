import { api, toFormData, type LocalFile } from './client';

/** A visit report as ife/list returns it (per task). */
export interface VisitReport {
  id: number;
  lead_id: number | null;
  company_name: string | null;
  shop_name: string | null;
  status: string | null;
  problem_description: string | null;
  require_support: string | null;
  support_description: string | null;
  personal_remarks: string | null;
  pic_name: string | null;
  follow_up_date: string | null;
  follow_up_plan: string | null;
  location: string | null;
  attachments: { media: { id: number; file_path: string; name: string }[]; documents: { id: number; file_path: string; name: string }[] };
}

export interface VisitInput {
  outletId: number;
  taskId?: number | null;
  /** What happened, with the problem appended when given (no migration, see the plan). */
  whatHappened: string;
  problem?: string | null;
  advice?: string | null;
  needsSupport: boolean;
  supportNeeded?: string | null;
  nextVisit: string;
  plan: string;
  /** The readable stamp text (lib/location.ts), or the outlet's address. */
  location: string;
  photos?: LocalFile[];
}

/** File a visit report (ife/create). Returns the new report's id. */
export async function logVisit(input: VisitInput): Promise<number | null> {
  const problem = input.problem?.trim();
  const fields = {
    existing_lead_id: String(input.outletId),
    ...(input.taskId ? { task_id: input.taskId } : {}),
    problem_description: problem ? `${input.whatHappened.trim()}\n\nProblem: ${problem}` : input.whatHappened.trim(),
    personal_remarks: input.advice?.trim() || null,
    support_required: input.needsSupport ? 'Yes' : 'No',
    support_description: input.needsSupport ? input.supportNeeded?.trim() || null : null,
    next_followup_date: input.nextVisit,
    next_followup_plan: input.plan.trim(),
    location: input.location.slice(0, 255),
  };
  const body = await api.post<{ id?: number }>(
    'ife/create',
    input.photos?.length ? toFormData({ ...fields, files: input.photos }) : fields,
    input.photos?.length ? 120 : 30,
  );
  return body.id ?? null;
}

export async function fetchTaskVisits(taskId: number): Promise<VisitReport[]> {
  const body = await api.get<{ data: VisitReport[] }>('ife/list', { task_id: taskId });
  return body.data ?? [];
}

/** One visit report in full (ife/get). */
export interface VisitReportDetail {
  id: number;
  lead_id: number | null;
  task_id: number | null;
  outlet: string | null;
  company_name: string | null;
  customer_status: string | null;
  created_at: string;
  created_by: string | null;
  created_by_id: number;
  created_by_mobile: string | null;
  problem_description: string | null;
  support_required: string | null;
  support_description: string | null;
  personal_remarks: string | null;
  pic_name: string | null;
  next_followup_date: string | null;
  next_followup_plan: string | null;
  location: string | null;
  attachments: { media: { id: number; file_path: string; name: string }[]; documents: { id: number; file_path: string; name: string }[] };
}

export const visitKeys = {
  detail: (id: number) => ['visits', 'detail', id] as const,
};

export async function fetchVisitReport(id: number): Promise<VisitReportDetail> {
  const body = await api.get<{ data: VisitReportDetail }>('ife/get', { id });
  return body.data;
}

/** "Yes" (any case) means the rep asked for support; older reports say "N/A". */
export const needsSupport = (value: string | null | undefined) => /^y(es)?$/i.test((value ?? '').trim());

/** Split the stored text back into what happened and the problem (see logVisit). */
export function splitWhatHappened(text: string | null | undefined): { what: string; problem: string | null } {
  const value = (text ?? '').trim();
  const at = value.lastIndexOf('\n\nProblem: ');
  if (at < 0) return { what: value, problem: null };
  return { what: value.slice(0, at).trim(), problem: value.slice(at + '\n\nProblem: '.length).trim() };
}

export interface RecentReportParams {
  /** Only reports that are not a task yet (the manager's Review tab). */
  open?: boolean;
  /** The caller's own reports. */
  mine?: boolean;
  /** One person's reports (a manager looking at a rep). */
  createdBy?: number;
  days?: number;
}

export const recentKey = (params: RecentReportParams) => ['visits', 'recent', params] as const;

/** Recent visit reports, newest first (ife/recent). */
export async function fetchRecentReports(params: RecentReportParams = {}): Promise<VisitReportDetail[]> {
  const body = await api.get<{ data: VisitReportDetail[] }>('ife/recent', {
    open: params.open ? 1 : undefined,
    mine: params.mine ? 1 : undefined,
    created_by: params.createdBy,
    days: params.days,
    per_page: 100,
  });
  return body.data ?? [];
}

/** The sales areas (IFE areas), for the manager's More filters. */
export async function fetchAreas(): Promise<{ id: number; name: string }[]> {
  const body = await api.get<{ areas?: { value: number | string; label: string }[] }>('ife/fields', { requireLeads: 'false' });
  return (body.areas ?? []).map((a) => ({ id: Number(a.value), name: a.label }));
}
