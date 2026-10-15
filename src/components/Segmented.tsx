import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { GLIDE } from '../motion/curves';
import { Moving } from '../motion/Moving';
import { haptic } from '../lib/haptics';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { PillWords } from './Chips';
import { PressableScale } from './Pressable';
import { Text } from './Text';

interface SegmentedProps<K extends string> {
  segments: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
  /** 'large' for list switches (40 tall), 'small' for inline choices (34). */
  size?: 'large' | 'small';
}

/** Two or three views of one list (rule 3). The thumb springs to the choice. */
export function Segmented<K extends string>({ segments, value, onChange, accessibilityLabel, size = 'large' }: SegmentedProps<K>) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const segWidth = width > 0 ? (width - 6) / segments.length : 0;

  // Position in a shared value, moved only when the choice or the width
  // changes, so an unrelated re-render cannot lose or misplace the thumb.
  const target = index * segWidth;
  const x = useSharedValue(target);
  const placed = useRef(false);
  useEffect(() => {
    if (segWidth <= 0) return;
    if (!placed.current || reduced) {
      placed.current = true;
      x.value = target;
      return;
    }
    x.value = withSpring(target, GLIDE);
  }, [target, segWidth, reduced, x]);

  // The boards' sizes: segments 40 tall in a list switch, 34 inline, in a
  // track 3 pt bigger all round. The row you can touch is 48 tall (Android's
  // minimum); the track is drawn inside it and the spare is taken back with
  // negative margins, so the layout around it stays the board's.
  const segHeight = size === 'large' ? 40 : 34;
  const trackHeight = segHeight + 6;
  const slop = Math.max(0, (48 - trackHeight) / 2);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { marginVertical: -slop }]}
    >
      <View
        pointerEvents="none"
        style={[styles.track, { top: slop, bottom: slop, backgroundColor: colors.segmented.track, borderRadius: size === 'large' ? 14 : 12 }]}
      />
      {width > 0 ? (
        <Moving
          value={x}
          kind="translateX"
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              top: slop + 3,
              bottom: slop + 3,
              backgroundColor: colors.segmented.thumb,
              width: segWidth,
              borderRadius: size === 'large' ? 11 : 10,
              shadowOpacity: colors.scheme === 'dark' ? 0.4 : 0.12,
            },
          ]}
        />
      ) : null}
      {segments.map((s) => {
        const on = s.key === value;
        return (
          <PressableScale
            key={s.key}
            scaleTo={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
            onPress={() => {
              if (!on) {
                haptic.selection();
                onChange(s.key);
              }
            }}
            style={[styles.segment, { minHeight: trackHeight + slop * 2 }]}
          >
            <PillWords
              text={s.label}
              fontSize={size === 'large' ? 15 : 14}
              style={styles.words}
              renderWord={(word, a11y) => (
                <Text {...a11y} variant="captionStrong" style={{ fontSize: size === 'large' ? 15 : 14 }}>
                  {word}
                </Text>
              )}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 3 },
  track: { position: 'absolute', left: 0, right: 0 },
  thumb: {
    position: 'absolute',
    left: 3,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  words: { justifyContent: 'center' },
});
