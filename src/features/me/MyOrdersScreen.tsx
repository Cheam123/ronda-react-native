import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchMyOrders, meKeys } from '../../api/me';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatMoney } from '../../lib/format';
import { OrderCard } from '../outlets/OutletOrdersScreen';
import { space } from '../../theme/tokens';

/** Orders I recorded, newest first, at every outlet. */
export function MyOrdersScreen() {
  const orders = useQuery({ queryKey: meKeys.orders, queryFn: fetchMyOrders });
  const list = orders.data ?? [];
  const total = list.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <DetailScreen backLabel="Me" onRefresh={() => orders.refetch()}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Orders I recorded
      </Text>
      {list.length ? (
        <Text variant="subhead" color="ink2" style={styles.lead}>
          The last {list.length} · {formatMoney(total)}
        </Text>
      ) : null}
      {orders.isPending ? (
        <ListSkeleton label="Loading orders" shape={rowShapes.entry} style={styles.block} />
      ) : orders.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="receipt" title="No orders yet" body="Orders you record at an outlet show up here." />
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((o) => (
            <OrderCard key={o.id} order={o} mine subtitle={o.outlet ?? 'Outlet'} />
          ))}
        </View>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 20 },
  list: { marginTop: 20, marginHorizontal: space.gutter, gap: 12 },
});
