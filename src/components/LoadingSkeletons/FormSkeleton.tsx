import { StyleSheet, View } from 'react-native';
import { space } from '../../theme/tokens';
import { SkeletonCard } from './ListSkeleton';
import { Bone, Skeleton, TextBone } from './Skeleton';

const TITLE_28 = { fontSize: 28, lineHeight: 34 };

/** One labelled field: the label, then an empty box like the text field. */
function FieldBone({ index }: { index: number }) {
  return (
    <View style={styles.field}>
      <TextBone variant="captionStrong" width={(['38%', '52%', '30%', '46%'] as const)[index % 4]} />
      <Bone height={51} radius={14} outline />
    </View>
  );
}

/**
 * A form loading. `fill`: a step of Fill in a form (its title, a short
 * intro, the first fields). `card`: fields in a card, as on Add or Edit
 * outlet.
 */
export function FormSkeleton({ variant = 'fill', fields = 3, label = 'Opening the form' }: { variant?: 'fill' | 'card'; fields?: number; label?: string }) {
  if (variant === 'card') {
    return (
      <Skeleton label={label}>
        <TextBone variant="captionStrong" width="30%" style={styles.section} />
        <SkeletonCard padded style={styles.card}>
          {Array.from({ length: fields }, (_, i) => (
            <FieldBone key={i} index={i} />
          ))}
        </SkeletonCard>
      </Skeleton>
    );
  }
  return (
    <Skeleton label={label}>
      <View style={styles.stepOf} />
      <TextBone variant="title" size={TITLE_28} width="64%" style={styles.side} />
      <TextBone variant="body" width="90%" lines={2} lastWidth="56%" style={[styles.side, styles.intro]} />
      <View style={styles.fields}>
        {Array.from({ length: fields }, (_, i) => (
          <FieldBone key={i} index={i} />
        ))}
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  side: { marginHorizontal: 20 },
  // Where "Step 1 of 3" sits; the title follows it.
  stepOf: { marginTop: 24 },
  intro: { marginTop: 8 },
  fields: { marginTop: 28, marginHorizontal: 20, gap: 28 },
  field: { gap: 6 },
  section: { marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  card: { marginHorizontal: space.gutter, gap: 16 },
});
