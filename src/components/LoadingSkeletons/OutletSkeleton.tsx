import { StyleSheet, View } from 'react-native';
import { radius } from '../../theme/tokens';
import { Text } from '../Text';
import { SkeletonCard } from './ListSkeleton';
import { Bone, CircleBone, Skeleton, TextBone } from './Skeleton';

const BULLET = { fontSize: 17, lineHeight: 24 };

/**
 * The visit brief's bullets loading, inside a card that is already there
 * (the outlet screen) or on its own (the full brief).
 */
export function BriefLines({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.bullets}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.bullet}>
          <Bone width={6} height={6} radius={3} style={styles.bulletDot} />
          <TextBone variant="body" size={BULLET} width="94%" lines={2} lastWidth={(['62%', '48%', '70%'] as const)[i % 3]} style={styles.flex} />
        </View>
      ))}
    </View>
  );
}

/** The brief section on its own, as a skeleton (the outlet's brief card is still loading). */
export function BriefSkeleton({ count = 3, label = 'Loading the visit brief' }: { count?: number; label?: string }) {
  return (
    <Skeleton label={label}>
      <BriefLines count={count} />
    </Skeleton>
  );
}

/**
 * One outlet loading: its tile, name and kind, the four round actions, then
 * the visit brief. With `name` (from the list), the real name shows at once.
 */
export function OutletSkeleton({ name, label = 'Loading the outlet' }: { name?: string; label?: string }) {
  return (
    <Skeleton label={label}>
      <View style={styles.header}>
        <Bone width={64} height={64} radius={20} />
        {name ? (
          <Text variant="title" style={styles.title}>
            {name}
          </Text>
        ) : (
          <TextBone variant="title" width="72%" style={styles.title} />
        )}
        <TextBone variant="body" width="40%" style={styles.company} />
        <View style={styles.chips}>
          <Bone width={112} height={28} radius={radius.pill} />
          <Bone width={150} height={28} radius={radius.pill} />
        </View>
      </View>

      <View style={styles.actions}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.action}>
            <CircleBone size={56} />
            <TextBone variant="caption" width={56} />
          </View>
        ))}
      </View>

      <SkeletonCard padded style={styles.brief}>
        <View style={styles.briefHead}>
          <CircleBone size={20} />
          <TextBone variant="rowTitle" size={{ fontSize: 18, lineHeight: 24 }} width="36%" style={styles.flex} />
        </View>
        <BriefLines />
      </SkeletonCard>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: 20, paddingTop: 14 },
  title: { marginTop: 14 },
  company: { marginTop: 2 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 24 },
  action: { flex: 1, alignItems: 'center', gap: 8, minHeight: 48 },
  brief: { marginTop: 28 },
  briefHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullets: { marginTop: 14, gap: 12 },
  bullet: { flexDirection: 'row', gap: 12 },
  bulletDot: { marginTop: 9 },
});
