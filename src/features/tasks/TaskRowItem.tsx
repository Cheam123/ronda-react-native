import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import type { TaskRow } from '../../api/tasks';
import { CheckCircle } from '../../components/CheckCircle';
import { Tag } from '../../components/Chips';
import { PlaceAndNote } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { keepTogether } from '../../lib/format';
import { dueNote, statusColors, statusLabel, toneFor } from '../../lib/taskCopy';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useColors } from '../../theme/ThemeProvider';

interface TaskRowItemProps {
  task: TaskRow;
  onPress: () => void;
  onLongPress?: () => void;
  /** Show the quick-complete circle (open tasks the user may finish). */
  checkable?: boolean;
  checked?: boolean;
  onCheck?: () => void;
  last?: boolean;
  /** Show who it is for (manager lists). */
  showWho?: boolean;
  /** Show the status as a chip (Done lists). */
  showStatus?: boolean;
  /** A line under the row, e.g. "Mei Ling Tan checks it". */
  footnote?: string;
}

/** One task in a list: the check, the title, where and when. */
export function TaskRowItem({ task, onPress, onLongPress, checkable, checked = false, onCheck, last, showWho, showStatus, footnote }: TaskRowItemProps) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const tone = colors.tones[toneFor(task.risk)];
  const note = dueNote({ status: task.status, risk: task.risk, dueAt: task.due_at, dueDate: task.task_due_date, dueTime: task.task_due_time });
  const shownNote = keepTogether(note);
  const where = task.outlet_name ?? task.lead_name ?? 'No outlet';
  const who = showWho ? task.subscriber : null;
  const status = statusColors(colors, task.status);
  const unread = task.unread_notification ?? 0;

  return (
    <Animated.View
      exiting={reduced ? undefined : FadeOut.duration(260)}
      layout={reduced ? undefined : LinearTransition.duration(300)}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }, !checkable && styles.rowPlain]}
    >
      {checkable ? (
        <CheckCircle
          checked={checked}
          onPress={() => onCheck?.()}
          accessibilityLabel={checked ? `${task.title}, marked as done` : `Mark ${task.title} as done`}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${where}${who ? `, for ${who}` : ''}, ${showStatus ? statusLabel(task.status) : note}${unread ? `, ${unread} new messages` : ''}`}
        style={({ pressed }) => [styles.link, pressed && { backgroundColor: colors.pressed }]}
      >
        <Text
          variant="rowTitle"
          color={checked ? 'muted' : 'ink'}
          style={checked ? styles.strike : undefined}
        >
          {task.title}
        </Text>
        {showStatus ? (
          <Text variant="subhead" color="ink2">
            {who ? `${who} · ` : ''}
            {where}
          </Text>
        ) : (
          <PlaceAndNote place={who ? `${who} · ${where}` : where} note={shownNote} noteColor={checked ? colors.muted : tone.ink} />
        )}
        {showStatus ? (
          <View style={styles.statusRow}>
            <Tag text={statusLabel(task.status)} ink={status.ink} bg={status.bg} />
            {footnote ? (
              <Text variant="caption" color="ink2" style={styles.flex}>
                {footnote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      {unread > 0 && !checked ? (
        <View style={[styles.badge, { backgroundColor: colors.brand }]} accessibilityElementsHidden>
          <Text variant="label" color="#FFFFFF" style={styles.badgeText} allowFontScaling={false}>
            {unread}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingLeft: 6, paddingRight: 14 },
  rowPlain: { paddingLeft: 8 },
  link: { flex: 1, minWidth: 0, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  flex: { flexShrink: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'InstrumentSans_700Bold', fontSize: 12, lineHeight: 16 },
});
