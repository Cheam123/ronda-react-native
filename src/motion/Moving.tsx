import { memo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type DerivedValue, type SharedValue } from 'react-native-reanimated';

/**
 * - translateX, width: points; rotate: degrees.
 * - fade: 0 to 1, opacity (a backdrop).
 * - reveal: 0 to 1, a panel rising into place (fades, rises 16 pt, grows 3%).
 */
type Kind = 'translateX' | 'width' | 'rotate' | 'fade' | 'reveal';

interface MovingProps {
  /** Where it is: points to move or grow by, degrees to turn, or 0 to 1 shown. */
  value: SharedValue<number> | DerivedValue<number>;
  kind: Kind;
  /** The look that does not move (size, colour, corners). */
  style?: StyleProp<ViewStyle>;
  /** Unchanging content (an icon); a new look should change `style` or `contentKey`. */
  children?: ReactNode;
  /** Changes when the children's look changes (a colour), so it redraws. */
  contentKey?: string;
  pointerEvents?: 'none' | 'auto' | 'box-none';
  accessibilityViewIsModal?: boolean;
}

/**
 * A view moved by a shared value: a tab capsule, a switch knob, a thumb, a
 * sheet appearing.
 *
 * A re-render of an animated view puts it back where it was first drawn (on
 * Android with Reanimated 4), so a parent re-rendering for anything else (a
 * badge, a refetch, a menu opening) would undo the move. This draws it once
 * and only redraws when its look changes, and then from scratch, starting
 * where the value is.
 */
export function Moving({ style, contentKey = '', ...rest }: MovingProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  return <MovingView key={`${JSON.stringify(flat)}|${contentKey}`} style={flat} {...rest} />;
}

const MovingView = memo(
  function MovingView({ value, kind, style, children, pointerEvents, accessibilityViewIsModal }: Omit<MovingProps, 'contentKey'>) {
    const animated = useAnimatedStyle(() => {
      const v = value.value;
      if (kind === 'width') return { width: v };
      if (kind === 'rotate') return { transform: [{ rotate: `${v}deg` }] };
      if (kind === 'fade') return { opacity: v };
      if (kind === 'reveal') return { opacity: Math.min(1, v * 1.6), transform: [{ translateY: (1 - v) * 16 }, { scale: 0.97 + v * 0.03 }] };
      return { transform: [{ translateX: v }] };
    });
    return (
      <Animated.View pointerEvents={pointerEvents} accessibilityViewIsModal={accessibilityViewIsModal} style={[style, animated]}>
        {children}
      </Animated.View>
    );
  },
  // The key already covers the look; only a new shared value or kind redraws.
  (a, b) => a.value === b.value && a.kind === b.kind,
);
