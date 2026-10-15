import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SETTLE } from '../motion/curves';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks under the thumb. */
  scaleTo?: number;
  children?: ReactNode;
}

/** A pressable that gives under the thumb, then springs back. */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { style, scaleTo = 0.97, onPressIn, onPressOut, children, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SETTLE);
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
});
