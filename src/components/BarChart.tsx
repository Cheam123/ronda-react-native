import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface Bar {
  label: string;
  /** One value per series (a single bar, or two side by side). */
  values: number[];
  /** Read out for this bar ("Tue, 2 visits"). */
  spoken: string;
}

/**
 * Small bar chart: bars grow up from the base (not with Reduce Motion). The
 * whole chart is one accessible image whose label lists every value.
 */
export function BarChart({
  bars,
  colors: seriesColors,
  height = 120,
  accessibilityLabel,
  axisLabels,
  empty,
}: {
  bars: Bar[];
  colors: string[];
  height?: number;
  accessibilityLabel: string;
  /** A few labels spread along the axis, instead of one under every bar (long charts). */
  axisLabels?: string[];
  /** Said instead of an empty plot when every value is 0. */
  empty?: string;
}) {
  const colors = useColors();
  const max = Math.max(1, ...bars.flatMap((b) => b.values));
  if (empty && bars.every((b) => b.values.every((v) => v === 0))) {
    return (
      <Text variant="subhead" color="ink2">
        {empty}
      </Text>
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${accessibilityLabel}: ${bars.map((b) => b.spoken).join(', ')}`}>
      <View style={[styles.plot, { height, borderBottomColor: colors.line }]}>
        {bars.map((b, i) => (
          <View key={`${b.label}-${i}`} style={styles.slot}>
            <View style={styles.pair}>
              {b.values.map((v, j) => (
                <Grow key={j} ratio={v / max} color={seriesColors[j] ?? seriesColors[0]} delay={i * 40} height={height} />
              ))}
            </View>
          </View>
        ))}
      </View>
      {axisLabels ? (
        <View style={[styles.labels, styles.axis]}>
          {axisLabels.map((l, i) => (
            <Text key={`${l}-${i}`} variant="footnote" color="ink2">
              {l}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.labels}>
          {bars.map((b, i) => (
            <Text key={`${b.label}-${i}`} variant="footnote" color="ink2" align="center" numberOfLines={1} style={styles.label}>
              {b.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Grow({ ratio, color, delay, height }: { ratio: number; color: string; delay: number; height: number }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? ratio : 0);
  useEffect(() => {
    h.value = reduced ? ratio : withDelay(delay, withTiming(ratio, { duration: 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [ratio, reduced, delay, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(ratio > 0 ? 3 : 0, h.value * (height - 4)) }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: 1 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, width: '100%', justifyContent: 'center' },
  bar: { flex: 1, maxWidth: 22, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  labels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  label: { flex: 1 },
  axis: { justifyContent: 'space-between' },
});
