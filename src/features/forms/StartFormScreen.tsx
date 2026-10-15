import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DetailScreen } from '../../components/Screen';
import { SearchBox } from '../../components/SearchBox';
import type { RootScreenProps } from '../../navigation/types';
import { FormCatalogue, useFormCatalogue } from './FormCatalogue';

/** Start a form, from the Record menu: pick one, and it opens to fill in. */
export function StartFormScreen({ navigation }: RootScreenProps<'StartForm'>) {
  const [text, setText] = useState('');
  const { query, search } = useFormCatalogue(text);
  return (
    <DetailScreen keyboard modalHeader={{ title: 'Start a form', onCancel: () => navigation.goBack() }}>
      <SearchBox value={text} onChange={setText} placeholder="Search forms" accessibilityLabel="Search forms" style={styles.search} />
      <View>
        <FormCatalogue
          forms={query.data?.forms ?? []}
          groups={query.data?.form_groups ?? []}
          loading={query.isPending}
          error={query.error}
          onRetry={() => query.refetch()}
          search={search}
          onPick={(f) => navigation.replace('FillForm', { formId: f.id })}
        />
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 6 },
});
