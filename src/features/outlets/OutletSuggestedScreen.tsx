import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { LAND, riseIn } from '../../motion/curves';
import { fetchPitches, type Pitch } from '../../api/assistant';
import { errorMessage } from '../../api/client';
import { fetchRecommendations, outletKeys, type RecommendationItem } from '../../api/outlets';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { EmptyState, LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatMoney } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';

export function OutletSuggestedScreen({ route, navigation }: RootScreenProps<'OutletSuggested'>) {
  const { id, name } = route.params;
  const colors = useColors();
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [openPitch, setOpenPitch] = useState<string | null>(null);

  const recs = useQuery({ queryKey: outletKeys.recommendations(id), queryFn: () => fetchRecommendations(id), staleTime: 10 * 60_000 });
  const pitches = useMutation({ mutationFn: () => fetchPitches(id) });

  const toggle = (item: RecommendationItem) => {
    haptic.selection();
    setAdded((s) => {
      const next = new Set(s);
      if (next.has(item.product_id)) next.delete(item.product_id);
      else next.add(item.product_id);
      return next;
    });
  };

  const showPitch = (sku: string) => {
    setOpenPitch((cur) => (cur === sku ? null : sku));
    if (!pitches.data && !pitches.isPending) pitches.mutate();
  };

  const data = recs.data;
  const count = added.size;
  const cta = count === 0 ? 'Start an order' : count === 1 ? 'Start an order with 1 product' : `Start an order with ${count} products`;

  return (
    <DetailScreen
      backLabel={name ?? 'Outlet'}
      onRefresh={() => recs.refetch()}
      bottomBar={<Button label={cta} style={styles.flex} onPress={() => navigation.navigate('RecordOrder', { outletId: id, productIds: [...added] })} />}
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Suggested orders
      </Text>

      {recs.isPending ? (
        <Loading label="Checking similar outlets" />
      ) : recs.isError || !data ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(recs.error)} onRetry={() => recs.refetch()} />
        </View>
      ) : data.items.length === 0 ? (
        <View style={styles.block}>
          <EmptyState
            icon="trend"
            title="No suggestions yet"
            body="We need more information to give you suggestions. Order history and outlet details from similar outlets help us learn."
          />
        </View>
      ) : (
        <>
          <View style={styles.value}>
            <Text variant="subhead" color="ink2">
              Could add about
            </Text>
            <Text variant="largeTitle" style={styles.amount}>
              {formatMoney(data.estimated_monthly_value, data.currency)}{' '}
              <Text variant="bodyStrong" color="ink2" style={styles.perMonth}>
                a month
              </Text>
            </Text>
          </View>

          {data.explanation.why ? (
            <View style={[styles.why, { backgroundColor: colors.brandTint }]}>
              <Text variant="subhead" color={colors.brandInk} style={styles.strong}>
                Why these?
              </Text>
              <Text variant="subhead" color={colors.brandInk} style={styles.whyText}>
                {data.explanation.why}
              </Text>
              <Text variant="footnote" color={colors.brandInk} style={styles.attribution}>
                {data.explanation.source === 'bedrock'
                  ? `Written by Claude (Amazon Bedrock) from the orders of ${data.similar_outlets} similar outlets.`
                  : `From the orders of ${data.similar_outlets} similar outlets.`}
              </Text>
            </View>
          ) : null}

          <View style={styles.cards}>
            {data.items.map((item) => (
              <SuggestionCard
                key={item.product_id}
                item={item}
                currency={data.currency}
                added={added.has(item.product_id)}
                onToggle={() => toggle(item)}
                pitchOpen={openPitch === item.sku}
                onPitch={() => showPitch(item.sku)}
                pitch={pitches.data?.pitches[item.sku]}
                pitchSource={pitches.data?.source ?? null}
                pitchLoading={pitches.isPending}
                pitchError={pitches.isError ? errorMessage(pitches.error) : null}
              />
            ))}
          </View>
        </>
      )}
    </DetailScreen>
  );
}

