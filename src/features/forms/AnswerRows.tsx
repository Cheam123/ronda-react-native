import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { LocalFile } from '../../api/client';
import { fetchPeople, formKeys } from '../../api/forms';
import type { MediaSet } from '../../api/tasks';
import { RemotePhotos } from '../../components/PhotoStrip';
import { Text } from '../../components/Text';
import { formatTime } from '../../lib/format';
import { displayValue, fileItems, isGps } from '../../lib/forms/schema';
import type { AnswerValue, FieldElement, Person } from '../../lib/forms/types';
import { useColors } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/type';

/** Everyone a Person field can name, cached for half an hour. */
export function usePeople(): { people: Person[]; names: Map<number, string> } {
  const query = useQuery({ queryKey: formKeys.people, queryFn: fetchPeople, staleTime: 30 * 60_000 });
  const people = query.data ?? [];
  return { people, names: new Map(people.map((p) => [p.id, p.name])) };
}

export interface AnswerItem {
  element: Pick<FieldElement, 'id' | 'type' | 'label'>;
  value: AnswerValue | undefined;
  /** New photos not sent yet. */
  local?: LocalFile[];
  /** Photos already stored. */
  stored?: MediaSet | null;
}

/** Short answers sit beside their question; long ones go under it. */
const INLINE_MAX = 22;

/** Questions and answers, read-only (Check and send, a record, an approval). */
export function AnswerRows({ items, names, first = true }: { items: AnswerItem[]; names: Map<number, string>; first?: boolean }) {
  const colors = useColors();
  return (
    <View>
      {items.map((item, i) => {
        const { element, value } = item;
        const photos = element.type === 'file';
        const stored = item.stored ? [...item.stored.media, ...item.stored.documents] : [];
        const local = item.local ?? [];
        const shown = photos ? null : element.type === 'gps' && isGps(value) ? `Stamped at ${formatTime(value.captured_at)}` : displayValue(element, value, names);
        const empty = shown === 'Not answered';
        const inline = !photos && shown !== null && shown.length <= INLINE_MAX && element.label.length <= 30;
        return (
          <View
            key={element.id}
            style={[styles.row, (i > 0 || !first) && { borderTopWidth: 1, borderTopColor: colors.divider }, inline && styles.inline]}
            accessible={!photos}
            accessibilityLabel={!photos ? `${element.label}: ${shown}` : undefined}
          >
            <Text variant="subhead" color="ink2" style={inline ? styles.flex : undefined}>
              {element.label}
            </Text>
            {photos ? (
              <View style={styles.photos}>
                {local.length ? (
                  <View style={styles.thumbs}>
                    {local.map((p, j) => (
                      <Image key={`${p.uri}-${j}`} source={{ uri: p.uri }} style={[styles.thumb, { backgroundColor: colors.line }]} contentFit="cover" accessibilityLabel={`Photo ${j + 1}`} />
                    ))}
                  </View>
                ) : stored.length ? (
                  <RemotePhotos files={stored} size={56} />
                ) : fileItems(value).length ? (
                  <Text variant="body" style={styles.value}>
                    {displayValue(element, value, names)}
                  </Text>
                ) : (
                  <Text variant="body" color="muted">
                    No photos
                  </Text>
                )}
              </View>
            ) : (
              <Text variant="body" color={empty ? 'muted' : 'ink'} style={[styles.value, inline && styles.inlineValue]}>
                {shown}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { paddingVertical: 10, gap: 2 },
  inline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  value: { fontFamily: fonts.medium },
  inlineValue: { textAlign: 'right', flexShrink: 1 },
  photos: { marginTop: 6 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
});
