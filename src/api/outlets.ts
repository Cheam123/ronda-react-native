import { api, toFormData, type LocalFile, type Query } from './client';
import type { MediaSet } from './tasks';

/** A GPS stamp, the same shape as a form's gps answer. */
export interface GpsStamp {
  lat: number;
  lng: number;
  accuracy: number | null;
  captured_at: string;
}

/** A row of GET leads (LeadController@index), with the mobile extras. */
export interface OutletRow {
  id: number;
  /** Company name. */
  name: string;
  /** Shop name; shown as the outlet's name when present. */
  business_name: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  state: string | null;
  city: string | null;
  postcode: string | null;
  remarks: string | null;
  business_category: string | null;
  business_category_id: number | null;
  source: string | null;
  lead_source_id: number | null;
  subscriber: string | null;
  customer_id: string | null;
  kind: 'customer' | 'prospect';
  last_visit_at: string | null;
  open_tasks: number;
  overdue: number;
  at_risk: number;
  due_today: number;
  next_due_at: string | null;
  size_band: string | null;
  size_band_label: string | null;
  seats: number | null;
  segment: string | null;
  segment_label: string | null;
  /** Missing from a server older than the halal question. */
  is_halal?: boolean | null;
  /** Customer group keys the rep picked. */
  main_customers?: string[];
  /** Drink kind keys that sell best there. Missing from an older server. */
  best_selling_kinds?: string[];
  /** What the owner wants to improve, as goal keys. Missing from an older server. */
  improvement_goals?: string[];
  /** What a usual drink costs there, in RM. Null when not stated. */
  typical_drink_price?: number | null;
  /** The same needs with readable names, for showing only. Missing from an older server. */
  needs?: OutletNeeds;
  location: GpsStamp | null;
  created_at: string;
}

export interface OutletDetail extends Omit<OutletRow, 'kind' | 'last_visit_at' | 'open_tasks' | 'overdue' | 'at_risk' | 'due_today' | 'next_due_at'> {
  state_id: number | null;
  city_id: number | null;
  attachments: { id: number; name: string; file_path: string; file_type: string; size: number }[];
}

