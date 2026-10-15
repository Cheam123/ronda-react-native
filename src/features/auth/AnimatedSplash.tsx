import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { Text } from '../../components/Text';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { SPLASH_BLUE } from '../../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 206; // drawn length of the ring (dasharray "206 300")
const EASE = Easing.bezier(0.65, 0, 0.35, 1);

interface AnimatedSplashProps {
  /** True once fonts are loaded and the session is known. */
  ready: boolean;
  onDone: () => void;
}

/**
 * The hand-off from the native splash: the ring draws, the dot pops in, the
 * wordmark fades up, then the whole thing fades out over the app. Timings
 * follow the splash board (a 4.2 s loop, played once and cut short).
 */
export function AnimatedSplash({ ready, onDone }: AnimatedSplashProps) {
  const reduced = useReducedMotion();
  const ring = useSharedValue(RING);
  const dot = useSharedValue(0);
  const ping = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const out = useSharedValue(1);
  const introDone = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    // The JS splash is on screen: let the native one go.
    SplashScreen.hide();
    if (reduced) {
      ring.value = 0;
      dot.value = 1;
      word.value = 1;
      tag.value = 1;
      const t = setTimeout(() => (introDone.current = true), 500);
      return () => clearTimeout(t);
    }
    ring.value = withTiming(0, { duration: 920, easing: EASE });
    dot.value = withDelay(
      670,
      withSequence(
        withTiming(1.32, { duration: 290 }),
        withTiming(0.9, { duration: 210 }),
        withTiming(1, { duration: 170 }),
      ),
    );
    ping.value = withDelay(1510, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    word.value = withDelay(1090, withTiming(1, { duration: 590, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
    tag.value = withDelay(1760, withTiming(1, { duration: 500 }));
    const t = setTimeout(() => (introDone.current = true), 1900);
    return () => clearTimeout(t);
  }, [reduced, ring, dot, ping, word, tag]);

  useEffect(() => {
    if (!ready) return;
    const tick = setInterval(() => {
      if (!introDone.current || finished.current) return;
      finished.current = true;
      clearInterval(tick);
      out.value = withTiming(0, { duration: reduced ? 150 : 320 }, (done) => {
        if (done) scheduleOnRN(onDone);
      });
    }, 60);
    return () => clearInterval(tick);
  }, [ready, reduced, out, onDone]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ring.value }));
  const dotProps = useAnimatedProps(() => ({ r: 10 * dot.value }));
  const pingProps = useAnimatedProps(() => ({
    r: 10 * (1 + 2.2 * ping.value),
    strokeOpacity: ping.value === 0 ? 0 : 0.55 * (1 - ping.value),
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 10 }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value }));
  const allStyle = useAnimatedStyle(() => ({ opacity: out.value, transform: [{ scale: 1 + (1 - out.value) * 0.04 }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, allStyle]} accessibilityLabel="Ronda" accessible>
      <View style={styles.center}>
        <Svg width={116} height={116} viewBox="0 0 100 100" style={styles.mark}>
          <AnimatedCircle
            cx={50}
            cy={50}
            r={43}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray="206 300"
            transform="rotate(2 50 50)"
            animatedProps={ringProps}
          />
          <AnimatedCircle cx={83.5} cy={18.6} fill="none" stroke="#FF6B4E" strokeWidth={2} animatedProps={pingProps} />
          <AnimatedCircle cx={83.5} cy={18.6} fill="#FF6B4E" animatedProps={dotProps} />
        </Svg>
        <Animated.View style={wordStyle}>
          <Image source={require('../../../assets/brand/wordmark-white.png')} style={styles.word} contentFit="contain" accessible={false} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.tagWrap, tagStyle]}>
        <Text variant="subhead" color="rgba(255,255,255,0.88)" align="center" style={styles.tag}>
          Every outlet, every round.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BLUE, zIndex: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { overflow: 'visible' },
  word: { width: 204, height: 57, marginTop: 15 },
  tagWrap: { position: 'absolute', left: 0, right: 0, bottom: 64 },
  tag: { fontFamily: 'InstrumentSans_500Medium', letterSpacing: 0.15 },
});
