import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { formatTime } from '../lib/format';
import { formatDistance, NEAR_OUTLET_METRES } from '../lib/location';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { fonts } from '../theme/type';
import { Card } from './Card';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** What a stamp needs to show: where and when (a visit's GpsStamp or a form's gps answer). */
export interface StampLike {
  lat: number;
  lng: number;
  accuracy: number | null;
  captured_at: string;
}

/** The dashed "Tap to stamp" button. Location is read only when it is tapped. */
export function StampButton({ onPress, busy, hint, style }: { onPress: () => void; busy: boolean; hint: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Tap to stamp your current location"
      accessibilityHint={hint}
      style={[styles.stampButton, { borderColor: '#84ADC2', backgroundColor: colors.panel }, style]}
    >
      <View style={[styles.stampIcon, { backgroundColor: colors.brandTint }]}>
        <Icon name="pin" size={26} color={colors.brand} />
      </View>
      <Text variant="rowTitle" align="center">
        {busy ? 'Checking your location…' : 'Tap to stamp your current location'}
      </Text>
      <Text variant="footnote" color="ink2" align="center" style={styles.stampHint}>
        {hint}
      </Text>
    </PressableScale>
  );
}

/** A stamp on a small drawn map, with "Stamp again". */
export function StampedCard({
  stamp,
  distance,
  onAgain,
  busy,
  note,
  style,
}: {
  stamp: StampLike;
  distance: number | null;
  onAgain?: () => void;
  busy?: boolean;
  /** Shown when there is no distance to give. */
  note?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const dark = colors.scheme === 'dark';
  const drop = useSharedValue(reduced ? 1 : 0);
  // The pin drops in and settles each time a new stamp lands.
  useEffect(() => {
    if (reduced) return;
    drop.value = 0;
    drop.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.8)) });
  }, [stamp.captured_at, reduced, drop]);
  const pin = useAnimatedStyle(() => ({ opacity: drop.value, transform: [{ translateY: (1 - drop.value) * -60 }] }));
  const far = distance != null && distance > NEAR_OUTLET_METRES;
  const detail =
    distance != null
      ? far
        ? `${formatDistance(distance)} from the outlet. Stamp again there.`
        : `${formatDistance(distance)} from the outlet`
      : (note ?? (stamp.accuracy != null ? `Accurate to about ${stamp.accuracy} m` : 'Location saved'));
  return (
    <Card style={[styles.block, style]}>
      <View style={[styles.map, { backgroundColor: dark ? '#151C28' : '#EDF0F3' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={128} viewBox="0 0 358 128" preserveAspectRatio="xMidYMid slice">
          <Path d="M-10 44 L368 32" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={12} />
          <Path d="M168 -10 L180 138" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={9} />
          <Path d="M-10 102 L368 96" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={6} />
          <Rect x={196} y={54} width={40} height={28} rx={4} fill={dark ? '#1C2433' : '#E3E7EC'} />
          <Rect x={96} y={56} width={50} height={26} rx={4} fill={dark ? '#1C2433' : '#E3E7EC'} />
          <Path d="M280 0 C 300 20, 330 26, 358 24 L358 0 Z" fill={dark ? '#12261D' : '#D9EEDF'} />
        </Svg>
        <Animated.View style={[styles.pin, pin]}>
          <Svg width={34} height={41} viewBox="0 0 40 48">
            <Path d="M20 47s-15-12.6-15-25a15 15 0 0 1 30 0c0 12.4-15 25-15 25Z" fill={colors.brand} stroke={dark ? colors.ground : '#FFFFFF'} strokeWidth={2.5} />
            <Circle cx={20} cy={21} r={6.5} fill={dark ? colors.ground : '#FFFFFF'} />
            <Circle cx={20} cy={21} r={3.2} fill={colors.coral} />
          </Svg>
        </Animated.View>
      </View>
      <View style={styles.stampedRow} accessible accessibilityLabel={`Stamped at ${formatTime(stamp.captured_at)}, ${detail}`}>
        {far ? (
          <View style={[styles.tick, { backgroundColor: colors.tones.serious.tile }]}>
            <Icon name="alert" size={18} color={colors.tones.serious.ink} strokeWidth={2.4} />
          </View>
        ) : (
          <View style={[styles.tick, { backgroundColor: '#067647' }]}>
            <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
        <View style={styles.flex}>
          <Text variant="subhead" style={styles.strong}>
            Stamped at {formatTime(stamp.captured_at)}
          </Text>
          <Text variant="footnote" color={far ? colors.tones.serious.ink : 'ink2'}>
            {detail}
          </Text>
        </View>
        {onAgain ? (
          <PressableScale onPress={onAgain} disabled={busy} accessibilityRole="button" style={styles.again}>
            <Text variant="captionStrong" color="link" style={styles.againText}>
              Stamp again
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fonts.semibold },
  block: { marginTop: 12, marginHorizontal: space.gutter, borderRadius: radius.card },
  stampButton: { marginTop: 12, marginHorizontal: space.gutter, paddingVertical: 20, paddingHorizontal: 16, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', gap: 10 },
  stampIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  stampHint: { maxWidth: 280 },
  map: { height: 128, overflow: 'hidden' },
  pin: { position: 'absolute', left: '50%', marginLeft: -17, top: 48 },
  stampedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  tick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  again: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  againText: { fontSize: 15 },
});
