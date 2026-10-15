import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchRecentReports, needsSupport, recentKey, type VisitReportDetail } from '../../api/visits';
import { CardSlice, ListRow } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { EmptyState, Loading, LoadError } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { parseStampText } from '../../lib/location';
import { friendlyDateTime } from '../../lib/taskCopy';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';

const DAYS = 90;

/** My visit reports from the last 90 days, newest first. */
export function MyVisitsScreen({ navigation }: RootScreenProps<'MyVisits'>) {
  const params = { mine: true, days: DAYS };
  const visits = useQuery({ queryKey: recentKey(params), queryFn: () => fetchRecentReports(params) });
  const list = visits.data ?? [];

  return (
    <DetailScreen
      backLabel="Me"
      onRefresh={() => visits.refetch()}
      list={{
        data: visits.isPending || visits.isError ? [] : list,
        keyExtractor: (v) => String(v.id),
        renderItem: (v, i) => <VisitRow visit={v} first={i === 0} last={i === list.length - 1} onPress={() => navigation.navigate('VisitReport', { id: v.id, ids: list.map((x) => x.id) })} />,
      }}
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        My visit reports
      </Text>
      <Text variant="subhead" color="ink2" style={styles.lead}>
        The last {DAYS} days
      </Text>
      {visits.isPending ? (
        <Loading label="Loading visits" />
      ) : visits.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(visits.error)} onRetry={() => visits.refetch()} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="visits" title="No visits yet" body="Visits you log show up here." />
        </View>
      ) : null}
    </DetailScreen>
  );
}

function VisitRow({ visit: v, first, last, onPress }: { visit: VisitReportDetail; first: boolean; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const stamped = !!parseStampText(v.location);
  return (
    <CardSlice first={first} last={last} style={first && styles.firstSlice}>
      <ListRow onPress={onPress} chevron divider={!last}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{v.outlet ?? 'Outlet'}</Text>
          <Text variant="caption" color="ink2">
            {friendlyDateTime(v.created_at)}
          </Text>
          {needsSupport(v.support_required) ? (
            <View style={styles.tag}>
              <Tag text="Needs support" ink={colors.tones.serious.ink} bg={colors.tones.serious.tile} />
            </View>
          ) : null}
        </View>
        <View style={styles.stamp}>
          {stamped ? <Icon name="pin" size={16} color={colors.tones.good.ink} /> : null}
          <Text variant="captionStrong" color={stamped ? colors.tones.good.ink : colors.ink2}>
            {stamped ? 'Stamped' : 'No stamp'}
          </Text>
        </View>
      </ListRow>
    </CardSlice>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 20 },
  firstSlice: { marginTop: 20 },
  tag: { marginTop: 8, flexDirection: 'row' },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
