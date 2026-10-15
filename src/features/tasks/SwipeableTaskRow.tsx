import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { TaskRow } from '../../api/tasks';
import { Icon } from '../../components/Icon';
import { Text } from '../../components/Text';
import { haptic } from '../../lib/haptics';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useColors } from '../../theme/ThemeProvider';

/** How far a swipe right must go before it marks the task done (a short one only shows Done). */
const FULL_SWIPE = 140;

/**
 * A task row you can swipe. Right: a short swipe shows Done, a full swipe
 * does it. Left: Keep in view and On hold, when the task allows them.
 * Screen readers get the same actions through the row's own buttons.
 */
export function SwipeableTaskRow({
  task,
  children,
  onDone,
  onKeepInView,
  onHold,
}: {
  task: TaskRow;
  children: ReactNode;
  onDone?: () => void;
  onKeepInView?: () => void;
  onHold?: () => void;
}) {
  const colors = useColors();
  const swipeable = useRef<SwipeableMethods>(null);
  const canFinish = !!onDone && (task.can_done_task || task.can_accept_task);
  const parks = [onKeepInView && task.can_kiv_task ? { key: 'kiv', label: 'Keep in view', run: onKeepInView } : null, onHold && task.can_hold_task ? { key: 'hold', label: 'On hold', run: onHold } : null].filter(
    Boolean,
  ) as { key: string; label: string; run: () => void }[];

  if (!canFinish && parks.length === 0) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.1}
      leftThreshold={FULL_SWIPE}
      rightThreshold={60}
      overshootLeft={false}
      overshootRight={false}
      childrenContainerStyle={{ backgroundColor: colors.panel }}
      renderLeftActions={canFinish ? (_progress, translation) => <DonePanel translation={translation} /> : undefined}
      renderRightActions={
        parks.length
          ? () => (
              <View style={styles.parkPanel}>
                {parks.map((p) => (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      haptic.light();
                      swipeable.current?.close();
                      p.run();
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.park, { backgroundColor: p.key === 'kiv' ? colors.tones.neutral.tile : colors.tones.serious.tile }, pressed && { opacity: 0.8 }]}
                  >
                    <Icon name={p.key === 'kiv' ? 'bookmark' : 'pause'} size={20} color={p.key === 'kiv' ? colors.tones.neutral.ink : colors.tones.serious.ink} strokeWidth={2.2} />
                    <Text variant="captionStrong" color={p.key === 'kiv' ? colors.tones.neutral.ink : colors.tones.serious.ink} align="center">
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )
          : undefined
      }
      onSwipeableWillOpen={(direction) => {
        // The Done panel sits on the left; opening it means a full swipe right.
        if (direction === 'left' && canFinish) {
          swipeable.current?.close();
          onDone?.();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function DonePanel({ translation }: { translation: SharedValue<number> }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  // The check grows as the swipe nears the point where it counts.
  const style = useAnimatedStyle(() => {
    const t = interpolate(translation.value, [0, FULL_SWIPE], [0.8, 1.08], 'clamp');
    return { transform: [{ scale: reduced ? 1 : t }], opacity: interpolate(translation.value, [24, 64], [0, 1], 'clamp') };
  });
  return (
    <View style={[styles.donePanel, { backgroundColor: colors.check.fill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.doneInner, style]}>
        <Icon name="check" size={22} color="#FFFFFF" strokeWidth={3} />
        <Text variant="captionStrong" color="#FFFFFF">
          Done
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  donePanel: { flex: 1, justifyContent: 'center', paddingLeft: 18 },
  doneInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parkPanel: { flexDirection: 'row' },
  park: { width: 96, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
});
