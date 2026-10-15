import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchOutletOrders, outletKeys, type Order } from '../../api/outlets';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { ListSkeleton, rowShapes } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDate, formatMoney, plural } from '../../lib/format';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

/** Orders the outlet placed, newest first. Tap one to see its products. */
export function OutletOrdersScreen({ route, navigation }: RootScreenProps<'OutletOrders'>) {
  const { id, name } = route.params;
  const { abilities, user } = useAuth();
  const orders = useQuery({ queryKey: outletKeys.orders(id), queryFn: () => fetchOutletOrders(id) });
  const list = orders.data ?? [];
  const confirmed = list.filter((o) => o.status !== 'cancelled');
  const total = confirmed.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <DetailScreen
      backLabel={name ?? 'Outlet'}
      onRefresh={() => orders.refetch()}
      bottomBar={
        abilities.record_order ? (
          <Button label="Record an order" style={styles.flex} onPress={() => navigation.navigate('RecordOrder', { outletId: id })} />
        ) : undefined
      }
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Orders
      </Text>
      {confirmed.length ? (
        <Text variant="body" color="ink2" style={styles.lead}>
          {plural(confirmed.length, 'order')}, {formatMoney(total)} in all
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
          <EmptyState icon="receipt" title="No orders yet" body="Orders you record for this outlet show up here." />
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((o) => (
            <OrderCard key={o.id} order={o} mine={o.created_by === user?.name} />
          ))}
        </View>
      )}
    </DetailScreen>
  );
}

/** One order, opening to its lines. The subtitle defaults to who recorded it (My orders shows the outlet). */
export function OrderCard({ order, mine, subtitle }: { order: Order; mine: boolean; subtitle?: string | null }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const cancelled = order.status === 'cancelled';
  return (
    <Card style={styles.card}>
      <PressableScale
        onPress={() => setOpen((v) => !v)}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Order ${order.order_no ?? ''}, ${formatDate(order.order_date)}, ${formatMoney(order.total_amount)}${cancelled ? ', cancelled' : ''}`}
        style={styles.cardBody}
      >
        <View style={styles.cardTop}>
          <Text variant="mono" color="body">
            {order.order_no ?? `#${order.id}`}
          </Text>
          <Text variant="caption" color="ink2">
            {formatDate(order.order_date)}
          </Text>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{plural(order.lines.length, 'product')}</Text>
            <Text variant="caption" color="ink2">
              {subtitle ?? (mine ? 'You' : order.created_by ?? 'Someone')}
            </Text>
          </View>
          {cancelled ? <Tag text="Cancelled" ink={colors.status.rejected.ink} bg={colors.status.rejected.bg} /> : null}
          <Text variant="section" style={[styles.amount, cancelled && styles.struck]}>
            {formatMoney(order.total_amount)}
          </Text>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} color={colors.chevron} strokeWidth={2.2} />
        </View>
      </PressableScale>
      {open ? (
        <View style={[styles.lines, { borderTopColor: colors.divider }]}>
          {order.lines.map((l) => (
            <View key={l.product_id} style={styles.line}>
              <View style={styles.flex}>
                <Text variant="subhead">{l.product_name ?? l.sku}</Text>
                <Text variant="footnote" color="ink2">
                  {l.quantity} {l.unit} × {formatMoney(l.unit_price)}
                </Text>
              </View>
              <Text variant="subhead" style={styles.lineTotal}>
                {formatMoney(l.line_total)}
              </Text>
            </View>
          ))}
          {order.remark ? (
            <Text variant="caption" color="ink2" style={styles.remark}>
              Remark: {order.remark}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 20 },
  list: { marginTop: 20, marginHorizontal: space.gutter, gap: 12 },
  card: { borderRadius: radius.card },

  cardBody: { paddingVertical: 16, paddingHorizontal: 18 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  amount: { fontSize: 20, lineHeight: 26 },
  struck: { textDecorationLine: 'line-through' },
  lines: { borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineTotal: { fontFamily: 'InstrumentSans_600SemiBold' },
  remark: { marginTop: 4 },
});
