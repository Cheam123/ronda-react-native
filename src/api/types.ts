/** Shapes the mobile API returns. Field names follow the backend exactly. */

/** User::ABILITIES, resolved for the signed-in user. */
export interface Abilities {
  dashboard: boolean;
  view_lead: boolean;
  create_lead: boolean;
  edit_lead: boolean;
  manage_task: boolean;
  add_task: boolean;
  create_task: boolean;
  ife_report: boolean;
  manage_ife_report: boolean;
  manage_user: boolean;
  form_creation: boolean;
  form_admin: boolean;
  manage_product: boolean;
  manage_area: boolean;
  record_order: boolean;
  manage_order: boolean;
  can_assign_subscribers?: boolean;
}

/** 0 Admin, 1 Manager, 2 Field Rep. */
export type UserType = 0 | 1 | 2;

export interface User {
  id: number;
  name: string;
  username?: string | null;
  email: string;
  mobile?: string | null;
  type: UserType;
  status?: number;
  enable_notification?: number | boolean | null;
  total_active_task?: number;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface VersionInfo {
  life_version: string | null;
  min_version: string | null;
}

/** Task statuses (Tasks::getTaskStatus). */
export const TASK_STATUS = {
  NEW: 1,
  IN_PROGRESS: 2,
  DONE: 3,
  VERIFIED: 4,
  COMPLETED: 5,
  KIV: 6,
  REJECTED: 7,
  ON_HOLD: 8,
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export type RiskLevel = 'on_track' | 'at_risk' | 'overdue';

/** Tasks::actionFlagsFor, the single source of truth for what the user may do. */
export interface TaskActionFlags {
  can_accept_task: boolean;
  can_hold_task: boolean;
  can_done_task: boolean;
  can_verify_task: boolean;
  can_fallback_task: boolean;
  can_complete_task: boolean;
  can_reject_task: boolean;
  can_kiv_task: boolean;
}
