import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, View } from 'react-native';
import { assistantKeys, briefSections, fetchBrief, writeBrief } from '../../api/assistant';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ReadingSkeleton } from '../../components/LoadingSkeletons';
import { RingIcon } from '../../components/Icon';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDateTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

/** The whole visit brief, in its four sections. */
export function VisitBriefScreen({ route }: RootScreenProps<'VisitBrief'>) {
  const { id, name } = route.params;
  const colors = useColors();
  const queryClient = useQueryClient();
  const brief = useQuery({ queryKey: assistantKeys.brief(id), queryFn: () => fetchBrief(id) });
  const update = useMutation({
    mutationFn: () => writeBrief(id),
    onSuccess: (b) => {
      haptic.success();
      queryClient.setQueryData(assistantKeys.brief(id), (prev: { available: boolean } | undefined) => ({ available: prev?.available ?? false, brief: b }));
    },
    onError: (e) => {
      haptic.error();
      Alert.alert('We could not update the brief', errorMessage(e));
    },
  });

  const b = brief.data?.brief;
  const sections = b ? briefSections(b.content) : [];

  return (
    <DetailScreen
      backLabel={name ?? 'Outlet'}
      bottomBar={<Button label={b ? 'Update the brief' : 'Write the brief'} loading={update.isPending} style={styles.flex} onPress={() => update.mutate()} />}
    >
      <View style={styles.head}>
        <RingIcon size={24} color={colors.brand} dot={colors.coral} />
        <Text variant="title" accessibilityRole="header" style={styles.flex}>
          Visit brief
        </Text>
      </View>
      {brief.isPending ? (
        <ReadingSkeleton variant="brief" label="Loading the visit brief" />
      ) : brief.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(brief.error)} onRetry={() => brief.refetch()} />
        </View>
      ) : !b ? (
        <View style={styles.block}>
          <EmptyState icon="visits" title="No brief yet" body="Write one before you go in: who they are, what happened last time and what to raise today." />
        </View>
      ) : (
        <>
          <Text variant="caption" color="ink2" style={styles.meta}>
            {b.source === 'bedrock' ? 'Written by Claude (Amazon Bedrock)' : 'Written from the records (Claude is not set up yet)'} on {formatDateTime(b.generated_at)}
            {b.generated_by ? ` for ${b.generated_by}` : ''}, from this outlet’s visits, orders and tasks.
          </Text>
          {b.stale ? (
            <View style={[styles.stale, { backgroundColor: colors.tones.serious.tile }]}>
              <Text variant="caption" color={colors.tones.serious.ink}>
                There are new visits, orders or tasks since this was written. Update it to include them.
              </Text>
            </View>
          ) : null}
          {sections.map((s, i) => (
            <Card key={`${s.title}-${i}`} padded style={styles.section}>
              {s.title ? (
                <Text variant="label" color="ink2" accessibilityRole="header">
                  {s.title}
                </Text>
              ) : null}
              <View style={styles.lines}>
                {s.lines.map((line, j) => (
                  <View key={j} style={styles.line}>
                    <View style={[styles.dot, { backgroundColor: colors.brand }]} />
                    <Text variant="body" style={styles.flex}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 8 },
  meta: { marginHorizontal: 20, marginTop: 6 },
  block: { marginTop: 20 },
  stale: { marginTop: 14, marginHorizontal: space.gutter, padding: 12, borderRadius: 14 },
  section: { marginTop: 14, marginHorizontal: space.gutter },
  lines: { marginTop: 8, gap: 10 },
  line: { flexDirection: 'row', gap: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
});
