/**
 * Colour tokens, copied from the design boards (light) and their *Dark boards.
 * Name colours by their job, never by their hue.
 */

export type ToneName = 'critical' | 'serious' | 'brand' | 'form' | 'neutral' | 'good' | 'suggest';

/** A status tone: text ink, a tinted tile, a dot, and the tint of a selected tile. */
export interface Tone {
  ink: string;
  tile: string;
  dot: string;
  selected: string;
}

export type TaskStatusKey = 'new' | 'progress' | 'done' | 'verified' | 'completed' | 'parked' | 'rejected';

export interface Palette {
  scheme: 'light' | 'dark';
  ground: string;
  panel: string;
  /** Sheets, menus, round icon buttons. */
  raised: string;
  line: string;
  divider: string;
  control: string;
  ink: string;
  body: string;
  ink2: string;
  muted: string;
  chevron: string;
  link: string;
  brand: string;
  brandInk: string;
  brandTint: string;
  coral: string;
  /** Pressed state of a row. */
  pressed: string;
  /** Hairline ring around cards and lists. */
  cardRing: string;
  primary: { bg: string; fg: string };
  secondary: { bg: string; fg: string; border: string };
  danger: string;
  chipOn: { bg: string; fg: string };
  chipOff: { bg: string; fg: string; count: string; ring: string };
  segmented: { track: string; thumb: string };
  tabBar: { bg: string; capsule: string; active: string; inactive: string; badge: string; ring: string };
  record: { bg: string; fg: string };
  toast: { bg: string; fg: string; action: string };
  check: { ring: string; fill: string; mark: string };
  scrim: string;
  /** Loading skeleton bones: visible on the page and on cards alike. */
  skeleton: string;
  fade: string;
  tones: Record<ToneName, Tone>;
  status: Record<TaskStatusKey, { ink: string; bg: string; dot: string }>;
  /** Avatar tints, picked by a stable hash of the name. */
  avatars: { bg: string; ink: string }[];
}

export const light: Palette = {
  scheme: 'light',
  ground: '#F5F6F8',
  panel: '#FFFFFF',
  raised: '#FFFFFF',
  line: '#EAECF0',
  divider: '#F2F4F7',
  control: '#D0D5DD',
  ink: '#101828',
  body: '#344054',
  ink2: '#475467',
  muted: '#667085',
  chevron: '#98A2B3',
  link: '#0D729E',
  brand: '#0D729E',
  brandInk: '#0A5A7D',
  brandTint: '#E5F0F5',
  coral: '#FF6B4E',
  pressed: '#F9FAFB',
  cardRing: 'rgba(16,24,40,0.06)',
  primary: { bg: '#101828', fg: '#FFFFFF' },
  secondary: { bg: '#FFFFFF', fg: '#101828', border: '#D0D5DD' },
  danger: '#B42318',
  chipOn: { bg: '#101828', fg: '#FFFFFF' },
  chipOff: { bg: '#FFFFFF', fg: '#344054', count: '#475467', ring: '#EAECF0' },
  segmented: { track: '#EEF0F3', thumb: '#FFFFFF' },
  tabBar: {
    bg: 'rgba(255,255,255,0.82)',
    capsule: 'rgba(13,114,158,0.12)',
    active: '#0A5A7D',
    inactive: '#475467',
    badge: '#B42318',
    ring: 'rgba(255,255,255,0.7)',
  },
  record: { bg: '#101828', fg: '#FFFFFF' },
  toast: { bg: '#101828', fg: '#FFFFFF', action: '#7CC8EE' },
  check: { ring: '#98A2B3', fill: '#079455', mark: '#FFFFFF' },
  scrim: 'rgba(16,24,40,0.35)',
  skeleton: '#E8EBEF',
  fade: 'rgba(245,246,248,0.92)',
  tones: {
    critical: { ink: '#B42318', tile: '#FEF3F2', dot: '#F04438', selected: '#FEF3F2' },
    serious: { ink: '#B54708', tile: '#FFFAEB', dot: '#F79009', selected: '#FFFAEB' },
    brand: { ink: '#0A5A7D', tile: '#E5F0F5', dot: '#0D729E', selected: '#E5F0F5' },
    form: { ink: '#5925DC', tile: '#F4F3FF', dot: '#7A5AF8', selected: '#F4F3FF' },
    neutral: { ink: '#475467', tile: '#F2F4F7', dot: '#98A2B3', selected: '#F2F4F7' },
    good: { ink: '#067647', tile: '#ECFDF3', dot: '#17B26A', selected: '#ECFDF3' },
    suggest: { ink: '#107569', tile: '#F0FDF9', dot: '#15B79E', selected: '#F0FDF9' },
  },
  status: {
    new: { ink: '#175CD3', bg: '#EFF8FF', dot: '#2E90FA' },
    progress: { ink: '#3538CD', bg: '#EEF4FF', dot: '#6172F3' },
    done: { ink: '#107569', bg: '#F0FDF9', dot: '#15B79E' },
    verified: { ink: '#5925DC', bg: '#F4F3FF', dot: '#7A5AF8' },
    completed: { ink: '#067647', bg: '#ECFDF3', dot: '#17B26A' },
    parked: { ink: '#475467', bg: '#F2F4F7', dot: '#98A2B3' },
    rejected: { ink: '#B42318', bg: '#FEF3F2', dot: '#F04438' },
  },
  avatars: [
    { bg: '#EFF8FF', ink: '#175CD3' },
    { bg: '#F0FDF9', ink: '#107569' },
    { bg: '#FDF2FA', ink: '#C11574' },
    { bg: '#F4F3FF', ink: '#5925DC' },
    { bg: '#FFF6ED', ink: '#C4320A' },
    { bg: '#F8F9FC', ink: '#363F72' },
    { bg: '#ECFDF3', ink: '#067647' },
  ],
};

