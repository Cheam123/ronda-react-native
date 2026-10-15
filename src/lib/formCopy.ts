import type { ApprovalRow, FormTurn, ProcessSummaryNode, RecordRow, RecordStatus } from '../api/forms';
import type { Palette } from '../theme/tokens';
import { formatDayMonth, keepTogether, relativeDay } from './format';

/** Words and colours for forms and records, in the brand voice. */

export interface StatusLook {
  label: string;
  ink: string;
  bg: string;
  dot: string;
}

/** The pill on a record: In review, Your turn, Approved, Rejected, Cancelled, Closed. */
export function recordLook(status: RecordStatus, colors: Palette, yourTurn = false): StatusLook {
  if (status === 'pending' && yourTurn) return { label: 'Your turn', ...tone(colors, 'brand') };
  switch (status) {
    case 'pending':
      return { label: 'In review', ink: colors.status.new.ink, bg: colors.status.new.bg, dot: colors.status.new.dot };
    case 'approved':
      return { label: 'Approved', ...tone(colors, 'good') };
    case 'rejected':
      return { label: 'Rejected', ...tone(colors, 'critical') };
    case 'cancelled':
      return { label: 'Cancelled', ...tone(colors, 'neutral') };
    default:
      return { label: 'Closed', ...tone(colors, 'neutral') };
  }
}

function tone(colors: Palette, name: 'brand' | 'good' | 'critical' | 'neutral') {
  const t = colors.tones[name];
  return { ink: t.ink, bg: t.tile, dot: t.dot };
}

/** Is the record waiting on this person? Waiting-on comes as names, so compare names. */
export function isMyTurn(row: Pick<RecordRow, 'status' | 'waiting_on'>, myName: string | null | undefined): boolean {
  return row.status === 'pending' && !!myName && row.waiting_on.includes(myName);
}

/** The short note beside the pill on My records. */
export function recordNote(row: RecordRow, myName: string | null | undefined): string {
  switch (row.status) {
    case 'pending': {
      if (isMyTurn(row, myName)) return 'Waiting on you';
      const others = row.waiting_on.filter((n) => n !== myName);
      return others.length ? `Waiting on ${listNames(others)}` : row.current_stage ? `At ${row.current_stage}` : 'In progress';
    }
    case 'approved':
      return `Approved ${relativeDay(row.updated_at)}`;
    case 'rejected':
      return `Rejected ${relativeDay(row.updated_at)}`;
    case 'cancelled':
      return 'You cancelled it';
    default:
      return `Closed ${relativeDay(row.updated_at)}`;
  }
}

/** "Mei Ling Tan", "Mei Ling Tan and Jason Lim", "Mei Ling Tan and 2 others". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

const GENERIC_FILL = /^(fill( in)?|fill-in)$/i;
const GENERIC_APPROVAL = /^approv(al|e)$/i;

/** What the person must do on a form waiting for them. */
export function turnAction(turn: Pick<FormTurn, 'stage_type' | 'stage_name'>): string {
  const name = turn.stage_name?.trim();
  if (turn.stage_type === 'fill') return name && !GENERIC_FILL.test(name) ? `Fill in your part: ${name}` : 'Fill in your part';
  return name && !GENERIC_APPROVAL.test(name) ? `Approve or reject: ${name}` : 'Approve or reject';
}

/** ["Stock return request", "from Aiman Rahman, 3 Oct"]: the form, then who sent it and when. */
export function turnParts(turn: FormTurn): string[] {
  const when = turn.submitted_at ? `, ${formatDayMonth(turn.submitted_at)}` : '';
  return [turn.form_name ?? 'Form', turn.submitted_by ? `from ${turn.submitted_by}${when}` : ''].filter(Boolean);
}

/** "Stock return request · from Aiman Rahman, 3 Oct" */
export function turnSubtitle(turn: FormTurn): string {
  return turnParts(turn).join(' · ');
}

/* ----- what happens after sending ----- */

export interface PreviewStep {
  key: string;
  title: string;
  note?: string;
  kind: 'you' | 'approval' | 'fill' | 'cc' | 'branch';
}

function stepTitle(type: string, name: string | null): string {
  const n = name?.trim();
  if (type === 'approval') return n && !GENERIC_APPROVAL.test(n) ? n : 'Someone approves it';
  if (type === 'fill') return n && !GENERIC_FILL.test(n) ? n : 'Someone adds their part';
  return n && !/^copy( to)?$/i.test(n) ? n : 'People get a copy';
}

function stepNote(type: string): string {
  if (type === 'approval') return 'Approves or rejects it';
  if (type === 'fill') return 'Adds their part';
  return 'Gets a copy';
}

/** The form's process, read out as the steps after "You fill it in". */
export function processPreview(process: ProcessSummaryNode[]): PreviewStep[] {
  const steps: PreviewStep[] = [{ key: 'you', title: 'You fill it in', note: 'Now', kind: 'you' }];
  for (const node of process) {
    if (node.type === 'branch') {
      const arms = node.branches
        .map((arm) => {
          const what = arm.steps.map((s) => stepTitle(s.type, s.name).toLowerCase()).join(', then ');
          return `${arm.name ?? 'Otherwise'}: ${what || 'nothing more'}`;
        })
        .join('. ');
      steps.push({ key: node.node_id, title: 'Then it depends on your answers', note: `${arms}.`, kind: 'branch' });
    } else {
      steps.push({ key: node.node_id, title: stepTitle(node.type, node.name), note: stepNote(node.type), kind: node.type });
    }
  }
  if (steps[1] && steps[1].kind !== 'branch') steps[1] = { ...steps[1], note: `Next · ${steps[1].note}` };
  return steps;
}

