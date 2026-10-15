import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { LAND } from '../motion/curves';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { Icon } from './Icon';

interface CheckCircleProps {
  checked: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/** The round check on an open task: a 26 pt ring in a 48 pt target that fills when tapped. */
export function CheckCircle({ checked, onPress, accessibilityLabel, disabled }: CheckCircleProps) {
  const colors = useColors();
  const reduced = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.target, pressed && !checked && styles.pressed]}
    >
      {checked ? (
        <Animated.View
          entering={reduced ? undefined : ZoomIn.springify(LAND.duration).dampingRatio(LAND.dampingRatio)}
          style={[styles.fill, { backgroundColor: colors.check.fill }]}
        >
          <Icon name="check" size={15} color={colors.check.mark} strokeWidth={3.2} />
        </Animated.View>
      ) : (
        <View style={[styles.ring, { borderColor: colors.check.ring, opacity: disabled ? 0.4 : 1 }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.86 }] },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  fill: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
