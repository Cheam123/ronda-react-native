import { useFocusEffect } from '@react-navigation/native';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchPeople, formKeys } from '../../api/forms';
import { fetchTasks, taskKeys, type TaskListParams, type TaskRow } from '../../api/tasks';
import { fetchAreas } from '../../api/visits';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { CardSlice } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { FilterSheet, type FilterOption } from '../../components/FilterSheet';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { TabScreen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Sheet, type SheetHandle } from '../../components/Sheet';
import { PlaceAndNote } from '../../components/PlaceAndNote';
import { signColor, StatusSign } from '../../components/StatusSign';
import { Text } from '../../components/Text';
import { doneNote, dueNote, statusLabel, toneFor } from '../../lib/taskCopy';
import { failedToLoad } from '../../lib/query';
import type { ManagerTabScreenProps, MgrFocus } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

const CHIPS: { key: MgrFocus; label: string; caption: string; empty: string }[] = [
  { key: 'urgent', label: 'Most urgent', caption: 'Overdue, then at risk', empty: 'Nothing is overdue or at risk.' },
  { key: 'overdue', label: 'Overdue', caption: 'Past their due time', empty: 'Nothing is overdue.' },
  { key: 'due_today', label: 'Due today', caption: 'Due before midnight', empty: 'Nothing is due today.' },
  { key: 'to_check', label: 'To check', caption: 'Done, waiting for you to verify', empty: 'Nothing is waiting for you to check.' },
];

/** The manager's tasks: the most urgent first, and done work to check. */
export function MgrTasksScreen({ route, navigation }: ManagerTabScreenProps<'MgrTasks'>) {
  const colors = useColors();
  const [focus, setFocus] = useState<MgrFocus>(route.params?.focus ?? 'urgent');
  const [person, setPerson] = useState<number | null>(null);
  const [area, setArea] = useState<number | null>(null);
  const filters = useRef<SheetHandle>(null);

  // A Team tile opens this tab on its chip.
  const wanted = route.params?.focus;
  useFocusEffect(
    useCallback(() => {
      if (wanted) {
        setFocus(wanted);
        navigation.setParams({ focus: undefined });
      }
    }, [wanted, navigation]),
  );

  const base: TaskListParams = { ...(person ? { subscriber: person } : {}), ...(area ? { area } : {}) };
  const lists = useQueries({
    queries: CHIPS.map((c) => ({
      queryKey: taskKeys.list({ ...base, focus: c.key }),
      queryFn: () => fetchTasks({ ...base, focus: c.key }),
    })),
  });
  const people = useQuery({ queryKey: formKeys.people, queryFn: fetchPeople, staleTime: 30 * 60_000 });
  const areas = useQuery({ queryKey: ['areas'], queryFn: fetchAreas, staleTime: 60 * 60_000 });

  const at = CHIPS.findIndex((c) => c.key === focus);
  const current = lists[at];
  const rows = current.data?.tasks ?? [];
  const chip = CHIPS[at];
  const activeFilters = (person ? 1 : 0) + (area ? 1 : 0);
  const refetchAll = () => Promise.all(lists.map((l) => l.refetch()));
  // The list to show, from the filter sheet the button beside the title opens (as on the rep's Tasks and Outlets).
  const shows: FilterOption<MgrFocus>[] = CHIPS.map((c, i) => ({ key: c.key, label: c.label, count: lists[i].data?.tasks.length }));

  const open = (t: TaskRow) => (Number(t.status) === 3 ? navigation.navigate('CheckTask', { id: t.id, title: t.title }) : navigation.navigate('Task', { id: t.id, title: t.title }));

  const filterSheet = (
    <Sheet
      ref={filters}
      title="More filters"
      snapPoints={['55%', '85%']}
      footer={
        <>
          <Button
            label="Clear"
            variant="secondary"
            style={styles.flex}
            onPress={() => {
              setPerson(null);
              setArea(null);
            }}
          />
          <Button label="Show tasks" style={styles.flex} onPress={() => filters.current?.close()} />
        </>
      }
    >
      <View style={styles.filterFields}>
        <SelectField
          label="Person"
          searchable
          placeholder="Everyone"
          options={(people.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          value={person}
          onChange={setPerson}
        />
        <SelectField label="Area" placeholder="Every area" options={(areas.data ?? []).map((a) => ({ value: a.id, label: a.name }))} value={area} onChange={setArea} />
      </View>
    </Sheet>
  );

  return (
    <TabScreen
      title="Tasks"
      titleAccessory={
        <>
          <FilterSheet<MgrFocus> title="Show tasks" options={shows} value={focus} onChange={setFocus} />
          <IconButton onPress={() => filters.current?.open()} accessibilityLabel={`More filters: person, area${activeFilters ? `, ${activeFilters} on` : ''}`} dot={activeFilters > 0}>
            <Icon name="sliders" size={20} color={colors.body} strokeWidth={2} />
          </IconButton>
          <IconButton onPress={() => navigation.navigate('AddTask')} accessibilityLabel="Add a task">
            <Icon name="plus" size={20} color={colors.body} strokeWidth={2.2} />
          </IconButton>
        </>
      }
      onRefresh={refetchAll}
      list={{
        data: current.isPending || failedToLoad(current) ? [] : rows,
        keyExtractor: (t) => String(t.id),
        renderItem: (t, i) => (
          <CardSlice first={i === 0} last={i === rows.length - 1}>
            <MgrTaskRow task={t} last={i === rows.length - 1} onPress={() => open(t)} />
          </CardSlice>
        ),
      }}
      overlay={filterSheet}
    >
      {/* The choice sits behind the filter button, so the caption names the list first. */}
      <Text variant="captionStrong" color="ink2" style={styles.caption} accessibilityLiveRegion="polite">
        {chip.label} · {chip.caption.charAt(0).toLowerCase() + chip.caption.slice(1)}
        {activeFilters ? ` · ${[person && people.data?.find((p) => p.id === person)?.name, area && areas.data?.find((a) => a.id === area)?.name].filter(Boolean).join(', ')}` : ''}
      </Text>

      {current.isPending ? (
        <ListSkeleton label="Loading tasks" rows={5} shape={rowShapes.managerTask} />
      ) : failedToLoad(current) ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(current.error)} onRetry={() => current.refetch()} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="tasks" title={chip.empty} body={activeFilters ? 'Try without the filters.' : 'Good work, team.'} />
        </View>
      ) : null}

    </TabScreen>
  );
}

