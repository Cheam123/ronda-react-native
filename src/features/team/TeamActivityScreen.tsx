import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchTeam, teamKeys } from '../../api/team';
import { Avatar } from '../../components/Avatar';
import { BarChart } from '../../components/BarChart';
import { Card, ListRow } from '../../components/Card';
import { LoadError } from '../../components/EmptyState';
import { PersonSkeleton } from '../../components/LoadingSkeletons';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDayMonth, formatMoney, formatShortDay, plural } from '../../lib/format';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

/** What the team did: tasks added and done, visits and orders, and each person's week. */
export function TeamActivityScreen({ navigation }: RootScreenProps<'TeamActivity'>) {
  const colors = useColors();
  const team = useQuery({ queryKey: teamKeys.team, queryFn: fetchTeam });

  if (team.isPending) {
    return (
      <DetailScreen backLabel="Team">
        <PersonSkeleton variant="activity" label="Loading team activity" />
      </DetailScreen>
    );
  }
  if (team.isError || !team.data) {
    return (
      <DetailScreen backLabel="Team">
        <LoadError message={errorMessage(team.error)} onRetry={() => team.refetch()} />
      </DetailScreen>
    );
  }

  const s = team.data.summary;
  const stats = [
    { label: 'Tasks added', value: String(s.tasks.created_7d) },
    { label: 'Tasks done', value: String(s.tasks.done_7d) },
    { label: 'Visits', value: String(s.visits.last_7d) },
    { label: 'Orders', value: formatMoney(s.orders.last_7d) },
  ];
  const people = [...s.team].sort((a, b) => b.done_7d + b.visits_7d - (a.done_7d + a.visits_7d) || a.name.localeCompare(b.name));
  const lastDay = s.trend.length - 1;
  const created = colors.brand;
  const done = colors.tones.good.dot;

  return (
    <DetailScreen backLabel="Team" onRefresh={() => team.refetch()}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Team activity
      </Text>
      <Text variant="subhead" color="ink2" style={styles.sub}>
        The last 7 days, for everyone.
      </Text>

      <View style={styles.stats}>
        {stats.map((x) => (
          <Card key={x.label} style={styles.stat}>
            <View accessible accessibilityLabel={`${x.label}: ${x.value}`} style={styles.statInner}>
              <Text variant="captionStrong" color="ink2">
                {x.label}
              </Text>
              <Text variant="title2" numberOfLines={1} adjustsFontSizeToFit>
                {x.value}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Card padded style={styles.block}>
        <Text variant="bodyStrong" accessibilityRole="header">
          Tasks added and done
        </Text>
        <View style={styles.legend}>
          <Legend color={created} label="Added" />
          <Legend color={done} label="Done" />
          <Text variant="footnote" color="ink2">
            Last 14 days
          </Text>
        </View>
        <BarChart
          accessibilityLabel="Tasks added and done each day"
          colors={[created, done]}
          height={130}
          empty="No tasks were added or done in the last 14 days."
          axisLabels={s.trend.length ? [formatDayMonth(s.trend[0].date), formatDayMonth(s.trend[Math.floor(lastDay / 2)].date), 'Today'] : undefined}
          bars={s.trend.map((d) => ({
            label: '',
            values: [d.created, d.done],
            spoken: `${formatShortDay(d.date)}: ${d.created} added, ${d.done} done`,
          }))}
        />
      </Card>

      <Card padded style={styles.block}>
        <Text variant="bodyStrong" accessibilityRole="header">
          Visits each day
        </Text>
        <View style={styles.chart}>
          <BarChart
            accessibilityLabel="Visits each day"
            empty="No visits in the last 7 days."
            colors={[colors.brand]}
            bars={s.visits.daily.map((d, i) => ({
              label: i === s.visits.daily.length - 1 ? 'Today' : formatShortDay(d.date).split(' ')[0],
              values: [d.count],
              spoken: `${formatShortDay(d.date)} ${d.count}`,
            }))}
          />
        </View>
      </Card>

      <Text variant="section" accessibilityRole="header" style={styles.sectionTitle}>
        Each person
      </Text>
      <Card style={styles.cardH}>
        {people.map((p, i) => (
          <ListRow key={p.user_id} onPress={() => navigation.navigate('Person', { userId: p.user_id, name: p.name })} chevron divider={i < people.length - 1}>
            <Avatar name={p.name} size={40} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{p.name}</Text>
              <Text variant="caption" color="ink2">
                {[`${p.done_7d} done`, plural(p.visits_7d, 'visit'), plural(p.forms_7d, 'form'), p.orders_7d ? formatMoney(p.orders_7d) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </ListRow>
        ))}
      </Card>
    </DetailScreen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="footnote" color="ink2">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginTop: 8, marginHorizontal: 20 },
  sub: { marginTop: 4, marginHorizontal: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginHorizontal: space.gutter },
  stat: { flexBasis: '40%', flexGrow: 1, borderRadius: radius.tile },
  // 92 tall like the other stat tiles, counting the card's 1 pt ring.
  statInner: { minHeight: 90, paddingVertical: 14, paddingHorizontal: 16, gap: 4, justifyContent: 'space-between' },
  block: { marginTop: 10, marginHorizontal: space.gutter, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 18 },
  chart: { marginTop: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  sectionTitle: { marginTop: 28, marginBottom: 12, marginHorizontal: 20 },
  cardH: { marginHorizontal: space.gutter, borderRadius: radius.card },
});
