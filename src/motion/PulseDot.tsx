import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';

/** A status dot. An overdue one sends out a soft ring every 2 s; with Reduce Motion it stays still. */
export function PulseDot({ color, size = 8, pulse = false }: { color: string; size?: number; pulse?: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const on = pulse && !reduced;
  useEffect(() => {
    if (!on) return;
    t.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);
  }, [on, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.value), transform: [{ scale: 1 + t.value * 1.8 }] }));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      {on ? <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color }, ring]} /> : null}
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color }]} />
    </View>
  );
}