function SuggestionCard({
  item,
  currency,
  added,
  onToggle,
  pitchOpen,
  onPitch,
  pitch,
  pitchSource,
  pitchLoading,
  pitchError,
}: {
  item: RecommendationItem;
  currency: string;
  added: boolean;
  onToggle: () => void;
  pitchOpen: boolean;
  onPitch: () => void;
  pitch?: Pitch;
  pitchSource: 'bedrock' | 'template' | null;
  pitchLoading: boolean;
  pitchError: string | null;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const isNew = item.status === 'gap';
  const dots = Math.max(item.neighbors_used, 1);
  const qty = `${trimQty(item.recommended_qty)} ${unitWord(item.unit, item.recommended_qty)} a month`;
  return (
    <Card padded style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text variant="rowTitle" style={styles.cardTitle}>
            {item.name}
          </Text>
          <Text variant="caption" color="ink2">
            <Text variant="mono" color="ink2">
              {item.sku}
            </Text>
            {` · ${formatMoney(item.unit_price, currency)} a ${item.unit}`}
          </Text>
        </View>
        <Tag size="large" text={isNew ? 'New for them' : 'Top up'} ink={colors.tones.suggest.ink} bg={colors.tones.suggest.tile} />
      </View>

      <View style={styles.backing} accessible accessibilityLabel={`${item.buyers} of ${item.neighbors_used} similar outlets buy it`}>
        <View style={styles.dots}>
          {Array.from({ length: dots }).map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < item.buyers ? colors.brand : colors.control }]} />
          ))}
        </View>
        <Text variant="subhead" color="body" style={styles.flex}>
          {item.buyers} of {item.neighbors_used} similar outlets buy it
        </Text>
      </View>
      <Text variant="subhead" color="ink2" style={styles.suggestedQty}>
        Suggested:{' '}
        <Text variant="subhead" style={styles.strong}>
          {qty}
          {isNew ? '' : `, they buy ${trimQty(item.current_qty)} ${unitWord(item.unit, item.current_qty)}`}
        </Text>
      </Text>

      <PressableScale onPress={onPitch} accessibilityRole="button" accessibilityState={{ expanded: pitchOpen }} style={styles.pitchToggle}>
        <Text variant="captionStrong" color="link" style={styles.pitchLabel}>
          {pitchOpen ? 'Hide how to pitch' : 'How to pitch'}
        </Text>
      </PressableScale>
      {pitchOpen ? (
        <Animated.View
          entering={reduced ? undefined : riseIn()}
          style={[styles.pitch, { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.ground }]}
        >
          {pitchLoading ? (
            <Text variant="subhead" color="ink2">
              Writing tips…
            </Text>
          ) : pitchError ? (
            <Text variant="subhead" color="danger">
              {pitchError}
            </Text>
          ) : pitch ? (
            <>
              <PitchLine label="Pitch" text={pitch.pitch} />
              {pitch.objection ? <PitchLine label="If they say" text={`“${pitch.objection}”`} /> : null}
              {pitch.reply ? <PitchLine label="You can say" text={`“${pitch.reply}”`} /> : null}
              <Text variant="footnote" color="muted">
                {pitchSource === 'bedrock' ? 'Written by Claude (Amazon Bedrock) from the product and similar outlets’ orders.' : 'From the product details and similar outlets’ orders.'}
              </Text>
            </>
          ) : (
            <Text variant="subhead" color="ink2">
              No tips for this product yet.
            </Text>
          )}
        </Animated.View>
      ) : null}

      {added ? (
        <Animated.View entering={reduced ? undefined : ZoomIn.springify(LAND.duration).dampingRatio(LAND.dampingRatio)}>
          <PressableScale
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel={`${item.name} added. Tap to remove`}
            style={[styles.addButton, { backgroundColor: colors.brandTint }]}
          >
            <Icon name="check" size={18} color={colors.brandInk} strokeWidth={2.8} />
            <Text variant="captionStrong" color={colors.brandInk} style={styles.addText}>
              Added
            </Text>
          </PressableScale>
        </Animated.View>
      ) : (
        <PressableScale
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to the order`}
          style={[styles.addButton, { borderColor: colors.control, borderWidth: 1, backgroundColor: colors.panel }]}
        >
          <Icon name="plus" size={18} color={colors.ink} strokeWidth={2.4} />
          <Text variant="captionStrong" style={styles.addText}>
            Add to order
          </Text>
        </PressableScale>
      )}
    </Card>
  );
}

function PitchLine({ label, text }: { label: string; text: string }) {
  return (
    <View>
      <Text variant="label" color="ink2">
        {label}
      </Text>
      <Text variant="subhead" color="body" style={styles.pitchText}>
        {text}
      </Text>
    </View>
  );
}

const trimQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const unitWord = (unit: string, n: number) => (n === 1 || ['kg', 'litre', 'l', 'g', 'ml'].includes(unit.toLowerCase()) ? unit : `${unit}s`);

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fonts.semibold },
  title: { marginHorizontal: 20, marginTop: 8 },
  block: { marginTop: 20 },
  value: { marginTop: 16, marginHorizontal: 20 },
  amount: { marginTop: 2, letterSpacing: -0.8 },
  perMonth: { fontFamily: fonts.medium, fontSize: 17, letterSpacing: 0 },
  why: { marginTop: 18, marginHorizontal: space.gutter, paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.card },
  whyText: { marginTop: 4, lineHeight: 22 },
  attribution: { marginTop: 8, opacity: 0.85 },
  cards: { marginTop: 20, marginHorizontal: space.gutter, gap: 12 },
  card: { borderRadius: radius.card },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  backing: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  suggestedQty: { marginTop: 8 },
  pitchToggle: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 2 },
  pitchLabel: { fontSize: 15 },
  pitch: { padding: 14, paddingHorizontal: 16, borderRadius: radius.inner, gap: 12 },
  pitchText: { lineHeight: 22 },
  addButton: { marginTop: 14, minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { fontSize: 15 },
});
