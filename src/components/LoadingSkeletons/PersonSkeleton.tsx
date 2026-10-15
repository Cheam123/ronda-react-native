import { StyleSheet, View } from 'react-native';
import { radius, space } from '../../theme/tokens';
import { Text } from '../Text';
import { SkeletonCard } from './ListSkeleton';
import { Bone, CircleBone, Skeleton, TextBone } from './Skeleton';

/** Bar heights for the week's chart, so it reads as a chart. */
const BARS = [36, 58, 24, 70, 44, 62, 30];

/**
 * One rep loading (a manager's Person: who, the actions, the week's numbers
 * and chart), or Team activity (its title, then the same numbers and chart).
 */
export function PersonSkeleton({ variant = 'person', name, label = 'Loading' }: { variant?: 'person' | 'activity'; name?: string; label?: string }) {
  const activity = variant === 'activity';
  return (
    <Skeleton label={label}>
      {activity ? (
        <>
          <TextBone variant="title" width="54%" style={styles.title} />
          <TextBone variant="subhead" width="72%" style={styles.sub} />
        </>
      ) : (
        <PersonHead name={name} />
      )}
      {activity ? null : <TextBone variant="section" width="34%" style={styles.sectionTitle} />}
      <View style={[styles.stats, activity && styles.statsActivity]}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} style={[styles.stat, activity && styles.statTall]}>
            <TextBone variant="captionStrong" width="54%" />
            <TextBone variant={activity ? 'number' : 'title2'} width="38%" />
          </SkeletonCard>
        ))}
      </View>

      <SkeletonCard style={[styles.block, activity && styles.blockActivity]}>
        <TextBone variant="bodyStrong" width="40%" />
        <View style={styles.chart}>
          {BARS.map((h, i) => (
            <Bone key={i} width={22} height={h} radius={6} />
          ))}
        </View>
      </SkeletonCard>
    </Skeleton>
  );
}

/** The person's picture, name and role, then call, message and add a task. The name shows at once when known. */
function PersonHead({ name }: { name?: string }) {
  return (
    <>
      <View style={styles.head}>
        <CircleBone size={56} />
        <View style={styles.flex}>
          {name ? <Text variant="title">{name}</Text> : <TextBone variant="title" width="70%" />}
          <TextBone variant="subhead" width="52%" />
        </View>
      </View>

      <View style={styles.actions}>
        <CircleBone size={44} />
        <CircleBone size={44} />
        <Bone height={48} radius={radius.button} style={styles.flex} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginHorizontal: space.gutter },
  sectionTitle: { marginTop: 28, marginBottom: 12, marginHorizontal: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: space.gutter },
  // The row already has the side margin.
  stat: { flexBasis: '40%', flexGrow: 1, marginHorizontal: 0, borderRadius: radius.tile, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  block: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 18 },
  title: { marginTop: 8, marginHorizontal: 20 },
  sub: { marginTop: 4, marginHorizontal: 20 },
  statsActivity: { gap: 10, marginTop: 18 },
  // 92 tall, like Team activity's tiles.
  statTall: { minHeight: 92, justifyContent: 'space-between' },
  blockActivity: { marginTop: 10 },
  chart: { marginTop: 14, height: 96, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 6 },
});
