import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { PressableScale } from './Pressable';

interface IconButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  /** A small dot on the corner (unread alerts). */
  dot?: boolean;
  size?: number;
  /** 'raised' (white or dark raised circle) or 'plain'. */
  tone?: 'raised' | 'plain';
}

/** A 44-point round button, padded out to a 48-point target. */
export function IconButton({ onPress, accessibilityLabel, children, dot, size = 44, tone = 'raised' }: IconButtonProps) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={(48 - size) / 2 + 2}
      scaleTo={0.92}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        tone === 'raised' && { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, borderColor: colors.cardRing, borderWidth: 1 },
      ]}
    >
      {children}
      {dot ? <View style={[styles.dot, { backgroundColor: colors.scheme === 'dark' ? '#F04438' : '#B42318', borderColor: colors.scheme === 'dark' ? colors.raised : colors.panel }]} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 10, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
});
