import { Fragment, useEffect, useRef, useState, type ReactElement } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type AccessibilityProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { haptic } from '../lib/haptics';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { fonts } from '../theme/type';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/**
 * Instrument Sans has a narrow word space (0.19 em), so in a small pill
 * "1 overdue" or "Customers 5" reads as one word. Pill words sit this far
 * apart instead, as a share of the text size.
 */
const WORD_GAP_EM = 0.3;

/** Chip text size (the boards' 15 pt). */
const LABEL_SIZE = 15;

/** Screen readers hear the pill as one phrase on its first word; the other words stay silent. */
type WordA11y = Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityElementsHidden' | 'importantForAccessibility'>;

/**
 * A pill's words side by side, WORD_GAP_EM apart. Each word is its own Text:
 * a widened space inside one Text is measured and laid out differently on
 * Android, which pushed the last word onto a hidden second line.
 */
export function PillWords({
  text,
  fontSize,
  renderWord,
  after,
  style,
}: {
  text: string;
  fontSize: number;
  renderWord: (word: string, a11y: WordA11y) => ReactElement;
  /** Set after the words, with the same gap (a chip's count). */
  after?: ReactElement | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const words = text.split(' ').filter(Boolean);
  const silent: WordA11y = { accessibilityElementsHidden: true, importantForAccessibility: 'no' };
  return (
    <View style={[styles.words, { columnGap: WORD_GAP_EM * fontSize * fontScale }, style]}>
      {words.map((word, i) => (
        <Fragment key={i}>{renderWord(word, i === 0 ? { accessibilityLabel: text } : silent)}</Fragment>
      ))}
      {after}
    </View>
  );
}

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  count?: number | string;
}

interface ChipRowProps<K extends string> {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Adds the "More filters" chip at the end (rule 4: one row plus a sheet). */
  onMoreFilters?: () => void;
  moreFiltersActive?: number;
  accessibilityLabel?: string;
}

/** One scrolling row of filter chips. */
export function ChipRow<K extends string>({ options, value, onChange, onMoreFilters, moreFiltersActive = 0, accessibilityLabel }: ChipRowProps<K>) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const scroller = useRef<ScrollView>(null);
  const chipBoxes = useRef(new Map<string, { x: number; width: number }>());
  const scrollX = useRef(0);
  const [viewWidth, setViewWidth] = useState(0);
  const [measured, setMeasured] = useState(0);

  // The chosen chip is always fully in view, with the gutter beside it: a chip
  // chosen at the edge, or chosen for you (a tile opens the list on it), scrolls in.
  useEffect(() => {
    const box = chipBoxes.current.get(value);
    if (!box || !viewWidth) return;
    const left = box.x - space.gutter;
    const right = box.x + box.width + space.gutter - viewWidth;
    const to = right > scrollX.current ? right : left < scrollX.current ? Math.max(0, left) : null;
    if (to !== null) scroller.current?.scrollTo({ x: to, animated: !reduced });
  }, [value, viewWidth, measured, reduced]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setViewWidth(e.nativeEvent.layout.width)}
      onScroll={(e) => {
        scrollX.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={32}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <PressableScale
            key={o.key}
            onLayout={(e) => {
              chipBoxes.current.set(o.key, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width });
              if (on) setMeasured((n) => n + 1);
            }}
            hitSlop={{ top: 5, bottom: 5 }}
            onPress={() => {
              if (!on) haptic.selection();
              onChange(o.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.count !== undefined ? `${o.label}, ${o.count}` : o.label}
            style={[
              styles.chip,
              // Every chip has the 1 pt ring (the chosen one in its own colour), so choosing one never changes its width.
              on ? { backgroundColor: colors.chipOn.bg, borderColor: colors.chipOn.bg } : { backgroundColor: colors.chipOff.bg, borderColor: colors.chipOff.ring },
            ]}
          >
            <PillWords
              text={o.label}
              fontSize={LABEL_SIZE}
              renderWord={(word, a11y) => (
                <Text {...a11y} variant="captionStrong" color={on ? colors.chipOn.fg : colors.chipOff.fg} style={styles.label}>
                  {word}
                </Text>
              )}
              after={
                o.count !== undefined ? (
                  <Text accessibilityElementsHidden importantForAccessibility="no" variant="captionStrong" color={on ? colors.chipOn.fg : colors.chipOff.count} style={[styles.label, !on && styles.countOff]}>
                    {String(o.count)}
                  </Text>
                ) : null
              }
            />
          </PressableScale>
        );
      })}
      {onMoreFilters ? (
        <PressableScale
          onPress={() => {
            haptic.selection();
            onMoreFilters();
          }}
          hitSlop={{ top: 5, bottom: 5 }}
          accessibilityLabel={moreFiltersActive ? `More filters, ${moreFiltersActive} on` : 'More filters'}
          style={[styles.chip, styles.more, { backgroundColor: colors.chipOff.bg, borderColor: moreFiltersActive ? colors.brand : colors.chipOff.ring }]}
        >
          <Icon name="sliders" size={18} color={colors.chipOff.fg} />
          <PillWords
            text={moreFiltersActive ? `More filters · ${moreFiltersActive}` : 'More filters'}
            fontSize={LABEL_SIZE}
            renderWord={(word, a11y) => (
              <Text {...a11y} variant="captionStrong" color={colors.chipOff.fg} style={styles.label}>
                {word}
              </Text>
            )}
          />
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

export type TagSize = 'small' | 'medium' | 'large' | 'xlarge';

/** Tag sizes from the boards: text, then the padding around it. */
const TAG_SIZES: Record<TagSize, { text: TextStyle; box: ViewStyle; fontSize: number }> = {
  // Busy list rows (Outlets, Record an order, the manager's tasks): 22 tall.
  small: { text: { fontSize: 12, lineHeight: 16 }, box: { paddingVertical: 3, paddingHorizontal: 9 }, fontSize: 12 },
  // Other list rows (Records, Review, done tasks): 24 tall.
  medium: { text: {}, box: { paddingVertical: 3, paddingHorizontal: 10 }, fontSize: 13 },
  // A screen's header (a task, a record, a visit report): 26 tall.
  large: { text: {}, box: { paddingVertical: 4, paddingHorizontal: 10 }, fontSize: 13 },
  // The outlet's own header: 28 tall.
  xlarge: { text: {}, box: { paddingVertical: 5, paddingHorizontal: 11 }, fontSize: 13 },
};

/** A small status label. Status is always in words; colour only helps. */
export function Tag({ text, ink, bg, dot, size = 'medium', style }: { text: string; ink: string; bg: string; dot?: string; size?: TagSize; style?: StyleProp<ViewStyle> }) {
  const s = TAG_SIZES[size];
  return (
    <View style={[styles.tag, s.box, { backgroundColor: bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <PillWords
        text={text}
        fontSize={s.fontSize}
        renderWord={(word, a11y) => (
          <Text {...a11y} variant="label" color={ink} style={s.text}>
            {word}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Vertical padding keeps the chips' hit slop inside the scroll view.
  row: { gap: 8, paddingHorizontal: space.gutter, paddingVertical: 5 },
  // 38 tall as drawn; the hit slop takes the target to 48. The 1 pt ring sits
  // inside the 14 pt side padding, as the boards draw it (an inset ring).
  chip: { minHeight: 38, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  more: { flexDirection: 'row', gap: 6 },
  label: { fontSize: LABEL_SIZE, lineHeight: 20 },
  // The boards set the count in medium on a chip that is not chosen.
  countOff: { fontFamily: fonts.medium },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999 },
  // A long label still wraps, a word at a time.
  words: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
