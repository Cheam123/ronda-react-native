import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Text } from '../../components/Text';
import { formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useColors } from '../../theme/ThemeProvider';

/**
 * First run: explain the location stamp before Android asks. The permission
 * is "while using the app" only; nothing is ever recorded in the background.
 */
export function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { finishLocationIntro } = useAuth();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const isDark = colors.scheme === 'dark';

  const pin = useSharedValue(reduced ? 1 : 0);
  const chip = useSharedValue(reduced ? 1 : 0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // 3.2 s loop: pin drops and squashes, ripples spread, the stamp chip pops.
    pin.value = withRepeat(
      withSequence(withTiming(0, { duration: 250 }), withTiming(1, { duration: 450, easing: Easing.out(Easing.back(2)) }), withDelay(1650, withTiming(1, { duration: 1 })), withTiming(0, { duration: 300 })),
      -1,
    );
    ripple.value = withRepeat(withSequence(withDelay(700, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) })), withTiming(0, { duration: 1 }), withDelay(1400, withTiming(0, { duration: 1 }))), -1);
    chip.value = withRepeat(
      withSequence(withDelay(1150, withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) })), withDelay(1450, withTiming(0, { duration: 280 }))),
      -1,
    );
  }, [reduced, pin, chip, ripple]);

  const pinStyle = useAnimatedStyle(() => ({ opacity: pin.value, transform: [{ translateY: (1 - pin.value) * -70 }] }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: ripple.value === 0 ? 0 : 0.8 * (1 - ripple.value), transform: [{ scale: 0.3 + ripple.value * 2.3 }] }));
  const chipStyle = useAnimatedStyle(() => ({ opacity: chip.value, transform: [{ translateY: (1 - chip.value) * 8 }, { scale: 0.9 + chip.value * 0.1 }] }));

  const allow = async () => {
    setBusy(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      haptic.light();
    } catch {
      // Asking again happens the first time they tap Stamp location.
    } finally {
      setBusy(false);
      finishLocationIntro();
    }
  };

  const map = isDark
    ? { bg: '#151C28', road: '#273142', block: '#1C2433', park: '#12261D', water: '#0E2230', halo1: '#0F1824', halo2: '#122030' }
    : { bg: '#EEF1F4', road: '#FFFFFF', block: '#E1E5EA', park: '#DCEFE3', water: '#D6E8F5', halo1: '#F3F8FB', halo2: '#E9F2F7' };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? colors.ground : colors.panel }}
      contentContainerStyle={[styles.fill, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}
    >
      <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.halo, { width: 300, height: 300, backgroundColor: map.halo1 }]} />
        <View style={[styles.halo, { width: 220, height: 220, backgroundColor: map.halo2 }]} />
        <View style={[styles.mapCard, { backgroundColor: map.bg }]}>
          <Svg width={200} height={152} viewBox="0 0 200 152">
            <Path d="M120 0 C 150 30, 170 40, 200 44 L200 0 Z" fill={map.park} />
            <Path d="M0 118 C 40 108, 80 130, 120 152 L0 152 Z" fill={map.water} />
            <Path d="M-10 62 L210 40" stroke={map.road} strokeWidth={12} />
            <Path d="M70 -10 L92 162" stroke={map.road} strokeWidth={9} />
            <Path d="M140 30 L160 162" stroke={map.road} strokeWidth={6} />
            <Path d="M-10 104 L210 92" stroke={map.road} strokeWidth={6} />
            <Rect x={104} y={64} width={26} height={20} rx={3} fill={map.block} />
            <Rect x={20} y={70} width={34} height={22} rx={3} fill={map.block} />
            <Rect x={160} y={54} width={30} height={28} rx={3} fill={map.block} />
          </Svg>
          <Animated.View style={[styles.ripple, { borderColor: colors.brand }, rippleStyle]} />
          <Animated.View style={[styles.pin, pinStyle]}>
            <Svg width={40} height={48} viewBox="0 0 40 48">
              <Path d="M20 47s-15-12.6-15-25a15 15 0 0 1 30 0c0 12.4-15 25-15 25Z" fill={colors.brand} />
              <Circle cx={20} cy={21} r={6.5} fill={isDark ? colors.ground : '#FFFFFF'} />
              <Circle cx={20} cy={21} r={3.2} fill={colors.coral} />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View style={[styles.stamp, { backgroundColor: isDark ? colors.raised : colors.panel, borderColor: colors.cardRing }, chipStyle]}>
          <View style={[styles.stampTick, { backgroundColor: '#067647' }]}>
            <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text variant="captionStrong">Stamped {formatTime(new Date())}</Text>
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <Text variant="title" accessibilityRole="header">
          Your location, only when you stamp
        </Text>
        <Text variant="body" color="ink2" style={styles.lead}>
          Ronda records your GPS location when you tap Stamp location on a visit or a form. Never at any other time.
        </Text>

        <View style={styles.points}>
          <Point icon="pin" title="One tap at the outlet" body="The stamp shows the visit happened at the outlet." />
          <Point icon="eye" title="You see every stamp" body="Each record shows the place and the time." />
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Allow when I stamp" onPress={allow} loading={busy} />
        <Button label="Not now" variant="ghost" onPress={finishLocationIntro} size="medium" />
      </View>
    </ScrollView>
  );
}

function Point({ icon, title, body }: { icon: 'pin' | 'eye'; title: string; body: string }) {
  const colors = useColors();
  return (
    <View style={styles.point}>
      <View style={[styles.pointIcon, { backgroundColor: colors.brandTint }]}>
        <Icon name={icon} size={22} color={colors.brandInk} strokeWidth={1.8} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" style={styles.pointTitle}>
          {title}
        </Text>
        <Text variant="subhead" color="ink2">
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, paddingHorizontal: 24 },
  flex: { flex: 1 },
  art: { height: 300, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderRadius: 999 },
  mapCard: {
    width: 200,
    height: 152,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  ripple: { position: 'absolute', left: 86, top: 92, width: 28, height: 10, borderRadius: 14, borderWidth: 2 },
  pin: { position: 'absolute', left: 80, top: 50 },
  stamp: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  stampTick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { marginTop: 12 },
  lead: { marginTop: 10 },
  points: { marginTop: 24, gap: 16 },
  point: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pointIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pointTitle: { fontSize: 15, lineHeight: 20 },
  // At least this much air above the button when the page is longer than the phone.
  actions: { marginTop: 'auto', paddingTop: 28, gap: 6 },
});
