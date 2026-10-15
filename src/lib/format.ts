/**
 * Dates, times and money in the house style: "6 Oct 2026", "2:30 PM",
 * "RM 1,234.00". The server sends Malaysian local times without a zone
 * ("2026-10-06 14:30:00"), so those are read as local wall-clock time.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse "2026-10-06", "2026-10-06 14:30:00" or an ISO string. */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const plain = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (plain) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = plain;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A date plus an optional "HH:mm[:ss]" time. */
export function combineDateTime(date: string | null | undefined, time: string | null | undefined): Date | null {
  const day = parseDate(date ?? null);
  if (!day) return null;
  if (!time) return day;
  const [h, m, s] = time.split(':').map(Number);
  day.setHours(h || 0, m || 0, s || 0, 0);
  return day;
}

/** "6 Oct 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

/** "6 Oct" */
export function formatDayMonth(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
}

/** "2:30 PM" */
export function formatTime(value: string | Date | null | undefined): string {
  const d = typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value) ? combineDateTime('2000-01-01', value) : parseDate(value);
  if (!d) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "6 Oct 2026, 2:30 PM" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? `${formatDate(d)}, ${formatTime(d)}` : '';
}

/** "Tuesday, 6 Oct" */
export function formatLongDay(value: Date = new Date()): string {
  return `${DAYS_LONG[value.getDay()]}, ${value.getDate()} ${MONTHS[value.getMonth()]}`;
}

/** "Fri 9 Oct" */
export function formatShortDay(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
}

/** "RM 1,234.00" */
export function formatMoney(value: number | string | null | undefined, currency = 'RM'): string {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value ?? 0;
  const safe = Number.isFinite(n) ? (n as number) : 0;
  const [whole, cents] = Math.abs(safe).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${safe < 0 ? '-' : ''}${currency} ${grouped}.${cents}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Whole calendar days from a to b (b later is positive). */
export function dayDiff(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** "today", "yesterday", "tomorrow", "Fri 9 Oct" or "6 Oct 2026". */
export function relativeDay(value: string | Date | null | undefined, now = new Date()): string {
  const d = parseDate(value);
  if (!d) return '';
  const diff = dayDiff(now, d);
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff < 7) return formatShortDay(d);
  return d.getFullYear() === now.getFullYear() ? formatDayMonth(d) : formatDate(d);
}

/** "1 day" / "4 days" */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Good morning / afternoon / evening. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * What to call someone: their given name, which Malaysian names put first and
 * often in two words ("Mei Ling Tan" → Mei Ling, "Nur Aisyah Ahmad" → Nur
 * Aisyah). A father's name after bin, binti, a/l or a/p is left out
 * ("Muhammad Hafiz bin Ismail" → Muhammad Hafiz). Two words: the first.
 */
export function firstName(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const father = words.findIndex((w, i) => i > 0 && /^(bin|binti|bt\.?|a\/l|a\/p|s\/o|d\/o)$/i.test(w));
  if (father > 0) return words.slice(0, father).join(' ');
  return words.slice(0, words.length > 2 ? 2 : 1).join(' ');
}

/** People: first and last name ("Mei Ling Tan" → MT). Outlets: the first two words ("Daily Grind SS2" → DG). */
export function initials(name: string | null | undefined, kind: 'person' | 'outlet' = 'person'): string {
  // Words, ignoring the symbols some names use ("Roast & Co" gives RC, not R&).
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const second = kind === 'outlet' ? parts[1] : parts[parts.length - 1];
  return (parts[0][0] + second[0]).toUpperCase();
}

/** A stable small number for a string, to pick an avatar tint. */
export function hashIndex(value: string, buckets: number): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h) % buckets;
}

/** "2 bottles", "4 kg", "1 litre": measures stay as they are, counted units take an s. */
export function quantityLabel(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const measure = ['kg', 'g', 'l', 'litre', 'ml', 'm'].includes(unit.toLowerCase());
  return `${n} ${qty === 1 || measure || unit.endsWith('s') ? unit : `${unit}s`}`;
}

/** Joins words with non-breaking spaces, so a short phrase ("11 days overdue") never breaks across lines. */
/** "overdue since 5:00 PM" → "Overdue since 5:00 PM", for a note that starts its own line. */
export function capitalise(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function keepTogether(text: string): string {
  return text.split(' ').join(String.fromCharCode(160));
}
