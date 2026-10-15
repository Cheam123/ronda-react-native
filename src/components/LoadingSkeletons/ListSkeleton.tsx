import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../../theme/ThemeProvider';
import { radius as radii, space } from '../../theme/tokens';
import type { TypeVariant } from '../../theme/type';
import { Bone, CircleBone, Skeleton, TextBone } from './Skeleton';

/** Widths that vary row to row, so a list of bones reads like a list. */
const TITLE_WIDTHS = ['74%', '58%', '82%', '64%', '50%', '70%'] as const;
const LINE_WIDTHS = ['52%', '66%', '44%', '58%', '38%', '62%'] as const;

export interface RowShape {
  /** What leads the row: the done circle, a person, an outlet's tile, an icon tile. */
  leading?: 'check' | 'avatar' | 'tile' | 'icon' | 'none';
  leadingSize?: number;
  title?: TypeVariant;
  /** The lines under the title, by type variant. */
  lines?: TypeVariant[];
  /** A pill under the text, and the space above it. */
  tag?: 'small' | 'medium';
  tagGap?: number;
  /** A pill at the right end of the row. */
  trailingTag?: 'small' | 'medium';
  /** The row's own padding and gap, as in the real list. */
  rowStyle?: StyleProp<ViewStyle>;
  /** Text centred on the leading picture, or from its top. */
  align?: 'center' | 'top';
}

const TAG_HEIGHT = { small: 22, medium: 24 } as const;

/**
 * The app's rows, by name, so each list's skeleton matches its real rows:
 * the same leading picture, lines and padding (and so the same height).
 */
export const rowShapes = {
  /** A rep's open task: the done circle, title, place and due. */
  // 76 tall like the real row: the circle's 48 pt target sets the height here.
  task: { leading: 'check', lines: ['subhead'], rowStyle: { paddingVertical: 14, paddingLeft: 6, paddingRight: 14, gap: 8 } },
  /** A task with no circle (an outlet's tasks, paused ones). */
  taskPlain: { lines: ['subhead'], rowStyle: { paddingVertical: 16, paddingLeft: 12, paddingRight: 14 } },
  /** A task with its status pill under it (done tasks, search). */
  taskStatus: { lines: ['subhead'], tag: 'medium', rowStyle: { paddingVertical: 16, paddingLeft: 12, paddingRight: 14 } },
  /** The manager's task list: who, the task, its status. */
  managerTask: { leading: 'avatar', leadingSize: 36, align: 'top', title: 'bodyStrong', lines: ['caption'], trailingTag: 'small', rowStyle: { paddingVertical: 14, paddingHorizontal: 18, gap: 12, minHeight: 64 } },
  /** An outlet: its tile, name, kind and a pill. */
  outlet: { leading: 'tile', leadingSize: 44, lines: ['caption'], tag: 'small', tagGap: 6, rowStyle: { paddingVertical: 14, paddingHorizontal: 18 } },
  /** Review: who sent it, what and when. */
  review: { leading: 'avatar', leadingSize: 40, align: 'top', lines: ['caption'], rowStyle: { paddingVertical: 16, paddingHorizontal: 18 } },
  /** A focus alert: its icon tile, title and two lines. */
  alert: { leading: 'icon', leadingSize: 40, align: 'top', title: 'bodyStrong', lines: ['caption', 'caption'], rowStyle: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 } },
  /** A form record: title, form and date, its status pill. */
  record: { lines: ['subhead'], tag: 'medium' },
  /** A form to start: its name and a two-line description. */
  form: { lines: ['subhead', 'subhead'] },
  /** A visit or an order: the outlet, then when. */
  entry: { title: 'bodyStrong', lines: ['caption'] },
  /** A person in a list: their picture, name and a line. */
  person: { leading: 'avatar', leadingSize: 40, title: 'bodyStrong', lines: ['caption'], rowStyle: { paddingVertical: 14, paddingHorizontal: 16 } },
  /** A product to add to an order: name, then price. */
  product: { title: 'bodyStrong', lines: ['caption'], rowStyle: { paddingVertical: 14, paddingHorizontal: 18 } },
} satisfies Record<string, RowShape>;

/** One row's bones, laid out like the real row. */
export function SkeletonRow({ index = 0, shape, divider }: { index?: number; shape: RowShape; divider?: boolean }) {
  const colors = useColors();
  const { leading = 'none', leadingSize = 44, title = 'rowTitle', lines = ['subhead'], tag, tagGap = 8, trailingTag, rowStyle, align = 'center' } = shape;
  return (
    <View
      style={[
        styles.row,
        align === 'top' && styles.top,
        rowStyle,
        divider && { borderBottomWidth: 1, borderBottomColor: colors.divider },
      ]}
    >
      {leading === 'check' ? (
        <View style={styles.check}>
          <CircleBone size={26} />
        </View>
      ) : leading === 'avatar' ? (
        <CircleBone size={leadingSize} />
      ) : leading === 'tile' ? (
        <Bone width={leadingSize} height={leadingSize} radius={Math.round(leadingSize * 0.31)} />
      ) : leading === 'icon' ? (
        <Bone width={leadingSize} height={leadingSize} radius={13} />
      ) : null}
      <View style={styles.text}>
        <TextBone variant={title} width={TITLE_WIDTHS[index % TITLE_WIDTHS.length]} />
        {lines.map((v, i) => (
          <TextBone key={i} variant={v} width={LINE_WIDTHS[(index + i) % LINE_WIDTHS.length]} />
        ))}
        {tag ? <Bone width={84} height={TAG_HEIGHT[tag]} radius={radii.pill} style={{ marginTop: tagGap }} /> : null}
      </View>
      {trailingTag ? <Bone width={78} height={TAG_HEIGHT[trailingTag]} radius={radii.pill} /> : null}
    </View>
  );
}

/**
 * A list loading: an optional caption, then a card of rows shaped like the
 * real rows (see RowShape).
 */
export function ListSkeleton({
  label = 'Loading',
  rows = 4,
  shape = {},
  title = false,
  caption,
  captionStyle,
  bare = false,
  style,
}: {
  label?: string;
  rows?: number;
  shape?: RowShape;
  /** The screen's title and a line under it, for a screen that shows them only once loaded. */
  title?: boolean;
  /** The small heading above the card ("Overdue", "Open work first"), as a type variant. */
  caption?: TypeVariant;
  captionStyle?: StyleProp<ViewStyle>;
  /** Rows straight on the surface, with no card (a list in a sheet). */
  bare?: boolean;
  /** Where the card sits: the real list's margins. */
  style?: StyleProp<ViewStyle>;
}) {
  const list = Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} index={i} shape={shape} divider={i < rows - 1} />);
  return (
    <Skeleton label={label}>
      {title ? (
        <>
          <TextBone variant="title" width="56%" style={styles.title} />
          <TextBone variant="subhead" width="78%" style={styles.subtitle} />
        </>
      ) : null}
      {caption ? <TextBone variant={caption} width="34%" style={[styles.caption, captionStyle]} /> : null}
      {bare ? <View style={style}>{list}</View> : <SkeletonCard style={style}>{list}</SkeletonCard>}
    </Skeleton>
  );
}

/** A card frame, like Card: the bones go inside. */
export function SkeletonCard({ children, style, padded = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.cardRing }, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.gutter, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  padded: { padding: 20 },
  caption: { marginTop: 24, marginBottom: 10, marginHorizontal: 20 },
  title: { marginTop: 8, marginHorizontal: 20 },
  subtitle: { marginTop: 4, marginHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, minHeight: 48 },
  top: { alignItems: 'flex-start' },
  check: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
});
