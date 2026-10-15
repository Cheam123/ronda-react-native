import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchTasks, taskKeys } from '../../api/tasks';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import type { RootScreenProps } from '../../navigation/types';
import { TaskRowItem } from '../tasks/TaskRowItem';
import { space } from '../../theme/tokens';

/** Open and recent tasks at one outlet. */
export function OutletTasksScreen({ route, navigation }: RootScreenProps<'OutletTasks'>) {
  const { id, name } = route.params;
  const { abilities, role } = useAuth();
  // The cache keeps the whole reply, as the outlet screen does under the same key; select picks the rows.
  const open = useQuery({ queryKey: taskKeys.list({ status: 0, lead_id: id }), queryFn: () => fetchTasks({ status: 0, lead_id: id }), select: (r) => r.tasks });
  const done = useQuery({ queryKey: taskKeys.list({ status: 3, lead_id: id }), queryFn: () => fetchTasks({ status: 3, lead_id: id }), select: (r) => r.tasks });

  const openList = open.data ?? [];
  const doneList = done.data ?? [];

  return (
    <DetailScreen
      backLabel={name ?? 'Outlet'}
      onRefresh={() => Promise.all([open.refetch(), done.refetch()])}
      bottomBar={
        abilities.create_task ? (
          <Button label="Add a task" style={styles.flex} onPress={() => navigation.navigate('AddTask', { outletId: id, outletName: name })} />
        ) : undefined
      }
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Tasks
      </Text>
      {open.isPending ? (
        <Loading label="Loading tasks" />
      ) : open.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(open.error)} onRetry={() => open.refetch()} />
        </View>
      ) : openList.length === 0 && doneList.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="tasks" title="No open tasks here" body={role === 'manager' ? 'Add a task for someone to do at this outlet.' : 'Tasks at this outlet show up here.'} />
        </View>
      ) : (
        <>
          {openList.length ? (
            <>
              <Text variant="captionStrong" color="ink2" style={styles.group}>
                Open
              </Text>
              <Card style={styles.card}>
                {openList.map((t, i) => (
                  <TaskRowItem key={t.id} task={t} last={i === openList.length - 1} showWho={role === 'manager'} onPress={() => navigation.navigate('Task', { id: t.id, title: t.title })} />
                ))}
              </Card>
            </>
          ) : null}
          {doneList.length ? (
            <>
              <Text variant="captionStrong" color="ink2" style={styles.group}>
                Waiting for checking
              </Text>
              <Card style={styles.card}>
                {doneList.map((t, i) => (
                  <TaskRowItem
                    key={t.id}
                    task={t}
                    last={i === doneList.length - 1}
                    showStatus
                    footnote={t.checker ? `${t.checker} checks it` : undefined}
                    onPress={() => navigation.navigate('Task', { id: t.id, title: t.title })}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginHorizontal: 20, marginTop: 8 },
  block: { marginTop: 20 },
  group: { marginTop: 24, marginBottom: 10, marginHorizontal: 20, fontSize: 15 },
  card: { marginHorizontal: space.gutter },
});
