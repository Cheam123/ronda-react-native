import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchOutlets, outletKeys, type OutletListParams, type OutletRow } from '../../api/outlets';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { CardSlice, ListRow } from '../../components/Card';
import { ChipRow, Tag } from '../../components/Chips';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { TabScreen } from '../../components/Screen';
import { SearchBox } from '../../components/SearchBox';
import type { SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { haptic } from '../../lib/haptics';
import { kindLabel, outletName, outletTags, visitedLabel } from '../../lib/outletCopy';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { OutletsFilter, RepTabParamList, RootStackParamList } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { OutletPreview } from './OutletPreview';

/** The rep's outlets (a manager's: every outlet), open work first. */
export function OutletsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // The same screen sits in both the rep and the manager tab bars.
  const route = useRoute<RouteProp<RepTabParamList, 'Outlets'>>();
  const colors = useColors();
  const reduced = useReducedMotion();
  const { abilities } = useAuth();
  const [filter, setFilter] = useState<OutletsFilter>(route.params?.filter ?? 'all');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  // Today's suggestions card opens this tab on the Suggestions chip.
  const wanted = route.params?.filter;
  useFocusEffect(
    useCallback(() => {
      if (wanted) {
        setFilter(wanted);
        (navigation as unknown as { setParams: (p: object) => void }).setParams({ filter: undefined });
      }
    }, [wanted, navigation]),
  );

  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params: OutletListParams = {
    ...(search ? { search } : {}),
    ...(filter === 'customer' || filter === 'prospect' ? { kind: filter } : {}),
    ...(filter === 'sugg' ? { suggested: 1 as const } : {}),
  };
  const list = useQuery({ queryKey: outletKeys.list(params), queryFn: () => fetchOutlets(params), placeholderData: (prev) => prev });
  const counts = list.data?.counts;
  const rows = list.data?.leads ?? [];

  const open = (o: OutletRow) => navigation.navigate('Outlet', { id: o.id, name: outletName(o) });
  const [preview, setPreview] = useState<OutletRow | null>(null);
  const previewSheet = useRef<SheetHandle>(null);
  const lift = (o: OutletRow) => {
    haptic.light();
    setPreview(o);
    previewSheet.current?.open();
  };

  return (
    <TabScreen
      title="Outlets"
      titleAccessory={
        abilities.create_lead ? (
          <IconButton onPress={() => navigation.navigate('OutletForm', {})} accessibilityLabel="Add an outlet">
            <Icon name="plus" size={20} color={colors.body} strokeWidth={2.2} />
          </IconButton>
        ) : null
      }
      onRefresh={() => list.refetch()}
      list={{
        data: list.isPending || list.isError ? [] : rows,
        keyExtractor: (o) => String(o.id),
        renderItem: (o, i) => (
          <CardSlice first={i === 0} last={i === rows.length - 1}>
            <OutletRowItem outlet={o} last={i === rows.length - 1} onPress={() => open(o)} onLongPress={() => lift(o)} />
          </CardSlice>
        ),
      }}
      overlay={
        <OutletPreview
          ref={previewSheet}
          outlet={preview}
          onOpen={open}
          onVisit={(o) => navigation.navigate('LogVisit', { outletId: o.id })}
          onOrder={(o) => navigation.navigate('RecordOrder', { outletId: o.id })}
        />
      }
    >
      <SearchBox value={text} onChange={setText} placeholder="Search name, shop or mobile" accessibilityLabel="Search outlets" />

      <View style={styles.chips}>
        <ChipRow<OutletsFilter>
          accessibilityLabel="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: counts?.all },
            { key: 'customer', label: 'Customers', count: counts?.customer },
            { key: 'prospect', label: 'Prospects', count: counts?.prospect },
            { key: 'sugg', label: 'Suggestions', count: counts?.suggested },
          ]}
        />
      </View>

      {list.isPending ? (
        <Loading label="Loading outlets" />
      ) : list.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(list.error)} onRetry={() => list.refetch()} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.block}>
          <EmptyState
            icon="outlets"
            title={search ? `No outlets match "${search}"` : filter === 'sugg' ? 'No suggestions right now' : 'No outlets yet'}
            body={
              search
                ? 'Check the spelling, or search by mobile number.'
                : filter === 'sugg'
                  ? 'We need more information to give you suggestions. Order history and outlet details from similar outlets help us learn.'
                  : 'Outlets you add or are given show up here.'
            }
          />
        </View>
      ) : (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(260)}>
          <Text variant="captionStrong" color="ink2" style={styles.caption}>
            Open work first
          </Text>
        </Animated.View>
      )}
    </TabScreen>
  );
}

export function OutletRowItem({ outlet, last, onPress, onLongPress }: { outlet: OutletRow; last: boolean; onPress: () => void; onLongPress?: () => void }) {
  const colors = useColors();
  const name = outletName(outlet);
  const tags = outletTags(outlet);
  const sub = `${kindLabel(outlet.kind)} · ${visitedLabel(outlet.last_visit_at)}`;
  return (
    <ListRow
      onPress={onPress}
      onLongPress={onLongPress}
      divider={!last}
      chevron
      accessibilityLabel={`${name}. ${sub}. ${tags.map((t) => t.text).join(', ')}`}
      style={styles.row}
    >
      <Avatar name={name} size={44} shape="tile" />
      <View style={styles.flex}>
        <Text variant="rowTitle">{name}</Text>
        <Text variant="caption" color="ink2">
          {sub}
        </Text>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <Tag key={t.text} size="small" text={t.text} ink={colors.tones[t.tone].ink} bg={colors.tones[t.tone].tile} />
            ))}
          </View>
        ) : null}
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chips: { marginTop: 7 },
  caption: { marginTop: 13, marginBottom: 8, marginHorizontal: 20 },
  block: { marginTop: 20 },
  row: { paddingVertical: 14, paddingHorizontal: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
