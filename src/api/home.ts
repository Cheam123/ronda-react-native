import { api } from './client';
import type { Abilities, RiskLevel, TaskStatus } from './types';

/** A task row in the day view (HomeController::dayAtAGlance). */
export interface DayTask {
  id: number;
  reference: string | null;
  title: string;
  lead_id: number | null;
  lead_name: string | null;
  status: TaskStatus;
  status_label: string;
  due_date: string | null;
  due_time: string | null;
  appointment_at: string | null;
  risk: RiskLevel;
  risk_reason: string | null;
}

export interface PlannedVisit {
  ife_report_id: number;
  lead_id: number | null;
  outlet: string | null;
  plan: string | null;
  location: string | null;
}

export interface FormStep {
  entry_id: number;
  record_title: string | null;
  reference: string | null;
  form_name: string | null;
  stage_name: string | null;
  stage_type: 'fill' | 'approval' | 'cc' | null;
  submitted_at: string | null;
}

export interface SuggestionsSummary {
  outlets: {
    lead_id: number;
    name: string | null;
    products: string[];
    product_count: number;
    gap_count: number;
    estimated_monthly_value: number;
  }[];
  total: number;
  estimated_monthly_value: number;
  currency: string;
}

export interface DayAtAGlance {
  date: string;
  counts: {
    tasks_due: number;
    appointments: number;
    visits_planned: number;
    form_steps: number;
    /** Overdue included. */
    at_risk: number;
    overdue: number;
  };
  tasks_due: DayTask[];
  appointments: DayTask[];
  visits_planned: PlannedVisit[];
  form_steps: FormStep[];
  overdue: DayTask[];
  at_risk: DayTask[];
  suggestions: SuggestionsSummary | null;
}

export interface HomeSummary {
  listOfPermissions: Abilities;
  today: DayAtAGlance;
}

export const homeKey = ['home'] as const;

export async function fetchHome(): Promise<HomeSummary> {
  const body = await api.get<HomeSummary>('home');
  return { listOfPermissions: body.listOfPermissions, today: body.today };
}
