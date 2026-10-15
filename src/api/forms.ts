import type { AnswerValue, Answers, FormElement, FormSection, Person } from '../lib/forms/types';
import { api, isApiError, toFormData, uploadable, type LocalFile } from './client';
import type { MediaSet } from './tasks';

/**
 * Forms on the phone: Start, My records and Your turn (approvals and fill
 * steps). Building forms stays on the web. Every endpoint answers with
 * response_ok, so data sits at the top level. Its `status` key is always
 * "ok", which is why nothing here reads a status from an action's reply.
 */

export interface GroupRef {
  id: number;
  name: string;
}

export interface FormListItem {
  id: number;
  name: string;
  description: string | null;
  number_of_elements: number;
  /** The category the form is filed under; null files it last. */
  group: GroupRef | null;
}

export type StepType = 'approval' | 'fill' | 'cc';

export type ProcessSummaryNode =
  | { node_id: string; type: StepType; name: string | null }
  | { node_id: string; type: 'branch'; branches: { id: string; name: string | null; steps: { node_id: string; type: StepType; name: string | null }[] }[] };

export interface FormDefinition {
  id: number;
  name: string;
  description: string | null;
  group: GroupRef | null;
  /** Field sections, not the category above. */
  groups: FormSection[];
  elements: FormElement[];
  process: ProcessSummaryNode[];
  /** Fields a later fill step owns: the person starting the form never sees them. */
  deferred_element_ids: string[];
  can_submit?: boolean;
}

/** A form step waiting on the caller (forms/tasks). */
export interface FormTurn {
  entry_id: number;
  record_id: number;
  record_title: string;
  reference: string;
  form_id: number;
  form_name: string | null;
  group: GroupRef | null;
  submitted_by: string | null;
  submitted_at: string | null;
  stage_name: string | null;
  stage_type: 'approval' | 'fill' | null;
}

export type RecordStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'closed';

export interface CaseRef {
  id: number;
  reference: string;
  title: string;
  status?: string;
}

export interface RecordRow {
  id: number;
  reference: string;
  title: string;
  form_id: number;
  form_name: string | null;
  group: GroupRef | null;
  record_status: string | null;
  /** "closed" once the record is closed, whatever the entry did. */
  status: RecordStatus;
  entry_status: RecordStatus;
  current_stage: string | null;
  waiting_on: string[];
  opened_by: string | null;
  opened_at: string | null;
  updated_at: string | null;
  parent: CaseRef | null;
}

export interface RecordDetail {
  id: number;
  reference: string;
  title: string;
  form_id: number;
  form_name: string | null;
  group: GroupRef | null;
  record_status: string | null;
  closed: { remark: string | null; closed_by: string | null; closed_at: string | null } | null;
  opened_by: string | null;
  opened_at: string | null;
  can_follow_up: boolean;
  can_close: boolean;
  /** Names of who the open step waits on; only once the server sends it (proposed). */
  waiting_on?: string[];
  parent: CaseRef | null;
  children: (CaseRef & { submitted_by: string | null; submitted_at: string | null; current_stage: string | null })[];
}

/** One answer in a stored snapshot, with the schema's options grafted on. */
export interface AnswerRow {
  id: string;
  type: string;
  label: string;
  value: AnswerValue;
  hidden?: boolean;
  /** A Person answer's name (the value is the user id). */
  value_label?: string | null;
  values?: (string | { group: string; options: string[] })[];
  mandatory?: boolean;
}

export interface ApprovalRow {
  sequence: number;
  iteration: number;
  node_id: string | null;
  node_type: 'approval' | 'fill' | 'cc';
  name: string | null;
  approval_mode: string | null;
  /** pending, approved, rejected, completed, notified, skipped, cancelled … */
  status: string;
  acted_by: number | null;
  acted_by_name: string | null;
  acted_at: string | null;
  remark: string | null;
}

