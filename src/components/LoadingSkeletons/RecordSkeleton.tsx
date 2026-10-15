import { StyleSheet, View } from 'react-native';
import { useColors } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { SkeletonCard } from './ListSkeleton';
import { Bone, CircleBone, Skeleton, TextBone } from './Skeleton';

const TITLE_28 = { fontSize: 28, lineHeight: 34 };

/**
 * A form record or a visit report loading: the header (pill or kind, title,
 * who sent it), then the cards: "Where it is" and the answers for a record,
 * the location stamp and the details for a visit.
 */
export function RecordSkeleton({ variant = 'record', label = 'Loading' }: { variant?: 'record' | 'visit'; label?: string }) {
  const colors = useColors();
  const record = variant === 'record';

  return (
    <Skeleton label={label}>
      <View style={[styles.head, !record && styles.headVisit]}>
        {record ? <Bone width={120} height={26} radius={radius.pill} /> : <TextBone variant="captionStrong" width={90} />}
        <TextBone variant="title" size={TITLE_28} width="86%" lines={1} style={record ? styles.title : styles.titleVisit} />
        <View style={styles.from}>
          <CircleBone size={32} />
          <View style={styles.flex}>
            <TextBone variant="subhead" width="42%" />
            <TextBone variant="subhead" width="68%" />
          </View>
        </View>
        {record ? (
          <TextBone variant="mono" width={84} style={styles.ref} />
        ) : (
          <View style={styles.chips}>
            <Bone width={104} height={26} radius={radius.pill} />
            <Bone width={128} height={26} radius={radius.pill} />
          </View>
        )}
      </View>

      {record ? (
        <>
          <SkeletonCard padded style={styles.card}>
            <TextBone variant="rowTitle" width="34%" style={styles.trailTitle} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.trailRow, i < 2 && styles.trailGap]}>
                <CircleBone size={28} />
                <View style={styles.flex}>
                  <TextBone variant="rowTitle" width={(['58%', '64%', '52%'] as const)[i]} />
                  <TextBone variant="subhead" width={(['36%', '40%', '46%'] as const)[i]} />
                </View>
              </View>
            ))}
          </SkeletonCard>
          <SkeletonCard style={styles.answers}>
            <View style={styles.answerHead}>
              <TextBone variant="rowTitle" width="40%" />
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.answer, { borderTopColor: colors.divider }]}>
                <TextBone variant="body" width={[118, 150, 104][i]} />
                <TextBone variant="body" width={[92, 40, 72][i]} />
              </View>
            ))}
          </SkeletonCard>
        </>
      ) : (
        <>
          <SkeletonCard style={styles.card}>
            <Bone height={104} radius={0} />
            <View style={styles.stampRow}>
              <CircleBone size={22} />
              <TextBone variant="subhead" width="58%" />
            </View>
          </SkeletonCard>
          <SkeletonCard style={[styles.card, styles.details]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.detail, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                <TextBone variant="caption" width="30%" />
                <TextBone variant="body" width="88%" lines={i === 0 ? 2 : 1} lastWidth="54%" style={styles.detailValue} />
              </View>
            ))}
          </SkeletonCard>
        </>
      )}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { paddingHorizontal: 20, paddingTop: 12 },
  headVisit: { paddingTop: 8 },
  title: { marginTop: 12 },
  titleVisit: { marginTop: 2 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  ref: { marginTop: 8 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 12 },
  card: { marginTop: 16 },
  trailTitle: { marginBottom: 14 },
  trailRow: { flexDirection: 'row', gap: 14 },
  trailGap: { paddingBottom: 18 },
  answers: { marginTop: 12, paddingHorizontal: 18, paddingBottom: 8 },
  answerHead: { minHeight: 44, justifyContent: 'center' },
  answer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  details: { paddingHorizontal: 16, paddingVertical: 6 },
  detail: { paddingVertical: 12 },
  detailValue: { marginTop: 4 },
});
