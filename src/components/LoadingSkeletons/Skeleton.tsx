import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useWindowDimensions, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useColors } from '../../theme/ThemeProvider';
import { type, type TypeVariant } from '../../theme/type';

const Pulse = createContext<SharedValue<number> | null>(null);

/**
 * A loading placeholder shaped like what is coming: bones where the text,
 * pictures and cards will be, sized like them, so nothing jumps when the real
 * content arrives. Every bone breathes together, slowly (still with Reduce
 * Motion), while cards and the page stay put. A screen reader hears one
 * "Loading" instead of each bone.
 */
export function Skeleton({ label = 'Loading', children, style }: { label?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(0.5, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  return (
    <Pulse.Provider value={pulse}>
      <View style={style} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
        {children}
      </View>
    </Pulse.Provider>
  );
}

/** One grey shape: a picture, a pill, a button. `outline`: an empty box, like a text field. */
export function Bone({
  width = '100%',
  height,
  radius = 6,
  outline = false,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  outline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const pulse = useContext(Pulse);
  const breathe = useAnimatedStyle(() => ({ opacity: pulse ? pulse.value : 1 }));
  const look = outline ? { borderWidth: 1.5, borderColor: colors.skeleton } : { backgroundColor: colors.skeleton };
  return <Animated.View style={[{ width, height, borderRadius: radius }, look, style, breathe]} />;
}

/** A round picture: an avatar, a step's circle. */
export function CircleBone({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <Bone width={size} height={size} radius={size / 2} style={style} />;
}

/**
 * Lines of text in a type variant. Each line takes the text's own line
 * height (scaled with the phone's text size, like the real text), with the
 * bar centred in it, so the skeleton is exactly as tall as the copy.
 */
export function TextBone({
  variant = 'body',
  width = '100%',
  lines = 1,
  lastWidth = '60%',
  size,
  style,
}: {
  variant?: TypeVariant;
  width?: DimensionValue;
  /** More than one: the last line is shorter, like a paragraph. */
  lines?: number;
  lastWidth?: DimensionValue;
  /** When the screen sets its own size on that text (a 28 pt title). */
  size?: { fontSize: number; lineHeight: number };
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const t = size ?? type[variant];
  const lineHeight = Math.round((t.lineHeight ?? 20) * fontScale);
  const bar = Math.max(8, Math.round((t.fontSize ?? 15) * 0.72 * fontScale));
  return (
    <View style={style}>
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={{ height: lineHeight, justifyContent: 'center' }}>
          <Bone width={lines > 1 && i === lines - 1 ? lastWidth : width} height={bar} radius={Math.min(6, bar / 2)} />
        </View>
      ))}
    </View>
  );
}