export interface OutletListResult {
  leads: OutletRow[];
  counts: { all: number; customer: number; prospect: number };
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export interface OutletListParams extends Query {
  search?: string;
  kind?: 'customer' | 'prospect';
  area?: number;
  sort?: 'open_work';
  per_page?: number;
  page?: number;
}

/** One visit (IFE report) at an outlet (LeadController@getLeadVisits). */
export interface OutletVisit {
  id: number;
  visited_at: string;
  visited_by: string | null;
  status: string | null;
  problem_description: string | null;
  support_required: string | null;
  pic_name: string | null;
  next_followup_date: string | null;
  next_followup_plan: string | null;
  task_id: number | null;
  /** The stamp text the app wrote (lib/location.ts), or a place typed on the web. */
  location: string | null;
}

export interface OrderLine {
  product_id: number;
  sku: string | null;
  product_name: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: number;
  order_no: string | null;
  order_date: string | null;
  status: string;
  total_amount: number;
  remark: string | null;
  created_by: string | null;
  lines: OrderLine[];
}

/** What the rep did with a drink idea. */
export type FeedbackStatus = 'pitched' | 'accepted' | 'declined';

/** Each drink idea's newest answer at an outlet, and why it was declined, by drink id. */
export interface RecommendationFeedback {
  drink_feedback: Record<string, FeedbackStatus>;
  drink_reasons: Record<string, string>;
}

export interface OutletTaskRow {
  id: number;
  title: string;
  subscriber: string | null;
  due_date: string | null;
  status: number;
  task_due_date: string | null;
  task_due_time: string | null;
  unread_notification: number;
}

export interface FilterOption {
  value: number | string;
  label: string;
}

export interface OutletFilterOptions {
  business_category: FilterOption[];
  lead_source: FilterOption[];
  states: FilterOption[];
  cities: (FilterOption & { state_id?: number })[];
  size_bands: FilterOption[];
  segments: FilterOption[];
  /** The 8 customer groups, for "Main customers". Missing from an older server. */
  customer_groups?: FilterOption[];
  /** The 8 kinds of drink, for "Their best-selling drinks". Missing from an older server. */
  drink_kinds?: FilterOption[];
  /** What an outlet can want to improve. Missing from an older server. */
  goals?: FilterOption[];
}

/** What the outlet needs, with readable names. */
export interface OutletNeeds {
  main_customers: string[];
  best_selling_kinds: string[];
  improvement_goals: string[];
  typical_drink_price: number | null;
}

export const outletKeys = {
  all: ['outlets'] as const,
  list: (params: OutletListParams) => ['outlets', 'list', params] as const,
  detail: (id: number) => ['outlets', 'detail', id] as const,
  visits: (id: number) => ['outlets', 'visits', id] as const,
  orders: (id: number) => ['outlets', 'orders', id] as const,
  tasks: (id: number) => ['outlets', 'tasks', id] as const,
  media: (id: number) => ['outlets', 'media', id] as const,
  options: ['outlets', 'options'] as const,
};

export async function fetchOutlets(params: OutletListParams): Promise<OutletListResult> {
  const body = await api.get<OutletListResult>('leads', { per_page: 200, sort: 'open_work', ...params });
  return { leads: body.leads ?? [], counts: body.counts, pagination: body.pagination };
}

export async function fetchOutlet(id: number): Promise<OutletDetail> {
  const body = await api.get<{ data: OutletDetail }>('leads/get', { leadID: id });
  return body.data;
}

export async function fetchOutletVisits(leadId: number): Promise<OutletVisit[]> {
  const body = await api.get<{ data: { visits: OutletVisit[] } }>('leads/visits', { lead_id: leadId });
  return body.data?.visits ?? [];
}

export async function fetchOutletOrders(leadId: number): Promise<Order[]> {
  const body = await api.get<{ data: { orders: Order[] } }>('leads/orders', { lead_id: leadId });
  return body.data?.orders ?? [];
}

export async function fetchOutletTasks(leadId: number): Promise<OutletTaskRow[]> {
  const body = await api.get<{ data: { tasks: OutletTaskRow[] } }>('leads/tasks', { leadID: leadId });
  return body.data?.tasks ?? [];
}

/** Records what the rep did with a drink idea. 'cleared' takes the last answer back; a reason only goes with a decline. */
export async function saveRecommendationFeedback(
  leadId: number,
  recipeId: number,
  status: FeedbackStatus | 'cleared',
  reason?: string,
): Promise<RecommendationFeedback> {
  const body = await api.post<{ data: RecommendationFeedback }>('leads/recommendations/feedback', {
    lead_id: leadId,
    recipe_id: recipeId,
    status,
    ...(reason ? { reason } : {}),
  });
  return body.data;
}

export async function fetchOutletMedia(leadId: number): Promise<MediaSet> {
  const body = await api.get<{ data: MediaSet }>('leads/media', { leadID: leadId });
  return body.data ?? { media: [], documents: [] };
}

export async function fetchOutletOptions(): Promise<OutletFilterOptions> {
  const body = await api.get<{ data: OutletFilterOptions }>('leads/filterOptions');
  return body.data;
}

export interface OutletInput {
  id?: number;
  name: string;
  business_name?: string | null;
  mobile: string;
  email?: string | null;
  address?: string | null;
  state_id?: number | null;
  city_id?: number | null;
  postcode?: string | null;
  businesscat?: number | null;
  leadsource?: number | null;
  size_band?: string | null;
  seats?: number | null;
  segment?: string | null;
  /** True: only stocks halal products. Null: not stated. Left out: keep what is saved. */
  is_halal?: boolean | null;
  /** Customer group keys. An empty list clears the answer. */
  main_customers?: string[];
  /** Drink kind keys. An empty list clears the answer. */
  best_selling_kinds?: string[];
  /** Goal keys. An empty list clears the answer. */
  improvement_goals?: string[];
  /** RM. Null clears the answer. */
  typical_drink_price?: number | null;
  remark?: string | null;
  customer_id?: string | null;
  gps?: GpsStamp | null;
  files?: LocalFile[];
}

/** Add (no id) or edit an outlet. The server calls it a lead. */
export async function saveOutlet(input: OutletInput): Promise<{ id: number }> {
  const { files, gps, ...rest } = input;
  const fields: Record<string, unknown> = {
    ...rest,
    receive_date: new Date().toISOString().slice(0, 10),
  };
  if (gps !== undefined) fields.gps = gps ? JSON.stringify(gps) : '';
  // An empty list would send nothing, which the server reads as "keep the saved answer": send a blank to clear it.
  for (const key of ['main_customers', 'best_selling_kinds', 'improvement_goals'] as const) {
    const list = rest[key];
    if (Array.isArray(list) && list.length === 0) fields[key] = null;
  }
  const body = await api.post<{ data: { lead: { id: number } } }>(
    input.id ? 'leads/edit' : 'leads/create',
    toFormData({ ...fields, ...(files?.length ? { file: files } : {}) }),
    90,
  );
  return { id: body.data.lead.id };
}

/* ----- orders and products ----- */

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  unit_price: number;
  description: string | null;
}

export const productKeys = { all: ['products'] as const };

export async function fetchProducts(): Promise<{ currency: string; categories: string[]; products: Product[] }> {
  const body = await api.get<{ data: { currency: string; categories: string[]; products: Product[] } }>('products');
  return body.data;
}

export async function recordOrder(leadId: number, lines: { product_id: number; quantity: number; suggested?: boolean }[], remark?: string | null): Promise<Order> {
  const body = await api.post<{ data: { order: Order } }>('leads/orders/create', { lead_id: leadId, lines, remark: remark || null });
  return body.data.order;
}
