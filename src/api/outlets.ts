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
  suggested_count: number;
  suggested_value: number;
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
  location: GpsStamp | null;
  created_at: string;
}

export interface OutletDetail extends Omit<OutletRow, 'kind' | 'last_visit_at' | 'suggested_count' | 'suggested_value' | 'open_tasks' | 'overdue' | 'at_risk' | 'due_today' | 'next_due_at'> {
  state_id: number | null;
  city_id: number | null;
  attachments: { id: number; name: string; file_path: string; file_type: string; size: number }[];
}

export interface OutletListResult {
  leads: OutletRow[];
  counts: { all: number; customer: number; prospect: number; suggested: number };
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export interface OutletListParams extends Query {
  search?: string;
  kind?: 'customer' | 'prospect';
  suggested?: 1;
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

export interface RecommendationItem {
  product_id: number;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  unit_price: number;
  /** 'gap': they do not buy it yet; otherwise they buy less than similar outlets. */
  status: 'gap' | 'top_up' | string;
  support: number;
  buyers: number;
  neighbors_used: number;
  recommended_qty: number;
  current_qty: number;
  est_monthly_value: number;
}

export interface Recommendations {
  lead_id: number;
  status: 'ready' | 'insufficient_data';
  computed_at: string | null;
  currency: string;
  similar_outlets: number;
  gap_count: number;
  estimated_monthly_value: number;
  items: RecommendationItem[];
  explanation: { why: string | null; opening_line: string | null; source: 'bedrock' | 'template' | null };
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
}

export const outletKeys = {
  all: ['outlets'] as const,
  list: (params: OutletListParams) => ['outlets', 'list', params] as const,
  detail: (id: number) => ['outlets', 'detail', id] as const,
  visits: (id: number) => ['outlets', 'visits', id] as const,
  orders: (id: number) => ['outlets', 'orders', id] as const,
  tasks: (id: number) => ['outlets', 'tasks', id] as const,
  recommendations: (id: number) => ['outlets', 'recommendations', id] as const,
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

export async function fetchRecommendations(leadId: number): Promise<Recommendations> {
  const body = await api.get<{ data: Recommendations }>('leads/recommendations', { lead_id: leadId }, 120);
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

export async function recordOrder(leadId: number, lines: { product_id: number; quantity: number }[], remark?: string | null): Promise<Order> {
  const body = await api.post<{ data: { order: Order } }>('leads/orders/create', { lead_id: leadId, lines, remark: remark || null });
  return body.data.order;
}
