import type { TextStyle } from 'react-native';

/**
 * Font families as loaded by useFonts (one family per weight, see App.tsx).
 * Instrument Sans for everything; Instrument Serif only for the Morning
 * Round-Up and suggested opening lines; IBM Plex Mono for IDs.
 */
export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
  serif: 'InstrumentSerif_400Regular',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/** Letter-spacing is given in em by the design; React Native wants points. */
const em = (value: number, size: number) => value * size;

export type TypeVariant =
  | 'largeTitle'
  | 'title'
  | 'title2'
  | 'section'
  | 'rowTitle'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'subhead'
  | 'caption'
  | 'captionStrong'
  | 'footnote'
  | 'label'
  | 'tab'
  | 'number'
  | 'serif'
  | 'mono';

export const type: Record<TypeVariant, TextStyle> = {
  largeTitle: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 40, letterSpacing: em(-0.03, 34) },
  title: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: em(-0.03, 30) },
  title2: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: em(-0.02, 24) },
  section: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 28, letterSpacing: em(-0.015, 21) },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 },
  subhead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  tab: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13 },
  number: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 34, letterSpacing: em(-0.02, 30) },
  serif: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 27 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
};
