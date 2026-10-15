import { api, toFormData, type LocalFile, type Query } from './client';
import type { RiskLevel, TaskActionFlags, TaskStatus } from './types';

/** A row of GET tasks (TaskController@index), with the mobile extras. */
export interface TaskRow extends TaskActionFlags {
  id: number;
  reference: string | null;
  outlet_name: string | null;
  status_label: string;
  risk: RiskLevel;
  risk_reason: string | null;
  due_at: string | null;
  checker: string | null;
  checker_id: number | null;
  done_date: string | null;
  lead_name: string | null;
  lead_id: number | null;
  title: string;
  subscriber: string | null;
  subscriber_id: number | null;
  due_date: string | null;
  unread_notification: number;
  status: TaskStatus;
  sub_subscribers: string[];
  sub_subscriber_ids: number[];
  owners: string[];
  owner_ids: number[];
  viewers: string[];
  viewer_ids: number[];
  task_start_date: string | null;
  task_due_date: string | null;
  task_start_time: string | null;
  task_due_time: string | null;
  appointment_date_time: string | null;
  remark: string | null;
  last_follow_up: string | null;
}

export interface TaskDetail extends TaskRow {
  reference_no: string | null;
  /** The outlet's company name (lead.name); outlet_name is the shop. */
  lead: string | null;
  lead_mobile: string | null;
  reminder_at: string | null;
  done_remark: string | null;
  done_by: string | null;
  done_photos: MediaSet | null;
  /** Why the checker sent it back, while it is in progress again; only once the server sends it (proposed). */
  sent_back?: { remark: string | null; by: string | null; at: string | null } | null;
  verify_date: string | null;
  invoice_no: string | null;
  sales: string | number | null;
  creator: string | null;
}

/** Helper::media_documents_array */
export interface MediaFile {
  id: number;
  name: string;
  size: number;
  file_path: string;
  uploaded_by: string;
  created_at: string;
  file_type: string;
  mime_type: string;
}

export interface MediaSet {
  media: MediaFile[];
  documents: MediaFile[];
}

export interface TaskListResult {
  tasks: TaskRow[];
  summary: { label: string; value: number; count: number }[];
  pagination: { current_page: number; per_page: number; total: number; last_page: number };
}

export type TaskFocus = 'overdue' | 'at_risk' | 'urgent' | 'due_today' | 'to_check' | 'parked';

export interface TaskListParams extends Query {
  status?: number | string;
  focus?: TaskFocus;
  search?: string;
  lead_id?: number;
  subscriber?: number;
  area?: number;
  per_page?: number;
  page?: number;
  sortBy?: string;
  sortMode?: 'asc' | 'desc';
}

export const taskKeys = {
  all: ['tasks'] as const,
  list: (params: TaskListParams) => ['tasks', 'list', params] as const,
  detail: (id: number) => ['tasks', 'detail', id] as const,
  chat: (id: number) => ['tasks', 'chat', id] as const,
  media: (id: number) => ['tasks', 'media', id] as const,
};

export async function fetchTasks(params: TaskListParams): Promise<TaskListResult> {
  const body = await api.get<TaskListResult>('tasks', { per_page: 100, ...params });
  return { tasks: body.tasks ?? [], summary: body.summary ?? [], pagination: body.pagination };
}

export async function fetchTask(id: number): Promise<TaskDetail> {
  const body = await api.get<{ data: TaskDetail }>('tasks/get', { taskID: id });
  return body.data;
}

export async function fetchTaskMedia(id: number): Promise<MediaSet> {
  const body = await api.get<{ data: MediaSet }>('tasks/media', { taskID: id });
  return body.data ?? { media: [], documents: [] };
}

/** Status changes. The keys are always sent: the server reads them unchecked. */
export const taskActions = {
  start: (id: number) => api.post('tasks/markAsInProgress', { task_id: id, special_remark: null }),
  done: (id: number, input: { remark?: string | null; invoiceNo?: string | null; sales?: string | null; photos?: LocalFile[] } = {}) => {
    const fields = {
      task_id: id,
      special_remark: input.remark ?? null,
      invoice_no: input.invoiceNo ?? null,
      sales_amt: input.sales ?? null,
    };
    if (input.photos?.length) return api.post('tasks/markAsDone', toFormData({ ...fields, files: input.photos }), 90);
    return api.post('tasks/markAsDone', fields);
  },
  keepInView: (id: number, remark?: string | null) => api.post('tasks/markAsKIV', { task_id: id, special_remark: remark ?? null }),
  hold: (id: number, remark?: string | null) => api.post('tasks/markAsOnHold', { task_id: id, special_remark: remark ?? null }),
  verify: (id: number, remark?: string | null) => api.post('tasks/markAsVerified', { task_id: id, special_remark: remark ?? null }),
  sendBack: (id: number, reason: string) => api.post('tasks/markAsFallback', { task_id: id, special_remark: reason }),
  complete: (id: number, remark?: string | null) => api.post('tasks/markAsCompleted', { task_id: id, special_remark: remark ?? null }),
  reject: (id: number, reason: string) => api.post('tasks/markAsRejected', { task_id: id, special_remark: reason }),
};

/* ----- messages ----- */

export interface ChatDoc {
  name: string;
  time: string;
  chatid: number;
  docid: number;
  fullpath: string;
  isChatAudio: boolean;
  isChatImage: boolean;
  isChatPdf: boolean;
}

export interface NewTask {
  title: string;
  leadId: number;
  /** Who does it. */
  subscriber: number;
  owners: number[];
  viewers?: number[];
  subSubscribers?: number[];
  /** "2026-10-09" and "17:00:00". */
  dueDate: string;
  dueTime: string;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  remark?: string | null;
  /** Made from this visit report: the server links the two. */
  reportId?: number | null;
}

/** Add a task (tasks/create). It starts now. Returns the new task's id. */
export async function createTask(input: NewTask): Promise<number | null> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const body = await api.post<{ data?: { id?: number } }>('tasks/create', {
    title: input.title.trim(),
    lead_id: input.leadId,
    subscriber: input.subscriber,
    owner: input.owners,
    viewer: input.viewers ?? [],
    sub_subscriber: input.subSubscribers ?? [],
    task_start_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    task_start_time: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
    task_due_date: input.dueDate,
    task_due_time: input.dueTime,
    task_appointment_date: input.appointmentDate ?? null,
    task_appointment_time: input.appointmentTime ?? null,
    remark: input.remark?.trim() || null,
    ife_report_id: input.reportId ?? null,
  });
  return body.data?.id ?? null;
}