/**
 * A task's status as its sign and its name, no pill (quiet palette): grey,
 * red only for Rejected.
 */
function StatusWord({ status }: { status: number }) {
  const colors = useColors();
  return (
    <View style={styles.statusWord}>
      <StatusSign status={status} size={14} strokeWidth={2.4} />
      <Text variant="footnote" color={signColor(colors, status)} style={styles.statusText}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

/** One task on the manager's list: who does it, what, where and when, and its status. */
export function MgrTaskRow({ task, last, onPress, hideWho = false }: { task: TaskRow; last: boolean; onPress: () => void; hideWho?: boolean }) {
  const colors = useColors();
  // At the largest text sizes the status goes under the title instead of squeezing it.
  const large = useWindowDimensions().fontScale > 1.35;
  const risk = toneFor(task.risk);
  const done = Number(task.status) === 3;
  const note = done
    ? doneNote(task.done_date)
    : dueNote({ status: task.status, risk: task.risk, dueAt: task.due_at, dueDate: task.task_due_date, dueTime: task.task_due_time });
  // Quiet palette: red only when overdue, bold ink when at risk, grey otherwise.
  const quiet = done || risk === 'neutral';
  const noteColor = quiet ? colors.ink2 : risk === 'critical' ? colors.tones.critical.ink : colors.body;
  const where = task.outlet_name ?? task.lead_name ?? 'No outlet';
  const who = task.subscriber ?? 'No one yet';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, for ${who}, ${where}, ${note}, ${statusLabel(Number(task.status))}`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
    >
      {hideWho ? null : <Avatar name={who} size={36} />}
      <View style={styles.flex}>
        <Text variant="bodyStrong">{task.title}</Text>
        <PlaceAndNote
          variant="caption"
          place={where}
          note={note}
          noteStrong={!quiet}
          noteColor={noteColor}
        />
        {large ? (
          <View style={styles.tagBelow}>
            <StatusWord status={Number(task.status)} />
          </View>
        ) : null}
      </View>
      {large ? null : <StatusWord status={Number(task.status)} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  caption: { marginTop: 16, marginBottom: 8, marginHorizontal: 20 },
  // The caption above already spaces it like a list.
  block: { marginTop: 0 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 18, minHeight: 64 },
  // Level with the title's line (bodyStrong, 22 pt), at the right of the row.
  statusWord: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 22 },
  statusText: { fontFamily: 'InstrumentSans_500Medium' },
  filterFields: { marginTop: 16, gap: 16 },
  tagBelow: { marginTop: 6 },
});
