import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchTasks, taskKeys } from '../../api/tasks';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { PressableScale } from '../../components/Pressable';
import { Text } from '../../components/Text';
import { capitalise, formatDateTime, formatMoney, plural } from '../../lib/format';
import { dueNote, toneFor } from '../../lib/taskCopy';
import { riseIn } from '../../motion/curves';
import { DoneRing } from '../../motion/DoneRing';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

/** The order went through: the ring closes, and any open work here is one tap away. */
export function OrderSentScreen({ route, navigation }: RootScreenProps<'OrderSent'>) {
  const { outletId, outletName, orderNo, orderedAt, total, lines } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const short = useWindowDimensions().height < 760;
  const reduced = useReducedMotion();
  const { role } = useAuth();
  const open = useQuery({ queryKey: taskKeys.list({ status: 0, lead_id: outletId }), queryFn: () => fetchTasks({ status: 0, lead_id: outletId }) });
  const nextTask = (open.data?.tasks ?? []).find((t) => t.can_done_task || t.can_accept_task);

  // After the ring has closed, one after another.
  const enter = (i: number) => (reduced ? undefined : riseIn(500 + i * 110, 360));
  const home = () => navigation.popToTop();

  return (
    // Scrolls when it does not fit (a short phone, large text); otherwise the button sits at the bottom.
    <ScrollView
      style={{ backgroundColor: colors.scheme === 'dark' ? colors.ground : colors.panel }}
      contentContainerStyle={[styles.fill, { paddingTop: insets.top + (short ? 28 : 70), paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.center}>
        <DoneRing size={110} accessibilityLabel="Order sent" />
        <Animated.View entering={enter(0)}>
          <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>
            Order sent
          </Text>
          <Text variant="body" color="ink2" align="center" style={styles.sub}>
            Good work on that visit!
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={enter(1)} style={[styles.summary, { backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.ground }]}>
        <View style={styles.summaryTop}>
          <Text variant="mono" color="body">
            {orderNo ?? 'New order'}
          </Text>
          <Text variant="footnote" color="ink2">
            {formatDateTime(orderedAt)}
          </Text>
        </View>
        <View style={styles.summaryBottom}>
          <View style={styles.flex}>
            <Text variant="rowTitle">{outletName}</Text>
            <Text variant="subhead" color="ink2">
              {plural(lines, 'product')}
            </Text>
          </View>
          <Text variant="title2" style={styles.total}>
            {formatMoney(total)}
          </Text>
        </View>
      </Animated.View>

      {nextTask ? (
        <Animated.View entering={enter(2)} style={[styles.task, { borderColor: colors.line }]}>
          <Text variant="captionStrong" color="ink2">
            Still open at this outlet
          </Text>
          <View style={styles.taskRow}>
            <View style={styles.flex}>
              <Text variant="rowTitle">{nextTask.title}</Text>
              <Text variant="subhead" color={colors.tones[toneFor(nextTask.risk)].ink} style={styles.strong}>
                {capitalise(dueNote({ status: nextTask.status, risk: nextTask.risk, dueAt: nextTask.due_at }))}
              </Text>
            </View>
            <PressableScale
              onPress={() => navigation.replace('Task', { id: nextTask.id, title: nextTask.title })}
              accessibilityRole="button"
              style={[styles.taskButton, { backgroundColor: colors.brandTint }]}
            >
              <Text variant="captionStrong" color={colors.brandInk} style={styles.taskButtonText}>
                Mark as done
              </Text>
            </PressableScale>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(3)} style={styles.bottom}>
        <Button label={role === 'manager' ? 'Back to team' : 'Back to today'} onPress={home} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, paddingHorizontal: space.gutter },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: 'InstrumentSans_600SemiBold' },
  center: { alignItems: 'center', paddingHorizontal: 12 },
  title: { marginTop: 22, fontSize: 32, lineHeight: 38 },
  sub: { marginTop: 6, fontSize: 17, lineHeight: 25 },
  summary: { marginTop: 28, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  summaryBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 10 },
  total: { fontSize: 22, lineHeight: 26 },
  task: { marginTop: 14, borderRadius: radius.card, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 18 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  taskButton: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center' },
  taskButtonText: { fontSize: 15 },
  // The button sits where every bottom bar puts it, a little further in than the cards.
  bottom: { marginTop: 'auto', paddingTop: 20, marginHorizontal: space.side - space.gutter },
});
