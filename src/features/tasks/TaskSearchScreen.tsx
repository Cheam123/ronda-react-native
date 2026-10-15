import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchTasks, taskKeys } from '../../api/tasks';
import { CardSlice } from '../../components/Card';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { TaskRowItem } from './TaskRowItem';

/** Search every task you can see, open or not: title, reference or outlet. */
export function TaskSearchScreen({ navigation }: RootScreenProps<'TaskSearch'>) {
  const colors = useColors();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const results = useQuery({
    queryKey: taskKeys.list({ search: query, status: 'any' }),
    // Status 0 is open work; search all statuses by asking per group.
    queryFn: async () => {
      const groups = await Promise.all([0, 3, 4, 5, 6, 8].map((status) => fetchTasks({ search: query, status, per_page: 30 })));
      return groups.flatMap((g) => g.tasks);
    },
    enabled: query.length >= 2,
  });

  return (
    <DetailScreen
      backLabel="Tasks"
      list={{
        data: query.length >= 2 && results.data ? results.data : [],
        keyExtractor: (t) => String(t.id),
        renderItem: (t, i) => {
          const last = i === (results.data?.length ?? 0) - 1;
          return (
            <CardSlice first={i === 0} last={last}>
              <TaskRowItem task={t} last={last} showStatus onPress={() => navigation.navigate('Task', { id: t.id, title: t.title })} />
            </CardSlice>
          );
        },
      }}
    >
      <View style={styles.search}>
        <TextField
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder="Title, reference or outlet"
          returnKeyType="search"
          accessibilityLabel="Search tasks"
          leading={<Icon name="search" size={20} color={colors.muted} strokeWidth={2} />}
        />
      </View>
      {query.length < 2 ? (
        <Text variant="subhead" color="ink2" style={styles.hint}>
          Type at least 2 letters.
        </Text>
      ) : results.isPending ? (
        <Loading label="Searching" />
      ) : results.isError ? (
        <LoadError message={errorMessage(results.error)} onRetry={() => results.refetch()} />
      ) : (results.data ?? []).length === 0 ? (
        <EmptyState icon="search" title={`No tasks match "${query}"`} body="Check the spelling, or try the outlet's name." />
      ) : null}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: space.gutter, marginTop: 4, marginBottom: 16 },
  hint: { marginHorizontal: 20 },
});
