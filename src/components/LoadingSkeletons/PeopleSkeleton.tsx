import { StyleSheet, View } from 'react-native';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { CircleBone, Skeleton, TextBone } from './Skeleton';

/**
 * The row of people to choose from (Add a task's "Who does it") while the
 * team loads: three cards the width and height of the real ones, so the
 * row does not open up and push the form down when they arrive.
 */
export function PeopleSkeleton({ cardWidth, label = 'Loading the team' }: { cardWidth: number; label?: string }) {
  const colors = useColors();
  return (
    <Skeleton label={label} style={styles.row}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, { width: cardWidth, backgroundColor: colors.panel, borderColor: colors.cardRing }]}>
          <CircleBone size={52} />
          <TextBone variant="captionStrong" style={styles.name} />
          {/* Two short centred lines: "3 open", "1 overdue". */}
          <View style={styles.load}>
            <TextBone size={LOAD} style={styles.loadLine} />
            <TextBone size={LOAD} style={styles.loadLineShort} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

/** The load line under a name, as Add a task sets it. */
const LOAD = { fontSize: 12, lineHeight: 16 };

const styles = StyleSheet.create({
  // As the real row: the gutter at the sides, 10 between cards.
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingVertical: 2 },
  card: { borderRadius: radius.tile, borderWidth: 1, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6, alignItems: 'center', gap: 8 },
  name: { width: '62%' },
  load: { marginTop: -4, alignSelf: 'stretch', alignItems: 'center' },
  loadLine: { width: '50%' },
  loadLineShort: { width: '40%' },
});
