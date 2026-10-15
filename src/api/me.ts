import { api } from './client';
import type { Order } from './outlets';

/** The Me screen: this month's work, record counts, and my orders (MeController). */

export interface MeStats {
  /** "October 2026" */
  month_label: string;
  month: { visits: number; orders: number; orders_value: number; forms: number };
  /** All time, for the My records rows. */
  totals: { visits: number; forms: number; orders: number };
  currency: string;
}

export interface MyOrder extends Order {
  lead_id: number;
  outlet: string | null;
}

export const meKeys = {
  stats: ['me', 'stats'] as const,
  orders: ['me', 'orders'] as const,
};

export async function fetchMeStats(): Promise<MeStats> {
  return api.get<MeStats>('me/stats');
}

export async function fetchMyOrders(): Promise<MyOrder[]> {
  const body = await api.get<{ orders: MyOrder[] }>('orders', { mine: 1, per_page: 100 });
  return body.orders ?? [];
}
