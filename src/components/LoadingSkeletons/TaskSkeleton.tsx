import { StyleSheet, View } from 'react-native';
import { radius, space } from '../../theme/tokens';
import { SkeletonCard } from './ListSkeleton';
import { Bone, CircleBone, Skeleton, TextBone } from './Skeleton';

const TITLE_28 = { fontSize: 28, lineHeight: 34 };

/**
 * One task loading: the pills and title, then the cards below them. For the
 * rep's Task, the outlet card and the progress; for Check done work, who did
 * it and what they did.
 */
export function TaskSkeleton({ variant = 'task', label = 'Loading the task' }: { variant?: 'task' | 'check'; label?: string }) {
  return (
    <Skeleton label={label}>
      <View style={[styles.header, variant === 'check' && styles.headerCheck]}>
        <View style={styles.pills}>
          <Bone width={104} height={26} radius={radius.pill} />
          {variant === 'task' ? <Bone width={118} height={26} radius={radius.pill} /> : null}
        </View>
        <TextBone variant="title" size={variant === 'task' ? TITLE_28 : undefined} width="90%" lines={2} lastWidth="52%" style={styles.title} />
        {variant === 'check' ? (
          <View style={styles.doer}>
            <CircleBone size={32} />
            <View style={styles.flex}>
              <TextBone variant="subhead" width="44%" />
              <TextBone variant="subhead" width="70%" />
            </View>
          </View>
        ) : null}
      </View>

      {variant === 'task' ? (
        <SkeletonCard style={styles.outlet}>
          <Bone width={42} height={42} radius={13} />
          <View style={styles.flex}>
            <TextBone variant="bodyStrong" width="56%" />
            <TextBone variant="caption" width="40%" />
          </View>
        </SkeletonCard>
      ) : (
        <SkeletonCard padded style={styles.block}>
          <TextBone variant="bodyStrong" width="36%" />
          <TextBone variant="body" size={{ fontSize: 17, lineHeight: 25 }} width="92%" lines={2} lastWidth="64%" style={styles.did} />
        </SkeletonCard>
      )}

      <SkeletonCard style={[styles.block, styles.steps]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.step}>
            <CircleBone size={24} />
            <TextBone variant="caption" size={{ fontSize: 12, lineHeight: 15 }} width={48} />
          </View>
        ))}
      </SkeletonCard>

      <SkeletonCard style={[styles.block, styles.details]}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.detail}>
            <TextBone variant="body" width={74} />
            <TextBone variant="bodyStrong" width={i === 0 ? 150 : 110} />
          </View>
        ))}
      </SkeletonCard>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: 20, paddingTop: 10 },
  headerCheck: { paddingTop: 8 },
  pills: { flexDirection: 'row', gap: 6 },
  title: { marginTop: 12 },
  doer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  outlet: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  block: { marginTop: 16 },
  did: { marginTop: 8 },
  steps: { flexDirection: 'row', paddingTop: 16, paddingBottom: 14, paddingHorizontal: 4 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  details: { paddingHorizontal: 16, paddingVertical: 2 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 13 },
});