export interface PreviousRound {
  iteration: number;
  stage?: string | null;
  acted_by_name?: string | null;
  acted_at?: string | null;
  answers?: { id: string; label: string; value: AnswerValue }[];
}

export interface Entry {
  id: number;
  form_id: number;
  form_name: string | null;
  record_reference: string;
  record_title: string;
  record_status: string | null;
  status: RecordStatus;
  submitted_at: string | null;
  submitted_by: number;
  submitted_by_name: string | null;
  rejected_by_name: string | null;
  rejected_remark: string | null;
  form_elements: AnswerRow[];
  approvals: ApprovalRow[];
  current_stage: string | null;
  process_complete: boolean;
  field_permissions: Record<string, 'edit' | 'read' | 'hidden'>;
  /** Attachments by the field they answer. */
  attachments: Record<string, MediaSet>;
  can_act: boolean;
  can_edit: boolean;
  stage_type: 'approval' | 'fill' | null;
  editable_element_ids: string[];
  previous_rounds: PreviousRound[];
  /** The last answer per field the caller fills in again: a hint, never a pre-fill. */
  previous_answers: Record<string, AnswerValue>;
}

export interface ParentOption {
  id: number;
  reference: string;
  title: string;
  status: string;
  record_status: string | null;
  opened_by: string | null;
  opened_at: string | null;
  follow_up_count: number;
}

export const formKeys = {
  all: ['forms'] as const,
  list: (search: string) => ['forms', 'list', search] as const,
  form: (id: number) => ['forms', 'form', id] as const,
  turns: ['forms', 'turns'] as const,
  records: ['forms', 'records'] as const,
  record: (id: number) => ['forms', 'record', id] as const,
  entry: (id: number) => ['forms', 'entry', id] as const,
  parents: (formId: number, search: string) => ['forms', 'parents', formId, search] as const,
  people: ['forms', 'people'] as const,
};

export async function fetchForms(search = ''): Promise<{ forms: FormListItem[]; form_groups: GroupRef[] }> {
  const body = await api.get<{ forms: FormListItem[]; form_groups: GroupRef[] }>('forms', { search });
  return { forms: body.forms ?? [], form_groups: body.form_groups ?? [] };
}

export async function fetchForm(id: number): Promise<FormDefinition> {
  const body = await api.get<{ form: FormDefinition }>(`forms/${id}`);
  return body.form;
}

export async function fetchParents(formId: number, search = ''): Promise<ParentOption[]> {
  const body = await api.get<{ parents: ParentOption[] }>(`forms/${formId}/parents`, { search, limit: 50 });
  return body.parents ?? [];
}

export async function fetchFormTurns(): Promise<FormTurn[]> {
  const body = await api.get<{ tasks: FormTurn[] }>('forms/tasks');
  return body.tasks ?? [];
}

export async function fetchRecords(): Promise<RecordRow[]> {
  const body = await api.get<{ records: RecordRow[] }>('forms/records');
  return body.records ?? [];
}

export async function fetchRecord(id: number): Promise<RecordDetail> {
  const body = await api.get<{ record: RecordDetail }>(`forms/records/${id}`);
  return body.record;
}

export async function fetchEntry(id: number): Promise<Entry> {
  const body = await api.get<{ entry: Entry }>(`forms/entries/${id}`);
  return body.entry;
}

/** Everyone a Person field can offer. The server checks the pick again. */
export async function fetchPeople(): Promise<Person[]> {
  const body = await api.get<{ users?: { value: number | string; label: string }[] }>('tasks/filterOptions');
  return (body.users ?? []).map((u) => ({ id: Number(u.value), name: u.label }));
}

/* ----- sending answers ----- */

export interface AnswerPayload {
  answers: Answers;
  /** New photos by the field they answer: sent as files[el_id][]. */
  files?: Record<string, LocalFile[]>;
  /** The person picked for a step whose handler is chosen as it starts. */
  assigneeIds?: number[];
}

