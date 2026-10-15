import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { SETTLE } from '../motion/curves';
import { Moving } from '../motion/Moving';
import { haptic } from '../lib/haptics';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { Text } from './Text';

interface SwitchRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/** A labelled on/off switch, the whole row a 48 pt target. */
export function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  const colors = useColors();
  const reduced = useReducedMotion();
  // The knob's place in a shared value, moved only when the switch changes.
  const x = useSharedValue(value ? 20 : 0);
  useEffect(() => {
    x.value = reduced ? (value ? 20 : 0) : withSpring(value ? 20 : 0, SETTLE);
  }, [value, reduced, x]);
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.row}
    >
      <View style={styles.flex}>
        <Text variant="bodyStrong" style={styles.label}>
          {label}
        </Text>
        {hint ? (
          <Text variant="footnote" color="ink2">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.brand : colors.scheme === 'dark' ? colors.control : '#E4E7EC' }]}>
        <Moving value={x} kind="translateX" style={styles.knob} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  flex: { flex: 1 },
  label: { fontSize: 15, lineHeight: 20 },
  track: { width: 51, height: 31, borderRadius: 16, padding: 2 },
  knob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#101828',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
