import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchTasks, taskKeys } from '../../api/tasks';
import { Card } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import type { RootScreenProps } from '../../navigation/types';
import { TaskRowItem } from './TaskRowItem';
import { space } from '../../theme/tokens';

/** Tasks kept in view or on hold: out of the open list, not forgotten. */
export function ParkedTasksScreen({ navigation }: RootScreenProps<'ParkedTasks'>) {
  const parked = useQuery({ queryKey: taskKeys.list({ focus: 'parked' }), queryFn: () => fetchTasks({ focus: 'parked' }) });
  const tasks = parked.data?.tasks ?? [];

  return (
    <DetailScreen backLabel="Tasks" onRefresh={() => parked.refetch()}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        On hold or kept in view
      </Text>
      <Text variant="subhead" color="ink2" style={styles.lead}>
        These are paused. They come back to your open tasks when someone starts them again.
      </Text>
      {parked.isPending ? (
        <ListSkeleton label="Loading tasks" rows={3} shape={rowShapes.taskPlain} style={styles.block} />
      ) : parked.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(parked.error)} onRetry={() => parked.refetch()} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="pause" title="Nothing is paused" />
        </View>
      ) : (
        <Card style={styles.card}>
          {tasks.map((t, i) => (
            <TaskRowItem
              key={t.id}
              task={t}
              last={i === tasks.length - 1}
              showStatus
              onPress={() => navigation.navigate('Task', { id: t.id, title: t.title })}
            />
          ))}
        </Card>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 6 },
  block: { marginTop: 20 },
  card: { marginHorizontal: space.gutter, marginTop: 20 },
});
