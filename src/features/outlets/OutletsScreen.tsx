import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchOutlets, outletKeys, type OutletListParams, type OutletRow } from '../../api/outlets';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { CardSlice, ListRow } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { FilterSheet, type FilterOption } from '../../components/FilterSheet';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { TabScreen } from '../../components/Screen';
import { SearchBox } from '../../components/SearchBox';
import type { SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { haptic } from '../../lib/haptics';
import { kindLabel, outletName, outletTags, visitedLabel } from '../../lib/outletCopy';
import { failedToLoad } from '../../lib/query';
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

  // Another screen can open this tab on a chosen chip.
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
  };
  const list = useQuery({ queryKey: outletKeys.list(params), queryFn: () => fetchOutlets(params), placeholderData: (prev) => prev });
  const counts = list.data?.counts;
  const rows = list.data?.leads ?? [];
  // The last results stay up while new ones load (or while the search waits for typing to stop): say so.
  const finding = text.trim() !== search || (list.isFetching && list.isPlaceholderData);
  const shows: FilterOption<OutletsFilter>[] = [
    { key: 'all', label: 'All outlets', count: counts?.all },
    { key: 'customer', label: 'Customers', count: counts?.customer },
    { key: 'prospect', label: 'Prospects', count: counts?.prospect },
  ];
  const showing = shows.find((s) => s.key === filter) ?? shows[0];
  // The filter sits behind a button, so an empty list says when it is narrowed.
  const narrowed = filter !== 'all';

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
        <View style={styles.buttons}>
          <FilterSheet<OutletsFilter> title="Show outlets" options={shows} value={filter} onChange={setFilter} />
          {abilities.create_lead ? (
            <IconButton onPress={() => navigation.navigate('OutletForm', {})} accessibilityLabel="Add an outlet">
              <Icon name="plus" size={20} color={colors.body} strokeWidth={2.2} />
            </IconButton>
          ) : null}
        </View>
      }
      onRefresh={() => list.refetch()}
      list={{
        data: list.isPending || failedToLoad(list) ? [] : rows,
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

      {list.isPending ? (
        <ListSkeleton label="Loading outlets" rows={5} shape={rowShapes.outlet} caption="captionStrong" captionStyle={styles.caption} />
      ) : failedToLoad(list) ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(list.error)} onRetry={() => list.refetch()} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.block}>
          <EmptyState
            icon="outlets"
            title={
              search
                ? `No ${narrowed ? showing.label.toLowerCase() : 'outlets'} match “${search}”`
                : narrowed
                  ? `No ${showing.label.toLowerCase()} yet`
                  : 'No outlets yet'
            }
            body={
              narrowed
                ? 'Choose All outlets with the filter button beside the title to see the rest.'
                : search
                  ? 'Check the spelling, or search by mobile number.'
                  : 'Outlets you add or are given show up here.'
            }
          />
        </View>
      ) : (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(260)}>
          <Text variant="captionStrong" color="ink2" style={styles.caption} accessibilityLiveRegion="polite">
            {finding ? 'Finding outlets…' : `${showing.label} · open work first`}
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
        {/* The open work as a line of text, not pills: red only for overdue, bold for what is close. */}
        {tags.length ? (
          <Text variant="caption" color="ink2" style={styles.work}>
            {tags.map((t, i) => (
              <Fragment key={t.text}>
                {i > 0 ? ' · ' : null}
                <Text
                  variant={t.tone === 'neutral' ? 'caption' : 'captionStrong'}
                  color={t.tone === 'critical' ? colors.tones.critical.ink : t.tone === 'neutral' ? 'ink2' : 'body'}
                >
                  {t.text}
                </Text>
              </Fragment>
            ))}
          </Text>
        ) : null}
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  buttons: { flexDirection: 'row', gap: 10 },
  caption: { marginTop: 16, marginBottom: 8, marginHorizontal: 20 },
  block: { marginTop: 20 },
  row: { paddingVertical: 14, paddingHorizontal: 18 },
  work: { marginTop: 3 },
});
