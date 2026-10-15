import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { errorMessage, type LocalFile } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { fetchOutletVisits, outletKeys } from '../../api/outlets';
import { fetchTask, taskKeys } from '../../api/tasks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { LoadError } from '../../components/EmptyState';
import { TaskSkeleton } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { PhotoStrip, RemotePhotos } from '../../components/PhotoStrip';
import { PressableScale } from '../../components/Pressable';
import { ProgressSteps } from '../../components/ProgressSteps';
import { DetailScreen } from '../../components/Screen';
import { Sheet, SheetAction, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { riseIn, settleIn } from '../../motion/curves';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { firstName } from '../../lib/format';
import { formatDue, friendlyDateTime, riskChip, statusColors, statusLabel } from '../../lib/taskCopy';
import { clearTaskSales, takeTaskSales } from '../../lib/visitHandoff';
import type { RootScreenProps } from '../../navigation/types';
import { useBackLabel } from '../../navigation/usePreviousTitle';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { useUndo } from '../../undo/UndoProvider';
import { useTaskActions } from './useTaskActions';

/** Index on the New → Completed line. Kept in view and on hold sit at In progress. */
function stepIndex(status: number): number {
  return ({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 } as Record<number, number>)[status] ?? 1;
}

export function TaskScreen({ route, navigation }: RootScreenProps<'Task'>) {
  const { id } = route.params;
  const colors = useColors();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const { setBottomOffset } = useUndo();
  const actions = useTaskActions();
  const [justDone, setJustDone] = useState(false);
  const backLabel = useBackLabel();
  // Undo works only while the done is waiting to be sent (5 s); then the button goes.
  const [canUndo, setCanUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remark, setRemark] = useState('');
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const [sales, setSales] = useState('');
  const [invoice, setInvoice] = useState('');
  const doneSheet = useRef<SheetHandle>(null);
  const moreSheet = useRef<SheetHandle>(null);

  const task = useQuery({ queryKey: taskKeys.detail(id), queryFn: () => fetchTask(id) });
  // Opening a task is calm: the pill animates only once the status has
  // changed here (started, done, undone).
  const [firstStatus, setFirstStatus] = useState<number | null>(null);
  const [statusChanged, setStatusChanged] = useState(false);
  const leadId = task.data?.lead_id ?? null;
  const visits = useQuery({
    queryKey: outletKeys.visits(leadId ?? 0),
    queryFn: () => fetchOutletVisits(leadId!),
    enabled: !!leadId,
  });

  // The toast sits above this screen's bottom actions.
  useEffect(() => {
    setBottomOffset(108);
  }, [setBottomOffset]);

  if (task.isPending) {
    return (
      <DetailScreen backLabel="Tasks">
        <TaskSkeleton title={route.params.title} />
      </DetailScreen>
    );
  }
  if (task.isError || !task.data) {
    return (
      <DetailScreen backLabel="Tasks">
        <View style={styles.pad}>
          <LoadError message={errorMessage(task.error)} onRetry={() => task.refetch()} />
        </View>
      </DetailScreen>
    );
  }

  const t = task.data;
  const shownStatus = justDone ? 3 : Number(t.status);
  if (firstStatus === null) setFirstStatus(shownStatus);
  else if (!statusChanged && shownStatus !== firstStatus) setStatusChanged(true);
  const chip = statusColors(colors, shownStatus);
  const due = { status: t.status, risk: t.risk, dueAt: t.due_at, dueDate: t.task_due_date, dueTime: t.task_due_time };
  const risk = shownStatus <= 2 ? riskChip(due) : null;
  const checker = t.checker ?? 'Your manager';
  const outletName = t.outlet_name ?? t.lead ?? 'Outlet';
  const isNew = shownStatus === 1 && t.can_accept_task;
  const inProgress = shownStatus === 2 && t.can_done_task;
  const done = shownStatus === 3;
  // Back in progress after the checker sent it back: their reason leads.
  const sentBack = shownStatus === 2 && t.sent_back ? t.sent_back : null;
  const doneByYou = !!t.done_by && t.done_by === user?.name;
  const moreActions = [
    t.can_kiv_task && { key: 'kiv', label: 'Keep in view', hint: 'It moves out of your open tasks.' },
    t.can_hold_task && { key: 'hold', label: 'Put on hold', hint: 'Pause it until it can go on.' },
    { key: 'visit', label: 'Log a visit here', hint: `At ${outletName}` },
    { key: 'messages', label: `Message ${firstName(checker)}`, hint: 'Open the task messages' },
  ].filter(Boolean) as { key: string; label: string; hint: string }[];
  const details: { label: string; value: string; tone?: string; strong?: boolean; mono?: boolean }[] = [
    { label: 'Due', value: formatDue(due), tone: t.risk === 'overdue' && shownStatus <= 2 ? colors.tones.critical.ink : undefined, strong: true },
    { label: 'Checker', value: checker },
    // Not on your own task: the board leaves it out, it is you.
    ...(t.subscriber && t.subscriber !== user?.name ? [{ label: 'Who does it', value: t.subscriber }] : []),
    ...(t.reminder_at ? [{ label: 'Your reminder', value: friendlyDateTime(t.reminder_at) }] : []),
    ...(t.invoice_no ? [{ label: 'Invoice no.', value: t.invoice_no, mono: true }] : []),
  ];

  const start = async () => {
    setBusy(true);
    try {
      await actions.start(t.id);
    } catch (e) {
      Alert.alert('We could not start the task', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // A visit logged from this task may have left its sales and invoice number here.
  const openDone = () => {
    const handed = takeTaskSales(t.id);
    if (handed) {
      setSales(handed.sales ?? '');
      setInvoice(handed.invoiceNo ?? '');
    }
    doneSheet.current?.open();
  };

  const confirmDone = () => {
    doneSheet.current?.close();
    setJustDone(true);
    setCanUndo(true);
    actions.markDone(
      {
        id: t.id,
        status: t.status,
        checker: t.checker,
        remark: remark.trim() || null,
        photos,
        sales: sales.replace(/,/g, '').trim() || null,
        invoiceNo: invoice.trim() || null,
      },
      {
        quiet: true,
        onUndo: () => {
          setJustDone(false);
          setCanUndo(false);
        },
        onDone: () => {
          setCanUndo(false);
          setRemark('');
          setPhotos([]);
          setSales('');
          setInvoice('');
          clearTaskSales(t.id);
          task.refetch();
        },
      },
    );
  };

  const runMore = async (key: string) => {
    moreSheet.current?.close();
    try {
      if (key === 'kiv') await actions.keepInView(t.id);
      if (key === 'hold') await actions.hold(t.id);
      if (key === 'visit') navigation.navigate('LogVisit', { outletId: t.lead_id ?? undefined, taskId: t.id });
      if (key === 'messages') navigation.navigate('TaskMessages', { id: t.id, title: t.title });
      if (key === 'kiv' || key === 'hold') task.refetch();
    } catch (e) {
      Alert.alert('We could not change the task', errorMessage(e));
    }
  };

  const bottomBar = justDone ? (
    <>
      {canUndo ? <Button label="Undo" variant="secondary" style={styles.side} onPress={() => actions.undo(`task-done-${t.id}`)} /> : null}
      <Button label={backLabel} style={styles.flex} onPress={() => navigation.goBack()} />
    </>
  ) : isNew ? (
    <>
      <Button label="More" variant="secondary" style={styles.side} onPress={() => moreSheet.current?.open()} accessibilityLabel="More: keep in view, log a visit, message" />
      <Button label="Start task" style={styles.flex} onPress={start} loading={busy} />
    </>
  ) : inProgress ? (
    <>
      <Button label="More" variant="secondary" style={styles.side} onPress={() => moreSheet.current?.open()} accessibilityLabel="More: keep in view, log a visit, message" />
      <Button label="Mark as done" style={styles.flex} onPress={openDone} />
    </>
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
        <View style={styles.chips}>
          <Animated.View key={shownStatus} entering={reduced || !statusChanged ? undefined : settleIn()}>
            <Tag size="large" text={statusLabel(shownStatus)} ink={chip.ink} bg={chip.bg} dot={chip.dot} />
          </Animated.View>
          {risk ? <Tag size="large" text={risk} ink={colors.tones[t.risk === 'overdue' ? 'critical' : 'serious'].ink} bg={colors.tones[t.risk === 'overdue' ? 'critical' : 'serious'].tile} /> : null}
        </View>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {t.title}
        </Text>
        {t.remark ? (
          <Text variant="body" color="body" style={styles.remark}>
            {t.remark}
          </Text>
        ) : null}
      </View>

      {done ? (
        <Animated.View
          entering={reduced || !statusChanged ? undefined : riseIn()}
          accessibilityRole="alert"
          style={[styles.banner, { backgroundColor: colors.tones.suggest.tile }]}
        >
          <View style={[styles.bannerTick, { backgroundColor: colors.tones.suggest.ink }]}>
            <Icon name="check" size={16} color={colors.scheme === 'dark' ? colors.ground : '#FFFFFF'} strokeWidth={3} />
          </View>
          <Text variant="subhead" color={colors.tones.suggest.ink} style={[styles.flex, styles.strong]}>
            Marked as done. {checker} checks it next.
          </Text>
        </Animated.View>
      ) : null}

      {sentBack ? (
        <View accessible style={[styles.sentBack, { backgroundColor: colors.tones.serious.tile }]}>
          <Text variant="subhead" color={colors.tones.serious.ink} style={styles.strong}>
            Sent back{sentBack.by ? ` by ${sentBack.by}` : ''}
          </Text>
          <Text variant="subhead" color="body">
            {sentBack.remark ? `“${sentBack.remark}”` : 'Mark it as done again when it is finished.'}
          </Text>
        </View>
      ) : null}

      {t.lead_id ? (
        <PressableScale
          onPress={() => navigation.navigate('Outlet', { id: t.lead_id!, name: outletName })}
          scaleTo={0.98}
          accessibilityRole="link"
          accessibilityLabel={`${outletName}. Open the outlet`}
          style={[styles.outlet, { backgroundColor: colors.panel, borderColor: colors.cardRing }]}
        >
          <Avatar name={outletName} size={42} shape="tile" />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{outletName}</Text>
            <Text variant="caption" color="ink2">
              {t.appointment_date_time ? `Appointment ${friendlyDateTime(t.appointment_date_time).replace(/^(\w+),/, (m) => m.toLowerCase())}` : t.lead && t.lead !== outletName ? t.lead : 'Open the outlet'}
            </Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.chevron} strokeWidth={2.2} />
        </PressableScale>
      ) : null}

      <View style={styles.block}>
        <ProgressSteps index={stepIndex(shownStatus)} />
      </View>

      <Card style={[styles.block, styles.details]}>
        {details.map((d, i) => (
          <Detail key={d.label} {...d} last={i === details.length - 1} />
        ))}
      </Card>

      {t.done_remark || (t.done_photos?.media.length ?? 0) > 0 ? (
        <Card padded style={styles.block}>
          <Text variant="label" color="ink2">
            {doneByYou ? (sentBack ? 'What you did last time' : 'What you did') : t.done_by ? `What ${firstName(t.done_by)} did` : 'What was done'}
          </Text>
          {t.done_remark ? (
            <Text variant="body" style={styles.doneNote}>
              {t.done_remark}
            </Text>
          ) : null}
          {t.done_photos?.media.length ? (
            <View style={styles.photos}>
              <RemotePhotos files={t.done_photos.media} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.block}>
        <ListRow onPress={() => navigation.navigate('TaskMessages', { id: t.id, title: t.title })} chevron style={styles.navRow}>
          <Text variant="body" style={styles.flex}>
            Messages
          </Text>
          {t.unread_notification > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.brand }]}>
              <Text variant="label" color="#FFFFFF" style={styles.badgeText} allowFontScaling={false}>
                {t.unread_notification}
              </Text>
            </View>
          ) : null}
        </ListRow>
        {t.lead_id ? (
          <ListRow onPress={() => navigation.navigate('OutletVisits', { id: t.lead_id!, name: outletName })} chevron divider={false} style={styles.navRow}>
            <Text variant="body" style={styles.flex}>
              Visits at this outlet
            </Text>
            {visits.data ? (
              <Text variant="subhead" color="ink2">
                {visits.data.length}
              </Text>
            ) : null}
          </ListRow>
        ) : null}
      </Card>

      <Sheet
        ref={doneSheet}
        title="Mark as done?"
        fit
        subtitle={`${checker} checks it next.`}
        footer={
          <>
            <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => doneSheet.current?.close()} />
            <Button label="Mark as done" style={styles.flexMore} onPress={confirmDone} />
          </>
        }
      >
        <View style={styles.sheetBody}>
          <TextField
            inSheet
            label="What did you do?"
            optional
            multiline
            value={remark}
            onChangeText={setRemark}
            placeholder="For example: collected the payment in cash"
            style={styles.sheetInput}
          />
          <View style={styles.salesRow}>
            <View style={styles.flex}>
              <TextField
                inSheet
                label="Sales amount"
                optional
                value={sales}
                onChangeText={setSales}
                keyboardType="decimal-pad"
                placeholder="0.00"
                leading={
                  <Text variant="body" color="ink2" style={styles.rm}>
                    RM
                  </Text>
                }
              />
            </View>
            <View style={styles.flex}>
              <TextField inSheet label="Invoice no." optional value={invoice} onChangeText={setInvoice} autoCapitalize="characters" mono placeholder="INV-0000" />
            </View>
          </View>
          <PhotoStrip photos={photos} onChange={setPhotos} />
        </View>
      </Sheet>

      <Sheet ref={moreSheet} title="More" fit>
        <View style={styles.sheetBody}>
          {moreActions.map((a) => (
            <SheetAction key={a.key} label={a.label} hint={a.hint} onPress={() => runMore(a.key)} />
          ))}
        </View>
      </Sheet>
    </DetailScreen>
  );
}

function Detail({ label, value, tone, strong, mono, last }: { label: string; value: string; tone?: string; strong?: boolean; mono?: boolean; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.detail, { borderBottomColor: colors.divider, borderBottomWidth: last ? 0 : 1 }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="subhead" color="ink2">
        {label}
      </Text>
      <Text
        variant={mono ? 'mono' : 'subhead'}
        color={tone ?? 'ink'}
        align="right"
        style={[styles.detailValue, strong ? styles.strong : styles.medium]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexMore: { flex: 1.3 },
  side: { minWidth: 96 },
  pad: { paddingTop: 16 },
  reference: { paddingRight: 8 },
  header: { paddingHorizontal: 20, paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { marginTop: 12, fontSize: 28, lineHeight: 34 },
  remark: { marginTop: 8 },
  banner: { marginTop: 16, marginHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16, borderRadius: radius.tile },
  sentBack: { marginTop: 16, marginHorizontal: space.gutter, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.tile, gap: 4 },
  bannerTick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  strong: { fontFamily: 'InstrumentSans_600SemiBold' },
  medium: { fontFamily: 'InstrumentSans_500Medium' },
  outlet: { marginTop: 16, marginHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.card, borderWidth: 1 },
  block: { marginTop: 16, marginHorizontal: space.gutter },
  details: { paddingHorizontal: 16, paddingVertical: 2, borderRadius: radius.card },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 13, flexWrap: 'wrap' },
  detailValue: { flexShrink: 1 },
  doneNote: { marginTop: 6 },
  photos: { marginTop: 12 },
  navRow: { minHeight: 58, paddingVertical: 12, paddingHorizontal: 16 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'InstrumentSans_700Bold', fontSize: 12, lineHeight: 16 },
  sheetBody: { marginTop: 16, gap: 12 },
  sheetInput: { fontSize: 17, lineHeight: 24 },
  salesRow: { flexDirection: 'row', gap: 12 },
  rm: { marginRight: 6 },
});
