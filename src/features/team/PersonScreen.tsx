import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchTasks, taskKeys } from '../../api/tasks';
import { fetchPerson, teamKeys } from '../../api/team';
import { fetchRecentReports, recentKey } from '../../api/visits';
import { Avatar } from '../../components/Avatar';
import { BarChart } from '../../components/BarChart';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { LoadError } from '../../components/EmptyState';
import { ListSkeleton, PersonSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { callNumber, messageNumber } from '../../lib/contact';
import { firstName, formatMoney, formatShortDay, plural } from '../../lib/format';
import { friendlyDateTime } from '../../lib/taskCopy';
import { parseStampText } from '../../lib/location';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { MgrTaskRow } from './MgrTasksScreen';

/** One person on the team: their week, their open tasks and their recent visits. */
export function PersonScreen({ route, navigation }: RootScreenProps<'Person'>) {
  const { userId } = route.params;
  const colors = useColors();
  const [allTasks, setAllTasks] = useState(false);
  const view = useQuery({ queryKey: teamKeys.person(userId), queryFn: () => fetchPerson(userId) });
  const tasks = useQuery({ queryKey: taskKeys.list({ status: 0, subscriber: userId }), queryFn: () => fetchTasks({ status: 0, subscriber: userId }) });
  const visits = useQuery({ queryKey: recentKey({ createdBy: userId, days: 30 }), queryFn: () => fetchRecentReports({ createdBy: userId, days: 30 }) });

  if (view.isPending) {
    return (
      <DetailScreen backLabel="Team">
        <PersonSkeleton name={route.params.name} />
      </DetailScreen>
    );
  }
  if (view.isError || !view.data) {
    return (
      <DetailScreen backLabel="Team">
        <LoadError message={errorMessage(view.error)} onRetry={() => view.refetch()} />
      </DetailScreen>
    );
  }

  const { person, summary: s } = view.data;
  const first = firstName(person.name);
  const open = tasks.data?.tasks ?? [];
  const rank = { overdue: 0, at_risk: 1, on_track: 2 } as const;
  const sorted = [...open].sort((a, b) => rank[a.risk] - rank[b.risk] || (a.due_at ?? '').localeCompare(b.due_at ?? ''));
  const urgent = sorted.filter((t) => t.risk !== 'on_track');
  const shown = allTasks || urgent.length === 0 ? sorted : urgent;
  const onTrack = sorted.length - urgent.length;
  const days = s.visits.daily;

  const stats = [
    { label: 'Visits', value: String(s.visits.last_7d) },
    { label: 'Orders', value: formatMoney(s.orders.last_7d) },
    { label: 'Forms sent', value: String(s.forms.submitted_7d) },
    { label: 'Tasks done', value: String(s.tasks.done_7d) },
  ];

  return (
    <DetailScreen backLabel="Team" onRefresh={() => Promise.all([view.refetch(), tasks.refetch(), visits.refetch()])}>
      <View style={styles.head}>
        <Avatar name={person.name} size={56} />
        <View style={styles.flex}>
          <Text variant="title" accessibilityRole="header">
            {person.name}
          </Text>
          <Text variant="subhead" color="ink2">
            {person.role} · {plural(s.tasks.open, 'open task')}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <IconButton onPress={() => callNumber(person.mobile, `${first} has no mobile number saved.`)} accessibilityLabel={`Call ${first}`}>
          <Icon name="phone" size={20} color={colors.body} />
        </IconButton>
        <IconButton onPress={() => messageNumber(person.mobile, undefined, `${first} has no mobile number saved.`)} accessibilityLabel={`Message ${first}`}>
          <Icon name="message" size={20} color={colors.body} />
        </IconButton>
        <Button
          label={`Add a task for ${first}`}
          variant="brand"
          size="medium"
          icon={<Icon name="plus" size={18} color={colors.brandInk} strokeWidth={2.2} />}
          style={styles.flex}
          onPress={() => navigation.navigate('AddTask', { assigneeId: person.id })}
        />
      </View>

      <Text variant="section" accessibilityRole="header" style={styles.sectionTitle}>
        Last 7 days
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
          Visits each day
        </Text>
        <View style={styles.chart}>
          <BarChart
            accessibilityLabel="Visits each day"
            empty="No visits in the last 7 days."
            colors={[colors.brand]}
            bars={days.map((d, i) => ({
              label: i === days.length - 1 ? 'Today' : formatShortDay(d.date).split(' ')[0],
              values: [d.count],
              spoken: `${i === days.length - 1 ? 'today so far' : formatShortDay(d.date)} ${d.count}`,
            }))}
          />
        </View>
      </Card>

      <Text variant="section" accessibilityRole="header" style={styles.sectionTitle}>
        Open tasks
      </Text>
      {tasks.isPending ? (
        <ListSkeleton label="Loading tasks" rows={3} shape={rowShapes.taskPlain} />
      ) : shown.length === 0 ? (
        <Card padded style={styles.cardH}>
          <Text variant="subhead" color="ink2">
            {first} has no open tasks.
          </Text>
        </Card>
      ) : (
        <Card style={styles.cardH}>
          {shown.map((t, i) => (
            <MgrTaskRow key={t.id} hideWho task={t} last={i === shown.length - 1 && (allTasks || onTrack === 0)} onPress={() => navigation.navigate('Task', { id: t.id, title: t.title })} />
          ))}
          {!allTasks && onTrack > 0 && urgent.length > 0 ? (
            <Pressable onPress={() => setAllTasks(true)} accessibilityRole="button" style={({ pressed }) => [styles.showMore, pressed && { backgroundColor: colors.pressed }]}>
              <Text variant="captionStrong" color="link" style={styles.link15}>
                Show {onTrack} on track
              </Text>
            </Pressable>
          ) : null}
        </Card>
      )}

      <Text variant="section" accessibilityRole="header" style={styles.sectionTitle}>
        Recent visits
      </Text>
      {visits.isPending ? (
        <ListSkeleton label="Loading visits" rows={3} shape={rowShapes.entry} />
      ) : (visits.data ?? []).length === 0 ? (
        <Card padded style={styles.cardH}>
          <Text variant="subhead" color="ink2">
            No visits in the last 30 days.
          </Text>
        </Card>
      ) : (
        <Card style={styles.cardH}>
          {(visits.data ?? []).slice(0, 8).map((v, i, list) => {
            const stamped = !!parseStampText(v.location);
            return (
              <ListRow key={v.id} onPress={() => navigation.navigate('VisitReport', { id: v.id, ids: list.map((x) => x.id) })} chevron divider={i < list.length - 1}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{v.outlet ?? 'Outlet'}</Text>
                  <Text variant="caption" color="ink2">
                    {friendlyDateTime(v.created_at)}
                  </Text>
                </View>
                <View style={styles.stamp}>
                  {stamped ? <Icon name="pin" size={16} color={colors.tones.good.ink} /> : null}
                  <Text variant="captionStrong" color={stamped ? colors.tones.good.ink : colors.ink2}>
                    {stamped ? 'Stamped' : 'No stamp'}
                  </Text>
                </View>
              </ListRow>
            );
          })}
        </Card>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginHorizontal: space.gutter },
  sectionTitle: { marginTop: 28, marginBottom: 12, marginHorizontal: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: space.gutter },
  stat: { flexBasis: '40%', flexGrow: 1, borderRadius: radius.tile },
  statInner: { paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  block: { marginTop: 8, marginHorizontal: space.gutter, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 18 },
  cardH: { marginHorizontal: space.gutter, borderRadius: radius.card },
  chart: { marginTop: 14 },
  showMore: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'transparent' },
  link15: { fontSize: 15, fontFamily: fonts.semibold },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
