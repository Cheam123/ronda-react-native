import { api } from './client';

/** A visit brief written by Claude, or from the template when Claude is off. */
export interface VisitBrief {
  content: string;
  source: 'bedrock' | 'template';
  fallback: 'unavailable' | 'not_configured' | null;
  stale: boolean;
  generated_at: string;
  generated_by: string | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** "How to pitch" for one product, keyed by SKU. */
export interface Pitch {
  pitch: string;
  objection: string | null;
  reply: string | null;
}

export const assistantKeys = {
  brief: (id: number) => ['assistant', 'brief', id] as const,
  pitches: (id: number) => ['assistant', 'pitches', id] as const,
};

/** Claude can take a while: two minutes before giving up. */
const SLOW = 120;

export async function fetchBrief(leadId: number): Promise<{ brief: VisitBrief | null; available: boolean }> {
  const body = await api.get<{ data: { brief: VisitBrief | null; available: boolean } }>(`leads/${leadId}/assistant/brief`);
  return body.data;
}

export async function writeBrief(leadId: number): Promise<VisitBrief> {
  const body = await api.post<{ data: { brief: VisitBrief } }>(`leads/${leadId}/assistant/brief`, undefined, SLOW);
  return body.data.brief;
}

export async function askRonda(leadId: number, messages: ChatTurn[]): Promise<string> {
  const body = await api.post<{ data: { reply: string } }>(`leads/${leadId}/assistant/chat`, { messages }, SLOW);
  return body.data.reply;
}

export async function draftFollowUp(
  leadId: number,
  input: { language: 'en' | 'ms'; topic: 'last_visit' | 'last_order' | 'suggested'; note?: string | null },
): Promise<{ text: string; source: 'bedrock' | 'template' }> {
  const body = await api.post<{ data: { text: string; source: 'bedrock' | 'template' } }>(`leads/${leadId}/assistant/follow-up`, input, SLOW);
  return body.data;
}

export async function fetchPitches(leadId: number): Promise<{ pitches: Record<string, Pitch>; source: 'bedrock' | 'template' | null }> {
  const body = await api.post<{ data: { pitches: Record<string, Pitch> | Pitch[]; source: 'bedrock' | 'template' | null } }>(
    `leads/${leadId}/assistant/pitches`,
    undefined,
    SLOW,
  );
  const raw = body.data.pitches;
  return { pitches: Array.isArray(raw) ? {} : raw ?? {}, source: body.data.source };
}

/**
 * The brief is written in four sections ("Who they are", "Last time", "Watch
 * out", "Raise today"). Split it so the screen can show each with a heading.
 */
export function briefSections(content: string): { title: string; lines: string[] }[] {
  const sections: { title: string; lines: string[] }[] = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^#{1,4}\s*(.+)$/.exec(line) ?? /^\*\*(.+?)\*\*:?$/.exec(line) ?? /^(Who they are|Last time|Watch out|Raise today):?$/i.exec(line);
    if (heading) {
      sections.push({ title: heading[1].replace(/:$/, '').trim(), lines: [] });
      continue;
    }
    if (sections.length === 0) sections.push({ title: '', lines: [] });
    sections[sections.length - 1].lines.push(line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, ''));
  }
  return sections;
}
