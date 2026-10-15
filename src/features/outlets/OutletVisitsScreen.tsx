import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchOutletVisits, outletKeys, type OutletVisit } from '../../api/outlets';
import { splitWhatHappened } from '../../api/visits';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDate, formatDayMonth, parseDate, plural } from '../../lib/format';
import { parseStampText } from '../../lib/location';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PAGE = 8;

/** Every visit at an outlet, newest first, grouped by month. */
export function OutletVisitsScreen({ route, navigation }: RootScreenProps<'OutletVisits'>) {
  const { id, name } = route.params;
  const colors = useColors();
  const { user } = useAuth();
  const [shown, setShown] = useState(PAGE);
  const visits = useQuery({ queryKey: outletKeys.visits(id), queryFn: () => fetchOutletVisits(id) });

  const list = useMemo(() => visits.data ?? [], [visits.data]);
  const groups = useMemo(() => {
    const out: { title: string; rows: OutletVisit[] }[] = [];
    for (const v of list.slice(0, shown)) {
      const d = parseDate(v.visited_at);
      const title = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'Earlier';
      const last = out[out.length - 1];
      if (last && last.title === title) last.rows.push(v);
      else out.push({ title, rows: [v] });
    }
    return out;
  }, [list, shown]);
  const oldest = list[list.length - 1];
  const more = list.length - shown;

  return (
    <DetailScreen
      backLabel={name ?? 'Outlet'}
      onRefresh={() => visits.refetch()}
      bottomBar={<Button label="Log a visit" style={styles.flex} onPress={() => navigation.navigate('LogVisit', { outletId: id })} />}
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Visits
      </Text>
      {list.length ? (
        <Text variant="body" color="ink2" style={styles.lead}>
          {plural(list.length, 'visit')} since {formatDate(oldest?.visited_at)}
        </Text>
      ) : null}

      {visits.isPending ? (
        <Loading label="Loading visits" />
      ) : visits.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(visits.error)} onRetry={() => visits.refetch()} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="visits" title="No visits yet" body="Log a visit when you are at the outlet. It shows up here." />
        </View>
      ) : (
        <>
          {groups.map((g) => (
            <View key={g.title}>
              <Text variant="captionStrong" color="ink2" accessibilityRole="header" style={styles.month}>
                {g.title}
              </Text>
              <Card style={styles.card}>
                {g.rows.map((v, i) => {
                  const d = parseDate(v.visited_at);
                  const { what } = splitWhatHappened(v.problem_description);
                  const stamped = !!parseStampText(v.location);
                  const mine = v.visited_by === user?.name;
                  return (
                    <ListRow
                      key={v.id}
                      onPress={() => navigation.navigate('VisitReport', { id: v.id, ids: list.map((x) => x.id) })}
                      divider={i < g.rows.length - 1}
                      dividerInset={74}
                      style={styles.row}
                      accessibilityLabel={`${d ? formatDate(d) : ''}. ${what}. ${mine ? 'You' : v.visited_by ?? ''}${stamped ? ', stamped' : ''}`}
                    >
                      <View style={styles.dateCol}>
                        <Text variant="title2" align="center" style={styles.dayNum}>
                          {d ? d.getDate() : ''}
                        </Text>
                        <Text variant="footnote" color="ink2" align="center">
                          {d ? DAYS[d.getDay()] : ''}
                        </Text>
                      </View>
                      <View style={styles.flex}>
                        <Text variant="body" numberOfLines={3}>
                          {what || 'Visit report'}
                        </Text>
                        <View style={styles.meta}>
                          <Text variant="caption" color="ink2">
                            {mine ? 'You' : v.visited_by ?? 'Someone'}
                          </Text>
                          {stamped ? (
                            <View style={styles.stamped}>
                              <Icon name="pin" size={14} color={colors.tones.good.ink} strokeWidth={2.2} />
                              <Text variant="captionStrong" color={colors.tones.good.ink}>
                                Stamped
                              </Text>
                            </View>
                          ) : null}
                          {v.task_id ? (
                            <Text variant="caption" color="ink2">
                              Made into a task
                            </Text>
                          ) : v.next_followup_date ? (
                            <Text variant="caption" color="ink2">
                              Follow-up {formatDayMonth(v.next_followup_date)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </ListRow>
                  );
                })}
              </Card>
            </View>
          ))}
          {more > 0 ? (
            <PressableScale onPress={() => setShown((n) => n + PAGE)} style={styles.moreButton} accessibilityRole="button">
              <Text variant="captionStrong" color="link" style={styles.moreText}>
                Show {plural(Math.min(more, PAGE), 'older visit')}
              </Text>
            </PressableScale>
          ) : null}
        </>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 20 },
  month: { marginTop: 28, marginBottom: 10, marginHorizontal: 20, fontSize: 15 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card },
  row: { alignItems: 'flex-start', paddingVertical: 18, paddingHorizontal: 18, gap: 16 },
  dateCol: { width: 40 },
  dayNum: { fontSize: 22, lineHeight: 26 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6, marginTop: 8 },
  stamped: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreButton: { marginTop: 16, marginHorizontal: space.gutter, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 15, fontFamily: fonts.semibold },
});
