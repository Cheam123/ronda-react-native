import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RondaRing } from '../motion/RondaRing';
import { useColors } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** danger: red text on a plain button (Cancel entry). destructive: a solid red button (Reject, in a sheet). */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'brand';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  /** Put the icon after the label ("Next: Parts and photos →"). */
  iconAfter?: boolean;
  /** 54 for main actions at the bottom, 48 for smaller ones. */
  size?: 'large' | 'medium';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  iconAfter = false,
  size = 'large',
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const colors = useColors();
  const palette = {
    primary: { bg: colors.primary.bg, fg: colors.primary.fg, border: 'transparent' },
    secondary: { bg: colors.secondary.bg, fg: colors.secondary.fg, border: colors.secondary.border },
    ghost: { bg: 'transparent', fg: colors.link, border: 'transparent' },
    danger: { bg: colors.secondary.bg, fg: colors.danger, border: colors.secondary.border },
    destructive: { bg: colors.scheme === 'dark' ? '#D92D20' : colors.danger, fg: '#FFFFFF', border: 'transparent' },
    brand: { bg: colors.brandTint, fg: colors.brandInk, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      scaleTo={0.98}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.base,
        {
          minHeight: size === 'large' ? 54 : 48,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <RondaRing size={24} color={palette.fg} accessibilityLabel={`${label}, working`} />
      ) : (
        <View style={styles.content}>
          {iconAfter ? null : icon}
          <Text variant={size === 'large' ? 'bodyStrong' : 'captionStrong'} color={palette.fg} style={size === 'large' ? styles.large : styles.medium} align="center">
            {label}
          </Text>
          {iconAfter ? icon : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  large: { fontSize: 17, lineHeight: 22 },
  medium: { fontSize: 15, lineHeight: 20 },
});
