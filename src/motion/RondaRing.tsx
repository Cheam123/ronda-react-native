import { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../theme/ThemeProvider';
import { useReducedMotion } from './useReducedMotion';

interface RondaRingProps {
  size?: number;
  /** Ring colour; the brand colour by default. */
  color?: string;
  /** Spin (the loader). Off for a still mark. */
  spinning?: boolean;
  accessibilityLabel?: string;
}

/**
 * The loader: in a 100 × 100 box, a ring r=34, stroke 10, round caps,
 * dasharray "178 35.6", turned −60°, with a coral dot at (50, 16) r=7.
 * It turns once every 1.1 s, linear. Reduce Motion keeps it still.
 */
export function RondaRing({ size = 40, color, spinning = true, accessibilityLabel = 'Loading' }: RondaRingProps) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (spinning && !reduced) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(turn);
      turn.value = 0;
    }
    return () => cancelAnimation(turn);
  }, [spinning, reduced, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle
          cx={50}
          cy={50}
          r={34}
          fill="none"
          stroke={color ?? colors.brand}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray="178 35.6"
          transform="rotate(-60 50 50)"
        />
        <Circle cx={50} cy={16} r={7} fill={colors.coral} />
      </Svg>
    </Animated.View>
  );
}
