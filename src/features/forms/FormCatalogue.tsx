import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchForms, formKeys, type FormListItem, type GroupRef } from '../../api/forms';
import { Card, ListRow } from '../../components/Card';
import { EmptyState, Loading, LoadError } from '../../components/EmptyState';
import { Text } from '../../components/Text';
import { radius, space } from '../../theme/tokens';

/** The forms this person may start, searched on the server after a short pause. */
export function useFormCatalogue(text: string) {
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const query = useQuery({ queryKey: formKeys.list(search), queryFn: () => fetchForms(search), placeholderData: (prev) => prev });
  return { query, search };
}

/** Forms by the category an admin filed them under, in the admin's order; the rest last. */
export function FormCatalogue({
  forms,
  groups,
  loading,
  error,
  onRetry,
  search,
  onPick,
}: {
  forms: FormListItem[];
  groups: GroupRef[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  search: string;
  onPick: (form: FormListItem) => void;
}) {
  if (loading) return <Loading label="Loading forms" />;
  if (error) return <LoadError message={errorMessage(error)} onRetry={onRetry} />;
  if (forms.length === 0) {
    return (
      <EmptyState
        icon="forms"
        title={search ? `No forms match “${search}”` : 'No forms to start'}
        body={search ? 'Check the spelling, or search for a word in the form’s description.' : 'Forms your office sets up for you show up here.'}
      />
    );
  }

  const sections = [
    ...groups.map((g) => ({ key: `g-${g.id}`, title: g.name, forms: forms.filter((f) => f.group?.id === g.id) })),
    { key: 'other', title: groups.length ? 'Other forms' : null, forms: forms.filter((f) => !f.group || !groups.some((g) => g.id === f.group!.id)) },
  ].filter((s) => s.forms.length > 0);

  return (
    <View>
      {sections.map((s, i) => (
        <View key={s.key}>
          {s.title ? (
            <Text variant="captionStrong" color="ink2" accessibilityRole="header" style={[styles.heading, i === 0 && styles.firstHeading]}>
              {s.title}
            </Text>
          ) : null}
          <Card style={[styles.card, !s.title && styles.untitled]}>
            {s.forms.map((f, j) => (
              <ListRow key={f.id} onPress={() => onPick(f)} divider={j < s.forms.length - 1} chevron style={styles.row} accessibilityLabel={`${f.name}. ${f.description ?? ''}`}>
                <View style={styles.flex}>
                  <Text variant="rowTitle">{f.name}</Text>
                  {f.description ? (
                    <Text variant="subhead" color="ink2" numberOfLines={2}>
                      {f.description}
                    </Text>
                  ) : null}
                </View>
              </ListRow>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  heading: { marginTop: 20, marginBottom: 8, marginHorizontal: 20, fontSize: 15 },
  firstHeading: { marginTop: 16 },
  untitled: { marginTop: 16 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card },
  row: { paddingVertical: 16, paddingHorizontal: 18 },
});
