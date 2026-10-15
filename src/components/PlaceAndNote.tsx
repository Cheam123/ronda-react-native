import { useState } from 'react';
import { StyleSheet, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import { capitalise, keepTogether } from '../lib/format';
import { fonts, type TypeVariant } from '../theme/type';
import { Text } from './Text';

/**
 * Whether a joined line fitted on one line when it was laid out. `id` is
 * the line's text: a new text gets measured afresh.
 */
function useFitsOneLine(id: string) {
  const [tooLongFor, setTooLongFor] = useState<string | null>(null);
  return {
    fits: tooLongFor !== id,
    onTextLayout: (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (e.nativeEvent.lines.length > 1) setTooLongFor(id);
    },
  };
}

/**
 * A row's second line: "Kopi Kita Bangsar · 12 days overdue". On one line
 * when it fits. When it does not, the place and the note take a line each
 * and the dot goes, so a dot never hangs at the end of a line (TodayLarge
 * lays it out the same way).
 */
export function PlaceAndNote({
  place,
  note,
  noteColor,
  noteStrong = true,
  variant = 'subhead',
  stack = false,
}: {
  place: string;
  note: string;
  noteColor: string;
  /** The note in semibold (an overdue or due note); off for a quiet one. */
  noteStrong?: boolean;
  variant?: TypeVariant;
  /** Always a line each (the largest text sizes). */
  stack?: boolean;
}) {
  const { fits, onTextLayout } = useFitsOneLine(`${place}|${note}`);
  const noteStyle = noteStrong ? styles.strong : undefined;

  if (stack || !fits) {
    return (
      <>
        <Text variant={variant} color="ink2">
          {place}
        </Text>
        <Text variant={variant} color={noteColor} style={noteStyle}>
          {capitalise(note)}
        </Text>
      </>
    );
  }
  return (
    <Text variant={variant} color="ink2" onTextLayout={onTextLayout}>
      {place} ·{' '}
      <Text variant={variant} color={noteColor} style={noteStyle}>
        {keepTogether(note)}
      </Text>
    </Text>
  );
}

/**
 * "Jason Lim · Spice Route Ampang · done 29 Sep" beside an avatar. On one
 * line when it fits; otherwise the name takes the first line and the rest
 * the second, so the line never breaks inside a date or after a dot.
 */
export function NameAndDetails({ name, details, variant = 'subhead' }: { name: string; details: string; variant?: TypeVariant }) {
  const { fits, onTextLayout } = useFitsOneLine(`${name}|${details}`);
  if (!details) {
    return (
      <Text variant={variant} style={styles.strong}>
        {name}
      </Text>
    );
  }
  if (!fits) {
    return (
      <>
        <Text variant={variant} style={styles.strong}>
          {name}
        </Text>
        <Text variant={variant} color="ink2">
          {details}
        </Text>
      </>
    );
  }
  return (
    <Text variant={variant} color="ink2" onTextLayout={onTextLayout}>
      <Text variant={variant} style={styles.strong}>
        {name}
      </Text>
      {` · ${details}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fonts.semibold },
});

/**
 * A row's meta line from parts: "Discount approval · Aiman Rahman · today".
 * On one line when it fits. When it does not, it breaks after part `splitAt`
 * (the parts before it on the first line), so a dot never ends a line.
 */
export function MetaLine({ parts, splitAt, variant = 'caption', longLast = false }: { parts: string[]; splitAt: number; variant?: TypeVariant; longLast?: boolean }) {
  const shown = parts.filter(Boolean);
  const { fits, onTextLayout } = useFitsOneLine(shown.join('|'));
  if (fits || shown.length <= splitAt) {
    return (
      <Text variant={variant} color="ink2" onTextLayout={onTextLayout} numberOfLines={longLast ? 2 : undefined}>
        {shown.join(' · ')}
      </Text>
    );
  }
  return (
    <>
      <Text variant={variant} color="ink2">
        {shown.slice(0, splitAt).join(' · ')}
      </Text>
      <Text variant={variant} color="ink2" numberOfLines={longLast ? 2 : undefined}>
        {shown.slice(splitAt).join(' · ')}
      </Text>
    </>
  );
}
