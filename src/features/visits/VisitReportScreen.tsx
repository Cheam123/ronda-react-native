import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { errorMessage } from '../../api/client';
import { fetchOutlet, outletKeys } from '../../api/outlets';
import { fetchVisitReport, needsSupport, splitWhatHappened, visitKeys } from '../../api/visits';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { LoadError } from '../../components/EmptyState';
import { RecordSkeleton } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { RemotePhotos } from '../../components/PhotoStrip';
import { DetailScreen } from '../../components/Screen';
import { NameAndDetails } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { firstName, formatDate, formatDateTime } from '../../lib/format';
import { messageNumber } from '../../lib/contact';
import { distanceMeters, formatDistance, NEAR_OUTLET_METRES, parseStampText } from '../../lib/location';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';

/** One visit report. A manager can make it a task or message the rep. */
export function VisitReportScreen({ route, navigation }: RootScreenProps<'VisitReport'>) {
  const { id, ids } = route.params;
  const colors = useColors();
  const { user, abilities } = useAuth();
  const report = useQuery({ queryKey: visitKeys.detail(id), queryFn: () => fetchVisitReport(id) });
  const leadId = report.data?.lead_id ?? null;
  const outlet = useQuery({ queryKey: outletKeys.detail(leadId ?? 0), queryFn: () => fetchOutlet(leadId!), enabled: !!leadId });

  const position = ids && ids.length > 1 ? `${ids.indexOf(id) + 1} of ${ids.length}` : null;

  if (report.isPending) {
    return (
      <DetailScreen backLabel="Back">
        <RecordSkeleton variant="visit" label="Loading the visit report" />
      </DetailScreen>
    );
  }
  if (report.isError || !report.data) {
    return (
      <DetailScreen backLabel="Back">
        <View style={styles.pad}>
          <LoadError message={errorMessage(report.error)} onRetry={() => report.refetch()} />
        </View>
      </DetailScreen>
    );
  }

  const r = report.data;
  const { what, problem } = splitWhatHappened(r.problem_description);
  const stamp = parseStampText(r.location);
  const outletStamp = outlet.data?.location ?? null;
  const distance = stamp && outletStamp ? distanceMeters(stamp, outletStamp) : null;
  const far = distance != null && distance > NEAR_OUTLET_METRES;
  const support = needsSupport(r.support_required);
  const isProspect = /new/i.test(r.customer_status ?? '');
  const mine = r.created_by_id === user?.id;
  const canAct = abilities.manage_ife_report && !mine;
  const repFirst = firstName(r.created_by);

  const details = [
    { label: 'What happened', value: what },
    { label: 'Problem', value: problem },
    { label: 'Support needed', value: support ? r.support_description || 'Yes' : null },
    { label: 'Advice or opportunity', value: r.personal_remarks },
    { label: 'Person met', value: r.pic_name },
  ].filter((d) => d.value);

  const message = () => messageNumber(r.created_by_mobile, undefined, `${r.created_by ?? 'This rep'} has no mobile number saved.`);

  return (
    <DetailScreen
      backLabel="Back"
      topRight={
        position ? (
          <Text variant="caption" color="ink2" style={styles.position}>
            {position}
          </Text>
        ) : null
      }
      onRefresh={() => report.refetch()}
      bottomBar={
        canAct ? (
          <>
            {r.created_by_mobile ? <Button label={`Message ${repFirst}`} variant="secondary" style={styles.side} onPress={message} /> : null}
            {r.task_id ? (
              <Button label="Open the task" style={styles.flex} onPress={() => navigation.navigate('Task', { id: r.task_id! })} />
            ) : (
              <Button
                label="Make it a task"
                style={styles.flex}
                onPress={() => navigation.navigate('AddTask', { outletId: r.lead_id ?? undefined, outletName: r.outlet ?? undefined, reportId: r.id, assigneeId: r.created_by_id })}
              />
            )}
          </>
        ) : r.task_id ? (
          <Button label="Open the task" style={styles.flex} onPress={() => navigation.navigate('Task', { id: r.task_id! })} />
        ) : undefined
      }
    >
      <View style={styles.header}>
        <Text variant="captionStrong" color="ink2">
          Visit report
        </Text>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {r.outlet ?? 'Outlet'}
        </Text>
        <View style={styles.author}>
          <Avatar name={r.created_by ?? '?'} size={32} />
          <View style={styles.flex}>
            <NameAndDetails name={(mine ? 'You' : r.created_by) ?? 'Someone'} details={formatDateTime(r.created_at)} />
          </View>
        </View>
        <View style={styles.chips}>
          {r.customer_status ? (
            <Tag
              size="large"
              text={isProspect ? 'Prospect' : 'Customer'}
              ink={colors.tones[isProspect ? 'serious' : 'good'].ink}
              bg={colors.tones[isProspect ? 'serious' : 'good'].tile}
              dot={colors.tones[isProspect ? 'serious' : 'good'].dot}
            />
          ) : null}
          {support ? <Tag size="large" text="Needs support" ink={colors.tones.serious.ink} bg={colors.tones.serious.tile} /> : null}
          {r.task_id ? <Tag size="large" text="Made into a task" ink={colors.status.progress.ink} bg={colors.status.progress.bg} /> : null}
        </View>
      </View>

      <Card style={styles.block}>
        <StampMap stamped={!!stamp} />
        <View style={styles.stampRow}>
          {stamp && far ? (
            <View style={[styles.stampTick, { backgroundColor: colors.tones.serious.tile }]}>
              <Icon name="alert" size={15} color={colors.tones.serious.ink} strokeWidth={2.4} />
            </View>
          ) : stamp ? (
            <View style={[styles.stampTick, { backgroundColor: colors.tones.good.ink }]}>
              <Icon name="check" size={13} color={colors.scheme === 'dark' ? colors.ground : '#FFFFFF'} strokeWidth={3} />
            </View>
          ) : (
            <Icon name="pin" size={18} color={colors.muted} />
          )}
          <Text variant="caption" color={far ? colors.tones.serious.ink : 'body'} style={styles.flex}>
            {stamp
              ? `Stamped${stamp.when ? ` ${stamp.when.replace(/^\d{1,2} \w{3} \d{4}, /, 'at ')}` : ''}${distance != null ? `, ${formatDistance(distance)} from the outlet` : ''}`
              : r.location
                ? `Not stamped · ${r.location}`
                : 'Not stamped'}
          </Text>
        </View>
      </Card>

      {details.length || r.next_followup_date ? (
        <Card style={[styles.blockSmall, styles.details]}>
          {details.map((d, i) => (
            <View key={d.label} style={[styles.detail, { borderBottomColor: colors.divider }, i === details.length - 1 && !r.next_followup_date && styles.noBorder]}>
              <Text variant="label" color="ink2">
                {d.label}
              </Text>
              <Text variant="body" style={styles.detailValue}>
                {d.value}
              </Text>
            </View>
          ))}
          {r.next_followup_date ? (
            <View style={[styles.detail, styles.next, styles.noBorder]}>
              <Text variant="subhead" color="ink2">
                Next visit
              </Text>
              <Text variant="subhead" style={[styles.strong, styles.nextValue]}>
                {formatDate(r.next_followup_date)}
                {r.next_followup_plan ? ` · ${r.next_followup_plan.charAt(0).toLowerCase()}${r.next_followup_plan.slice(1)}` : ''}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {r.attachments.media.length ? (
        <View style={styles.blockSmall}>
          <RemotePhotos files={r.attachments.media} size={104} />
        </View>
      ) : null}
    </DetailScreen>
  );
}

function StampMap({ stamped }: { stamped: boolean }) {
  const colors = useColors();
  const dark = colors.scheme === 'dark';
  return (
    <View style={[styles.map, { backgroundColor: dark ? '#151C28' : '#EDF0F3' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={104} viewBox="0 0 358 104" preserveAspectRatio="xMidYMid slice">
        <Path d="M-10 36 L368 26" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={11} />
        <Path d="M150 -10 L162 120" stroke={dark ? '#273142' : '#FFFFFF'} strokeWidth={8} />
        <Rect x={190} y={46} width={40} height={26} rx={4} fill={dark ? '#1C2433' : '#E3E7EC'} />
        {stamped ? (
          <>
            <Circle cx={179} cy={63} r={11} fill={colors.brand} opacity={0.16} />
            <Path d="M179 72s-13-10.9-13-21.7a13 13 0 0 1 26 0c0 10.8-13 21.7-13 21.7Z" fill={colors.brand} stroke={dark ? colors.ground : '#FFFFFF'} strokeWidth={2.2} />
            <Circle cx={179} cy={50} r={5.6} fill={dark ? colors.ground : '#FFFFFF'} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  side: { paddingHorizontal: 18 },
  strong: { fontFamily: fonts.semibold },
  pad: { paddingTop: 16 },
  position: { paddingRight: 8 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  title: { marginTop: 2, fontSize: 28, lineHeight: 34 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  block: { marginTop: 16, marginHorizontal: space.gutter, borderRadius: radius.card },
  blockSmall: { marginTop: 14, marginHorizontal: space.gutter },
  map: { height: 104, overflow: 'hidden' },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  stampTick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  details: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.card },
  detail: { paddingVertical: 12, borderBottomWidth: 1 },
  noBorder: { borderBottomWidth: 0 },
  detailValue: { marginTop: 4 },
  next: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  nextValue: { flexShrink: 1, textAlign: 'right' },
});
