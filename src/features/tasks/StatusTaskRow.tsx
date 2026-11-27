import { StyleSheet, View } from 'react-native';
import type { TaskRow } from '../../api/tasks';
import { ListRow } from '../../components/Card';
import { StatusSign } from '../../components/StatusSign';
import { Text } from '../../components/Text';
import { capitalise, relativeDay } from '../../lib/format';
import { doneNote, dueMoment, statusLabel } from '../../lib/taskCopy';

/**
 * The line under a done or paused task, in place of a status pill:
 *   done      "Done today, 9:10 AM · Mei Ling Tan checks it"
 *   paused    "On hold · due Fri 4 Dec", "Kept in view · no due date"
 */
export function statusLine(task: TaskRow, now = new Date()): string {
  const status = Number(task.status);
  if (status === 3) return `${capitalise(doneNote(task.done_date, now))}${task.checker ? ` · ${task.checker} checks it` : ''}`;
  const due = dueMoment({ status: task.status, risk: task.risk, dueAt: task.due_at, dueDate: task.task_due_date, dueTime: task.task_due_time });
  return `${statusLabel(status)} · ${due ? `due ${relativeDay(due, now)}` : 'no due date'}`;
}

/** One done or paused task on the Tasks tab: its sign, title, place and what state it is in. No pill. */
export function StatusTaskRow({ task, last, onPress }: { task: TaskRow; last: boolean; onPress: () => void }) {
  const where = task.outlet_name ?? task.lead_name ?? 'No outlet';
  const line = statusLine(task);
  return (
    <ListRow onPress={onPress} divider={!last} chevron align="top" accessibilityLabel={`${task.title}, ${where}, ${line}`}>
      <View style={styles.sign}>
        <StatusSign status={Number(task.status)} />
      </View>
      <View style={styles.flex}>
        <Text variant="rowTitle">{task.title}</Text>
        <Text variant="caption" color="ink2">
          {where}
        </Text>
        <Text variant="caption" color="ink2" style={styles.line}>
          {line}
        </Text>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  sign: { marginTop: 1 },
  line: { marginTop: 2 },
});
