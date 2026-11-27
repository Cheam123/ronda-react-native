import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchTasks, taskKeys, type TaskRow } from '../../api/tasks';
import { CardSlice } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { FilterSheet, type FilterOption } from '../../components/FilterSheet';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { TabScreen } from '../../components/Screen';
import type { SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { haptic } from '../../lib/haptics';
import { groupFor, type GroupKey } from '../../lib/taskCopy';
import { failedToLoad } from '../../lib/query';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useTabBarSpace } from '../../navigation/TabBar';
import type { RepTabScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { useUndo } from '../../undo/UndoProvider';
import { StatusTaskRow } from './StatusTaskRow';
import { SwipeableTaskRow } from './SwipeableTaskRow';
import { TaskPreview } from './TaskPreview';
import { TaskRowItem } from './TaskRowItem';
import { doneKey, parkKey, useTaskActions } from './useTaskActions';

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Due today' },
  { key: 'later', title: 'Later' },
];

/** How long the filled circle and strike stay before the row folds away. */
const SETTLE_MS = 650;

type Show = 'open' | 'done' | 'parked';

/** What each list says under the title: which list it is, and for the narrowed ones, why the tasks are there. */
const LISTS: Record<Show, { caption: string; lead?: string; empty: string; emptyIcon: 'tasks' | 'check' | 'pause' }> = {
  open: { caption: 'Open tasks · most urgent first', empty: 'No open tasks', emptyIcon: 'tasks' },
  done: {
    caption: 'Done, waiting for checking · newest first',
    lead: 'Each one leaves this list once it is checked.',
    empty: 'Nothing is waiting for checking',
    emptyIcon: 'check',
  },
  parked: {
    caption: 'On hold or kept in view',
    lead: 'These are paused. They come back to Open tasks when someone starts them again.',
    empty: 'Nothing is on hold or kept in view',
    emptyIcon: 'pause',
  },
};

/**
 * The rep's tasks. Open tasks by default, most urgent first; the filter button
 * beside search switches to the ones done and waiting for checking, or the
 * ones on hold or kept in view, as the Outlets tab switches its list.
 */
