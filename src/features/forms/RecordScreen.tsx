import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { errorMessage } from '../../api/client';
import {
  approveEntry,
  cancelEntry,
  closeRecord,
  fetchEntry,
  fetchForm,
  fetchRecord,
  formKeys,
  needsAssignee,
  rejectEntry,
  type Entry,
  type FormDefinition,
  type NeedsAssignee,
  type RecordDetail,
} from '../../api/forms';
import { homeKey } from '../../api/home';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card, ListRow } from '../../components/Card';
import { Tag } from '../../components/Chips';
import { LoadError } from '../../components/EmptyState';
import { RecordSkeleton } from '../../components/LoadingSkeletons';
import { Icon, MoreDots } from '../../components/Icon';
import { IconButton } from '../../components/IconButton';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Sheet, SheetAction, type SheetHandle } from '../../components/Sheet';
import { NameAndDetails } from '../../components/PlaceAndNote';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { firstName, formatDate, formatTime, relativeDay } from '../../lib/format';
import { isEmptyValue } from '../../lib/forms/conditions';
import { buildSteps, displayValue, formNames, isField } from '../../lib/forms/schema';
import type { FieldType } from '../../lib/forms/types';
import { recordLook, recordTrail, type StatusLook, type TrailStep } from '../../lib/formCopy';
import { haptic } from '../../lib/haptics';
import { Moving } from '../../motion/Moving';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { useUndo } from '../../undo/UndoProvider';
import { AnswerRows, usePeople, type AnswerItem } from './AnswerRows';

