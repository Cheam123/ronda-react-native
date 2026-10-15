import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchHome, homeKey, type DayAtAGlance, type DayTask, type FormStep } from '../../api/home';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Card, ListRow } from '../../components/Card';
import { LoadError } from '../../components/EmptyState';
import { HomeSkeleton } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { PressableScale } from '../../components/Pressable';
import { TabScreen } from '../../components/Screen';
import { PlaceAndNote } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { firstName, formatLongDay, formatMoney, formatTime, greeting, keepTogether, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { dueNote, toneFor } from '../../lib/taskCopy';
import { useNow } from '../../lib/useNow';
import { riseIn } from '../../motion/curves';
import { PulseDot } from '../../motion/PulseDot';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RepTabScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import type { ToneName } from '../../theme/tokens';
import { useUndo } from '../../undo/UndoProvider';
import { doneKey } from '../tasks/useTaskActions';
import { useUnreadAlerts } from '../alerts/useUnreadAlerts';

type FilterKey = 'overdue' | 'risk' | 'today' | 'forms';

interface NeedItem {
  key: string;
  kind: 'task' | 'form';
  id: number;
  title: string;
  where: string;
  note: string;
  tone: ToneName;
  tags: Set<FilterKey>;
  pulse: boolean;
  label: string;
}

const FILTERS: { key: FilterKey; label: string; title: string; tone: ToneName; empty: string }[] = [
  { key: 'overdue', label: 'Overdue', title: 'Overdue', tone: 'critical', empty: 'Nothing is overdue. Good work.' },
  { key: 'risk', label: 'At risk', title: 'At risk', tone: 'serious', empty: 'Nothing is at risk right now.' },
  { key: 'today', label: 'Due today', title: 'Due today', tone: 'brand', empty: 'Nothing else is due today.' },
  { key: 'forms', label: 'Forms waiting', title: 'Forms waiting on you', tone: 'form', empty: 'No forms are waiting on you.' },
];

/** Overdue, at risk and due today, then form steps: one list, most urgent first. */
function buildNeeds(today: { overdue: DayTask[]; at_risk: DayTask[]; tasks_due: DayTask[]; form_steps: FormStep[] }, now: Date): NeedItem[] {
  const byId = new Map<number, NeedItem>();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const add = (t: DayTask, tag: FilterKey) => {
    const existing = byId.get(t.id);
    if (existing) {
      existing.tags.add(tag);
      return;
    }
    const tags = new Set<FilterKey>([tag]);
    if (t.risk === 'overdue') tags.add('overdue');
    if (t.risk === 'at_risk') tags.add('risk');
    if (t.due_date?.slice(0, 10) === todayIso) tags.add('today');
    byId.set(t.id, {
      key: `task-${t.id}`,
      kind: 'task',
      id: t.id,
      title: t.title,
      where: t.lead_name ?? 'No outlet',
      note: dueNote({ status: t.status, risk: t.risk, dueDate: t.due_date, dueTime: t.due_time }, { prefix: true, now }),
      tone: toneFor(t.risk),
      tags,
      pulse: t.risk === 'overdue',
      label: '',
    });
  };
  today.overdue.forEach((t) => add(t, 'overdue'));
  today.at_risk.forEach((t) => add(t, 'risk'));
  today.tasks_due.forEach((t) => add(t, 'today'));

  const tasks = [...byId.values()];
  const forms: NeedItem[] = today.form_steps.map((f) => ({
    key: `form-${f.entry_id}`,
    kind: 'form',
    id: f.entry_id,
    title: f.form_name ?? 'Form',
    where: f.record_title ?? f.reference ?? '',
    note: f.stage_type === 'approval' ? 'waiting for your approval' : f.stage_type === 'cc' ? 'for you to read' : 'your part',
    tone: 'form',
    tags: new Set<FilterKey>(['forms']),
    pulse: false,
    label: '',
  }));

  const rank = (i: NeedItem) => (i.tags.has('overdue') ? 0 : i.tags.has('risk') ? 1 : 2);
  return [...tasks.sort((a, b) => rank(a) - rank(b)), ...forms].map((i) => ({
    ...i,
    label: `${i.title}, ${i.where}, ${i.note}`,
  }));
}

/** "1 task is overdue and 1 is at risk." */
function summary(overdue: number, atRisk: number, dueToday: number, forms: number): string {
  const verb = (n: number) => (n === 1 ? 'is' : 'are');
  if (overdue && atRisk) return `${plural(overdue, 'task')} ${verb(overdue)} overdue and ${atRisk} ${verb(atRisk)} at risk.`;
  if (overdue) return `${plural(overdue, 'task')} ${verb(overdue)} overdue.`;
  if (atRisk) return `${plural(atRisk, 'task')} ${verb(atRisk)} at risk.`;
  if (dueToday) return `You have ${plural(dueToday, 'task')} due today.`;
  if (forms) return `${plural(forms, 'form')} ${verb(forms)} waiting on you.`;
  return 'Nothing needs you right now. Enjoy your round.';
}

export function TodayScreen({ navigation }: RepTabScreenProps<'Today'>) {
  const colors = useColors();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const { pending } = useUndo();
  const [filter, setFilter] = useState<FilterKey | 'all'>('all');
  const large = fontScale > 1.35;

  const home = useQuery({ queryKey: homeKey, queryFn: fetchHome });
  const unreadAlerts = useUnreadAlerts();
  const now = useNow();
  const today = home.data?.today;

  const needs = useMemo(() => (today ? buildNeeds(today, now) : []), [today, now]);
  // A task marked done waits 5 s for Undo; hide it meanwhile.
  const visibleNeeds = needs.filter((n) => !(n.kind === 'task' && pending.has(doneKey(n.id))));
  const counts: Record<FilterKey, number> = {
    overdue: today?.counts.overdue ?? 0,
    risk: Math.max(0, (today?.counts.at_risk ?? 0) - (today?.counts.overdue ?? 0)),
    today: today?.counts.tasks_due ?? 0,
    forms: today?.counts.form_steps ?? 0,
  };
  const rows = filter === 'all' ? visibleNeeds : visibleNeeds.filter((n) => n.tags.has(filter));
  const current = FILTERS.find((f) => f.key === filter);

  const openNeed = (n: NeedItem) => {
    if (n.kind === 'task') navigation.navigate('Task', { id: n.id, title: n.title });
    else navigation.navigate('Record', { id: n.id, title: n.where || n.title });
  };

  const header = (
    <View style={styles.header}>
      <Text variant="subhead" color="ink2" style={styles.date}>
        {formatLongDay(now)}
      </Text>
      <View style={styles.headerButtons}>
        <IconButton onPress={() => navigation.navigate('Alerts')} accessibilityLabel={unreadAlerts ? `Focus alerts, ${unreadAlerts} new` : 'Focus alerts'} dot={unreadAlerts > 0}>
          <Icon name="bell" size={22} color={colors.body} strokeWidth={1.8} />
        </IconButton>
        <PressableScale onPress={() => navigation.navigate('Me')} accessibilityLabel="Me" scaleTo={0.92} hitSlop={4}>
          <Avatar name={user?.name ?? 'Me'} size={44} brand />
        </PressableScale>
      </View>
    </View>
  );

  return (
    <TabScreen
      title={`${greeting(now)}, ${keepTogether(firstName(user?.name))}`}
      compactTitle="Today"
      header={header}
      onRefresh={() => home.refetch()}
    >
      {home.isPending ? (
        <HomeSkeleton variant="today" label="Loading your day" />
      ) : home.isError ? (
        <View style={styles.section}>
          <LoadError message={errorMessage(home.error)} onRetry={() => home.refetch()} />
        </View>
      ) : (
        <>
          <Text variant="callout" color="body" style={styles.summary}>
            {summary(counts.overdue, counts.risk, counts.today, counts.forms)}
          </Text>

          <View
            style={[styles.tiles, large && styles.tilesStacked]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Show in Needs you"
          >
            {FILTERS.map((f) => {
              const on = filter === f.key;
              const tone = colors.tones[f.tone];
              return (
                <PressableScale
                  key={f.key}
                  scaleTo={0.97}
                  onPress={() => {
                    haptic.selection();
                    setFilter(on ? 'all' : f.key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${f.label}, ${counts[f.key]}`}
                  style={[
                    large ? styles.tileRow : styles.tile,
                    {
                      backgroundColor: on ? tone.selected : colors.panel,
                      borderColor: on ? tone.dot : colors.cardRing,
                      borderWidth: on ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.tileLabel}>
                    <View style={[styles.dot, { backgroundColor: tone.dot }, large && styles.dotLarge]} />
                    <Text variant="captionStrong" color={tone.ink} style={large ? styles.tileLabelLarge : undefined}>
                      {f.label}
                    </Text>
                  </View>
                  <Text variant="number" style={large ? styles.countLarge : undefined}>
                    {counts[f.key]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* The list slides in when the filter changes; not when the screen first shows it. */}
          <LayoutAnimationConfig skipEntering>
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text variant="section" accessibilityRole="header" style={styles.flex}>
                  {current ? current.title : 'Needs you'}
                </Text>
                {filter !== 'all' ? (
                  <Pressable onPress={() => setFilter('all')} accessibilityRole="button" style={styles.showAll}>
                    <Text variant="captionStrong" color="link" style={styles.showAllText}>
                      Show all
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {rows.length === 0 ? (
                <Card padded style={styles.emptyCard}>
                  <Text variant="subhead" color="ink2" align="center">
                    {current ? current.empty : 'Nothing needs you right now. New tasks and forms show up here.'}
                  </Text>
                </Card>
              ) : (
                <Animated.View key={filter} entering={reduced ? undefined : riseIn()}>
                  <Card>
                    {rows.map((n, i) => (
                      <NeedRow key={n.key} item={n} large={large} last={i === rows.length - 1} onPress={() => openNeed(n)} />
                    ))}
                  </Card>
                </Animated.View>
              )}
            </View>
          </LayoutAnimationConfig>

          <AlsoToday today={today!} onOpenTask={(id, title) => navigation.navigate('Task', { id, title })} onOpenOutlet={(id, name) => navigation.navigate('Outlet', { id, name })} />

          {today?.suggestions && today.suggestions.total > 0 ? (
            <PressableScale
              onPress={() => navigation.navigate('Outlets', { filter: 'sugg' })}
              scaleTo={0.98}
              accessibilityRole="link"
              style={[styles.suggest, { backgroundColor: colors.panel, borderColor: colors.cardRing }]}
            >
              <Text variant="captionStrong" color={colors.tones.suggest.ink}>
                Suggested orders
              </Text>
              <Text variant="section" style={styles.suggestTitle}>
                {today.suggestions.total === 1 ? '1 of your outlets could order more' : `${today.suggestions.total} of your outlets could order more`}
              </Text>
              <Text variant="subhead" color="ink2" style={styles.suggestBody}>
                About {formatMoney(today.suggestions.estimated_monthly_value, today.suggestions.currency)} a month, from what similar outlets buy.
              </Text>
              <View style={styles.seeThem}>
                <Text variant="captionStrong" color="link" style={styles.showAllText}>
                  See them
                </Text>
                <Icon name="chevronRight" size={16} color={colors.link} strokeWidth={2.4} />
              </View>
            </PressableScale>
          ) : null}
        </>
      )}
    </TabScreen>
  );
}

function NeedRow({ item, large, last, onPress }: { item: NeedItem; large: boolean; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const tone = colors.tones[item.tone];
  return (
    <ListRow onPress={onPress} divider={!last} chevron={!large} accessibilityLabel={item.label} style={styles.needRow}>
      {large ? null : (
        <View style={[styles.needTile, { backgroundColor: tone.tile }]}>
          <Icon name={item.kind === 'form' ? 'forms' : 'tasks'} size={21} color={tone.ink} />
          {item.pulse ? (
            <View style={[styles.pulse, { borderColor: colors.panel, backgroundColor: colors.panel }]}>
              <PulseDot color="#F04438" size={8} pulse />
            </View>
          ) : null}
        </View>
      )}
      <View style={styles.flex}>
        <Text variant="rowTitle">{item.title}</Text>
        <PlaceAndNote place={item.where} note={item.note} noteColor={tone.ink} stack={large} />
      </View>
    </ListRow>
  );
}

function AlsoToday({
  today,
  onOpenTask,
  onOpenOutlet,
}: {
  today: DayAtAGlance;
  onOpenTask: (id: number, title: string) => void;
  onOpenOutlet: (id: number, name: string) => void;
}) {
  const appointments = today.appointments;
  const visits = today.visits_planned;
  if (appointments.length === 0 && visits.length === 0) return null;
  const total = appointments.length + visits.length;
  return (
    <View style={styles.sectionLarge}>
      <Text variant="section" accessibilityRole="header" style={styles.sectionTitle}>
        Also today
      </Text>
      <Card>
        {appointments.map((a, i) => {
          const index = i + 1;
          return (
            <ListRow key={`a-${a.id}`} onPress={() => onOpenTask(a.id, a.title)} divider={index < total} style={styles.alsoRow}>
              <Text variant="bodyStrong" style={styles.time}>
                {a.appointment_at ? formatTime(a.appointment_at) : ''}
              </Text>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{a.lead_name ?? a.title}</Text>
                <Text variant="caption" color="ink2">
                  Appointment · {lowerFirst(a.title)}
                </Text>
              </View>
            </ListRow>
          );
        })}
        {visits.map((v, i) => {
          const index = appointments.length + i + 1;
          return (
            <ListRow
              key={`v-${v.ife_report_id}`}
              onPress={v.lead_id ? () => onOpenOutlet(v.lead_id!, v.outlet ?? '') : undefined}
              divider={index < total}
              style={styles.alsoRow}
            >
              <Text variant="bodyStrong" color="ink2" style={styles.time}>
                Follow-up
              </Text>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{v.outlet ?? 'Outlet'}</Text>
                {v.plan ? (
                  <Text variant="caption" color="ink2">
                    You planned: {lowerFirst(v.plan)}
                  </Text>
                ) : null}
              </View>
            </ListRow>
          );
        })}
      </Card>
    </View>
  );
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  date: { fontFamily: 'InstrumentSans_500Medium', flexShrink: 1 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  summary: { marginTop: 10, marginHorizontal: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, marginHorizontal: space.gutter },
  tilesStacked: { flexDirection: 'column' },
  tile: { flexBasis: '40%', flexGrow: 1, minHeight: 92, borderRadius: radius.tile, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'space-between', gap: 8 },
  tileRow: { minHeight: 72, borderRadius: radius.tile, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  tileLabelLarge: { fontSize: 22, lineHeight: 28 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLarge: { width: 12, height: 12, borderRadius: 6 },
  countLarge: { fontSize: 34, lineHeight: 40 },
  section: { marginTop: 32, marginHorizontal: space.gutter },
  sectionLarge: { marginTop: 36, marginHorizontal: space.gutter },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 44, marginBottom: 8 },
  sectionTitle: { marginHorizontal: 12, marginBottom: 12 },
  showAll: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  showAllText: { fontSize: 15 },
  emptyCard: { alignItems: 'center' },
  needRow: { paddingVertical: 16, paddingHorizontal: 18 },
  needTile: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  alsoRow: { paddingVertical: 15, paddingHorizontal: 18 },
  time: { width: 76, fontSize: 15, lineHeight: 20 },
  suggest: { marginTop: 36, marginHorizontal: space.gutter, borderRadius: radius.card, borderWidth: 1, padding: 20 },
  suggestTitle: { marginTop: 6, fontSize: 20, lineHeight: 27 },
  suggestBody: { marginTop: 4, lineHeight: 22 },
  seeThem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, minHeight: 24 },
});
