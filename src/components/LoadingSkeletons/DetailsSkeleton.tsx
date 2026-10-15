import { StyleSheet, View } from 'react-native';
import { useColors } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { BriefLines } from './OutletSkeleton';
import { SkeletonCard, SkeletonRow } from './ListSkeleton';
import { Bone, Skeleton, TextBone } from './Skeleton';

/** A group's small heading, as on Outlet details and Documents. */
function GroupBone({ width = '28%' }: { width?: `${number}%` }) {
  return <TextBone variant="captionStrong" size={{ fontSize: 15, lineHeight: 20 }} width={width} style={styles.group} />;
}

/**
 * Facts in groups loading (Outlet details): a heading, then a card of
 * label-over-value rows.
 */
export function DetailsSkeleton({ groups = 2, rows = 3, label = 'Loading the details' }: { groups?: number; rows?: number; label?: string }) {
  const colors = useColors();
  return (
    <Skeleton label={label}>
      {Array.from({ length: groups }, (_, g) => (
        <View key={g}>
          <GroupBone width={g === 0 ? '24%' : '34%'} />
          <SkeletonCard style={styles.card}>
            {Array.from({ length: rows }, (_, i) => (
              <View key={i} style={[styles.row, i < rows - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                <TextBone variant="caption" width={(['26%', '34%', '22%', '30%'] as const)[i % 4]} />
                <TextBone variant="body" width={(['58%', '44%', '66%', '50%'] as const)[(i + g) % 4]} />
              </View>
            ))}
          </SkeletonCard>
        </View>
      ))}
    </Skeleton>
  );
}

/** An outlet's documents loading: a row of photos, then a list of files. */
export function DocumentsSkeleton({ label = 'Loading documents' }: { label?: string }) {
  return (
    <Skeleton label={label}>
      <GroupBone width="22%" />
      <View style={styles.photos}>
        {[0, 1, 2].map((i) => (
          <Bone key={i} width={104} height={104} radius={14} />
        ))}
      </View>
      <GroupBone width="18%" />
      <SkeletonCard>
        {[0, 1].map((i) => (
          <SkeletonRow key={i} index={i} divider={i === 0} shape={{ leading: 'icon', leadingSize: 40, title: 'bodyStrong', lines: ['caption'] }} />
        ))}
      </SkeletonCard>
    </Skeleton>
  );
}

/**
 * Something to read loading: the Morning Round-Up (a kicker, the title, the
 * lead, then sections of points) or the full visit brief (a line of when, then
 * sections of points).
 */
export function ReadingSkeleton({ variant, label = 'Loading' }: { variant: 'roundUp' | 'brief'; label?: string }) {
  return (
    <Skeleton label={label}>
      {variant === 'roundUp' ? (
        <>
          <View style={styles.head}>
            <TextBone variant="captionStrong" width="42%" />
            <TextBone variant="title" width="70%" style={styles.title} />
          </View>
          <TextBone variant="serif" size={{ fontSize: 24, lineHeight: 32 }} width="92%" lines={3} lastWidth="50%" style={styles.lead} />
        </>
      ) : (
        <TextBone variant="caption" width="54%" style={styles.meta} />
      )}
      {[0, 1].map((i) => (
        <SkeletonCard key={i} padded style={styles.block}>
          <TextBone variant="rowTitle" width={i === 0 ? '40%' : '32%'} />
          <BriefLines count={i === 0 ? 3 : 2} />
        </SkeletonCard>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 24, marginBottom: 10, marginHorizontal: 20 },
  card: { paddingHorizontal: 16 },
  row: { paddingVertical: 13, gap: 2 },
  photos: { flexDirection: 'row', gap: 8, marginHorizontal: space.gutter },
  head: { paddingHorizontal: 20, paddingTop: 8 },
  title: { marginTop: 6 },
  lead: { marginTop: 16, marginHorizontal: 20 },
  meta: { marginHorizontal: 20, marginTop: 6 },
  block: { marginTop: 16 },
});
