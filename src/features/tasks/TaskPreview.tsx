import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TaskRow } from '../../api/tasks';
import { Tag } from '../../components/Chips';
import { Sheet, SheetAction, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { openDirections } from '../../lib/location';
import { keepTogether } from '../../lib/format';
import { dueNote, formatDue, riskChip, statusColors, statusLabel } from '../../lib/taskCopy';
import { useColors } from '../../theme/ThemeProvider';

export interface PreviewActions {
  open: (task: TaskRow) => void;
  start: (task: TaskRow) => void;
  done: (task: TaskRow) => void;
  message: (task: TaskRow) => void;
}

/**
 * Press and hold a task: it lifts out with its most used actions. Opens on
 * a light haptic (the caller's); a tap outside or a drag down closes it.
 */
export const TaskPreview = forwardRef<SheetHandle, { task: TaskRow | null; actions: PreviewActions }>(function TaskPreview({ task, actions }, ref) {
  const colors = useColors();
  const close = () => (ref && typeof ref === 'object' ? ref.current?.close() : undefined);
  const run = (fn: (t: TaskRow) => void) => () => {
    close();
    if (task) fn(task);
  };

  const status = task ? statusColors(colors, Number(task.status)) : null;
  const due = task ? { status: task.status, risk: task.risk, dueAt: task.due_at, dueDate: task.task_due_date, dueTime: task.task_due_time } : null;
  const risk = due ? riskChip(due) : null;
  const where = task?.outlet_name ?? task?.lead_name ?? null;

  return (
    <Sheet ref={ref} fit>
      {task && status && due ? (
        <View>
          <View style={styles.tags}>
            <Tag size="large" text={statusLabel(Number(task.status))} ink={status.ink} bg={status.bg} dot={status.dot} />
            {risk ? <Tag size="large" text={risk} ink={colors.tones[task.risk === 'overdue' ? 'critical' : 'serious'].ink} bg={colors.tones[task.risk === 'overdue' ? 'critical' : 'serious'].tile} /> : null}
          </View>
          <Text variant="section" accessibilityRole="header" style={styles.title}>
            {task.title}
          </Text>
          {/* The chip already says how late it is, so this line gives the date. */}
          <Text variant="subhead" color="ink2">
            {[where, risk ? `Due ${formatDue(due)}` : dueNote(due, { prefix: true })].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.actions}>
            {Number(task.status) === 1 && task.can_accept_task ? <SheetAction label="Start task" hint="Move it to In progress" onPress={run(actions.start)} /> : null}
            {task.can_done_task || task.can_accept_task ? <SheetAction label="Mark as done" hint={`${task.checker ?? 'Your manager'} checks it next, with Undo for ${keepTogether('5 seconds')}`} onPress={run(actions.done)} /> : null}
            <SheetAction label={`Message ${task.checker ?? 'the checker'}`} hint="Open the task messages" onPress={run(actions.message)} />
            {where ? <SheetAction label="Directions" hint={`To ${where}`} onPress={run(() => openDirections({ name: where }))} /> : null}
            <SheetAction label="Open the task" onPress={run(actions.open)} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  title: { marginTop: 10 },
  actions: { marginTop: 12 },
});
