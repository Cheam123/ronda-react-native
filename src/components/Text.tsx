import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import type { Palette } from '../theme/tokens';
import { type, type TypeVariant } from '../theme/type';

type ColorKey = 'ink' | 'body' | 'ink2' | 'muted' | 'link' | 'brandInk' | 'danger';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  /** A palette key, or any colour string. */
  color?: ColorKey | (string & {});
  align?: TextStyle['textAlign'];
}

const KEYS: ColorKey[] = ['ink', 'body', 'ink2', 'muted', 'link', 'brandInk', 'danger'];

export function resolveColor(colors: Palette, color: string): string {
  return (KEYS as string[]).includes(color) ? (colors[color as ColorKey] as string) : color;
}

/**
 * All copy goes through here so it uses the right family per weight and
 * scales with the phone's text size (never capped: layouts reflow instead).
 */
export function Text({ variant = 'body', color = 'ink', align, style, ...rest }: TextProps) {
  const colors = useColors();
  return <RNText {...rest} style={[type[variant], { color: resolveColor(colors, color), textAlign: align }, style]} />;
}
