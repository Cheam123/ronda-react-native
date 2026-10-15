import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { digestSections, fetchTeam, teamKeys } from '../../api/team';
import { Card } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ReadingSkeleton } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { attribution } from './TeamScreen';

/** The whole Morning Round-Up: the summary in Instrument Serif, then each section. */
export function RoundUpScreen() {
  const colors = useColors();
  const team = useQuery({ queryKey: teamKeys.team, queryFn: fetchTeam });

  if (team.isPending) {
    return (
      <DetailScreen backLabel="Team">
        <ReadingSkeleton variant="roundUp" label="Loading the Morning Round-Up" />
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

  const digest = team.data.digest;
  if (!digest) {
    return (
      <DetailScreen backLabel="Team">
        <View style={styles.empty}>
          <EmptyState icon="trend" title="No Round-Up yet" body="It is written each morning from the team’s tasks, visits and orders." />
        </View>
      </DetailScreen>
    );
  }

  const sections = digestSections(digest.content);
  const [lead, ...rest] = sections;

  return (
    <DetailScreen backLabel="Team" onRefresh={() => team.refetch()}>
      <View style={styles.head}>
        <View style={styles.kicker}>
          <Icon name="trend" size={18} color={colors.brandInk} strokeWidth={2} />
          <Text variant="captionStrong" color="brandInk">
            Morning Round-Up
          </Text>
        </View>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {digest.date_label}
        </Text>
      </View>

      {lead ? (
        <Text variant="serif" style={styles.lead}>
          {lead.lines.join(' ')}
        </Text>
      ) : null}

      {rest.map((s) => (
        <Card key={s.title} padded style={styles.block}>
          <Text variant="rowTitle" accessibilityRole="header">
            {s.title}
          </Text>
          <View style={styles.lines}>
            {s.lines.map((line, i) => (
              <View key={i} style={styles.line}>
                <View style={[styles.bullet, { backgroundColor: colors.chevron }]} />
                <Text variant="body" color="body" style={styles.flex}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ))}

      <Text variant="footnote" color="muted" style={styles.attribution}>
        {attribution(digest.source)}
      </Text>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  empty: { marginTop: 12 },
  head: { paddingHorizontal: 20, paddingTop: 8 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { marginTop: 6 },
  lead: { marginTop: 16, marginHorizontal: 20, fontSize: 24, lineHeight: 32 },
  block: { marginTop: 16, marginHorizontal: space.gutter, borderRadius: radius.card },
  lines: { marginTop: 10, gap: 10 },
  line: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 10 },
  attribution: { marginTop: 18, marginHorizontal: 20 },
});
