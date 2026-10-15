import { memo, useEffect } from 'react';
import Animated, { Easing, interpolateColor, useAnimatedProps, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { haptic } from '../lib/haptics';
import { useColors } from '../theme/ThemeProvider';
import { useReducedMotion } from './useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE = Easing.bezier(0.65, 0, 0.35, 1);
const FULL = 213.6; // 2π × 34
/** Length of the check path M36 51 L46 61 L65 41 (14.1 + 27.6). */
const CHECK = 41.8;

/**
 * A "done" moment (order sent, form sent, task verified): the Ronda ring
 * closes, turning green as the dot shrinks away, then a check draws.
 */
export function DoneRing({ size = 110, accessibilityLabel = 'Done' }: { size?: number; accessibilityLabel?: string }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const close = useSharedValue(reduced ? 1 : 0);
  const check = useSharedValue(reduced ? 1 : 0);
  const green = colors.scheme === 'dark' ? '#17B26A' : '#079455';

  useEffect(() => {
    haptic.success();
    if (reduced) return;
    close.value = withTiming(1, { duration: 700, easing: EASE });
    check.value = withDelay(650, withTiming(1, { duration: 420, easing: EASE }));
  }, [reduced, close, check]);

  // Drawn by its own memoised component: a re-render of an animated view puts
  // it back where it was first drawn (on Android with Reanimated 4), which
  // would hide the check again. New colours remount it, from where it is.
  return (
    <Drawing
      key={`${colors.brand}-${colors.coral}-${green}`}
      close={close}
      check={check}
      size={size}
      label={accessibilityLabel}
      brand={colors.brand}
      coral={colors.coral}
      green={green}
    />
  );
}

const Drawing = memo(function Drawing({
  close,
  check,
  size,
  label,
  brand,
  coral,
  green,
}: {
  close: SharedValue<number>;
  check: SharedValue<number>;
  size: number;
  label: string;
  brand: string;
  coral: string;
  green: string;
}) {
  const ring = useAnimatedProps(() => ({
    strokeDasharray: [178 + 35.6 * close.value, 35.6 * (1 - close.value)],
    stroke: interpolateColor(close.value, [0, 1], [brand, green]),
  }));
  const dot = useAnimatedProps(() => ({ r: 6 * (1 - Math.min(1, close.value * 1.6)) }));
  // Hidden until it starts drawing, so the round cap does not show as a dot.
  const tick = useAnimatedProps(() => ({ strokeDashoffset: CHECK * (1 - check.value), strokeOpacity: check.value > 0 ? 1 : 0 }));

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible accessibilityRole="image" accessibilityLabel={label}>
      <AnimatedCircle cx={50} cy={50} r={34} fill="none" strokeWidth={8} strokeLinecap="round" transform="rotate(-60 50 50)" animatedProps={ring} />
      <AnimatedCircle cx={50} cy={16} fill={coral} animatedProps={dot} />
      <AnimatedPath
        d="M36 51 L46 61 L65 41"
        strokeDasharray={String(CHECK)}
        fill="none"
        stroke={green}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={tick}
      />
    </Svg>
  );
});

// The full circumference, for anyone drawing the closed ring by hand.
export const RING_LENGTH = FULL;
