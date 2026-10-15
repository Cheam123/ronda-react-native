import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { Icon } from './Icon';

/** A white (or dark panel) surface with the hairline ring the boards use. */
export function Card({ children, style, padded = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.panel, borderColor: colors.cardRing },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * One row of a card that a FlatList draws row by row: the slices of a list
 * together look like one Card (rounded at the first and last, one ring).
 */
export function CardSlice({ first, last, children, style }: { first: boolean; last: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.slice,
        { backgroundColor: colors.panel, borderColor: colors.cardRing },
        first && styles.sliceFirst,
        last && styles.sliceLast,
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ListRowProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Draw the divider under this row (off for the last one). */
  divider?: boolean;
  /** Indent the divider so it starts after a leading tile. */
  dividerInset?: number;
  chevron?: boolean;
  /** 'top': the leading avatar lines up with the first line, not the middle of the row. */
  align?: 'center' | 'top';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** A tappable row inside a Card; dims to the pressed colour while held. */
export function ListRow({
  children,
  onPress,
  onLongPress,
  divider = true,
  dividerInset = 0,
  chevron = false,
  align = 'center',
  style,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  const colors = useColors();
  return (
    <View>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress && !onLongPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }, style]}
      >
        <View style={[styles.rowContent, align === 'top' && styles.rowContentTop]}>{children}</View>
        {chevron ? <Icon name="chevronRight" size={20} color={colors.chevron} strokeWidth={2.2} /> : null}
      </Pressable>
      {divider ? <View style={[styles.divider, { backgroundColor: colors.divider, marginLeft: dividerInset }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  slice: { marginHorizontal: space.gutter, borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
  sliceFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  sliceLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  padded: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, minHeight: 48 },
  rowContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowContentTop: { alignItems: 'flex-start' },
  divider: { height: 1 },
});
