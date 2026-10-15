import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { GLIDE } from '../../motion/curves';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '../../api/client';
import { homeKey } from '../../api/home';
import {
  fetchOutlet,
  fetchOutletOrders,
  fetchProducts,
  fetchRecommendations,
  outletKeys,
  productKeys,
  recordOrder,
  type Product,
} from '../../api/outlets';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { ListSkeleton, Skeleton, TextBone, rowShapes } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { BottomBar, DetailScreen } from '../../components/Screen';
import { Sheet, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { formatDate, formatDayMonth, formatMoney, plural, quantityLabel } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { outletName } from '../../lib/outletCopy';
import type { RootScreenProps } from '../../navigation/types';
import { useConfirmLeave } from '../../navigation/useConfirmLeave';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';

interface Line {
  product: Product;
  qty: number;
  suggested: boolean;
  /** What similar outlets buy a month, for the "Use 8 kg" tip. */
  tip: number | null;
}

/** Record an order: repeat the last one, add the suggested products, or pick products. */
export function RecordOrderScreen({ route, navigation }: RootScreenProps<'RecordOrder'>) {
  const { outletId, productIds, fromVisit } = route.params ?? {};
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [remark, setRemark] = useState('');
  const [showToast, setShowToast] = useState(!!fromVisit);
  const picker = useRef<SheetHandle>(null);
  const seeded = useRef(false);

  const outlet = useQuery({ queryKey: outletKeys.detail(outletId ?? 0), queryFn: () => fetchOutlet(outletId!), enabled: !!outletId });
  const products = useQuery({ queryKey: productKeys.all, queryFn: fetchProducts, staleTime: 10 * 60_000 });
  const orders = useQuery({ queryKey: outletKeys.orders(outletId ?? 0), queryFn: () => fetchOutletOrders(outletId!), enabled: !!outletId });
  const recs = useQuery({ queryKey: outletKeys.recommendations(outletId ?? 0), queryFn: () => fetchRecommendations(outletId!), enabled: !!outletId, staleTime: 10 * 60_000 });

  const lastOrder = (orders.data ?? []).find((o) => o.status !== 'cancelled');
  const recByProduct = useMemo(() => new Map((recs.data?.items ?? []).map((i) => [i.product_id, i])), [recs.data]);
  const currency = products.data?.currency ?? 'RM';

  // Products picked on Suggested orders arrive pre-filled at the suggested quantity.
  useEffect(() => {
    if (seeded.current || !products.data || !productIds?.length || !recs.data) return;
    seeded.current = true;
    const byId = new Map(products.data.products.map((p) => [p.id, p]));
    setLines(
      productIds
        .map((pid) => {
          const p = byId.get(pid);
          const rec = recByProduct.get(pid);
          return p ? { product: p, qty: Math.max(1, Math.round(rec?.recommended_qty ?? 1)), suggested: !!rec, tip: rec?.recommended_qty ?? null } : null;
        })
        .filter((l): l is Line => !!l),
    );
  }, [products.data, productIds, recs.data, recByProduct]);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3500);
    return () => clearTimeout(t);
  }, [showToast]);

  const repeatLast = () => {
    if (!lastOrder || !products.data) return;
    haptic.selection();
    const byId = new Map(products.data.products.map((p) => [p.id, p]));
    setLines((current) => {
      const next = [...current];
      for (const l of lastOrder.lines) {
        const p = byId.get(l.product_id);
        if (!p) continue;
        const at = next.findIndex((x) => x.product.id === p.id);
        const rec = recByProduct.get(p.id);
        if (at >= 0) next[at] = { ...next[at], qty: l.quantity };
        else next.push({ product: p, qty: l.quantity, suggested: !!rec, tip: rec?.recommended_qty ?? null });
      }
      return next;
    });
  };

  const addProduct = (p: Product) => {
    haptic.selection();
    picker.current?.close();
    setLines((current) => {
      if (current.some((l) => l.product.id === p.id)) return current.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      const rec = recByProduct.get(p.id);
      return [...current, { product: p, qty: 1, suggested: !!rec, tip: rec?.recommended_qty ?? null }];
    });
  };

  const setQty = (pid: number, qty: number) => {
    haptic.selection();
    setLines((current) => current.map((l) => (l.product.id === pid ? { ...l, qty: Math.max(0, Math.round(qty * 100) / 100) } : l)));
  };

  const active = lines.filter((l) => l.qty > 0);
  const total = active.reduce((sum, l) => sum + l.qty * l.product.unit_price, 0);
  const allowLeave = useConfirmLeave(active.length > 0 || !!remark.trim(), { title: 'Discard this order?', keep: 'Keep editing' });

  const send = useMutation({
    mutationFn: () => recordOrder(outletId!, active.map((l) => ({ product_id: l.product.id, quantity: l.qty })), remark.trim() || null),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      queryClient.invalidateQueries({ queryKey: homeKey });
      allowLeave();
      navigation.replace('OrderSent', {
        outletId: outletId!,
        outletName: outlet.data ? outletName(outlet.data) : 'the outlet',
        orderNo: order.order_no,
        orderedAt: new Date().toISOString(),
        total: order.total_amount,
        lines: order.lines.length,
      });
    },
    onError: (e) => {
      haptic.error();
      Alert.alert('We could not send the order', errorMessage(e));
    },
  });

  const confirmSend = () => {
    if (!outletId) {
      navigation.navigate('PickOutlet', { purpose: 'order' });
      return;
    }
    if (!active.length) {
      haptic.error();
      Alert.alert('Add a product first', 'Choose at least one product and a quantity.');
      return;
    }
    send.mutate();
  };

  return (
    <View style={styles.fill}>
      <DetailScreen keyboard modalHeader={{ title: 'Record an order', onCancel: () => navigation.goBack() }} contentStyle={{ paddingBottom: 190 + insets.bottom }}>
        <Card style={styles.block}>
          <View style={styles.outletRow}>
            {outlet.data ? <Avatar name={outletName(outlet.data)} size={40} shape="tile" /> : <View style={[styles.emptyTile, { backgroundColor: colors.divider }]} />}
            <View style={styles.flex}>
              {!outlet.data && outletId ? (
                <Skeleton label="Loading the outlet">
                  <TextBone variant="bodyStrong" width={150} />
                </Skeleton>
              ) : (
                <Text variant="bodyStrong">{outlet.data ? outletName(outlet.data) : 'Choose an outlet'}</Text>
              )}
              <Text variant="footnote" color="ink2">
                Order date {formatDate(new Date())}
              </Text>
            </View>
            {!outletId ? (
              <PressableScale onPress={() => navigation.navigate('PickOutlet', { purpose: 'order' })} accessibilityRole="button" style={styles.small}>
                <Text variant="captionStrong" color="link" style={styles.linkText}>
                  Choose
                </Text>
              </PressableScale>
            ) : null}
          </View>
          {lastOrder ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <ListRow onPress={repeatLast} divider={false} accessibilityLabel={`Repeat last order, ${formatDayMonth(lastOrder.order_date)}, ${formatMoney(lastOrder.total_amount, currency)}`}>
                <Icon name="refresh" size={20} color={colors.link} />
                <Text variant="captionStrong" color="link" style={[styles.flex, styles.linkText]}>
                  Repeat last order
                </Text>
                <Text variant="caption" color="ink2">
                  {formatDayMonth(lastOrder.order_date)} · {formatMoney(lastOrder.total_amount, currency)}
                </Text>
              </ListRow>
            </>
          ) : null}
        </Card>

        <View style={styles.headRow}>
          <Text variant="label" color="ink2" accessibilityRole="header">
            Products
          </Text>
          <Text variant="label" color="ink2" style={styles.light}>
            {plural(active.length, 'line')}
          </Text>
        </View>
        <Card style={styles.linesCard}>
          <View>
            {lines.map((l) => (
              <OrderLineRow key={l.product.id} line={l} currency={currency} onQty={(q) => setQty(l.product.id, q)} />
            ))}
            <ListRow onPress={() => picker.current?.open()} divider={false} accessibilityLabel="Add a product">
              <Icon name="plus" size={20} color={colors.link} strokeWidth={2.4} />
              <Text variant="captionStrong" color="link" style={styles.linkText}>
                Add a product
              </Text>
            </ListRow>
          </View>
        </Card>

        <View style={styles.remark}>
          <TextField label="Remark" optional value={remark} onChangeText={setRemark} multiline placeholder="Delivery notes for the office" />
        </View>
      </DetailScreen>

      <BottomBar>
        <View style={styles.flex}>
          <View style={styles.totalRow}>
            <Text variant="subhead" color="ink2">
              {plural(active.length, 'product')}
            </Text>
            <Text variant="title2" style={styles.total}>
              {formatMoney(total, currency)}
            </Text>
          </View>
          <Button label="Send order" loading={send.isPending} onPress={confirmSend} />
        </View>
      </BottomBar>

      {showToast ? (
        <Animated.View entering={SlideInUp.springify(GLIDE.duration).dampingRatio(GLIDE.dampingRatio)} exiting={FadeOutUp} style={[styles.toast, { top: insets.top + 8, backgroundColor: colors.toast.bg }]} accessibilityRole="alert">
          <View style={[styles.toastTick, { backgroundColor: '#17B26A' }]}>
            <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text variant="bodyStrong" color={colors.toast.fg} style={styles.toastText}>
            Visit submitted. Good work!
          </Text>
        </Animated.View>
      ) : null}

      <ProductPicker ref={picker} products={products.data?.products ?? []} loading={products.isPending} suggestedIds={new Set(recByProduct.keys())} onPick={addProduct} currency={currency} />
    </View>
  );
}

