import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { Moving } from '../motion/Moving';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

const LABELS = ['New', 'In progress', 'Done', 'Verified', 'Completed'];

/** Where a task is in its life: New → In progress → Done → Verified → Completed. */
export function ProgressSteps({ index }: { index: number }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  // The line runs from the first dot's centre to the last one's.
  const inset = width > 0 ? 4 + (width - 8) / 10 : 34;
  const track = Math.max(0, width - inset * 2);
  // The line's length in a shared value, grown only when the step or the
  // width changes; the first measure places it without animating.
  const target = (track * index) / 4;
  const length = useSharedValue(target);
  const placed = useRef(false);
  useEffect(() => {
    if (width <= 0) return;
    if (!placed.current || reduced) {
      placed.current = true;
      length.value = target;
      return;
    }
    length.value = withTiming(target, { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  }, [target, width, reduced, length]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Progress: ${LABELS[index] ?? ''}, step ${index + 1} of 5`}
      style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.cardRing }]}
    >
      <View style={[styles.track, { left: inset, right: inset, backgroundColor: colors.scheme === 'dark' ? colors.line : '#E4E7EC' }]} />
      <Moving value={length} kind="width" style={[styles.track, { left: inset, backgroundColor: colors.brand }]} />
      {LABELS.map((label, i) => {
        const past = i < index || (index === 4 && i === 4);
        const now = i === index && index < 4;
        return (
          <View key={label} style={styles.step}>
            {past ? (
              <View style={[styles.dot, { backgroundColor: colors.brand }]}>
                <Icon name="check" size={13} color={colors.scheme === 'dark' ? colors.ground : '#FFFFFF'} strokeWidth={3.2} />
              </View>
            ) : now ? (
              <View style={[styles.dot, { backgroundColor: colors.panel, borderWidth: 7, borderColor: colors.brand }]} />
            ) : (
              <View style={[styles.dot, { backgroundColor: colors.panel, borderWidth: 2, borderColor: colors.control }]} />
            )}
            <Text
              variant="footnote"
              align="center"
              color={i <= index ? 'ink' : 'ink2'}
              style={[styles.label, i === index && styles.labelNow]}
              // Always one line: bold "In progress" would otherwise wrap and make the card jump. Very large text shrinks a little instead.
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', paddingTop: 16, paddingBottom: 14, paddingHorizontal: 4, borderRadius: radius.card, borderWidth: 1 },
  track: { position: 'absolute', top: 27, height: 2 },
  step: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // A little wider than its column (about 67 pt on a small phone); the labels either side are short, so they never touch.
  label: { fontSize: 12, lineHeight: 15, width: 84 },
  labelNow: { fontFamily: 'InstrumentSans_600SemiBold' },
});
