import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { assistantKeys, briefSections, fetchBrief, writeBrief } from '../../api/assistant';
import { errorMessage } from '../../api/client';
import {
  fetchOutlet,
  fetchOutletMedia,
  fetchOutletOrders,
  fetchOutletVisits,
  fetchRecommendations,
  outletKeys,
} from '../../api/outlets';
import { fetchTasks, taskKeys } from '../../api/tasks';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { LoadError } from '../../components/EmptyState';
import { BriefSkeleton, OutletSkeleton } from '../../components/LoadingSkeletons';
import { Icon, MoreDots, RingIcon, type IconName } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Sheet, SheetAction, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { formatDate, formatDayMonth, formatMoney, formatTime, parseDate, plural } from '../../lib/format';
import { callNumber, messageNumber } from '../../lib/contact';
import { haptic } from '../../lib/haptics';
import { openDirections } from '../../lib/location';
import { outletCompany, outletName } from '../../lib/outletCopy';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import type { ToneName } from '../../theme/tokens';
import { fonts } from '../../theme/type';

export function OutletScreen({ route, navigation }: RootScreenProps<'Outlet'>) {
  const { id } = route.params;
  const colors = useColors();
  const { user, abilities } = useAuth();
  const queryClient = useQueryClient();
  const more = useRef<SheetHandle>(null);

  const outlet = useQuery({ queryKey: outletKeys.detail(id), queryFn: () => fetchOutlet(id) });
  const visits = useQuery({ queryKey: outletKeys.visits(id), queryFn: () => fetchOutletVisits(id) });
  const orders = useQuery({ queryKey: outletKeys.orders(id), queryFn: () => fetchOutletOrders(id) });
  const tasks = useQuery({ queryKey: taskKeys.list({ status: 0, lead_id: id }), queryFn: () => fetchTasks({ status: 0, lead_id: id }) });
  const recs = useQuery({ queryKey: outletKeys.recommendations(id), queryFn: () => fetchRecommendations(id), staleTime: 10 * 60_000 });
  const media = useQuery({ queryKey: outletKeys.media(id), queryFn: () => fetchOutletMedia(id) });
  const brief = useQuery({ queryKey: assistantKeys.brief(id), queryFn: () => fetchBrief(id) });

  const write = useMutation({
    mutationFn: () => writeBrief(id),
    onSuccess: (b) => {
      haptic.success();
      queryClient.setQueryData(assistantKeys.brief(id), (prev: { available: boolean } | undefined) => ({ available: prev?.available ?? false, brief: b }));
    },
    onError: (e) => {
      haptic.error();
      Alert.alert('We could not write the brief', errorMessage(e));
    },
  });

  if (outlet.isPending) {
    return (
      <DetailScreen backLabel="Back">
        <OutletSkeleton name={route.params.name} />
      </DetailScreen>
    );
  }
  if (outlet.isError || !outlet.data) {
    return (
      <DetailScreen backLabel="Back">
        <View style={styles.pad}>
          <LoadError message={errorMessage(outlet.error)} onRetry={() => outlet.refetch()} />
        </View>
      </DetailScreen>
    );
  }

  const o = outlet.data;
  const name = outletName(o);
  const company = outletCompany(o);
  const isCustomer = !!o.customer_id;
  const mobileDigits = (o.mobile ?? '').replace(/[^\d+]/g, '');

  const visitList = visits.data ?? [];
  const lastVisit = visitList[0];
  const orderList = (orders.data ?? []).filter((x) => x.status !== 'cancelled');
  const lastOrder = orderList[0];
  const taskList = tasks.data?.tasks ?? [];
  const overdueTasks = taskList.filter((t) => t.risk === 'overdue').length;
  const rec = recs.data;
  const details = [o.business_category, o.size_band_label?.toLowerCase(), o.seats ? `${o.seats} seats` : null, o.segment_label?.toLowerCase()].filter(Boolean).join(' · ');
  const files = (media.data?.media.length ?? 0) + (media.data?.documents.length ?? 0);
  const stampedAt = parseDate(o.location?.captured_at ?? null);

  const call = () => callNumber(mobileDigits, 'Add a mobile number in Outlet details first.');
  const message = () => messageNumber(mobileDigits, undefined, 'Add a mobile number in Outlet details first.');

  return (
    <DetailScreen
      backLabel="Back"
      topRight={
        <IconButton onPress={() => more.current?.open()} accessibilityLabel={abilities.create_task ? 'More: edit outlet, add a task' : 'More: edit outlet'}>
          <MoreDots color={colors.body} />
        </IconButton>
      }
      onRefresh={() => Promise.all([outlet.refetch(), visits.refetch(), orders.refetch(), tasks.refetch(), brief.refetch()])}
      bottomBar={
        <>
          {abilities.record_order ? (
            <Button label="Record order" variant="secondary" style={styles.flex} onPress={() => navigation.navigate('RecordOrder', { outletId: id })} />
          ) : null}
          <Button label="Log a visit" style={styles.flexMore} onPress={() => navigation.navigate('LogVisit', { outletId: id })} />
        </>
      }
    >
      <View style={styles.header}>
        <Avatar name={name} size={64} shape="tile" />
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {name}
        </Text>
        {company ? (
          <Text variant="body" color="ink2" style={styles.company}>
            {company}
          </Text>
        ) : null}
        <View style={styles.chips}>
          <Tag
            size="xlarge"
            text={isCustomer ? 'Customer' : 'Prospect'}
            ink={colors.tones[isCustomer ? 'good' : 'form'].ink}
            bg={colors.tones[isCustomer ? 'good' : 'form'].tile}
            dot={colors.tones[isCustomer ? 'good' : 'form'].dot}
          />
          {o.city || o.state ? <Tag size="xlarge" text={[o.city, o.state].filter(Boolean).join(', ')} ink={colors.status.new.ink} bg={colors.status.new.bg} /> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <RoundAction icon="phone" label="Call" onPress={call} />
        <RoundAction icon="message" label="Message" onPress={message} />
        <RoundAction icon="directions" label="Directions" onPress={() => openDirections({ location: o.location, address: o.address, name })} />
        <RoundAction ring label="Ask Ronda" onPress={() => navigation.navigate('AskRonda', { id, name })} />
      </View>

      <Card padded style={styles.brief}>
        <View style={styles.briefHead}>
          <RingIcon size={20} color={colors.brand} dot={colors.coral} />
          <Text variant="rowTitle" accessibilityRole="header" style={[styles.flex, styles.briefTitle]}>
            Visit brief
          </Text>
          {brief.data?.brief ? (
            <Text variant="caption" color="ink2">
              {formatTime(brief.data.brief.generated_at)}
            </Text>
          ) : null}
        </View>
        {brief.isPending ? (
          <BriefSkeleton />
        ) : brief.data?.brief ? (
          <BriefPreview content={brief.data.brief.content} />
        ) : (
          <Text variant="subhead" color="ink2" style={styles.briefEmpty}>
            A short brief before you go in: who they are, what happened last time and what to raise today.
          </Text>
        )}
        {rec?.explanation.opening_line ? (
          <View style={[styles.opener, { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.ground }]}>
            <Text variant="label" color="ink2">
              You could open with
            </Text>
            <Text variant="serif" style={styles.openerText}>
              “{rec.explanation.opening_line}”
            </Text>
          </View>
        ) : null}
        <View style={styles.briefFoot}>
          <Text variant="footnote" color="muted" style={styles.flex}>
            {brief.data?.brief
              ? brief.data.brief.source === 'bedrock'
                ? 'Written by Claude (Amazon Bedrock) from this outlet’s visits, orders and tasks.'
                : 'Written from this outlet’s visits, orders and tasks. Claude is not set up yet.'
              : brief.data?.available
                ? 'Claude (Amazon Bedrock) writes it from this outlet’s visits, orders and tasks.'
                : 'Written from this outlet’s visits, orders and tasks.'}
          </Text>
          {brief.data?.brief ? (
            <PressableScale onPress={() => navigation.navigate('VisitBrief', { id, name })} accessibilityRole="link" style={styles.link}>
              <Text variant="captionStrong" color="link" style={styles.linkText}>
                Full brief
              </Text>
            </PressableScale>
          ) : (
            <Button label="Write it" size="medium" variant="brand" loading={write.isPending} onPress={() => write.mutate()} style={styles.writeButton} />
          )}
        </View>
      </Card>

      <Card style={styles.block}>
        <SectionRow
          icon="trend"
          tone="suggest"
          title="Suggested orders"
          sub={
            recs.isPending
              ? 'Checking similar outlets…'
              : rec && rec.items.length
                ? `${plural(rec.items.length, 'product')}, about ${formatMoney(rec.estimated_monthly_value, rec.currency)} a month`
                : 'None right now'
          }
          onPress={() => navigation.navigate('OutletSuggested', { id, name })}
        />
        <SectionRow
          icon="visits"
          tone="brand"
          title="Visits"
          sub={
            lastVisit
              ? `${visitList.length} · last on ${formatDayMonth(lastVisit.visited_at)}, by ${lastVisit.visited_by === user?.name ? 'you' : lastVisit.visited_by ?? 'someone'}`
              : 'No visits yet'
          }
          onPress={() => navigation.navigate('OutletVisits', { id, name })}
        />
        <SectionRow
          icon="receipt"
          tone="good"
          title="Orders"
          sub={lastOrder ? `${orderList.length} · last ${formatMoney(lastOrder.total_amount)} on ${formatDayMonth(lastOrder.order_date)}` : 'No orders yet'}
          onPress={() => navigation.navigate('OutletOrders', { id, name })}
        />
        <SectionRow
          icon="tasks"
          tone="form"
          title="Tasks"
          sub={taskList.length ? `${taskList.length} open` : 'No open tasks'}
          alert={overdueTasks ? `${overdueTasks} overdue` : undefined}
          onPress={() => navigation.navigate('OutletTasks', { id, name })}
          last
        />
      </Card>

      <Card style={styles.blockSmall}>
        <SectionRow icon="outlets" tone="neutral" title="Outlet details" sub={details || 'Type, size and contact'} onPress={() => navigation.navigate('OutletDetails', { id, name })} />
        <SectionRow
          icon="document"
          tone="neutral"
          title="Documents"
          sub={media.isPending ? ' ' : files ? plural(files, 'file') : 'No files'}
          onPress={() => navigation.navigate('OutletDocuments', { id, name })}
          last
        />
      </Card>

      <Card style={styles.blockSmall}>
        <MiniMap />
        <View style={styles.where}>
          <Text variant="rowTitle">{o.address || 'No address yet'}</Text>
          {o.postcode || o.city || o.state ? (
            <Text variant="subhead" color="ink2">
              {[o.postcode, o.city].filter(Boolean).join(' ')}
              {o.state ? `, ${o.state}` : ''}
            </Text>
          ) : null}
          <View style={styles.stamp}>
            <Icon name="pin" size={16} color={stampedAt ? colors.tones.good.ink : colors.muted} strokeWidth={2} />
            <Text variant="caption" color="ink2">
              {stampedAt ? `Location stamped ${formatDate(stampedAt)}` : 'No location stamp yet'}
            </Text>
          </View>
        </View>
      </Card>

      <Sheet ref={more} title={name} fit>
        <View style={styles.sheet}>
          {abilities.edit_lead ? (
            <SheetAction label="Edit outlet" hint="Name, contact, type and location" onPress={() => { more.current?.close(); navigation.navigate('OutletForm', { id }); }} />
          ) : null}
          {abilities.create_task ? (
            <SheetAction label="Add a task" hint="For someone to do at this outlet" onPress={() => { more.current?.close(); navigation.navigate('AddTask', { outletId: id, outletName: name }); }} />
          ) : null}
          <SheetAction label="Directions" hint="Open in your maps app" onPress={() => { more.current?.close(); openDirections({ location: o.location, address: o.address, name }); }} />
        </View>
      </Sheet>
    </DetailScreen>
  );
}

function RoundAction({ icon, ring, label, onPress }: { icon?: IconName; ring?: boolean; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} accessibilityLabel={label} style={styles.roundAction}>
      <View
        style={[
          styles.roundCircle,
          ring
            ? { backgroundColor: colors.brandTint }
            : { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, borderColor: colors.cardRing, borderWidth: 1 },
        ]}
      >
        {ring ? <RingIcon size={24} color={colors.brandInk} dot={colors.coral} /> : <Icon name={icon!} size={22} color={colors.link} />}
      </View>
      <Text variant="label" color={ring ? colors.link : colors.ink} align="center">
        {label}
      </Text>
    </PressableScale>
  );
}