export function TasksScreen({ navigation }: RepTabScreenProps<'Tasks'>) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const tabSpace = useTabBarSpace();
  const { setBottomOffset } = useUndo();
  const { markDone, pending, start, keepInView, hold } = useTaskActions();
  const [show, setShow] = useState<Show>('open');
  const [preview, setPreview] = useState<TaskRow | null>(null);
  const previewSheet = useRef<SheetHandle>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const open = useQuery({ queryKey: taskKeys.list({ status: 0 }), queryFn: () => fetchTasks({ status: 0 }) });
  // The menu's counts: one-row replies, under their own keys so they stay out of the lists they count.
  const doneCount = useQuery({ queryKey: taskKeys.list({ status: 3, per_page: 1 }), queryFn: () => fetchTasks({ status: 3, per_page: 1 }) });
  const parkedCount = useQuery({ queryKey: taskKeys.list({ focus: 'parked', per_page: 1 }), queryFn: () => fetchTasks({ focus: 'parked', per_page: 1 }) });
  // The narrowed lists load when they are chosen.
  const done = useQuery({ queryKey: taskKeys.list({ status: 3 }), queryFn: () => fetchTasks({ status: 3 }), enabled: show === 'done' });
  const parked = useQuery({ queryKey: taskKeys.list({ focus: 'parked' }), queryFn: () => fetchTasks({ focus: 'parked' }), enabled: show === 'parked' });
  const current = show === 'open' ? open : show === 'done' ? done : parked;

  // The toast sits just above the floating tab bar.
  useEffect(() => setBottomOffset(tabSpace - 12), [setBottomOffset, tabSpace]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const openTasks = useMemo(
    () => (open.data?.tasks ?? []).filter((t) => !pending.has(doneKey(t.id)) && !pending.has(parkKey(t.id))),
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
  // Newest first, as the caption says: the one just marked done is on top.
  const doneTasks = useMemo(() => [...(done.data?.tasks ?? [])].sort((a, b) => (b.done_date ?? '').localeCompare(a.done_date ?? '')), [done.data]);
  const parkedTasks = parked.data?.tasks ?? [];

  const check = (task: TaskRow) => {
    if (checked.has(task.id)) return;
    // Felt as the circle fills (or the swipe lands), not when the row folds away.
    haptic.success();
    setChecked((s) => new Set(s).add(task.id));
    const timer = setTimeout(() => {
      markDone(
        { id: task.id, status: task.status, checker: task.checker },
        {
          felt: true,
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

  const shows: FilterOption<Show>[] = [
    { key: 'open', label: 'Open tasks', count: open.data ? openTasks.length : undefined },
    { key: 'done', label: 'Done, waiting for checking', count: doneCount.data?.pagination?.total },
    { key: 'parked', label: 'On hold or kept in view', count: parkedCount.data?.pagination?.total },
  ];
  const list = LISTS[show];
  const refresh = () => Promise.all([open.refetch(), doneCount.refetch(), parkedCount.refetch(), show === 'done' ? done.refetch() : show === 'parked' ? parked.refetch() : null]);
  const goTask = (t: TaskRow) => navigation.navigate('Task', { id: t.id, title: t.title });
  const lift = (t: TaskRow) => {
    haptic.light();
    setPreview(t);
    previewSheet.current?.open();
  };
  const safely = (fn: () => Promise<unknown>) => () => {
    fn().catch((e) => Alert.alert('We could not change the task', errorMessage(e)));
  };

  // One flat list for the FlatList: open tasks in groups, each with a title; the narrowed lists in one card.
  const items: ListItem[] = [];
  if (!current.isPending && !failedToLoad(current)) {
    if (show === 'open') {
      for (const g of groups) {
        items.push({ kind: 'title', key: `t-${g.key}`, title: g.title });
        g.rows.forEach((t, i) => items.push({ kind: 'task', key: `r-${t.id}`, task: t, first: i === 0, last: i === g.rows.length - 1 }));
      }
    } else {
      const rows = show === 'done' ? doneTasks : parkedTasks;
      rows.forEach((t, i) => items.push({ kind: 'status', key: `${show}-${t.id}`, task: t, first: i === 0, last: i === rows.length - 1 }));
    }
  }
  const empty = !current.isPending && !failedToLoad(current) && items.length === 0;

  const renderItem = (item: ListItem) => {
    if (item.kind === 'title') {
      // Grey: the red is on each overdue date, not on the heading as well.
      return (
        <Text variant="captionStrong" color="ink2" accessibilityRole="header" style={styles.groupTitle}>
          {item.title}
        </Text>
      );
    }
    const t = item.task;
    if (item.kind === 'status') {
      return (
        <CardSlice first={item.first} last={item.last}>
          <StatusTaskRow task={t} last={item.last} onPress={() => goTask(t)} />
        </CardSlice>
      );
    }
    const finishable = t.can_done_task || t.can_accept_task;
    // The swipe's actions, for anyone who cannot swipe.
    const rowActions = [
      finishable && !checked.has(t.id) ? { name: 'done', label: 'Mark as done', run: () => check(t) } : null,
      t.can_kiv_task ? { name: 'kiv', label: 'Keep in view', run: () => keepInView(t.id) } : null,
      t.can_hold_task ? { name: 'hold', label: 'Put on hold', run: () => hold(t.id) } : null,
      { name: 'preview', label: 'Show quick actions', run: () => lift(t) },
    ].filter((a): a is { name: string; label: string; run: () => void } => !!a);
    return (
      <CardSlice first={item.first} last={item.last}>
        <SwipeableTaskRow task={t} onDone={() => check(t)} onKeepInView={() => keepInView(t.id)} onHold={() => hold(t.id)}>
          <TaskRowItem
            task={t}
            last={item.last}
            checkable={finishable}
            checked={checked.has(t.id)}
            onCheck={() => check(t)}
            onPress={() => goTask(t)}
            onLongPress={() => lift(t)}
            actions={rowActions}
          />
        </SwipeableTaskRow>
      </CardSlice>
    );
  };

  return (
    <TabScreen
      title="Tasks"
      titleAccessory={
        <View style={styles.buttons}>
          <FilterSheet<Show> title="Show tasks" options={shows} value={show} onChange={setShow} />
          <IconButton onPress={() => navigation.navigate('TaskSearch')} accessibilityLabel="Search tasks">
            <Icon name="search" size={20} color={colors.body} strokeWidth={2} />
          </IconButton>
        </View>
      }
      onRefresh={refresh}
      list={{ data: items, keyExtractor: (item) => item.key, renderItem, animateRows: true }}
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
      {current.isPending ? (
        <ListSkeleton
          key={show}
          label="Loading your tasks"
          rows={show === 'open' ? 5 : 3}
          shape={show === 'open' ? rowShapes.task : rowShapes.taskSign}
          caption="captionStrong"
        />
      ) : failedToLoad(current) ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(current.error)} onRetry={() => current.refetch()} />
        </View>
      ) : empty ? (
        <Animated.View key={show} entering={reduced ? undefined : FadeIn.duration(260)} style={styles.block}>
          {show === 'open' ? (
            <EmptyState icon={list.emptyIcon} title={list.empty} body="New tasks from your manager show up here." />
          ) : (
            // The filter sits behind a button, so a narrowed list that is empty says how to get back.
            <EmptyState
              icon={list.emptyIcon}
              title={list.empty}
              body="This list is narrowed. Choose Open tasks with the filter button beside the title to see your open tasks."
              action={{ label: 'Show open tasks', onPress: () => setShow('open') }}
            />
          )}
        </Animated.View>
      ) : (
        <Animated.View key={show} entering={reduced ? undefined : FadeIn.duration(260)}>
          <Text variant="captionStrong" color="ink2" style={styles.caption} accessibilityLiveRegion="polite">
            {list.caption}
          </Text>
          {list.lead ? (
            <Text variant="subhead" color="ink2" style={styles.lead}>
              {list.lead}
            </Text>
          ) : null}
        </Animated.View>
      )}
    </TabScreen>
  );
}

/** A row of the Tasks list: a group's title, an open task in that group's card, or a done or paused task. */
type ListItem =
  | { kind: 'title'; key: string; title: string }
  | { kind: 'task' | 'status'; key: string; task: TaskRow; first: boolean; last: boolean };

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10 },
  caption: { marginTop: 18, marginHorizontal: 20 },
  lead: { marginTop: 4, marginBottom: 12, marginHorizontal: 20 },
  groupTitle: { marginTop: 20, marginBottom: 10, marginHorizontal: 20, fontSize: 15 },
  block: { marginTop: 24 },
});
