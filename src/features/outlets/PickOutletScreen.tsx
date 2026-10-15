import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchOutlets, outletKeys } from '../../api/outlets';
import { CardSlice } from '../../components/Card';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { OutletRowItem } from './OutletsScreen';

// Short enough for the header's one line (about 170 pt between Cancel and the edge).
const TITLES = { visit: 'Where was the visit?', order: 'Who is ordering?', task: 'Outlet for the task' } as const;

/** Choose an outlet, then carry on to the screen that asked. */
export function PickOutletScreen({ route, navigation }: RootScreenProps<'PickOutlet'>) {
  const { purpose } = route.params;
  const colors = useColors();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = search ? { search } : {};
  const list = useQuery({ queryKey: outletKeys.list(params), queryFn: () => fetchOutlets(params), placeholderData: (prev) => prev });
  const rows = list.data?.leads ?? [];

  const pick = (outletId: number, outletName: string) => {
    // Go back to the screen that asked, carrying the choice.
    if (purpose === 'visit') navigation.popTo('LogVisit', { outletId }, { merge: true });
    else if (purpose === 'order') navigation.popTo('RecordOrder', { outletId }, { merge: true });
    else navigation.popTo('AddTask', { outletId, outletName }, { merge: true });
  };

  return (
    <DetailScreen
      modalHeader={{ title: TITLES[purpose], onCancel: () => navigation.goBack() }}
      list={{
        data: list.isPending || list.isError ? [] : rows,
        keyExtractor: (o) => String(o.id),
        renderItem: (o, i) => (
          <CardSlice first={i === 0} last={i === rows.length - 1}>
            <OutletRowItem outlet={o} last={i === rows.length - 1} onPress={() => pick(o.id, o.business_name || o.name)} />
          </CardSlice>
        ),
      }}
    >
      <View style={styles.search}>
        <TextField
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder="Search name, shop or mobile"
          accessibilityLabel="Search outlets"
          leading={<Icon name="search" size={20} color={colors.muted} strokeWidth={2} />}
        />
      </View>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <LoadError message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="outlets" title={search ? `No outlets match "${search}"` : 'No outlets yet'} />
      ) : (
        <Text variant="captionStrong" color="ink2" style={styles.caption}>
          Open work first
        </Text>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: space.gutter, marginTop: 4 },
  caption: { marginTop: 16, marginBottom: 8, marginHorizontal: 20 },
});
