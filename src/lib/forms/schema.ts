import { formatDate, formatDateTime, formatTime } from '../format';
import { isEmptyValue } from './conditions';
import type { AnswerValue, FieldElement, FileAnswer, FormElement, FormSchema, GpsAnswer, Person, RenderItem } from './types';

/**
 * Schema helpers. renderTree, optionList, peopleFor and fileItems are copied
 * from the web app (resources/js/lib/forms/schema.ts); the step and display
 * helpers are the phone's own: one section per screen.
 */

export function isField(element: FormElement | undefined | null): element is FieldElement {
  return !!element && (element.kind ?? 'field') === 'field';
}

/** Sections and top-level elements interleaved by order, each section's members sorted (FormSchemaService::renderTree). */
export function renderTree(schema: Pick<FormSchema, 'groups' | 'elements'>): RenderItem[] {
  const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
  const elements = schema.elements ?? [];

  const items: (RenderItem & { order: number })[] = [
    ...(schema.groups ?? []).map((group) => ({
      kind: 'group' as const,
      order: group.order ?? 0,
      group,
      elements: elements.filter((element) => element.group_id === group.id).sort(byOrder),
    })),
    ...elements.filter((element) => !element.group_id).map((element) => ({ kind: 'element' as const, order: element.order ?? 0, element })),
  ];

  return items.sort(byOrder);
}

/** Every option a choice field offers, categories flattened. */
export function optionList(element: FieldElement): string[] {
  return (element.values ?? []).flatMap((value) =>
    typeof value === 'object' && value !== null ? (value.options ?? []).filter(Boolean) : value ? [value] : [],
  );
}

/** The options as categories; plain options come back as one unnamed category. */
export function optionGroups(element: FieldElement): { group: string; options: string[] }[] {
  const groups: { group: string; options: string[] }[] = [];
  for (const value of element.values ?? []) {
    if (typeof value === 'object' && value !== null) groups.push({ group: value.group ?? '', options: (value.options ?? []).filter(Boolean) });
    else if (value) {
      const last = groups[groups.length - 1];
      if (last && last.group === '') last.options.push(value);
      else groups.push({ group: '', options: [value] });
    }
  }
  return groups;
}

/**
 * The people a Person field offers. The form sends them with the field; an
 * older server does not, so fall back to the selected ones from the app's
 * own list (FormSchemaService::userOptionsFor).
 */
export function peopleFor(element: FieldElement, people: Person[]): Person[] {
  if (element.people?.length) return element.people;
  const ids = (element.user_ids ?? []).map(Number).filter(Boolean);
  if (element.user_source !== 'selected' || ids.length === 0) return people;
  return people.filter((person) => ids.includes(person.id));
}

/** Names for user ids, from every Person field's people (for showing Person answers). */
export function formNames(elements: FormElement[] | undefined, base: Map<number, string> = new Map()): Map<number, string> {
  const names = new Map(base);
  for (const el of elements ?? []) {
    if (isField(el)) for (const p of el.people ?? []) if (!names.has(p.id)) names.set(p.id, p.name);
  }
  return names;
}

export interface FileItem {
  url: string;
  name: string;
  /** A web link (http/https or root-relative), so it can be opened. */
  linkable: boolean;
  image: boolean;
}

/** A stored file answer as displayable items, whatever shape it was saved in. */
export function fileItems(value: unknown): FileItem[] {
  const files = (Array.isArray(value) ? value : [value]) as FileAnswer[];

  return files
    .filter((file) => file !== null && file !== undefined && file !== '')
    .map((file) => {
      const url = typeof file === 'object' ? (file.file_path ?? file.url ?? file.name ?? '') : String(file);
      const path = url.split('?')[0];
      const base = path.split('/').pop() ?? '';
      const name = typeof file === 'object' ? (file.file_name ?? file.name ?? base) : base;
      const linkable = /^(https?:\/\/|\/)/.test(url);
      return { url, name: name || 'File', linkable, image: linkable && /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(path) };
    });
}

export function isGps(value: unknown): value is GpsAnswer {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'lat' in value && 'lng' in value;
}

/* ----- one section per screen ----- */

export interface FormStep {
  /** The section id, or `top_<n>` for a run of fields outside any section. */
  id: string;
  title: string;
  elements: FormElement[];
}

/**
 * The form as screens: each section is one, and fields outside a section
 * that sit next to each other share one. Hidden elements and those the
 * filter rejects are left out, and a screen left empty is dropped.
 */
export function buildSteps(
  schema: Pick<FormSchema, 'groups' | 'elements'>,
  visible: Record<string, boolean>,
  include: (element: FormElement) => boolean = () => true,
): FormStep[] {
  const steps: FormStep[] = [];
  let loose: FormStep | null = null;

  for (const item of renderTree(schema)) {
    if (item.kind === 'group') {
      loose = null;
      const elements = item.elements.filter((el) => visible[el.id] !== false && include(el));
      if (elements.some(isField)) steps.push({ id: item.group.id, title: item.group.label || 'Details', elements });
    } else if (visible[item.element.id] !== false && include(item.element)) {
      if (!loose) {
        loose = { id: `top_${steps.length}`, title: 'Details', elements: [] };
        steps.push(loose);
      }
      loose.elements.push(item.element);
    }
  }

  // A run of loose text with no field to answer is not worth a screen.
  return steps.filter((step) => step.elements.some(isField));
}

/* ----- showing an answer ----- */

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** An answer as one line of text, in the house style ("14 Sep 2026", "1,240", "Grinder, Gasket"). */
export function displayValue(element: Pick<FieldElement, 'type'>, value: AnswerValue | undefined, people: Map<number, string> = new Map()): string {
  if (isEmptyValue(value)) return 'Not answered';
  switch (element.type) {
    case 'date':
      return formatDate(String(value)) || String(value);
    case 'time':
      return formatTime(String(value)) || String(value);
    case 'number': {
      const text = String(value).trim();
      if (!NUMERIC.test(text)) return text;
      const [whole, frac] = text.split('.');
      return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
    }
    case 'user': {
      const ids = Array.isArray(value) ? value : [value];
      return ids.map((id) => people.get(Number(id)) ?? `Person #${id}`).join(', ');
    }
    case 'gps':
      return isGps(value) ? `Stamped ${formatDateTime(value.captured_at)}` : 'Stamped';
    case 'file': {
      const n = fileItems(value).length;
      return `${n} ${n === 1 ? 'file' : 'files'}`;
    }
    default:
      return Array.isArray(value) ? value.map(String).join(', ') : String(value);
  }
}