export const dark: Palette = {
  scheme: 'dark',
  ground: '#0B0F17',
  panel: '#121823',
  raised: '#1A2230',
  line: '#242D3B',
  divider: '#1E2633',
  control: '#3A4558',
  ink: '#F2F4F7',
  body: '#D0D5DD',
  ink2: '#A9B1BF',
  muted: '#8B95A7',
  chevron: '#667085',
  link: '#7CC8EE',
  brand: '#47B0DD',
  brandInk: '#7CC8EE',
  brandTint: '#0E2A38',
  coral: '#FF6B4E',
  pressed: '#1A2230',
  cardRing: 'rgba(255,255,255,0.06)',
  primary: { bg: '#F2F4F7', fg: '#0B0F17' },
  secondary: { bg: '#1A2230', fg: '#F2F4F7', border: '#3A4558' },
  danger: '#F97066',
  chipOn: { bg: '#F2F4F7', fg: '#0B0F17' },
  chipOff: { bg: '#121823', fg: '#D0D5DD', count: '#A9B1BF', ring: '#242D3B' },
  segmented: { track: '#1A2230', thumb: '#2E394B' },
  tabBar: {
    bg: 'rgba(26,34,48,0.78)',
    capsule: 'rgba(71,176,221,0.18)',
    active: '#7CC8EE',
    inactive: '#A9B1BF',
    badge: '#D92D20',
    ring: 'rgba(255,255,255,0.08)',
  },
  record: { bg: '#F2F4F7', fg: '#0B0F17' },
  toast: { bg: '#2A3445', fg: '#F2F4F7', action: '#7CC8EE' },
  check: { ring: '#667085', fill: '#17B26A', mark: '#0B0F17' },
  scrim: 'rgba(0,0,0,0.55)',
  skeleton: '#1F2734',
  fade: 'rgba(11,15,23,0.92)',
  tones: {
    critical: { ink: '#F97066', tile: '#3A1513', dot: '#F04438', selected: '#2A1414' },
    serious: { ink: '#FDB022', tile: '#3A2509', dot: '#F79009', selected: '#2A1E0C' },
    brand: { ink: '#7CC8EE', tile: '#0E2A38', dot: '#47B0DD', selected: '#0E2230' },
    form: { ink: '#BDB4FE', tile: '#2A1E5C', dot: '#9B8AFB', selected: '#1E1840' },
    neutral: { ink: '#A9B1BF', tile: '#1A2230', dot: '#8B95A7', selected: '#1A2230' },
    good: { ink: '#75E0A7', tile: '#0E2A1F', dot: '#17B26A', selected: '#0E2A1F' },
    suggest: { ink: '#5FE9D0', tile: '#0B2D2A', dot: '#15B79E', selected: '#0B2D2A' },
  },
  status: {
    new: { ink: '#84CAFF', bg: '#102A56', dot: '#2E90FA' },
    progress: { ink: '#A4BCFD', bg: '#1F235B', dot: '#6172F3' },
    done: { ink: '#5FE9D0', bg: '#0B2D2A', dot: '#15B79E' },
    verified: { ink: '#BDB4FE', bg: '#2A1E5C', dot: '#9B8AFB' },
    completed: { ink: '#75E0A7', bg: '#0E2A1F', dot: '#17B26A' },
    parked: { ink: '#D0D5DD', bg: '#1F2734', dot: '#8B95A7' },
    rejected: { ink: '#FDA29B', bg: '#3A1513', dot: '#F04438' },
  },
  avatars: [
    { bg: '#102A56', ink: '#84CAFF' },
    { bg: '#0B2D2A', ink: '#5FE9D0' },
    { bg: '#3B1430', ink: '#FAA7E0' },
    { bg: '#2A1E5C', ink: '#BDB4FE' },
    { bg: '#3A1A0A', ink: '#F7B27A' },
    { bg: '#1B1F33', ink: '#B3B8DB' },
    { bg: '#0E2A1F', ink: '#75E0A7' },
  ],
};

/** The splash and brand surfaces keep their own colour in both themes. */
export const SPLASH_BLUE = '#106F93';

/**
 * Corners. Cards 14, tiles and banners 12, and a box inside a card 12, so
 * nothing inside is rounder than what holds it. Small, so cards read as
 * flat panels.
 */
export const radius = { row: 14, button: 16, card: 14, tile: 12, inner: 12, pill: 999 } as const;
/**
 * Spacing. `gutter` is the side margin of every card, tile and list, kept
 * narrow so they use the screen's width; headings keep `sideWide`, so their
 * text lines up with the text inside the cards.
 */
export const space = { gutter: 8, side: 16, sideWide: 20, section: 32, sectionLarge: 36 } as const;
/** Smallest tap target, in points. */
export const TAP = 48;
