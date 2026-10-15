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
import { ChipRow, Tag } from '../../components/Chips';
import { EmptyState, Loading, LoadError } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { TabScreen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Sheet, type SheetHandle } from '../../components/Sheet';
import { PlaceAndNote } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { doneNote, dueNote, statusColors, statusLabel, toneFor } from '../../lib/taskCopy';
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
        data: current.isPending || current.isError ? [] : rows,
        keyExtractor: (t) => String(t.id),
        renderItem: (t, i) => (
          <CardSlice first={i === 0} last={i === rows.length - 1}>
            <MgrTaskRow task={t} last={i === rows.length - 1} onPress={() => open(t)} />
          </CardSlice>
        ),
      }}
      overlay={filterSheet}
    >
      <View style={styles.chips}>
        <ChipRow<MgrFocus>
          accessibilityLabel="Show"
          value={focus}
          onChange={setFocus}
          options={CHIPS.map((c, i) => ({ key: c.key, label: c.label, count: lists[i].data?.tasks.length }))}
        />
      </View>
      <Text variant="captionStrong" color="ink2" style={styles.caption}>
        {chip.caption}
        {activeFilters ? ` · ${[person && people.data?.find((p) => p.id === person)?.name, area && areas.data?.find((a) => a.id === area)?.name].filter(Boolean).join(', ')}` : ''}
      </Text>

      {current.isPending ? (
        <Loading label="Loading tasks" />
      ) : current.isError ? (
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

/** One task on the manager's list: who does it, what, where and when, and its status. */
export function MgrTaskRow({ task, last, onPress, hideWho = false }: { task: TaskRow; last: boolean; onPress: () => void; hideWho?: boolean }) {
  const colors = useColors();
  // At the largest text sizes the status goes under the title instead of squeezing it.
  const large = useWindowDimensions().fontScale > 1.35;
  const tone = colors.tones[toneFor(task.risk)];
  const done = Number(task.status) === 3;
  const note = done
    ? doneNote(task.done_date)
    : dueNote({ status: task.status, risk: task.risk, dueAt: task.due_at, dueDate: task.task_due_date, dueTime: task.task_due_time });
  const where = task.outlet_name ?? task.lead_name ?? 'No outlet';
  const status = statusColors(colors, Number(task.status));
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
          noteStrong={!(done || task.risk === 'on_track')}
          noteColor={done || task.risk === 'on_track' ? colors.ink2 : tone.ink}
        />
        {large ? (
          <View style={styles.tagBelow}>
            <Tag size="small" style={styles.status} text={statusLabel(Number(task.status))} ink={status.ink} bg={status.bg} />
          </View>
        ) : null}
      </View>
      {large ? null : <Tag size="small" style={styles.status} text={statusLabel(Number(task.status))} ink={status.ink} bg={status.bg} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chips: { marginTop: 7 },
  caption: { marginTop: 13, marginBottom: 8, marginHorizontal: 20 },
  // The caption above already spaces it like a list.
  block: { marginTop: 0 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 18, minHeight: 64 },
  status: { paddingHorizontal: 8 },
  filterFields: { marginTop: 16, gap: 16 },
  tagBelow: { marginTop: 6 },
});