function answerBody({ answers, files = {}, assigneeIds = [] }: AnswerPayload, extra: Record<string, unknown> = {}) {
  const formData = Object.entries(answers).map(([id, value]) => ({ id, value }));
  const withFiles = Object.values(files).some((list) => list.length > 0);
  if (!withFiles) return { multipart: false, body: { form_data: formData, next_assignee_ids: assigneeIds, ...extra } };

  const form = toFormData({ ...extra, form_data: JSON.stringify(formData), next_assignee_ids: assigneeIds });
  for (const [elementId, list] of Object.entries(files)) {
    list.forEach((file) => form.append(`files[${elementId}][]`, uploadable(file)));
  }
  return { multipart: true, body: form };
}

export interface SentEntry {
  entry_id: number;
  record_id: number;
}

export async function submitForm(formId: number, payload: AnswerPayload & { recordTitle?: string; parentId?: number | null }): Promise<SentEntry> {
  const { multipart, body } = answerBody(payload, {
    record_title: payload.recordTitle?.trim() || undefined,
    parent_submission_id: payload.parentId ?? undefined,
  });
  return api.post<SentEntry>(`forms/${formId}/submit`, body, multipart ? 120 : 30);
}

/** Change answers no one has acted on yet. Files go as POST + _method, since PHP cannot read a multipart PUT. */
export async function updateEntry(entryId: number, payload: AnswerPayload): Promise<SentEntry> {
  const { multipart, body } = answerBody(payload, {});
  if (multipart) {
    (body as FormData).append('_method', 'PUT');
    return api.post<SentEntry>(`forms/entries/${entryId}`, body, 120);
  }
  return api.put<SentEntry>(`forms/entries/${entryId}`, body);
}

export async function fillStage(entryId: number, payload: AnswerPayload): Promise<SentEntry> {
  const { multipart, body } = answerBody(payload, {});
  return api.post<SentEntry>(`forms/tasks/${entryId}/fill`, body, multipart ? 120 : 30);
}

export async function approveEntry(entryId: number, remark: string | null, assigneeIds: number[] = []): Promise<void> {
  await api.post(`forms/tasks/${entryId}/approve`, { remark: remark?.trim() || null, next_assignee_ids: assigneeIds });
}

export async function rejectEntry(entryId: number, remark: string): Promise<void> {
  await api.post(`forms/tasks/${entryId}/reject`, { remark: remark.trim() });
}

export async function cancelEntry(entryId: number): Promise<void> {
  await api.patch(`forms/entries/${entryId}/cancel`);
}

export async function cloneEntry(entryId: number): Promise<{ form: FormDefinition; prefill: AnswerRow[] }> {
  return api.post<{ form: FormDefinition; prefill: AnswerRow[] }>(`forms/entries/${entryId}/clone`);
}

export async function closeRecord(recordId: number, remark: string): Promise<void> {
  await api.post(`forms/records/${recordId}/close`, { remark: remark.trim() });
}

/* ----- a step that needs a person ----- */

export interface NeedsAssignee {
  name: string;
  candidates: Person[];
}

/**
 * The action started a step whose handler is picked at the time, and no pick
 * was sent. Nothing was saved: show the people and send again with the pick.
 */
export function needsAssignee(e: unknown): NeedsAssignee | null {
  if (!isApiError(e) || !e.raw || typeof e.raw !== 'object') return null;
  const raw = e.raw as { needs_assignee?: { name?: string }; candidates?: { id: number; name: string }[] };
  if (!raw.needs_assignee) return null;
  return { name: raw.needs_assignee.name ?? 'the next step', candidates: raw.candidates ?? [] };
}

/** Server validation errors keyed by element id ("el_x": "Which machine? is required."). */
export function answerErrors(e: unknown): Record<string, string> {
  if (!isApiError(e)) return {};
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(e.fieldErrors)) if (messages[0]) out[key] = messages[0];
  return out;
}
