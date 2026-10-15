import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { alertKeys, fetchAlerts, markAlertsRead, type Alert, type AlertList } from '../../api/alerts';
import { errorMessage } from '../../api/client';
import { CardSlice } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { Icon, type IconName } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatTime, isSameDay, parseDate, relativeDay } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { openTarget } from '../../lib/openTarget';
import type { ToneName } from '../../theme/tokens';
import { useColors } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/type';

/** Focus alerts: every push you were sent, newest first, in Today and Earlier. */
export function AlertsScreen() {
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: alertKeys.list, queryFn: fetchAlerts });

  // Marked read straight away on the phone; the server catches up.
  const markRead = useMutation({
    mutationFn: (ids: string[] | 'all') => markAlertsRead(ids),
    onMutate: (ids) => {
      queryClient.setQueryData<AlertList>(alertKeys.list, (prev) => {
        if (!prev) return prev;
        const list = prev.alerts.map((a) => (ids === 'all' || ids.includes(a.id) ? { ...a, read: true } : a));
        return { alerts: list, unread: list.filter((a) => !a.read).length };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: alertKeys.list }),
  });

  const list = alerts.data?.alerts ?? [];
  const unread = alerts.data?.unread ?? 0;
  const now = new Date();
  const today = list.filter((a) => {
    const d = parseDate(a.created_at);
    return d ? isSameDay(d, now) : false;
  });
  const earlier = list.filter((a) => !today.includes(a));

  // Section titles and alerts as one list, for the FlatList.
  const items: ({ kind: 'title'; key: string; title: string } | { kind: 'alert'; key: string; alert: Alert; first: boolean; last: boolean })[] = [];
  for (const sec of [
    { title: 'Today', rows: today },
    { title: 'Earlier', rows: earlier },
  ]) {
    if (!sec.rows.length) continue;
    items.push({ kind: 'title', key: `t-${sec.title}`, title: sec.title });
    sec.rows.forEach((a, i) => items.push({ kind: 'alert', key: a.id, alert: a, first: i === 0, last: i === sec.rows.length - 1 }));
  }

  const open = (a: Alert) => {
    haptic.selection();
    if (!a.read) markRead.mutate([a.id]);
    openTarget(a.type, a.target_id);
  };

  return (
    <DetailScreen
      backLabel="Back"
      onRefresh={() => alerts.refetch()}
      list={{
        data: items,
        keyExtractor: (item) => item.key,
        renderItem: (item) =>
          item.kind === 'title' ? (
            <Text variant="label" color="ink2" accessibilityRole="header" style={styles.section}>
              {item.title}
            </Text>
          ) : (
            <CardSlice first={item.first} last={item.last}>
              <AlertRow alert={item.alert} last={item.last} onPress={() => open(item.alert)} />
            </CardSlice>
          ),
      }}
      topRight={
        unread > 0 ? (
          <PressableScale onPress={() => markRead.mutate('all')} accessibilityRole="button" style={styles.markAll}>
            <Text variant="captionStrong" color="link" style={styles.link15}>
              Mark all read
            </Text>
          </PressableScale>
        ) : null
      }
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Focus alerts
      </Text>

      {alerts.isPending ? (
        <ListSkeleton label="Loading alerts" rows={4} shape={rowShapes.alert} caption="label" captionStyle={styles.section} />
      ) : alerts.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(alerts.error)} onRetry={() => alerts.refetch()} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="bell" title="No alerts yet" body="When a task is at risk, a form waits for you or someone sends you a message, it shows here." />
        </View>
      ) : null}
    </DetailScreen>
  );
}

/** The icon and tone for an alert, by what it is about. */
function lookFor(a: Alert): { icon: IconName; tone: ToneName } {
  if (a.type === 'task' && /overdue|at[- ]risk|to check|sent back/i.test(a.title)) return { icon: 'alert', tone: /overdue/i.test(a.title) ? 'critical' : 'serious' };
  switch (a.type) {
    case 'task':
      return { icon: 'tasks', tone: 'brand' };
    case 'chat':
      return { icon: 'message', tone: 'brand' };
    case 'lead':
      return { icon: 'outlets', tone: 'suggest' };
    case 'formtask':
      return { icon: 'forms', tone: 'form' };
    case 'formentry':
      return { icon: 'formCheck', tone: 'good' };
    default:
      return { icon: 'bell', tone: 'neutral' };
  }
}

function whenLabel(value: string | null): string {
  const d = parseDate(value);
  if (!d) return '';
  if (isSameDay(d, new Date())) return formatTime(d);
  const day = relativeDay(d);
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function AlertRow({ alert: a, last, onPress }: { alert: Alert; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const look = lookFor(a);
  const tone = colors.tones[look.tone];
  const when = whenLabel(a.created_at);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${a.read ? '' : 'Unread. '}${a.title}. ${a.body}. ${when}`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
    >
      <View style={[styles.tile, { backgroundColor: tone.tile }]}>
        <Icon name={look.icon} size={20} color={tone.ink} />
      </View>
      <View style={styles.flex}>
        <View style={styles.head}>
          <Text variant="bodyStrong" style={[styles.flex, !a.read && styles.unreadTitle]} numberOfLines={2}>
            {a.title}
          </Text>
          <Text variant="footnote" color="ink2">
            {when}
          </Text>
        </View>
        {a.body ? (
          <Text variant="caption" color="body" numberOfLines={3}>
            {a.body}
          </Text>
        ) : null}
      </View>
      {a.read ? <View style={styles.dotSpace} /> : <View style={[styles.dot, { backgroundColor: colors.brand }]} accessibilityElementsHidden />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 18 },
  markAll: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  link15: { fontSize: 15 },
  section: { marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  unreadTitle: { fontFamily: fonts.bold },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 7 },
  dotSpace: { width: 9 },
});
