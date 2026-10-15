import { Easing, withDelay, withTiming } from 'react-native-reanimated';

/**
 * Ronda's motion in one place: calm and exact. Things ease out and come to
 * rest without bouncing. A spring that slides something to a new place keeps
 * a damping ratio near 1, so it never visibly overshoots and swings back.
 */

/** Arriving: quick to start, soft to land. */
export const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Leaving: gathers speed as it goes. */
export const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

/** Sliding to a new place: the tab capsule, a segment thumb. */
export const GLIDE = { duration: 320, dampingRatio: 0.92 } as const;

/** A small control coming to rest: a switch knob, a pressed button. */
export const SETTLE = { duration: 220, dampingRatio: 0.9 } as const;

/** Something landing (a tick): one small give, then still. */
export const LAND = { duration: 300, dampingRatio: 0.72 } as const;

/** Content arriving: a short rise and fade. */
export function riseIn(delay = 0, duration = 280) {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 10 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration, easing: EASE_OUT })),
        transform: [{ translateY: withDelay(delay, withTiming(0, { duration, easing: EASE_OUT })) }],
      },
    };
  };
}

/** A status pill that changed: it settles in from slightly small. */
export function settleIn(duration = 260) {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
      animations: {
        opacity: withTiming(1, { duration: duration * 0.7, easing: EASE_OUT }),
        transform: [{ scale: withTiming(1, { duration, easing: EASE_OUT }) }],
      },
    };
  };
}
