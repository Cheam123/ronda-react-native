/**
 * The one place that talks to the Laravel mobile API (/api/mobile/*).
 *
 * The backend answers in two shapes:
 *   response_ok:      { status: 'ok', message, ...data }   (data at the top level)
 *   response_success: { status: 'ok', message, data }
 * and fails with HTTP 400 { status: 'error', message, errors? }, or 422 for
 * Laravel validation. Callers get the raw body and pick what they need.
 */

import { File } from 'expo-file-system';

const BASE = `${(process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000').replace(/\/+$/, '')}/api/mobile`;

export const API_BASE = BASE;

/** Files and photos the backend stores sit under the site root, not /api/mobile. */
export const SITE_ROOT = BASE.replace(/\/api\/mobile$/, '');

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;
  /** The `errors` value as the server sent it, for errors that carry data (a form's needs_assignee). */
  raw: unknown;
  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}, raw: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.raw = raw;
  }
  /** The first message for a field, for showing under an input. */
  field(name: string): string | undefined {
    return this.fieldErrors[name]?.[0];
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(next: string | null) {
  token = next;
}

export function getToken() {
  return token;
}

/** Called once by AuthProvider: a 401 means the token is gone, so sign out. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

function toQuery(params?: Query): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(v))}`));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Seconds before giving up. Claude-written answers can take two minutes. */
  timeout?: number;
}

const GENERIC = 'Something went wrong. Check your connection and try again.';

export async function request<T = Record<string, unknown>>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, timeout = 30 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}/${path.replace(/^\/+/, '')}${toQuery(query)}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    throw new ApiError(aborted ? 'This is taking too long. Check your connection and try again.' : GENERIC, 0);
  } finally {
    clearTimeout(timer);
  }

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (response.status === 401) {
    onUnauthorized?.();
    throw new ApiError('Please sign in again.', 401);
  }

  if (!response.ok || json?.status === 'error') {
    const errors = normaliseErrors(json?.errors);
    const message = typeof json?.message === 'string' && json.message ? json.message : GENERIC;
    throw new ApiError(message, response.status, errors, json?.errors ?? null);
  }

  // A "success" that is not JSON (a Wi-Fi sign-in page, a proxy) is not our data:
  // passing it on as {} would leave screens with lists that are missing parts.
  if (json === null && response.status !== 204) {
    throw new ApiError(GENERIC, response.status);
  }

  return (json ?? {}) as T;
}

function normaliseErrors(errors: unknown): Record<string, string[]> {
  if (!errors || typeof errors !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    // Only messages: some errors carry data (candidates, needs_assignee), which is not a message.
    const messages = (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string');
    if (messages.length) out[key] = messages;
  }
  return out;
}

export const api = {
  get: <T>(path: string, query?: Query, timeout?: number) => request<T>(path, { query, timeout }),
  post: <T>(path: string, body?: unknown, timeout?: number) => request<T>(path, { method: 'POST', body, timeout }),
  put: <T>(path: string, body?: unknown, timeout?: number) => request<T>(path, { method: 'PUT', body, timeout }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};

/** A local photo picked with expo-image-picker, ready for a multipart upload. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Build multipart data. Arrays become key[] entries; LocalFile values are
 * appended as files (React Native's FormData takes {uri, name, type}).
 */
/**
 * A picked photo or file, ready for FormData. Expo's fetch only uploads real
 * file objects; React Native's { uri, name, type } shape fails with
 * "Unsupported FormDataPart implementation".
 */
export function uploadable(file: LocalFile): Blob {
  return new File(file.uri);
}

export function toFormData(fields: Record<string, unknown>): FormData {
  const form = new FormData();
  const append = (key: string, value: unknown) => {
    if (value === undefined) return;
    if (value === null) {
      form.append(key, '');
    } else if (isLocalFile(value)) {
      form.append(key, uploadable(value));
    } else if (typeof value === 'boolean') {
      form.append(key, value ? '1' : '0');
    } else {
      form.append(key, String(value));
    }
  };
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((v) => append(`${key}[]`, v));
    else append(key, value);
  }
  return form;
}

function isLocalFile(value: unknown): value is LocalFile {
  return !!value && typeof value === 'object' && 'uri' in value && 'name' in value && 'type' in value;
}

/** Friendly copy for an error caught in a screen. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    const first = Object.values(e.fieldErrors)[0]?.[0];
    return first ?? e.message;
  }
  return GENERIC;
}
