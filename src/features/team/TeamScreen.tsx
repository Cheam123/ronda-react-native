import { useQuery } from '@tanstack/react-query';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { digestSections, fetchTeam, teamKeys, type Digest, type TeamPerson } from '../../api/team';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Card, ListRow } from '../../components/Card';
import { Loading, LoadError } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { PressableScale } from '../../components/Pressable';
import { TabScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { firstName, formatDayMonth, formatLongDay, formatTime, greeting, isSameDay, keepTogether, parseDate, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { PulseDot } from '../../motion/PulseDot';
import type { ManagerTabScreenProps } from '../../navigation/types';
import type { ToneName } from '../../theme/tokens';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { useUnreadAlerts } from '../alerts/useUnreadAlerts';

/** "3 tasks are overdue and 4 are at risk, spread across 3 people." */
function summaryLine(overdue: number, atRisk: number, people: number, dueToday: number): string {
  const verb = (n: number) => (n === 1 ? 'is' : 'are');
  const across = people > 1 ? `, spread across ${people} people` : people === 1 ? ', all with one person' : '';
  if (overdue && atRisk) return `${plural(overdue, 'task')} ${verb(overdue)} overdue and ${atRisk} ${verb(atRisk)} at risk${across}.`;
  if (overdue) return `${plural(overdue, 'task')} ${verb(overdue)} overdue${across}.`;
  if (atRisk) return `${plural(atRisk, 'task')} ${verb(atRisk)} at risk${across}.`;
  if (dueToday) return `${plural(dueToday, 'task')} ${verb(dueToday)} due today. Nothing is late.`;
  return 'Nothing is late or at risk. A quiet day for the team.';
}

/** Overdue first, then at risk, then the busiest. */
const byNeed = (a: TeamPerson, b: TeamPerson) => b.overdue - a.overdue || b.at_risk - a.at_risk || b.open - a.open || a.name.localeCompare(b.name);

/** The manager's home: how the team is doing, the Round-Up, and each person. */
export function TeamScreen({ navigation }: ManagerTabScreenProps<'Team'>) {
  const colors = useColors();
  const { user } = useAuth();
  const { fontScale } = useWindowDimensions();
  const large = fontScale > 1.35;
  const team = useQuery({ queryKey: teamKeys.team, queryFn: fetchTeam });
  const unreadAlerts = useUnreadAlerts();
  const now = useNow();
  const s = team.data?.summary;
  const people = (s?.team ?? []).filter((p) => p.user_id !== user?.id).sort(byNeed);
  const behind = people.filter((p) => p.overdue + p.at_risk > 0).length;
  const toReview = (team.data?.review.forms ?? 0) + (team.data?.review.visits ?? 0);

  const tiles: { key: string; label: string; tone: ToneName; count: number; go: () => void }[] = [
    { key: 'overdue', label: 'Overdue', tone: 'critical', count: s?.tasks.overdue ?? 0, go: () => navigation.navigate('MgrTasks', { focus: 'overdue' }) },
    { key: 'risk', label: 'At risk', tone: 'serious', count: s?.tasks.at_risk ?? 0, go: () => navigation.navigate('MgrTasks', { focus: 'urgent' }) },
    { key: 'today', label: 'Due today', tone: 'brand', count: s?.tasks.due_today ?? 0, go: () => navigation.navigate('MgrTasks', { focus: 'due_today' }) },
    { key: 'review', label: 'To review', tone: 'form', count: toReview, go: () => navigation.navigate('Review') },
  ];

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
    <TabScreen title={`${greeting(now)}, ${keepTogether(firstName(user?.name))}`} compactTitle="Team" header={header} onRefresh={() => team.refetch()}>
      {team.isPending ? (
        <Loading label="Loading your team" />
      ) : team.isError || !s ? (
        <View style={styles.section}>
          <LoadError message={errorMessage(team.error)} onRetry={() => team.refetch()} />
        </View>
      ) : (
        <>
          <Text variant="callout" color="body" style={styles.summary}>
            {summaryLine(s.tasks.overdue, s.tasks.at_risk, behind, s.tasks.due_today)}
          </Text>

          <View style={[styles.tiles, large && styles.tilesStacked]}>
            {tiles.map((t) => {
              const tone = colors.tones[t.tone];
              return (
                <PressableScale
                  key={t.key}
                  scaleTo={0.97}
                  onPress={() => {
                    haptic.selection();
                    t.go();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label}, ${t.count}`}
                  style={[large ? styles.tileRow : styles.tile, { backgroundColor: colors.panel, borderColor: colors.cardRing }]}
                >
                  <View style={styles.tileLabel}>
                    <View style={[styles.dot, { backgroundColor: tone.dot }]} />
                    <Text variant="captionStrong" color={tone.ink} style={large ? styles.tileLabelLarge : undefined}>
                      {t.label}
                    </Text>
                  </View>
                  <Text variant="number">{t.count}</Text>
                </PressableScale>
              );
            })}
          </View>

          {team.data?.digest ? <RoundUpCard digest={team.data.digest} onRead={() => navigation.navigate('RoundUp')} /> : null}

          <View style={styles.section}>
            <Text variant="section" accessibilityRole="header" style={styles.sectionTitle}>
              People
            </Text>
            <Card>
              {people.map((p, i) => (
                <PersonRow key={p.user_id} person={p} last={i === people.length - 1} onPress={() => navigation.navigate('Person', { userId: p.user_id, name: p.name })} />
              ))}
              {people.length === 0 ? (
                <View style={styles.empty}>
                  <Text variant="subhead" color="ink2">
                    No one is in the team yet.
                  </Text>
                </View>
              ) : null}
            </Card>
            <Card style={styles.activity}>
              <ListRow onPress={() => navigation.navigate('TeamActivity')} chevron divider={false} style={styles.activityRow}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">Team activity</Text>
                  <Text variant="caption" color="ink2">
                    Tasks added and done, visits, orders
                  </Text>
                </View>
              </ListRow>
            </Card>
          </View>
        </>
      )}
    </TabScreen>
  );
}

/** The top of the Morning Round-Up. Claude (or the template) wrote it; the card says which. */
export function RoundUpCard({ digest, onRead }: { digest: Digest; onRead: () => void }) {
  const colors = useColors();
  const sections = digestSections(digest.content);
  const lead = (sections.find((x) => x.title === 'Summary') ?? sections[0])?.lines.join(' ') ?? digest.content;
  const written = parseDate(digest.written_at ?? digest.digest_date);
  const day = parseDate(digest.digest_date);
  const stamp = day && !isSameDay(day, new Date()) ? formatDayMonth(day) : written ? formatTime(written) : '';
  return (
    <Card padded style={styles.roundUp}>
      <View style={styles.roundHead}>
        <View style={styles.roundTitle}>
          <Icon name="trend" size={18} color={colors.brandInk} strokeWidth={2} />
          <Text variant="captionStrong" color="brandInk" accessibilityRole="header">
            Morning Round-Up
          </Text>
        </View>
        <Text variant="footnote" color="ink2">
          {stamp}
        </Text>
      </View>
      <Text variant="serif" numberOfLines={5} style={styles.roundText}>
        {lead}
      </Text>
      <View style={styles.roundFoot}>
        <Text variant="footnote" color="muted" style={styles.flex}>
          {attribution(digest.source)}
        </Text>
        <PressableScale onPress={onRead} accessibilityRole="button" accessibilityLabel="Read all of the Morning Round-Up" style={styles.readAll}>
          <Text variant="captionStrong" color="link" style={styles.link15}>
            Read all
          </Text>
        </PressableScale>
      </View>
    </Card>
  );
}

/** Who wrote the Round-Up, and from what. */
export function attribution(source: string): string {
  return source === 'bedrock'
    ? 'Written by Claude (Amazon Bedrock) from the team’s tasks, visits and orders.'
    : 'Written from a template, from the team’s tasks, visits and orders. Claude was not used.';
}

function PersonRow({ person: p, last, onPress }: { person: TeamPerson; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const top = p.urgent[0];
  const label = [`${p.open} open`, p.overdue ? `${p.overdue} overdue` : null, p.at_risk ? `${p.at_risk} at risk` : null].filter(Boolean).join(', ');
  return (
    <ListRow onPress={onPress} divider={!last} align="top" style={styles.personRow} accessibilityLabel={`${p.name}. ${label}.${top ? ` Most urgent: ${top.title}` : ''}`}>
      <Avatar name={p.name} size={44} />
      <View style={styles.flex}>
        <Text variant="rowTitle">{p.name}</Text>
        <Text variant="caption" color="ink2">
          {p.open} open
          {p.overdue ? (
            <Text variant="captionStrong" color={colors.tones.critical.ink}>
              {` · ${p.overdue} overdue`}
            </Text>
          ) : null}
          {p.at_risk ? (
            <Text variant="captionStrong" color={colors.tones.serious.ink}>
              {` · ${p.at_risk} at risk`}
            </Text>
          ) : null}
        </Text>
        {top ? (
          <View style={styles.urgent}>
            <PulseDot color={top.level === 'overdue' ? colors.tones.critical.dot : colors.tones.serious.dot} pulse={top.level === 'overdue'} />
            <Text variant="caption" color="body" numberOfLines={1} style={styles.flex}>
              {top.title}
              {top.lead ? `, ${top.lead}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  date: { fontFamily: fonts.medium, flexShrink: 1 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  summary: { marginTop: 10, marginHorizontal: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, marginHorizontal: space.gutter },
  tilesStacked: { flexDirection: 'column' },
  tile: { flexBasis: '40%', flexGrow: 1, minHeight: 92, borderRadius: radius.tile, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'space-between', gap: 8 },
  tileRow: { minHeight: 72, borderRadius: radius.tile, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  tileLabelLarge: { fontSize: 22, lineHeight: 28 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  roundUp: { marginTop: 32, marginHorizontal: space.gutter, borderRadius: radius.card, paddingVertical: 18, paddingHorizontal: 18 },
  roundHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  roundTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundText: { marginTop: 10, fontSize: 22, lineHeight: 29 },
  roundFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  readAll: { minHeight: 48, justifyContent: 'center', paddingLeft: 8 },
  link15: { fontSize: 15 },
  section: { marginTop: 32, marginHorizontal: space.gutter },
  sectionTitle: { marginHorizontal: 12, marginBottom: 12 },
  personRow: { paddingVertical: 16, paddingHorizontal: 18, alignItems: 'flex-start' },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  empty: { padding: 20 },
  activity: { marginTop: 12 },
  activityRow: { minHeight: 60, paddingVertical: 12, paddingHorizontal: 18 },
});
