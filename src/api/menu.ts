import type { MenuFragment } from "../lib/menuReader";
import { api, toFormData, type LocalFile } from "./client";

/** One product a drink idea needs, with a starting monthly quantity. */
export interface IdeaProduct {
  product_id: number;
  name: string | null;
  unit: string | null;
  unit_price: number;
  amount: string | null;
  quantity: number;
  value: number;
  already_buys: boolean;
}

/** A drink the outlet could add (MenuIdeas on the server). */
export interface DrinkIdea {
  recipe_id: number;
  name: string;
  serve: "hot" | "iced" | "either";
  category: string | null;
  description: string | null;
  score: number;
  /** Why it suits, strongest first. */
  reasons: string[];
  cost_per_serve: number;
  products: IdeaProduct[];
  est_monthly_value: number;
}

export type IdeaStatus = "pitched" | "accepted" | "declined";

/** Each idea's newest answer, and why it was declined, by drink id. */
export interface IdeaAnswers {
  drink_feedback: Record<string, IdeaStatus>;
  drink_reasons: Record<string, string>;
}

/** An outlet's drink ideas as they stand now, with or without a menu. */
export interface DrinkIdeas {
  ideas: DrinkIdea[];
  /** The menu the ideas used; null when the outlet has none. */
  menu_scan_id: number | null;
  /** What the ideas were worked out from: "their menu", "what the owner told you"… */
  based_on: string[];
  answers: IdeaAnswers;
  /** Reasons a rep can give when declining: key => label. */
  decline_reasons: Record<string, string>;
}

/** A menu row as the server read it. */
export interface MenuRow {
  id: number;
  text: string;
  price: number | null;
  recipe_id: number | null;
  /** The drink it was matched to. */
  drink: string | null;
  kept: boolean;
  changed: boolean;
}

/** A menu scan: a draft for the rep to check, or the outlet's confirmed menu. */
export interface MenuScan {
  id: number;
  status: "draft" | "confirmed";
  source: "phone" | "typed" | string;
  scanned_label: string;
  scanned_by: string | null;
  price_level: string | null;
  price_label: string | null;
  median_price: number | null;
  matched: MenuRow[];
  unrecognised: MenuRow[];
}

/** A drink a rep can name an unrecognised row as. */
export interface DrinkOption {
  value: number;
  label: string;
}

/** What the rep changed on a draft. */
export interface RowChange {
  id: number;
  kept?: boolean;
  recipe_id?: number | null;
}

export const menuKeys = {
  ideas: (leadId: number) => ["menu", "ideas", leadId] as const,
  reader: (leadId: number) => ["menu", "reader", leadId] as const,
};

/**
 * Whether the server reads menu photos itself (Amazon Textract). When it
 * does, the phone sends the photos as they are instead of reading them first.
 */
export async function fetchServerReadsPhotos(leadId: number): Promise<boolean> {
  const body = await api.get<{ data: { reads_photos?: boolean } }>(
    "leads/menu",
    { lead_id: leadId },
  );
  return body.data.reads_photos === true;
}

export async function fetchDrinkIdeas(leadId: number): Promise<DrinkIdeas> {
  const body = await api.get<{ data: { ideas: DrinkIdeas } }>(
    "leads/drink-ideas",
    { lead_id: leadId },
  );
  return body.data.ideas;
}

/** Records what the rep did with an idea; "cleared" takes the answer back. */
export async function answerIdea(input: {
  leadId: number;
  recipeId: number;
  menuScanId: number | null;
  status: IdeaStatus | "cleared";
  reason?: string;
}): Promise<IdeaAnswers> {
  const body = await api.post<{ data: IdeaAnswers }>(
    "leads/recommendations/feedback",
    {
      lead_id: input.leadId,
      recipe_id: input.recipeId,
      menu_scan_id: input.menuScanId,
      status: input.status,
      reason: input.reason ?? null,
    },
  );
  return body.data;
}

/**
 * Sends the photos, with what the phone read from them (none when the server
 * reads them itself), and gets the draft to check. reader "phone" asks the
 * server to use the phone's reading even when it could read the photos.
 */
export async function sendMenuScan(
  leadId: number,
  fragments: MenuFragment[],
  photos: LocalFile[],
  reader?: "phone",
): Promise<{ scan: MenuScan; drinks: DrinkOption[] }> {
  const body = await api.post<{
    data: { scan: MenuScan; drinks: DrinkOption[] };
  }>(
    "leads/menu-scans",
    toFormData({
      lead_id: leadId,
      fragments: JSON.stringify(fragments),
      file: photos,
      reader,
    }),
    90,
  );
  return body.data;
}

/** Saves the rep's check of a draft; it becomes the outlet's menu. */
export async function confirmMenuScan(
  scanId: number,
  changes: RowChange[],
): Promise<void> {
  await api.post(`leads/menu-scans/${scanId}/confirm`, { items: changes });
}