/** "Today, 10:58 AM", "Yesterday, 4:10 PM", "3 Oct, 9:00 AM" */
function when(value: string | null): string {
  if (!value) return '';
  const day = relativeDay(value);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${formatTime(value)}`;
}

/**
 * One record: where it is, the answers, and what you can do with it. The
 * same screen serves the person who sent it, a handler whose turn it is,
 * and an approver (the ApproveRecord board).
 */
export function RecordScreen({ route, navigation }: RootScreenProps<'Record'>) {
  const { id } = route.params;
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { names: listed } = usePeople();
  const { schedule, undo, notify } = useUndo();
  const record = useQuery({ queryKey: formKeys.record(id), queryFn: () => fetchRecord(id) });
  const entry = useQuery({ queryKey: formKeys.entry(id), queryFn: () => fetchEntry(id) });
  const formId = entry.data?.form_id ?? record.data?.form_id;
  const form = useQuery({ queryKey: formKeys.form(formId ?? 0), queryFn: () => fetchForm(formId!), enabled: !!formId, retry: false });

  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  // Undo only while the decision is still waiting to be sent.
  const [canUndo, setCanUndo] = useState(false);
  const [reason, setReason] = useState('');
  const [closeWhy, setCloseWhy] = useState('');
  const [need, setNeed] = useState<NeedsAssignee | null>(null);
  const more = useRef<SheetHandle>(null);
  const rejectSheet = useRef<SheetHandle>(null);
  const closeSheet = useRef<SheetHandle>(null);
  const pickSheet = useRef<SheetHandle>(null);
  const lastError = useRef<NeedsAssignee | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: formKeys.all });
    queryClient.invalidateQueries({ queryKey: homeKey });
  };

  const cancel = useMutation({
    mutationFn: () => cancelEntry(id),
    onSuccess: () => {
      haptic.warning();
      notify('Entry cancelled. No one needs to act on it now.', 'done');
      refresh();
    },
    onError: (e) => Alert.alert('We could not cancel it', errorMessage(e)),
  });

  const close = useMutation({
    mutationFn: () => closeRecord(id, closeWhy),
    onSuccess: () => {
      haptic.warning();
      closeSheet.current?.close();
      setCloseWhy('');
      notify('Record closed.', 'done');
      refresh();
    },
    onError: (e) => Alert.alert('We could not close it', errorMessage(e)),
  });

  const approveWith = useMutation({
    mutationFn: (assigneeId: number) => approveEntry(id, null, [assigneeId]),
    onSuccess: () => {
      haptic.success();
      notify('Approved.', 'done');
      refresh();
    },
    onError: (e) => {
      setDecision(null);
      Alert.alert('We could not approve it', errorMessage(e));
    },
  });

  if (record.isError || entry.isError) {
    return (
      <DetailScreen>
        <LoadError message={errorMessage(record.error ?? entry.error)} onRetry={() => (record.refetch(), entry.refetch())} />
      </DetailScreen>
    );
  }
  if (!record.data || !entry.data) {
    return (
      <DetailScreen>
        <RecordSkeleton label="Loading the record" />
      </DetailScreen>
    );
  }

  const r = record.data;
  const e = entry.data;
  // Names for Person answers: the server sends them (value_label, and each
  // Person field's people); the sender and whoever acted are on the record too.
  const names = formNames(form.data?.elements, listed);
  for (const a of e.form_elements) if (a.value_label && (typeof a.value === 'number' || typeof a.value === 'string')) names.set(Number(a.value), a.value_label);
  if (!names.has(e.submitted_by) && e.submitted_by_name) names.set(e.submitted_by, e.submitted_by_name);
  for (const a of e.approvals) if (a.acted_by && a.acted_by_name && !names.has(a.acted_by)) names.set(a.acted_by, a.acted_by_name);
  const mine = e.submitted_by === user?.id;
  const turn = e.can_act && e.status === 'pending' ? e.stage_type : null;
  const sender = mine ? 'You' : (e.submitted_by_name ?? 'Someone');
  const status = r.closed ? 'closed' : e.status;
  const look: StatusLook =
    decision === 'approved'
      ? { label: 'Approved by you', ...tone(colors, 'good') }
      : decision === 'rejected'
        ? { label: 'Rejected by you', ...tone(colors, 'critical') }
        : turn === 'approval'
          ? { label: 'Your turn to approve', ...tone(colors, 'brand') }
          : turn === 'fill'
            ? { label: 'Your turn', ...tone(colors, 'brand') }
            : recordLook(status, colors);

  const trail = recordTrail(e.approvals, mine ? 'You sent it' : `${sender} sent it`, e.submitted_at, e.status, when, user?.id ?? null, r.waiting_on ?? (turn && user ? [user.name] : []), user?.name ?? null);
  const upcoming = upcomingAfterNow(e);

  /* ----- approving ----- */

  const approve = () => {
    haptic.success();
    setDecision('approved');
    setCanUndo(true);
    lastError.current = null;
    schedule({
      key: `form-approve-${id}`,
      quiet: true,
      message: upcoming.length ? `Approved. ${upcoming[0]} next.` : 'Approved.',
      run: async () => {
        try {
          await approveEntry(id, null);
        } catch (err) {
          lastError.current = needsAssignee(err);
          throw err;
        }
      },
      onUndo: () => {
        setDecision(null);
        setCanUndo(false);
      },
      onDone: () => {
        setCanUndo(false);
        refresh();
      },
      onError: () => {
        setCanUndo(false);
        if (lastError.current) {
          setNeed(lastError.current);
          pickSheet.current?.open();
        } else {
          setDecision(null);
        }
        refresh();
      },
    });
  };

  const reject = () => {
    if (!reason.trim()) {
      haptic.error();
      return;
    }
    rejectSheet.current?.close();
    haptic.warning();
    setDecision('rejected');
    setCanUndo(true);
    const why = reason;
    schedule({
      key: `form-reject-${id}`,
      quiet: true,
      message: `Rejected. ${firstName(e.submitted_by_name) || 'They'} sees your reason.`,
      run: () => rejectEntry(id, why),
      onUndo: () => {
        setDecision(null);
        setCanUndo(false);
      },
      onDone: () => {
        setCanUndo(false);
        setReason('');
        refresh();
      },
      onError: () => {
        setCanUndo(false);
        setDecision(null);
        refresh();
      },
    });
  };

  const confirmCancel = () =>
    Alert.alert('Cancel this entry?', 'It stops here, and no one needs to act on it. You can fill it in again later.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel entry', style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  const fillAgain = () => navigation.navigate('FillForm', { formId: e.form_id, mode: 'again', entryId: e.id });
  const followUp = () => navigation.navigate('FillForm', { formId: e.form_id, parent: { id: r.id, reference: r.reference, title: r.title } });
  const canFillAgain = mine && (e.status === 'rejected' || e.status === 'cancelled' || e.status === 'approved');
  const moreActions = [canFillAgain && !(e.status === 'rejected' || e.status === 'cancelled'), r.can_follow_up, r.can_close].some(Boolean);

  /* ----- bottom bar ----- */

  let bar: React.ReactNode = null;
  if (decision) {
    bar = (
      <View style={styles.bar}>
        {canUndo ? <Button label="Undo" variant="secondary" style={styles.flex} onPress={() => undo(`form-${decision === 'approved' ? 'approve' : 'reject'}-${id}`)} /> : null}
        <Button label="Done" style={canUndo ? styles.wide : styles.flex} onPress={() => navigation.goBack()} />
      </View>
    );
  } else if (turn === 'approval') {
    bar = (
      <View style={styles.bar}>
        <Button label="Reject" variant="danger" style={styles.flex} onPress={() => rejectSheet.current?.open()} accessibilityHint="Asks you for a reason" />
        <Button label="Approve" style={styles.wide} onPress={approve} />
      </View>
    );
  } else if (turn === 'fill') {
    bar = <Button label="Fill in your part" style={styles.flex} onPress={() => navigation.navigate('FillForm', { formId: e.form_id, mode: 'stage', entryId: e.id })} />;
  } else if (e.can_edit && !r.closed) {
    bar = (
      <View style={styles.bar}>
        <Button label="Cancel entry" variant="danger" style={styles.flex} loading={cancel.isPending} onPress={confirmCancel} />
        <Button label="Change answers" style={styles.wide} onPress={() => navigation.navigate('FillForm', { formId: e.form_id, mode: 'edit', entryId: e.id })} />
      </View>
    );
  } else if (mine && (e.status === 'rejected' || e.status === 'cancelled')) {
    bar = <Button label="Fill it in again" style={styles.flex} onPress={fillAgain} />;
  }

  return (
    <DetailScreen
      onRefresh={() => Promise.all([record.refetch(), entry.refetch()])}
      topRight={
        moreActions ? (
          <IconButton onPress={() => more.current?.open()} accessibilityLabel="More actions">
            <MoreDots color={colors.body} />
          </IconButton>
        ) : undefined
      }
      bottomBar={bar}
    >
      <View style={styles.head}>
        <Tag size="large" text={look.label} ink={look.ink} bg={look.bg} dot={look.dot} />
        <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
          {r.title}
        </Text>
        {mine ? (
          <Text variant="body" color="ink2" style={styles.sub}>
            {e.form_name ?? r.form_name} · sent {relativeDay(e.submitted_at)}, {formatTime(e.submitted_at)}
          </Text>
        ) : (
          <View style={styles.from}>
            <Avatar name={e.submitted_by_name ?? '?'} size={32} />
            <View style={styles.flex}>
              <NameAndDetails name={e.submitted_by_name ?? 'Someone'} details={`${e.form_name ?? r.form_name} · ${relativeDay(e.submitted_at)}, ${formatTime(e.submitted_at)}`} />
            </View>
          </View>
        )}
        <Text variant="mono" color="ink2" style={styles.ref}>
          {r.reference}
        </Text>
      </View>

      {decision ? <DecisionNote decision={decision} next={upcoming[0]} sender={firstName(e.submitted_by_name) || 'They'} /> : null}
      {!decision && r.closed ? <ClosedNote closed={r.closed} /> : null}
      {!decision && e.status === 'rejected' && e.rejected_remark ? <RejectedNote by={e.rejected_by_name} remark={e.rejected_remark} /> : null}

      {r.parent ? (
        <Card style={styles.card}>
          <ListRow onPress={() => navigation.push('Record', { id: r.parent!.id, title: r.parent!.title })} divider={false} chevron>
            <Icon name="link" size={20} color={colors.ink2} />
            <View style={styles.flex}>
              <Text variant="footnote" color="ink2">
                Follows up on
              </Text>
              <Text variant="bodyStrong">{r.parent.title}</Text>
            </View>
          </ListRow>
        </Card>
      ) : null}

      {turn !== 'approval' ? <Trail steps={trail} complete={e.process_complete} /> : null}

      <Answers entry={e} form={form.data ?? null} names={names} expanded={turn === 'approval' || !!decision} />

      {turn === 'approval' && !decision ? (
        <Card padded style={styles.card}>
          <Text variant="rowTitle" accessibilityRole="header">
            If you approve
          </Text>
          <Text variant="subhead" color="ink2" style={styles.ifText}>
            {upcoming.length
              ? `${upcoming.map((s, i) => (i === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1))).join(', then ')}.`
              : e.process_complete
                ? 'That is the last step. The record is done.'
                : 'The next step depends on the answers.'}
          </Text>
        </Card>
      ) : null}

      {r.children.length ? (
        <View>
          <Text variant="label" color="ink2" style={styles.sectionLabel} accessibilityRole="header">
            Follow-ups
          </Text>
          <Card style={styles.cardFlat}>
            {r.children.map((c, i) => (
              <ListRow key={c.id} onPress={() => navigation.push('Record', { id: c.id, title: c.title })} divider={i < r.children.length - 1} chevron>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{c.title}</Text>
                  <Text variant="caption" color="ink2">
                    {[c.submitted_by, formatDate(c.submitted_at)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </ListRow>
            ))}
          </Card>
        </View>
      ) : null}

      {e.can_edit && !r.closed && !turn ? (
        <Text variant="caption" color="ink2" align="center" style={styles.footNote}>
          You can change your answers until someone acts on it.
        </Text>
      ) : null}

      <Sheet ref={more} title="More" fit>
        {canFillAgain && !(e.status === 'rejected' || e.status === 'cancelled') ? (
          <SheetAction
            label="Fill in again"
            hint="A new record with these answers to start from"
            onPress={() => {
              more.current?.close();
              fillAgain();
            }}
          />
        ) : null}
        {r.can_follow_up ? (
          <SheetAction
            label="Start a follow-up"
            hint="A new record linked to this one, for a return visit"
            onPress={() => {
              more.current?.close();
              followUp();
            }}
          />
        ) : null}
        {r.can_close ? (
          <SheetAction
            label="Close this record"
            hint={e.status === 'pending' ? 'It stops here, and the steps still waiting are cancelled' : 'No more work happens on it'}
            tone="danger"
            onPress={() => {
              more.current?.close();
              closeSheet.current?.open();
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        ref={rejectSheet}
        title="Reject this record?"
        subtitle={`${firstName(e.submitted_by_name) || 'They'} sees your reason and can fill it in again.`}
        fit
        footer={
          <>
            <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => rejectSheet.current?.close()} />
            <Button label="Reject" variant="destructive" style={styles.flex} onPress={reject} disabled={!reason.trim()} />
          </>
        }
      >
        <View style={styles.sheetField}>
          <TextField inSheet label="Why it is rejected" value={reason} onChangeText={setReason} multiline placeholder="For example: please add a photo of the machine" />
        </View>
      </Sheet>

      <Sheet
        ref={closeSheet}
        title="Close this record?"
        subtitle={e.status === 'pending' ? 'It is still in progress, so the steps waiting on people are cancelled.' : 'No more work happens on it. People can still read it.'}
        fit
        footer={
          <>
            <Button label="Keep it open" variant="secondary" style={styles.flex} onPress={() => closeSheet.current?.close()} />
            <Button label="Close record" variant="destructive" style={styles.flex} loading={close.isPending} disabled={!closeWhy.trim()} onPress={() => close.mutate()} />
          </>
        }
      >
        <View style={styles.sheetField}>
          <TextField inSheet label="Why you are closing it" value={closeWhy} onChangeText={setCloseWhy} multiline placeholder="For example: sent by mistake" />
        </View>
      </Sheet>

      <Sheet ref={pickSheet} title={need ? `Who should handle "${need.name}"?` : 'Choose a person'} subtitle="They get it next. It is not approved until you choose." snapPoints={['60%', '92%']}>
        {(need?.candidates ?? []).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              pickSheet.current?.close();
              approveWith.mutate(p.id);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.personRow, { borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
          >
            <Avatar name={p.name} size={36} />
            <Text variant="body" style={styles.flex}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </DetailScreen>
  );
}

function tone(colors: ReturnType<typeof useColors>, name: 'brand' | 'good' | 'critical') {
  const t = colors.tones[name];
  return { ink: t.ink, bg: t.tile, dot: t.dot };
}

/** The names of the steps still waiting after the current one. */
function upcomingAfterNow(e: Entry): string[] {
  const rows = e.approvals.filter((a) => a.status === 'pending');
  return rows.slice(1).map((a) => a.name || (a.node_type === 'approval' ? 'Approval' : a.node_type === 'fill' ? 'Fill in' : 'Copy'));
}

function DecisionNote({ decision, next, sender }: { decision: 'approved' | 'rejected'; next?: string; sender: string }) {
  const colors = useColors();
  const t = decision === 'approved' ? colors.tones.good : colors.tones.critical;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.note, { backgroundColor: t.tile }]} accessibilityLiveRegion="polite">
      {decision === 'approved' ? (
        <View style={[styles.noteTick, { backgroundColor: '#067647' }]}>
          <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} />
        </View>
      ) : null}
      <Text variant="subhead" color={t.ink} style={[styles.flex, styles.strong]}>
        {decision === 'approved' ? (next ? `Approved. ${next} is next.` : 'Approved.') : `Rejected. ${sender} sees your reason and can fill it in again.`}
      </Text>
    </Animated.View>
  );
}

function ClosedNote({ closed }: { closed: NonNullable<RecordDetail['closed']> }) {
  const colors = useColors();
  return (
    <View style={[styles.noteBlock, { backgroundColor: colors.tones.neutral.tile }]}>
      <Text variant="subhead" style={styles.strong}>
        Closed{closed.closed_by ? ` by ${closed.closed_by}` : ''}
        {closed.closed_at ? ` on ${formatDate(closed.closed_at)}` : ''}
      </Text>
      {closed.remark ? (
        <Text variant="subhead" color="body">
          “{closed.remark}”
        </Text>
      ) : null}
    </View>
  );
}

function RejectedNote({ by, remark }: { by: string | null; remark: string }) {
  const colors = useColors();
  return (
    <View style={[styles.noteBlock, { backgroundColor: colors.tones.critical.tile }]}>
      <Text variant="subhead" color={colors.tones.critical.ink} style={styles.strong}>
        Rejected{by ? ` by ${by}` : ''}
      </Text>
      <Text variant="subhead" color="body">
        “{remark}”
      </Text>
    </View>
  );
}

/* ----- where it is ----- */

function Trail({ steps, complete }: { steps: TrailStep[]; complete: boolean }) {
  const colors = useColors();
  return (
    <Card padded style={styles.card}>
      <Text variant="rowTitle" accessibilityRole="header" style={styles.trailTitle}>
        Where it is
      </Text>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <View key={s.key} style={[styles.trailRow, !last && styles.trailGap]} accessible accessibilityLabel={`${s.title}. ${s.note ?? ''}${s.state === 'now' ? '. Current step' : ''}`}>
            {!last ? <View style={[styles.trailLine, { backgroundColor: s.state === 'done' ? '#0D729E' : colors.line }]} /> : null}
            <TrailDot state={s.state} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" color={s.state === 'later' ? colors.body : colors.ink}>
                {s.title}
              </Text>
              {s.note ? (
                <Text variant="caption" color={s.state === 'now' ? 'brandInk' : s.state === 'stopped' ? colors.tones.critical.ink : 'ink2'} style={s.state === 'now' && styles.strong}>
                  {s.note}
                </Text>
              ) : null}
              {s.remark ? (
                <Text variant="caption" color="body" style={styles.remark}>
                  “{s.remark}”
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      {!complete ? (
        <Text variant="caption" color="ink2" style={styles.moreSteps}>
          More steps may follow, depending on the answers.
        </Text>
      ) : null}
    </Card>
  );
}

function TrailDot({ state }: { state: TrailStep['state'] }) {
  const colors = useColors();
  if (state === 'done')
    return (
      <View style={[styles.dot, { backgroundColor: '#0D729E' }]}>
        <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} />
      </View>
    );
  if (state === 'stopped')
    return (
      <View style={[styles.dot, { backgroundColor: colors.tones.critical.ink }]}>
        <Icon name="close" size={14} color="#FFFFFF" strokeWidth={3} />
      </View>
    );
  if (state === 'now') return <NowDot />;
  return <View style={[styles.dot, { borderWidth: 2, borderColor: colors.control, backgroundColor: colors.panel }]} />;
}

/** The current step: a brand ring with a soft pulse around it (none with Reduce Motion). */
function NowDot() {
  const colors = useColors();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, t]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.7 }] }));
  return (
    <View>
      {!reduced ? <Animated.View style={[styles.dot, styles.halo, { backgroundColor: '#0D729E' }, halo]} /> : null}
      <View style={[styles.dot, { borderWidth: 8, borderColor: '#0D729E', backgroundColor: colors.panel }]} />
    </View>
  );
}

/* ----- the answers ----- */

function Answers({ entry, form, names, expanded }: { entry: Entry; form: Pick<FormDefinition, 'groups' | 'elements'> | null; names: Map<number, string>; expanded: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState<string | null>(null);

  const sections = useMemo(() => {
    const byId = new Map(entry.form_elements.map((a) => [a.id, a]));
    const item = (id: string, type: string, label: string): AnswerItem => ({
      element: { id, type: type as FieldType, label },
      value: byId.get(id)?.value,
      stored: entry.attachments?.[id] ?? null,
    });
    if (form) {
      const visible = Object.fromEntries(entry.form_elements.map((a) => [a.id, !a.hidden]));
      const steps = buildSteps({ groups: form.groups ?? [], elements: form.elements ?? [] }, visible, (el) => !isField(el) || byId.has(el.id));
      const out = steps
        .map((s) => ({ id: s.id, title: s.title, items: s.elements.filter(isField).filter((el) => byId.has(el.id)).map((el) => item(el.id, el.type, el.label)) }))
        .filter((s) => s.items.length);
      if (out.length) return out;
    }
    return [{ id: 'all', title: 'Answers', items: entry.form_elements.filter((a) => !a.hidden).map((a) => item(a.id, a.type, a.label)) }];
  }, [entry, form]);


  if (expanded || sections.length === 1) {
    return (
      <View>
        {sections.map((s) => (
          <Card key={s.id} style={styles.answerCard}>
            <Text variant="rowTitle" accessibilityRole="header" style={styles.answerHead}>
              {s.title}
            </Text>
            <AnswerRows items={s.items} names={names} first={false} />
          </Card>
        ))}
      </View>
    );
  }

  const shownOpen = open ?? sections[0]?.id;
  return (
    <Card style={styles.card}>
      {sections.map((s, i) => {
        const isOpen = shownOpen === s.id;
        const summary = s.items
          .filter((it) => it.element.type !== 'file' && !isEmptyValue(it.value))
          .slice(0, 2)
          .map((it) => displayValue(it.element, it.value, names))
          .join(', ');
        return (
          <View key={s.id} style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }}>
            <PressableScale
              scaleTo={0.99}
              onPress={() => setOpen(isOpen ? '' : s.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={styles.sectionButton}
            >
              <View style={styles.flex}>
                <Text variant="rowTitle">{s.title}</Text>
                {summary ? (
                  <Text variant="caption" color="ink2" numberOfLines={1}>
                    {summary}
                  </Text>
                ) : null}
              </View>
              <Chevron open={isOpen} />
            </PressableScale>
            {isOpen ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.sectionBody}>
                <AnswerRows items={s.items} names={names} first={false} />
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

function Chevron({ open }: { open: boolean }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const turn = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 180 : 0, { duration: reduced ? 0 : 200 });
  }, [open, reduced, turn]);
  return (
    <Moving value={turn} kind="rotate" contentKey={colors.chevron}>
      <Icon name="chevronDown" size={20} color={colors.chevron} strokeWidth={2.2} />
    </Moving>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  wide: { flex: 1.3 },
  strong: { fontFamily: fonts.semibold },
  bar: { flex: 1, flexDirection: 'row', gap: 10 },
  head: { paddingHorizontal: 20, paddingTop: 12 },
  title: { marginTop: 12, fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  sub: { marginTop: 6 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  ref: { marginTop: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginHorizontal: space.gutter, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.tile },
  noteTick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noteBlock: { marginTop: 18, marginHorizontal: space.gutter, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.tile, gap: 4 },
  card: { marginTop: 16, marginHorizontal: space.gutter, borderRadius: radius.card },
  cardFlat: { marginHorizontal: space.gutter, borderRadius: radius.card },
  trailTitle: { marginBottom: 14 },
  trailRow: { flexDirection: 'row', gap: 14 },
  trailGap: { paddingBottom: 18 },
  trailLine: { position: 'absolute', left: 13, top: 28, bottom: 0, width: 2 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  remark: { marginTop: 4 },
  moreSteps: { marginTop: 12 },
  answerCard: { marginTop: 12, marginHorizontal: space.gutter, borderRadius: radius.card, paddingHorizontal: 18, paddingBottom: 8 },
  answerHead: { lineHeight: 44 },
  sectionButton: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionBody: { paddingHorizontal: 18, paddingBottom: 8 },
  ifText: { marginTop: 6 },
  sectionLabel: { marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  footNote: { marginTop: 14, marginHorizontal: 24 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1 },
  sheetField: { marginTop: 16 },
});
