import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchTasks, taskKeys, type TaskRow } from '../../api/tasks';
import { Card, CardSlice, ListRow } from '../../components/Card';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { TabScreen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import type { SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { haptic } from '../../lib/haptics';
import { groupFor, type GroupKey } from '../../lib/taskCopy';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useTabBarSpace } from '../../navigation/TabBar';
import type { RepTabScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { useUndo } from '../../undo/UndoProvider';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import { TaskPreview } from './TaskPreview';
import { TaskRowItem } from './TaskRowItem';
import { doneKey, useTaskActions } from './useTaskActions';

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Due today' },
  { key: 'later', title: 'Later' },
];

/** How long the filled circle and strike stay before the row folds away. */
const SETTLE_MS = 650;

export function TasksScreen({ navigation }: RepTabScreenProps<'Tasks'>) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const tabSpace = useTabBarSpace();
  const { setBottomOffset } = useUndo();
  const { markDone, pending, start, keepInView, hold } = useTaskActions();
  const [preview, setPreview] = useState<TaskRow | null>(null);
  const previewSheet = useRef<SheetHandle>(null);
  const [view, setView] = useState<'open' | 'done'>('open');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const open = useQuery({ queryKey: taskKeys.list({ status: 0 }), queryFn: () => fetchTasks({ status: 0 }) });
  const done = useQuery({ queryKey: taskKeys.list({ status: 3 }), queryFn: () => fetchTasks({ status: 3 }), enabled: view === 'done' });
  // Only the count is needed here; its own key keeps this one-row reply out of the Parked screen's list.
  const parked = useQuery({ queryKey: taskKeys.list({ focus: 'parked', per_page: 1 }), queryFn: () => fetchTasks({ focus: 'parked', per_page: 1 }) });

  // The toast sits just above the floating tab bar.
  useEffect(() => setBottomOffset(tabSpace - 12), [setBottomOffset, tabSpace]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const openTasks = useMemo(
    () => (open.data?.tasks ?? []).filter((t) => !pending.has(doneKey(t.id))),
    [open.data, pending],
  );
  const groups = useMemo(() => {
    const now = new Date();
    const sorted = [...openTasks].sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9'));
    return GROUPS.map((g) => ({
      ...g,
      rows: sorted.filter((t) => groupFor({ status: t.status, risk: t.risk, dueAt: t.due_at }, now) === g.key),
    })).filter((g) => g.rows.length > 0);
  }, [openTasks]);

  const check = (task: TaskRow) => {
    if (checked.has(task.id)) return;
    setChecked((s) => new Set(s).add(task.id));
    const timer = setTimeout(() => {
      markDone(
        { id: task.id, status: task.status, checker: task.checker },
        {
          onUndo: () =>
            setChecked((s) => {
              const next = new Set(s);
              next.delete(task.id);
              return next;
            }),
          onDone: () =>
            setChecked((s) => {
              const next = new Set(s);
              next.delete(task.id);
              return next;
            }),
        },
      );
    }, reduced ? 0 : SETTLE_MS);
    timers.current.set(task.id, timer);
  };

  const openCount = openTasks.length;
  const parkedCount = parked.data?.pagination?.total ?? 0;
  const refresh = () => Promise.all([open.refetch(), parked.refetch(), view === 'done' ? done.refetch() : null]);
  const goTask = (t: TaskRow) => navigation.navigate('Task', { id: t.id, title: t.title });
  const lift = (t: TaskRow) => {
    haptic.light();
    setPreview(t);
    previewSheet.current?.open();
  };
  const safely = (fn: () => Promise<unknown>) => () => {
    fn().catch((e) => Alert.alert('We could not change the task', errorMessage(e)));
  };

  // One flat list for the FlatList: a title before each group, then its rows.
  const doneTasks = done.data?.tasks ?? [];
  const items: ListItem[] = [];
  if (view === 'open' && !open.isPending && !open.isError) {
    for (const g of groups) {
      items.push({ kind: 'title', key: `t-${g.key}`, title: g.title, critical: g.key === 'overdue' });
      g.rows.forEach((t, i) => items.push({ kind: 'task', key: `r-${t.id}`, task: t, first: i === 0, last: i === g.rows.length - 1 }));
    }
  }
  if (view === 'done' && !done.isPending && !done.isError && doneTasks.length) {
    doneTasks.forEach((t, i) => items.push({ kind: 'task', key: `d-${t.id}`, task: t, first: i === 0, last: i === doneTasks.length - 1, done: true }));
  }

  const renderItem = (item: ListItem) => {
    if (item.kind === 'title') {
      return (
        <Text variant="captionStrong" color={item.critical ? colors.tones.critical.ink : colors.ink2} accessibilityRole="header" style={styles.groupTitle}>
          {item.title}
        </Text>
      );
    }
    const t = item.task;
    if (item.done) {
      return (
        <CardSlice first={item.first} last={item.last}>
          <TaskRowItem
            task={t}
            last={item.last}
            onLongPress={() => lift(t)}
            showStatus
            footnote={t.checker ? `${t.checker} checks it` : undefined}
            onPress={() => goTask(t)}
          />
        </CardSlice>
      );
    }
    return (
      <CardSlice first={item.first} last={item.last}>
        <SwipeableTaskRow task={t} onDone={() => check(t)} onKeepInView={safely(() => keepInView(t.id))} onHold={safely(() => hold(t.id))}>
          <TaskRowItem
            task={t}
            last={item.last}
            checkable={t.can_done_task || t.can_accept_task}
            checked={checked.has(t.id)}
            onCheck={() => check(t)}
            onPress={() => goTask(t)}
            onLongPress={() => lift(t)}
          />
        </SwipeableTaskRow>
      </CardSlice>
    );
  };

  const parkedRow =
    view === 'open' && parkedCount > 0 ? (
      <Card style={[styles.card, styles.parked]}>
        <ListRow onPress={() => navigation.navigate('ParkedTasks')} divider={false} chevron accessibilityLabel={`On hold or kept in view, ${parkedCount}`}>
          <Text variant="subhead" color="body" style={styles.flex}>
            On hold or kept in view
          </Text>
          <Text variant="subhead" color="ink2">
            {parkedCount}
          </Text>
        </ListRow>
      </Card>
    ) : null;

  return (
    <TabScreen
      title="Tasks"
      titleAccessory={
        <IconButton onPress={() => navigation.navigate('TaskSearch')} accessibilityLabel="Search tasks">
          <Icon name="search" size={20} color={colors.body} strokeWidth={2} />
        </IconButton>
      }
      onRefresh={refresh}
      list={{ data: items, keyExtractor: (item) => item.key, renderItem, footer: parkedRow, animateRows: true }}
      overlay={
        <TaskPreview
          ref={previewSheet}
          task={preview}
          actions={{
            open: goTask,
            start: (t) => safely(() => start(t.id))(),
            done: check,
            message: (t) => navigation.navigate('TaskMessages', { id: t.id, title: t.title }),
          }}
        />
      }
    >
      <View style={styles.segment}>
        <Segmented
          accessibilityLabel="Show"
          value={view}
          onChange={setView}
          segments={[
            { key: 'open', label: open.data ? `Open ${openCount}` : 'Open' },
            { key: 'done', label: 'Done' },
          ]}
        />
      </View>

      {view === 'open' ? (
        open.isPending ? (
          <Loading label="Loading your tasks" />
        ) : open.isError ? (
          <View style={styles.block}>
            <LoadError message={errorMessage(open.error)} onRetry={() => open.refetch()} />
          </View>
        ) : groups.length === 0 ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(260)} style={styles.block}>
            <EmptyState icon="tasks" title="No open tasks" body="New tasks from your manager show up here." />
          </Animated.View>
        ) : null
      ) : done.isPending ? (
        <Loading label="Loading done tasks" />
      ) : done.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(done.error)} onRetry={() => done.refetch()} />
        </View>
      ) : (
        <>
          <Text variant="captionStrong" color="ink2" accessibilityRole="header" style={styles.groupTitle}>
            Waiting for checking
          </Text>
          {doneTasks.length === 0 ? (
            <View style={styles.blockTight}>
              <EmptyState icon="check" title="Nothing waiting" body="Tasks you mark as done wait here until they are checked." />
            </View>
          ) : null}
        </>
      )}
    </TabScreen>
  );
}

/** A row of the Tasks list: a group's title, or a task in that group's card. */
type ListItem =
  | { kind: 'title'; key: string; title: string; critical: boolean }
  | { kind: 'task'; key: string; task: TaskRow; first: boolean; last: boolean; done?: boolean };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segment: { marginTop: 16, marginHorizontal: space.gutter },
  groupTitle: { marginTop: 24, marginBottom: 10, marginHorizontal: 20, fontSize: 15 },
  card: { marginHorizontal: space.gutter },
  parked: { marginTop: 12, borderRadius: radius.card },
  block: { marginTop: 24 },
  blockTight: { marginTop: 0 },
});
