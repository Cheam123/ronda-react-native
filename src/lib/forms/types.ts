/**
 * The form module's JSON shapes, copied from the web app
 * (ronda-web-react/resources/js/types/forms.ts). See FormSchemaService and
 * FormProcessService on the server for the other side of each.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'multi-choice'
  | 'multi-select'
  | 'checkbox'
  | 'file'
  | 'user'
  | 'gps';

export type ConditionOperator = 'equals' | 'not_equals' | 'includes' | 'not_includes' | 'gt' | 'lt' | 'is_empty' | 'is_not_empty';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: string | null;
}

/** Conditions in a group are AND'd; groups are OR'd. Null means "always". */
export interface ConditionSchema {
  logic?: 'or';
  groups: { logic?: 'and'; conditions: Condition[] }[];
}

/** A categorised option list (multi-select). */
export interface OptionCategory {
  group: string;
  options: string[];
}

export interface FieldElement {
  id: string;
  kind: 'field';
  type: FieldType;
  label: string;
  placeholder?: string | null;
  mandatory: boolean;
  /** Options: strings, or categories for multi-select. */
  values: (string | OptionCategory)[];
  min?: number | string | null;
  max?: number | string | null;
  /** Date fields: earliest allowed = today + N days. */
  min_days?: number | null;
  group_id: string | null;
  order?: number;
  visible_when: ConditionSchema | null;
  user_source?: 'all' | 'selected' | null;
  user_ids?: number[];
  capture_mode?: 'auto' | 'manual' | null;
  text?: string;
  /** Person fields: their people, sent by the mobile API (the same rule the server checks). Deactivated ones have active false. */
  people?: Person[];
}

export interface DescriptionElement {
  id: string;
  kind: 'description';
  type?: string;
  text: string;
  label?: string;
  group_id: string | null;
  order?: number;
  visible_when: ConditionSchema | null;
}

export type FormElement = FieldElement | DescriptionElement;

export interface FormSection {
  id: string;
  label: string;
  order?: number;
  visible_when: ConditionSchema | null;
}

export interface FormSchema {
  schema_version: 2;
  groups: FormSection[];
  elements: FormElement[];
}

export type RenderItem = { kind: 'group'; group: FormSection; elements: FormElement[] } | { kind: 'element'; element: FormElement };

export interface Person {
  id: number;
  name: string;
  /** False for a deactivated person: named in past answers, not offered in a picker. */
  active?: boolean;
}

export interface GpsAnswer {
  lat: number;
  lng: number;
  accuracy: number | null;
  captured_at: string;
}

/** A stored file answer; older answers use url/name, newer file_path/file_name. */
export type FileAnswer = string | { file_path?: string; url?: string; name?: string; file_name?: string };

export type AnswerValue = string | number | string[] | GpsAnswer | FileAnswer[] | null;

/** element id -> answer */
export type Answers = Record<string, AnswerValue>;