/** The send button names the first step when it is an approval. */
export function sendLabel(process: ProcessSummaryNode[]): string {
  const first = process[0];
  if (!first) return 'Send';
  if (first.type === 'approval') return 'Send for approval';
  return 'Send';
}

/* ----- where a record is ----- */

export interface TrailStep {
  key: string;
  title: string;
  note: string | null;
  state: 'done' | 'now' | 'later' | 'stopped';
  remark: string | null;
}

/** A finished step, named for what happened: "Approved by Mei Ling Tan", "You filled in your part". */
function actedTitle(row: ApprovalRow, meId: number | null): string {
  const me = meId != null && row.acted_by === meId;
  const who = me ? 'you' : row.acted_by_name;
  switch (row.status) {
    case 'approved':
      return who ? `Approved by ${who}` : 'Approved';
    case 'rejected':
      return who ? `Rejected by ${who}` : 'Rejected';
    case 'completed':
      return me ? 'You filled in your part' : who ? `${who} filled in their part` : 'Their part is filled in';
    case 'notified':
      return 'Copy sent';
    case 'skipped':
      return `${stepTitle(row.node_type, row.name)}: skipped`;
    case 'cancelled':
      return `${stepTitle(row.node_type, row.name)}: cancelled`;
    default:
      return stepTitle(row.node_type, row.name);
  }
}

/** The step's own name, when the admin gave it one worth showing. */
function customName(row: ApprovalRow): string | null {
  const n = row.name?.trim();
  if (!n || GENERIC_APPROVAL.test(n) || GENERIC_FILL.test(n) || /^copy( to)?$/i.test(n)) return null;
  return n;
}

/** The step waiting now, named for who it waits on: "Jason Lim adds their part", "You approve or reject it". */
function waitingTitle(type: string, name: string | null, people: string[]): string {
  const n = name?.trim();
  const custom = type === 'approval' ? n && !GENERIC_APPROVAL.test(n) : n && !GENERIC_FILL.test(n);
  if (custom || !people.length) return stepTitle(type, name);
  const you = people.length === 1 && people[0] === 'you';
  const who = you ? 'You' : listNames(people);
  const many = you || people.length > 1;
  // The last words stay together, so "it" or "part" never sits alone on a line.
  if (type === 'approval') return `${who} ${many ? 'approve' : 'approves'} or ${keepTogether(`${many ? 'reject' : 'rejects'} it`)}`;
  return `${who} ${many ? 'add' : 'adds'} ${keepTogether(`${you ? 'your' : 'their'} part`)}`;
}

/** "Today, 2:30 PM" inside a sentence: "waiting since today, 2:30 PM". */
function midSentence(when: string): string {
  return when.replace(/^(Today|Yesterday|Tomorrow)\b/, (w) => w.toLowerCase());
}

/**
 * The record's trail for "Where it is": who sent it, then every step the
 * process has laid out so far. The first blocking step still pending is now,
 * named for who it waits on when the server says (`waitingOn`, as names).
 */
export function recordTrail(
  rows: ApprovalRow[],
  sentBy: string,
  sentAt: string | null,
  entryStatus: RecordStatus,
  formatWhen: (value: string | null) => string,
  meId: number | null = null,
  waitingOn: string[] = [],
  myName: string | null = null,
): TrailStep[] {
  const people = waitingOn.map((p) => (p === myName ? 'you' : p));
  const trail: TrailStep[] = [{ key: 'sent', title: sentBy, note: formatWhen(sentAt), state: 'done', remark: null }];
  const live = entryStatus === 'pending';
  let nowFound = false;
  let lastActedAt = sentAt;

  for (const row of rows) {
    const key = `${row.sequence}-${row.iteration}`;
    if (row.status !== 'pending') {
      const note = [customName(row), row.acted_at ? formatWhen(row.acted_at) : null].filter(Boolean).join(' · ');
      trail.push({
        key,
        title: actedTitle(row, meId),
        note: note || null,
        state: row.status === 'rejected' || row.status === 'cancelled' ? 'stopped' : 'done',
        remark: row.remark,
      });
      if (row.acted_at) lastActedAt = row.acted_at;
      continue;
    }
    const isNow = live && row.node_type !== 'cc' && !nowFound;
    if (isNow) nowFound = true;
    const plain = stepTitle(row.node_type, row.name);
    const title = isNow ? waitingTitle(row.node_type, row.name, people) : plain;
    // A step the admin named keeps its name, so who it waits on goes in the note.
    const on = isNow && people.length && title === plain ? `on ${listNames(people)} ` : '';
    trail.push({
      key,
      title,
      note: isNow ? `Waiting ${on}since ${midSentence(formatWhen(lastActedAt))}` : null,
      state: isNow ? 'now' : 'later',
      remark: null,
    });
  }
  return trail;
}
