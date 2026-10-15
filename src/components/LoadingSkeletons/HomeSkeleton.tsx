import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { SkeletonCard, SkeletonRow } from './ListSkeleton';
import { Bone, Skeleton, TextBone } from './Skeleton';

/** As in Today and Team: past this, the tiles stack into rows. */
const LARGE_TEXT = 1.35;

/**
 * Today (a rep) or Team (a manager) loading, under the greeting the screen
 * already shows: the summary line, the four count tiles, then the first
 * section (Needs you, or the Morning Round-Up and People).
 */
export function HomeSkeleton({ variant, label = 'Loading' }: { variant: 'today' | 'team'; label?: string }) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const large = fontScale > LARGE_TEXT;

  return (
    <Skeleton label={label}>
      <TextBone variant="callout" width="88%" lines={2} lastWidth="46%" style={styles.summary} />

      <View style={[styles.tiles, large && styles.tilesStacked]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[large ? styles.tileRow : styles.tile, { backgroundColor: colors.panel, borderColor: colors.cardRing }]}>
            <View style={styles.tileLabel}>
              <Bone width={8} height={8} radius={4} />
              <TextBone variant="captionStrong" width={large ? 120 : '70%'} style={styles.flex} />
            </View>
            <TextBone variant="number" width={large ? 36 : 30} />
          </View>
        ))}
      </View>

      {variant === 'today' ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <TextBone variant="section" width="38%" />
          </View>
          <SkeletonCard style={styles.inSection}>
            {[0, 1, 2].map((i) => (
              <SkeletonRow
                key={i}
                index={i}
                divider={i < 2}
                shape={{ leading: large ? 'none' : 'icon', leadingSize: 42, lines: large ? ['subhead', 'subhead'] : ['subhead'] }}
              />
            ))}
          </SkeletonCard>
        </View>
      ) : (
        <>
          <SkeletonCard style={styles.roundUp}>
            <TextBone variant="captionStrong" width="46%" />
            <TextBone variant="serif" width="94%" lines={3} lastWidth="58%" style={styles.roundText} />
          </SkeletonCard>
          <View style={styles.section}>
            <TextBone variant="section" width="26%" style={styles.sectionTitle} />
            <SkeletonCard style={styles.inSection}>
              {[0, 1, 2].map((i) => (
                <SkeletonRow key={i} index={i} divider={i < 2} shape={{ leading: 'avatar', leadingSize: 44, lines: ['caption'], align: 'top' }} />
              ))}
            </SkeletonCard>
          </View>
        </>
      )}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  flex: { flexShrink: 1 },
  summary: { marginTop: 10, marginHorizontal: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, marginHorizontal: space.gutter },
  tilesStacked: { flexDirection: 'column' },
  tile: { flexBasis: '40%', flexGrow: 1, minHeight: 92, borderRadius: radius.tile, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'space-between', gap: 8 },
  tileRow: { minHeight: 72, borderRadius: radius.tile, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  section: { marginTop: 32, marginHorizontal: space.gutter },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 44, marginBottom: 8 },
  sectionTitle: { marginHorizontal: 12, marginBottom: 12 },
  // The section already has the side margin.
  inSection: { marginHorizontal: 0 },
  roundUp: { marginTop: 32, paddingVertical: 18, paddingHorizontal: 18 },
  roundText: { marginTop: 10 },
});
