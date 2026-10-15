import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchFormTurns, formKeys, type FormTurn } from '../../api/forms';
import { fetchRecentReports, needsSupport, recentKey, splitWhatHappened, type VisitReportDetail } from '../../api/visits';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { TabScreen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { MetaLine } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { dayDiff, parseDate, plural, relativeDay } from '../../lib/format';
import { turnAction } from '../../lib/formCopy';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { ManagerTabScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';

type Show = 'forms' | 'visits';
const PAGE = 10;
/** A form waiting longer than this says so in amber. */
const LONG_WAIT_DAYS = 2;

/** The manager's Review: forms to approve, and new visit reports to act on. */
export function ReviewScreen({ route, navigation }: ManagerTabScreenProps<'Review'>) {
  const reduced = useReducedMotion();
  const [chosen, setShow] = useState<Show | null>(route.params?.show ?? null);
  const [shown, setShown] = useState(PAGE);
  const turns = useQuery({ queryKey: formKeys.turns, queryFn: fetchFormTurns });
  const reports = useQuery({ queryKey: recentKey({ open: true }), queryFn: () => fetchRecentReports({ open: true }) });

  const wanted = route.params?.show;
  useFocusEffect(
    useCallback(() => {
      if (wanted) {
        setShow(wanted);
        navigation.setParams({ show: undefined });
      }
    }, [wanted, navigation]),
  );

  // Until one is picked, open where the work is: visit reports when no form waits.
  const show: Show = chosen ?? (turns.data?.length === 0 && (reports.data?.length ?? 0) > 0 ? 'visits' : 'forms');
  // Oldest first: the one waiting longest is the one to clear.
  const forms = [...(turns.data ?? [])].sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''));
  const visits = reports.data ?? [];
  const current = show === 'forms' ? turns : reports;

  return (
    <TabScreen
      title="Review"
      onRefresh={() => Promise.all([turns.refetch(), reports.refetch()])}
    >
      <View style={styles.segmented}>
        <Segmented<Show>
          accessibilityLabel="Show"
          value={show}
          onChange={(k) => {
            setShow(k);
            setShown(PAGE);
          }}
          segments={[
            { key: 'forms', label: `Forms ${turns.data ? forms.length : ''}`.trim() },
            { key: 'visits', label: `Visit reports ${reports.data ? visits.length : ''}`.trim() },
          ]}
        />
      </View>

      {/* The line describes the list, so it goes when there is none: the empty card says it instead. */}
      {current.isError || (current.data && (show === 'forms' ? forms.length : visits.length) === 0) ? null : (
        <Text variant="subhead" color="ink2" style={styles.caption}>
          {show === 'forms' ? 'Forms waiting for you, oldest first.' : 'New visit reports. Make one a task if it needs follow-up.'}
        </Text>
      )}

      {current.isPending ? (
        <ListSkeleton label="Loading" shape={rowShapes.review} />
      ) : current.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(current.error)} onRetry={() => current.refetch()} />
        </View>
      ) : show === 'forms' ? (
        forms.length === 0 ? (
          <View style={styles.block}>
            <EmptyState icon="review" title="No forms are waiting for you" body="Forms your team sends for approval show up here." />
          </View>
        ) : (
          <Animated.View key="forms" entering={reduced ? undefined : FadeIn.duration(220)}>
            <Card style={styles.card}>
              {forms.map((f, i) => (
                <FormRow key={f.entry_id} turn={f} last={i === forms.length - 1} onPress={() => navigation.navigate('Record', { id: f.entry_id, title: f.record_title })} />
              ))}
            </Card>
          </Animated.View>
        )
      ) : visits.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="visits" title="No new visit reports" body="Reports from the last 2 weeks that are not a task yet show up here." />
        </View>
      ) : (
        <Animated.View key="visits" entering={reduced ? undefined : FadeIn.duration(220)}>
          <Card style={styles.card}>
            {visits.slice(0, shown).map((v, i, list) => (
              <VisitRow
                key={v.id}
                report={v}
                last={i === list.length - 1}
                onPress={() =>
                  navigation.navigate('VisitReport', {
                    id: v.id,
                    ids: visits.map((x) => x.id),
                  })
                }
              />
            ))}
          </Card>
          {visits.length > shown ? (
            <Pressable onPress={() => setShown((n) => n + PAGE)} accessibilityRole="button" style={styles.more}>
              <Text variant="captionStrong" color="link" style={styles.moreText}>
                Show {Math.min(PAGE, visits.length - shown)} more
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      )}
    </TabScreen>
  );
}

function FormRow({ turn, last, onPress }: { turn: FormTurn; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const sent = parseDate(turn.submitted_at);
  const waited = sent ? dayDiff(sent, new Date()) : 0;
  const parts = [turn.form_name, turn.submitted_by, turn.submitted_at ? relativeDay(turn.submitted_at) : null].filter((p): p is string => !!p);
  const sub = parts.join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${turn.record_title}. ${sub}. ${turnAction(turn)}`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
    >
      <Avatar name={turn.submitted_by ?? '?'} size={40} />
      <View style={styles.flex}>
        <Text variant="rowTitle">{turn.record_title}</Text>
        {/* Too long for one line: the form's name, then who and when. */}
        <MetaLine parts={parts} splitAt={1} />
        {waited > LONG_WAIT_DAYS ? (
          <View style={styles.tag}>
            <Tag text={`Waiting ${plural(waited, 'day')}`} ink={colors.tones.serious.ink} bg={colors.tones.serious.tile} />
          </View>
        ) : turn.stage_type === 'fill' ? (
          <Text variant="captionStrong" color="brandInk" style={styles.note}>
            {turnAction(turn)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function VisitRow({ report: r, last, onPress }: { report: VisitReportDetail; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const { what } = splitWhatHappened(r.problem_description);
  const gist = what.split(/[.\n]/)[0]?.trim().toLowerCase() ?? '';
  const parts = [r.created_by, relativeDay(r.created_at), gist].filter((p): p is string => !!p);
  const sub = parts.join(' · ');
  const support = needsSupport(r.support_required);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.outlet ?? 'Outlet'}. ${sub}${support ? '. Needs support' : ''}`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
    >
      <Avatar name={r.created_by ?? '?'} size={40} />
      <View style={styles.flex}>
        <Text variant="rowTitle">{r.outlet ?? 'Outlet'}</Text>
        {/* Too long for one line: who and when, then what happened. */}
        <MetaLine parts={parts} splitAt={2} longLast />
        {support ? (
          <View style={styles.tag}>
            <Tag text="Needs support" ink={colors.tones.serious.ink} bg={colors.tones.serious.tile} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  segmented: { marginTop: 16, marginHorizontal: space.gutter },
  caption: { marginTop: 20, marginBottom: 10, marginHorizontal: 20 },
  block: { marginTop: 20 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  note: { marginTop: 6, fontFamily: fonts.semibold },
  tag: { marginTop: 8, flexDirection: 'row' },
  more: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  moreText: { fontSize: 15 },
});
