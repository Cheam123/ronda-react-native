import { StyleSheet, View } from 'react-native';
import { Bone, Skeleton, TextBone } from './Skeleton';

/** Who sent each bubble, and how long it is: a short back-and-forth. */
const BUBBLES = [
  { mine: false, width: '68%', lines: 2 },
  { mine: true, width: '54%', lines: 1 },
  { mine: false, width: '46%', lines: 1 },
  { mine: true, width: '72%', lines: 2 },
] as const;

/** A task's messages loading: a day label, then bubbles on either side. */
export function MessagesSkeleton({ label = 'Loading messages' }: { label?: string }) {
  return (
    <Skeleton label={label} style={styles.list}>
      <TextBone variant="caption" width={88} style={styles.day} />
      {BUBBLES.map((b, i) => (
        <View key={i} style={[styles.wrap, b.mine ? styles.mine : styles.theirs, { width: b.width }]}>
          {b.mine ? null : <TextBone variant="caption" width={72} style={styles.name} />}
          <Bone height={b.lines === 2 ? 66 : 43} radius={20} />
          <TextBone variant="footnote" width={52} style={styles.name} />
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  day: { alignSelf: 'center', marginVertical: 8 },
  wrap: { gap: 4 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  name: { marginHorizontal: 4 },
});
