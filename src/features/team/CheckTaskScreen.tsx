import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import { fetchTask, fetchTasks, taskKeys } from '../../api/tasks';
import { fetchTaskVisits } from '../../api/visits';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { LoadError } from '../../components/EmptyState';
import { TaskSkeleton } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { RemotePhotos } from '../../components/PhotoStrip';
import { ProgressSteps } from '../../components/ProgressSteps';
import { DetailScreen } from '../../components/Screen';
import { Sheet, type SheetHandle } from '../../components/Sheet';
import { NameAndDetails } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { firstName, formatDateTime, formatMoney, parseDate } from '../../lib/format';
import { parseStampText } from '../../lib/location';
import { doneNote, dueMoment, formatDue, statusColors } from '../../lib/taskCopy';
import { riseIn, settleIn } from '../../motion/curves';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps } from '../../navigation/types';
import { useBackLabel } from '../../navigation/usePreviousTitle';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { useUndo } from '../../undo/UndoProvider';
import { useTaskActions } from '../tasks/useTaskActions';

type Decision = 'verified' | 'back' | null;

/** Check done work: what the rep did, then Verify or Send back with a reason. */
export function CheckTaskScreen({ route, navigation }: RootScreenProps<'CheckTask'>) {
  const { id } = route.params;
  const colors = useColors();
  const reduced = useReducedMotion();
  const { setBottomOffset } = useUndo();
  const actions = useTaskActions();
  const [decision, setDecision] = useState<Decision>(null);
  // Undo works only while the decision is waiting to be sent (5 s); then the button goes.
  const [canUndo, setCanUndo] = useState(false);
  const backLabel = useBackLabel();
  const [reason, setReason] = useState('');
  const sheet = useRef<SheetHandle>(null);

  const task = useQuery({ queryKey: taskKeys.detail(id), queryFn: () => fetchTask(id) });
  // Opening it is calm: the pill animates only once the status has
  // changed here (verified, sent back, undone).
  const [firstStatus, setFirstStatus] = useState<number | null>(null);
  const [statusChanged, setStatusChanged] = useState(false);
  const visits = useQuery({ queryKey: ['visits', 'task', id], queryFn: () => fetchTaskVisits(id) });
  const toCheck = useQuery({ queryKey: taskKeys.list({ focus: 'to_check' }), queryFn: () => fetchTasks({ focus: 'to_check' }) });

  useEffect(() => {
    setBottomOffset(108);
  }, [setBottomOffset]);

  if (task.isPending) {
    return (
      <DetailScreen backLabel="Tasks">
        <TaskSkeleton variant="check" title={route.params.title} />
      </DetailScreen>
    );
  }
  if (task.isError || !task.data) {
    return (
      <DetailScreen backLabel="Tasks">
        <LoadError message={errorMessage(task.error)} onRetry={() => task.refetch()} />
      </DetailScreen>
    );
  }

  const t = task.data;
  const doer = t.done_by ?? t.subscriber ?? null;
  const who = firstName(doer) || 'They';
  const outlet = t.outlet_name ?? t.lead ?? null;
  const canCheck = Number(t.status) === 3 && (t.can_verify_task || t.can_fallback_task);
  const shownStatus = decision === 'verified' ? 4 : decision === 'back' ? 2 : Number(t.status);
  if (firstStatus === null) setFirstStatus(shownStatus);
  else if (!statusChanged && shownStatus !== firstStatus) setStatusChanged(true);
  const chip = statusColors(colors, shownStatus);
  const chipLabel = shownStatus === 3 ? (canCheck ? 'Done · waiting for you' : `Done · waiting for ${firstName(t.checker) || 'the checker'}`) : shownStatus === 4 ? 'Verified' : shownStatus === 2 ? 'In progress' : null;

  // On time or late, by the due time.
  const due = dueMoment({ status: t.status, risk: t.risk, dueAt: t.due_at, dueDate: t.task_due_date, dueTime: t.task_due_time });
  const doneAt = parseDate(t.done_date);
  const timing = due && doneAt ? (doneAt.getTime() <= due.getTime() ? 'on time' : 'late') : null;
  const stamped = (visits.data ?? []).find((v) => parseStampText(v.location));
  const next = (toCheck.data?.tasks ?? []).find((x) => x.id !== t.id);

  const verify = () => {
    setDecision('verified');
    setCanUndo(true);
    actions.verify(t.id, doer, { quiet: true, onUndo: () => (setDecision(null), setCanUndo(false)), onDone: () => setCanUndo(false) });
  };
  const sendBack = () => {
    if (!reason.trim()) return;
    sheet.current?.close();
    setDecision('back');
    const why = reason;
    setCanUndo(true);
    actions.sendBack(t.id, why, doer, { quiet: true, onUndo: () => (setDecision(null), setCanUndo(false)), onDone: () => (setReason(''), setCanUndo(false)) });
  };
  const key = decision === 'verified' ? `task-verify-${t.id}` : `task-back-${t.id}`;

  const bottomBar = decision ? (
    <>
      {canUndo ? <Button label="Undo" variant="secondary" style={styles.flex} onPress={() => actions.undo(key)} /> : null}
      <Button
        label={next ? 'Next to check' : backLabel}
        style={styles.wide}
        onPress={() => (next ? navigation.replace('CheckTask', { id: next.id, title: next.title }) : navigation.goBack())}
      />
    </>
  ) : canCheck ? (
    <>
      {t.can_fallback_task ? <Button label="Send back" variant="danger" style={styles.flex} onPress={() => sheet.current?.open()} accessibilityHint="Asks you what still needs doing" /> : null}
      {t.can_verify_task ? <Button label="Verify" style={styles.wide} onPress={verify} /> : null}
    </>
  ) : Number(t.status) === 3 ? (
    // Done, but someone else checks it: say who, instead of offering buttons that would fail.
    <View style={styles.otherChecker} accessibilityLiveRegion="polite">
      <Text variant="subhead" color="ink2" align="center">
        {t.checker ? `${t.checker} checks this one.` : 'Its checker verifies it.'}
      </Text>
    </View>
  ) : null;

  return (
    <DetailScreen
      backLabel="Tasks"
      topRight={
        t.reference ? (
          <Text variant="mono" color="ink2" style={styles.reference} selectable>
            {t.reference}
          </Text>
        ) : null
      }
      bottomBar={bottomBar}
      onRefresh={() => task.refetch()}
    >
      <View style={styles.header}>
        {chipLabel ? (
          <Animated.View key={shownStatus} entering={reduced || !statusChanged ? undefined : settleIn()} style={styles.chip}>
            <Tag size="large" text={chipLabel} ink={chip.ink} bg={chip.bg} dot={chip.dot} />
          </Animated.View>
        ) : null}
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {t.title}
        </Text>
        <View style={styles.doer}>
          <Avatar name={doer ?? '?'} size={32} />
          <View style={styles.flex}>
            <NameAndDetails name={doer ?? 'Someone'} details={[outlet, t.done_date ? doneNote(t.done_date) : null].filter(Boolean).join(' · ')} />
          </View>
        </View>
      </View>

      {decision ? (
        <Animated.View
          entering={reduced ? undefined : riseIn()}
          accessibilityLiveRegion="polite"
          style={[styles.banner, { backgroundColor: decision === 'verified' ? colors.tones.form.tile : colors.tones.brand.tile }]}
        >
          {decision === 'verified' ? (
            <View style={[styles.tick, { backgroundColor: colors.tones.form.ink }]}>
              <Icon name="check" size={16} color={colors.scheme === 'dark' ? colors.ground : '#FFFFFF'} strokeWidth={3} />
            </View>
          ) : null}
          <Text variant="subhead" color={decision === 'verified' ? colors.tones.form.ink : colors.tones.brand.ink} style={[styles.flex, styles.strong]}>
            {decision === 'verified' ? `Verified. ${who} sees it in Done.` : `Sent back to ${who} with your reason. It is in progress again.`}
          </Text>
        </Animated.View>
      ) : null}

      <Card padded style={styles.block}>
        <Text variant="bodyStrong" color="ink2" accessibilityRole="header" style={styles.didTitle}>
          What {who} did
        </Text>
        <Text variant="body" color={t.done_remark ? 'ink' : 'muted'} style={styles.did}>
          {t.done_remark || `${who} did not add a note.`}
        </Text>
        {t.done_photos?.media.length ? (
          <View style={styles.photos}>
            <RemotePhotos files={t.done_photos.media} size={112} />
          </View>
        ) : null}
      </Card>

      <View style={styles.block}>
        <ProgressSteps index={({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 } as Record<number, number>)[shownStatus] ?? 1} />
      </View>

      <Card style={styles.block}>
        <Detail label="Due" value={formatDue({ status: t.status, risk: t.risk, dueAt: t.due_at, dueDate: t.task_due_date, dueTime: t.task_due_time })} />
        {t.done_date ? <Detail label="Done" value={`${formatDateTime(t.done_date)}${timing ? ` · ${timing}` : ''}`} tone={timing === 'late' ? colors.tones.serious.ink : undefined} /> : null}
        {t.sales ? <Detail label="Sales" value={formatMoney(t.sales)} /> : null}
        {t.invoice_no ? <Detail label="Invoice no." value={t.invoice_no} /> : null}
        <Detail label="Visit report" value={stamped ? 'Stamped at the outlet' : visits.data?.length ? 'Not stamped' : 'None'} last />
      </Card>

      {visits.data?.length ? (
        <Card style={styles.block}>
          {visits.data.map((v, i) => (
            <ListRow key={v.id} onPress={() => navigation.navigate('VisitReport', { id: v.id })} chevron divider={i < visits.data!.length - 1}>
              <Text variant="body" style={styles.flex}>
                Visit report
              </Text>
              <Text variant="subhead" color="ink2">
                {parseStampText(v.location) ? 'Stamped' : 'Open'}
              </Text>
            </ListRow>
          ))}
        </Card>
      ) : null}

      <Card style={styles.block}>
        <ListRow onPress={() => navigation.navigate('TaskMessages', { id: t.id, title: t.title })} chevron divider={false}>
          <Text variant="body" style={styles.flex}>
            Message {who}
          </Text>
        </ListRow>
      </Card>

      <Sheet
        ref={sheet}
        title={`Send it back to ${who}?`}
        subtitle="It goes back to In progress with your reason."
        fit
        footer={
          <>
            <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => sheet.current?.close()} />
            <Button label="Send back" variant="destructive" style={styles.flex} disabled={!reason.trim()} onPress={sendBack} />
          </>
        }
      >
        <View style={styles.sheetField}>
          <TextField inSheet label="What still needs doing" multiline value={reason} onChangeText={setReason} placeholder="For example: please add a photo of the old cartridge" />
        </View>
      </Sheet>
    </DetailScreen>
  );
}

function Detail({ label, value, tone, last }: { label: string; value: string; tone?: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.detail, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="subhead" color="ink2">
        {label}
      </Text>
      <Text variant="subhead" color={tone ?? colors.ink} style={[styles.detailValue, styles.strong]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  wide: { flex: 1.3 },
  strong: { fontFamily: fonts.semibold },
  reference: { paddingRight: 8 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  chip: { alignSelf: 'flex-start' },
  title: { marginTop: 12 },
  doer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginHorizontal: space.gutter, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.tile },
  tick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  block: { marginTop: 16, marginHorizontal: space.gutter },
  // The CheckTask board: a quiet 15 pt heading, then the rep's words at 17 pt.
  didTitle: { fontSize: 15, lineHeight: 20 },
  did: { marginTop: 8, fontSize: 17, lineHeight: 25 },
  photos: { marginTop: 14 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 14, paddingHorizontal: 18 },
  detailValue: { flexShrink: 1, textAlign: 'right' },
  sheetField: { marginTop: 16 },
  otherChecker: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
