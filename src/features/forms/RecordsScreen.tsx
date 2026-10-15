import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchRecords, formKeys, type RecordRow } from '../../api/forms';
import { useAuth } from '../../auth/AuthProvider';
import { CardSlice, ListRow } from '../../components/Card';
import { ChipRow, Tag } from '../../components/Chips';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { relativeDay } from '../../lib/format';
import { isMyTurn, recordLook, recordNote } from '../../lib/formCopy';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';

type Show = 'all' | 'open' | 'approved' | 'rejected' | 'closed';

const matches = (r: RecordRow, show: Show) =>
  show === 'all' ||
  (show === 'open' && r.status === 'pending') ||
  (show === 'approved' && r.status === 'approved') ||
  (show === 'rejected' && r.status === 'rejected') ||
  (show === 'closed' && (r.status === 'closed' || r.status === 'cancelled'));

/** Every record you opened or took part in, newest first. */
export function RecordsScreen({ navigation }: RootScreenProps<'Records'>) {
  const [show, setShow] = useState<Show>('all');
  const records = useQuery({ queryKey: formKeys.records, queryFn: fetchRecords });
  const all = records.data ?? [];
  const rows = all.filter((r) => matches(r, show));
  const count = (s: Show) => all.filter((r) => matches(r, s)).length;
  const closed = count('closed');

  return (
    <DetailScreen
      onRefresh={() => records.refetch()}
      list={{
        data: records.isPending || records.isError ? [] : rows,
        keyExtractor: (r) => String(r.id),
        renderItem: (r, i) => (
          <CardSlice first={i === 0} last={i === rows.length - 1} style={i === 0 && styles.firstSlice}>
            <RecordRowItem row={r} last={i === rows.length - 1} onPress={() => navigation.navigate('Record', { id: r.id, title: r.title })} />
          </CardSlice>
        ),
      }}
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        My records
      </Text>
      <View style={[styles.chips, all.length === 0 && styles.hidden]}>
        <ChipRow<Show>
          accessibilityLabel="Show"
          value={show}
          onChange={setShow}
          options={[
            { key: 'all', label: 'All', count: all.length },
            { key: 'open', label: 'Open', count: count('open') },
            { key: 'approved', label: 'Approved', count: count('approved') },
            { key: 'rejected', label: 'Rejected', count: count('rejected') },
            ...(closed ? [{ key: 'closed' as const, label: 'Closed', count: closed }] : []),
          ]}
        />
      </View>

      {records.isPending ? (
        <ListSkeleton label="Loading records" shape={rowShapes.record} style={styles.firstSlice} />
      ) : records.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(records.error)} onRetry={() => records.refetch()} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.block}>
          <EmptyState
            icon="records"
            title={all.length === 0 ? 'No records yet' : 'Nothing here right now'}
            body={all.length === 0 ? 'Forms you send, and forms you take part in, are kept here.' : 'Try another filter.'}
          />
        </View>
      ) : null}
    </DetailScreen>
  );
}

function RecordRowItem({ row, last, onPress }: { row: RecordRow; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const { user } = useAuth();
  const look = recordLook(row.status, colors, isMyTurn(row, user?.name));
  const note = recordNote(row, user?.name);
  const sub = `${row.form_name ?? 'Form'} · ${relativeDay(row.opened_at)}`;
  return (
    <ListRow onPress={onPress} divider={!last} chevron style={styles.row} accessibilityLabel={`${row.title}. ${sub}. ${look.label}. ${note}`}>
      <View style={styles.flex}>
        <Text variant="rowTitle">{row.title}</Text>
        <Text variant="subhead" color="ink2">
          {sub}
        </Text>
        <View style={styles.status}>
          <Tag text={look.label} ink={look.ink} bg={look.bg} dot={look.dot} />
          <Text variant="caption" color="ink2" style={styles.flex} numberOfLines={1}>
            {note}
          </Text>
        </View>
        {row.parent ? (
          <Text variant="footnote" color="ink2" style={styles.parent} numberOfLines={1}>
            Follows up on {row.parent.title}
          </Text>
        ) : null}
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginTop: 8, marginHorizontal: 20 },
  chips: { marginTop: 11 },
  hidden: { display: 'none' },
  block: { marginTop: 20 },
  firstSlice: { marginTop: 15 },
  row: { paddingVertical: 16, paddingHorizontal: 18 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  parent: { marginTop: 6 },
});