function SectionRow({
  icon,
  tone,
  title,
  sub,
  alert,
  onPress,
  last,
}: {
  icon: IconName;
  tone: ToneName;
  title: string;
  sub: string;
  alert?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = useColors();
  const t = colors.tones[tone];
  return (
    <ListRow onPress={onPress} chevron divider={!last} dividerInset={74} accessibilityLabel={`${title}. ${sub}${alert ? `, ${alert}` : ''}`}>
      <View style={[styles.sectionIcon, { backgroundColor: tone === 'neutral' ? (colors.scheme === 'dark' ? colors.raised : colors.divider) : t.tile }]}>
        <Icon name={icon} size={22} color={tone === 'neutral' ? colors.ink2 : t.ink} />
      </View>
      <View style={styles.flex}>
        <Text variant="rowTitle">{title}</Text>
        <Text variant="subhead" color="ink2">
          {sub}
          {alert ? (
            <Text variant="subhead" color={colors.tones.critical.ink} style={styles.strong}>
              {` · ${alert}`}
            </Text>
          ) : null}
        </Text>
      </View>
    </ListRow>
  );
}

/** The "Raise today" points of the brief, or its first section. */
function BriefPreview({ content }: { content: string }) {
  const colors = useColors();
  const sections = briefSections(content);
  const raise = sections.find((s) => /raise/i.test(s.title)) ?? sections[0];
  const lines = (raise?.lines ?? []).slice(0, 3);
  return (
    <View style={styles.bullets}>
      {lines.map((line, i) => (
        <View key={i} style={styles.bullet}>
          <View style={[styles.bulletDot, { backgroundColor: i === 0 ? colors.tones.critical.dot : colors.brand }]} />
          <Text variant="body" style={[styles.flex, styles.bulletText]}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A quiet map tile; the real map opens with Directions. */
function MiniMap() {
  const colors = useColors();
  const dark = colors.scheme === 'dark';
  return (
    <View style={[styles.map, { backgroundColor: dark ? '#151C28' : '#EDF0F3' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={128} viewBox="0 0 358 128" preserveAspectRatio="xMidYMid slice">
        <Path d="M-10 44 L368 32" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={12} />
        <Path d="M170 -10 L182 138" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={9} />
        <Path d="M-10 104 L368 98" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={6} />
        <Rect x={198} y={54} width={40} height={28} rx={4} fill={dark ? '#1C2433' : '#E3E7EC'} />
        <Rect x={100} y={56} width={50} height={26} rx={4} fill={dark ? '#1C2433' : '#E3E7EC'} />
        <Path d="M280 0 C 300 20, 330 26, 358 24 L358 0 Z" fill={dark ? '#12261D' : '#D9EEDF'} />
        <Path d="M179 87s-15-12.6-15-25a15 15 0 0 1 30 0c0 12.4-15 25-15 25Z" fill={colors.brand} stroke={dark ? colors.ground : '#FFFFFF'} strokeWidth={2.5} />
        <Circle cx={179} cy={61} r={6.5} fill={dark ? colors.ground : '#FFFFFF'} />
        {dark ? null : <Circle cx={179} cy={61} r={3.2} fill={colors.coral} />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexMore: { flex: 1.3 },
  strong: { fontFamily: fonts.semibold },
  pad: { paddingTop: 16 },
  header: { paddingHorizontal: 20, paddingTop: 14 },
  title: { marginTop: 14 },
  company: { marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 24 },
  roundAction: { flex: 1, alignItems: 'center', gap: 8, minHeight: 48 },
  roundCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  brief: { marginTop: 28, marginHorizontal: space.gutter, borderRadius: radius.card },
  briefHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  briefTitle: { fontSize: 18, lineHeight: 24 },
  briefEmpty: { marginTop: 10 },
  bullets: { marginTop: 14, gap: 12 },
  bullet: { flexDirection: 'row', gap: 12 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  bulletText: { fontSize: 17, lineHeight: 24 },
  opener: { marginTop: 16, padding: 14, paddingHorizontal: 16, borderRadius: radius.inner, gap: 4 },
  openerText: { fontSize: 21, lineHeight: 27 },
  briefFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { fontSize: 15 },
  writeButton: { paddingHorizontal: 14 },
  block: { marginTop: 28, marginHorizontal: space.gutter, borderRadius: radius.card },
  blockSmall: { marginTop: 16, marginHorizontal: space.gutter, borderRadius: radius.card },
  sectionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  map: { height: 128, overflow: 'hidden' },
  where: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  sheet: { marginTop: 8 },
});