function OrderLineRow({ line, currency, onQty }: { line: Line; currency: string; onQty: (q: number) => void }) {
  const colors = useColors();
  const p = line.product;
  const unitLabel = p.unit;
  return (
    <View style={[styles.line, { borderBottomColor: colors.divider }]}>
      <View style={styles.lineTop}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{p.name}</Text>
          <Text variant="footnote" color="ink2">
            {formatMoney(p.unit_price, currency)} a {p.unit}
          </Text>
          {line.suggested ? (
            <View style={styles.tagGap}>
              <Tag size="small" text="Suggested" ink={colors.tones.suggest.ink} bg={colors.tones.suggest.tile} />
            </View>
          ) : null}
        </View>
        <View style={styles.qtyCol}>
          <View style={[styles.stepper, { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.divider }]}>
            <PressableScale onPress={() => onQty(line.qty - 1)} accessibilityLabel={line.qty <= 1 ? `Remove ${p.name}` : `One less ${p.name}`} style={styles.step} hitSlop={4}>
              <Icon name={line.qty <= 1 ? 'trash' : 'minus'} size={18} color={colors.ink} strokeWidth={2.4} />
            </PressableScale>
            <Text variant="captionStrong" align="center" style={styles.qty}>
              {quantityLabel(line.qty, unitLabel)}
            </Text>
            <PressableScale onPress={() => onQty(line.qty + 1)} accessibilityLabel={`One more ${p.name}`} style={styles.step} hitSlop={4}>
              <Icon name="plus" size={18} color={colors.ink} strokeWidth={2.4} />
            </PressableScale>
          </View>
          <Text variant="caption" style={styles.lineTotal}>
            {formatMoney(line.qty * p.unit_price, currency)}
          </Text>
        </View>
      </View>
      {line.tip && line.qty < line.tip ? (
        <View style={[styles.tip, { backgroundColor: colors.brandTint }]}>
          <Text variant="footnote" color={colors.brandInk} style={styles.flex}>
            Similar outlets buy {line.tip} {p.unit} a month.
          </Text>
          <PressableScale onPress={() => onQty(line.tip!)} accessibilityRole="button" style={[styles.tipButton, { backgroundColor: colors.panel }]}>
            <Text variant="label" color={colors.brandInk}>
              Use {line.tip} {p.unit}
            </Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}


const ProductPicker = forwardRef<SheetHandle, { products: Product[]; loading: boolean; suggestedIds: Set<number>; onPick: (p: Product) => void; currency: string }>(
  function ProductPicker({ products, loading, suggestedIds, onPick, currency }, ref) {
    const colors = useColors();
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    const shown = products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .sort((a, b) => Number(suggestedIds.has(b.id)) - Number(suggestedIds.has(a.id)));
    return (
      <Sheet ref={ref} title="Add a product" snapPoints={['70%', '92%']} onDismiss={() => setQuery('')}>
        <View style={styles.pickerSearch}>
          <TextField
            inSheet
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or SKU"
            accessibilityLabel="Search products"
            leading={<Icon name="search" size={20} color={colors.muted} strokeWidth={2} />}
          />
        </View>
        {loading ? <ListSkeleton label="Loading products" rows={4} shape={rowShapes.product} bare /> : null}
        {shown.map((p) => (
          <ListRow key={p.id} onPress={() => onPick(p)} accessibilityLabel={`${p.name}, ${formatMoney(p.unit_price, currency)} a ${p.unit}`} style={styles.pickRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{p.name}</Text>
              <Text variant="footnote" color="ink2">
                <Text variant="mono" color="ink2" style={styles.sku}>
                  {p.sku}
                </Text>
                {` · ${formatMoney(p.unit_price, currency)} a ${p.unit}`}
              </Text>
            </View>
            {suggestedIds.has(p.id) ? <Tag size="small" text="Suggested" ink={colors.tones.suggest.ink} bg={colors.tones.suggest.tile} /> : null}
          </ListRow>
        ))}
        {!loading && shown.length === 0 ? (
          <Text variant="subhead" color="ink2" style={styles.noMatch}>
            No products match “{query}”.
          </Text>
        ) : null}
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  block: { marginTop: 8, marginHorizontal: space.gutter, borderRadius: radius.card },
  outletRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  emptyTile: { width: 40, height: 40, borderRadius: 12 },
  small: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  divider: { height: 1, marginLeft: 16 },
  linkText: { fontSize: 15 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  light: { fontFamily: fonts.regular },
  line: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  lineTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tagGap: { marginTop: 6 },
  qtyCol: { alignItems: 'flex-end', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderRadius: 12 },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Wide enough for "12 bottles" or "24 litre", so the steppers in the list line up.
  qty: { minWidth: 74, fontSize: 15 },
  lineTotal: { fontFamily: fonts.semibold },
  tip: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, borderRadius: 12 },
  tipButton: { minHeight: 36, paddingHorizontal: 12, borderRadius: 9, justifyContent: 'center' },
  linesCard: { marginHorizontal: space.gutter, borderRadius: radius.card },
  remark: { marginTop: 22, marginHorizontal: space.gutter },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  total: { fontSize: 24, lineHeight: 28 },
  toast: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    minHeight: 52,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    shadowColor: '#101828',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  toastTick: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toastText: { fontSize: 15 },
  pickerSearch: { marginTop: 12, marginBottom: 6 },
  pickRow: { paddingHorizontal: 0 },
  sku: { fontSize: 12 },
  noMatch: { marginTop: 12 },
});
