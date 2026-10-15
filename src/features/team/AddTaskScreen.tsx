import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchPeople, formKeys } from '../../api/forms';
import { homeKey } from '../../api/home';
import { createTask, taskKeys } from '../../api/tasks';
import { fetchTeam, teamKeys } from '../../api/team';
import { fetchVisitReport, visitKeys } from '../../api/visits';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Sheet, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { firstName, formatDate, keepTogether, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { RootScreenProps } from '../../navigation/types';
import { useConfirmLeave } from '../../navigation/useConfirmLeave';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { useUndo } from '../../undo/UndoProvider';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

/** Tomorrow at 5:00 PM: the usual first due time. */
function defaultDue(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return d;
}

/** Join a day and a time picked separately. */
function at(day: Date, time: Date): Date {
  const d = new Date(day);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

/**
 * Add a task for someone in the team. From a visit report ("Make it a task")
 * the outlet, the person and a title come filled in, and the server links
 * the report to the task.
 */
export function AddTaskScreen({ route, navigation }: RootScreenProps<'AddTask'>) {
  const params = route.params ?? {};
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { notify } = useUndo();
  const more = useRef<SheetHandle>(null);

  const report = useQuery({ queryKey: visitKeys.detail(params.reportId ?? 0), queryFn: () => fetchVisitReport(params.reportId!), enabled: !!params.reportId });
  const team = useQuery({ queryKey: teamKeys.team, queryFn: fetchTeam });
  const everyone = useQuery({ queryKey: formKeys.people, queryFn: fetchPeople, staleTime: 30 * 60_000 });

  const r = report.data;
  const suggestedTitle = params.title ?? (r ? (r.support_description?.trim() || `Follow up at ${r.outlet ?? 'the outlet'}`) : '');
  const [title, setTitle] = useState<string | null>(null);
  const shownTitle = title ?? suggestedTitle;
  const [who, setWho] = useState<number | null>(params.assigneeId ?? null);
  const [dueDay, setDueDay] = useState<Date>(defaultDue);
  const [dueTime, setDueTime] = useState<Date>(defaultDue);
  const [apptDay, setApptDay] = useState<Date | null>(null);
  const [apptTime, setApptTime] = useState<Date | null>(null);
  const [remark, setRemark] = useState('');
  const [owners, setOwners] = useState<number[]>(user ? [user.id] : []);
  const [viewers, setViewers] = useState<number[]>([]);
  const [helpers, setHelpers] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allowLeave = useConfirmLeave(!!(title?.trim() || remark.trim()), { title: 'Discard this task?', keep: 'Keep editing' });

  const outletId = params.outletId ?? r?.lead_id ?? null;
  const outletName = params.outletName ?? r?.outlet ?? null;

  // The team, busiest last, with how much each person already has.
  const load = useMemo(() => new Map((team.data?.summary.team ?? []).map((p) => [p.user_id, p])), [team.data]);
  const people = useMemo(() => {
    const list = (everyone.data ?? []).filter((p) => p.id !== user?.id);
    const score = (id: number) => (load.get(id)?.overdue ?? 0) * 100 + (load.get(id)?.open ?? 0);
    return list.sort((a, b) => (a.id === params.assigneeId ? -1 : b.id === params.assigneeId ? 1 : score(a.id) - score(b.id)));
  }, [everyone.data, load, user?.id, params.assigneeId]);
  const chosen = people.find((p) => p.id === who) ?? null;

  // Three cards fill the width, as on the board; more than three scroll.
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - space.gutter * 2 - 20) / 3);

  const hint = (() => {
    if (!chosen && everyone.data && params.assigneeId && r && r.created_by_id === params.assigneeId) return `${r.created_by ?? 'This rep'}’s account is turned off, so they cannot take tasks. Choose someone else.`;
    if (!chosen) return 'Choose who does it.';
    const l = load.get(chosen.id);
    const first = firstName(chosen.name);
    if (r && r.created_by_id === chosen.id) return `${first} made this visit${l?.overdue ? `, and has ${plural(l.overdue, 'overdue task')}` : ''}.`;
    if (l?.overdue) return `${first} already has ${plural(l.overdue, 'overdue task')}.`;
    if (l) return `${first} has ${plural(l.open, 'open task')}.`;
    return `${first} gets it next.`;
  })();

  const save = useMutation({
    mutationFn: () => {
      const due = at(dueDay, dueTime);
      return createTask({
        title: shownTitle,
        leadId: outletId!,
        subscriber: who!,
        owners: owners.length ? owners : user ? [user.id] : [],
        viewers,
        subSubscribers: helpers,
        dueDate: isoDay(due),
        dueTime: clock(due),
        appointmentDate: apptDay ? isoDay(apptDay) : null,
        appointmentTime: apptDay && apptTime ? clock(apptTime) : null,
        remark,
        reportId: params.reportId ?? null,
      });
    },
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: teamKeys.team });
      queryClient.invalidateQueries({ queryKey: homeKey });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      notify(`Task added for ${chosen ? firstName(chosen.name) : 'them'}.`, 'done');
      allowLeave();
      navigation.goBack();
    },
    onError: (e) => {
      haptic.error();
      Alert.alert('We could not add the task', errorMessage(e));
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!shownTitle.trim()) next.title = 'Give the task a title.';
    if (!outletId) next.outlet = 'Choose the outlet.';
    if (!who) next.who = 'Choose who does it.';
    if (at(dueDay, dueTime).getTime() < Date.now()) next.due = 'Choose a due time later than now.';
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.error();
      return;
    }
    save.mutate();
  };

  const options = (everyone.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const extra = owners.filter((id) => id !== user?.id).length + viewers.length + helpers.length;

  return (
    <DetailScreen
      keyboard
      modalHeader={{ title: 'Add a task', onCancel: () => navigation.goBack(), action: { label: 'Add', onPress: submit, disabled: save.isPending } }}
      bottomBar={<Button label={chosen ? `Add task for ${firstName(chosen.name)}` : 'Add task'} loading={save.isPending} style={styles.flex} onPress={submit} />}
    >
      <Card padded style={styles.block}>
        <TextField label="Title" grow submitBehavior="blurAndSubmit" returnKeyType="done" value={shownTitle} onChangeText={setTitle} error={errors.title} placeholder="For example: check the grinder before the trial" />
        <PressableScale
          onPress={() => navigation.navigate('PickOutlet', { purpose: 'task' })}
          disabled={!!params.reportId}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={outletName ? `Outlet: ${outletName}. Change` : 'Choose the outlet'}
          style={[styles.outlet, { borderColor: errors.outlet ? colors.danger : colors.control, backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel }]}
        >
          {outletName ? <Avatar name={outletName} size={36} shape="tile" /> : <Icon name="outlets" size={22} color={colors.ink2} />}
          <View style={styles.flex}>
            <Text variant="footnote" color="ink2">
              Outlet
            </Text>
            <Text variant="bodyStrong" color={outletName ? 'ink' : 'muted'}>
              {outletName ?? 'Choose an outlet'}
            </Text>
          </View>
          {params.reportId ? null : <Icon name="chevronRight" size={20} color={colors.chevron} strokeWidth={2.2} />}
        </PressableScale>
        {errors.outlet ? (
          <Text variant="caption" color="danger">
            {errors.outlet}
          </Text>
        ) : null}
        {r ? (
          <Text variant="caption" color="ink2">
            From {firstName(r.created_by) || 'the'}’s visit report on {formatDate(r.created_at)}. The report is linked to the task.
          </Text>
        ) : null}
      </Card>

      <Text variant="label" color="ink2" accessibilityRole="header" style={styles.sectionTitle}>
        Who does it
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} accessibilityRole="radiogroup">
        {people.map((p) => {
          const on = p.id === who;
          const l = load.get(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                haptic.selection();
                setWho(p.id);
                setErrors(({ who: _, ...rest }) => rest);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${p.name}${l ? `, ${l.open} open${l.overdue ? `, ${l.overdue} overdue` : ''}` : ''}`}
              style={({ pressed }) => [
                styles.person,
                { width: cardWidth, backgroundColor: on ? colors.brandTint : colors.panel, borderColor: on ? colors.brand : colors.cardRing },
                pressed && styles.pressed,
              ]}
            >
              <Avatar name={p.name} size={52} />
              <Text variant="captionStrong" numberOfLines={1}>
                {firstName(p.name)}
              </Text>
              {/* Their load, quietly, a count a line: the line under the cards says when it is a worry. */}
              <Text variant="caption" align="center" color="ink2" style={styles.load}>
                {l ? [`${l.open} open`, l.overdue ? `${l.overdue} overdue` : null].filter((x): x is string => !!x).map(keepTogether).join('\n') : ' '}
              </Text>
              {on ? (
                <View style={[styles.check, { backgroundColor: colors.brand }]}>
                  <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Text variant="caption" color={errors.who ? 'danger' : 'ink2'} style={styles.hint}>
        {errors.who ?? hint}
      </Text>

      <Text variant="label" color="ink2" accessibilityRole="header" style={styles.sectionTitle}>
        When
      </Text>
      <Card style={styles.flat}>
        <DateField row label="Due date" value={dueDay} onChange={setDueDay} minimumDate={new Date()} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <DateField row label="Due time" mode="time" value={dueTime} onChange={setDueTime} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <DateField row label="Appointment" value={apptDay} onChange={setApptDay} placeholder="Add" minimumDate={new Date()} />
        {apptDay ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <DateField row label="Appointment time" mode="time" value={apptTime} onChange={setApptTime} placeholder="Add" />
          </>
        ) : null}
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <View style={styles.checkerRow}>
          <Text variant="subhead" color="ink2" style={styles.flex}>
            Checker
          </Text>
          <Text variant="subhead" style={styles.strong}>
            You
          </Text>
        </View>
      </Card>
      {errors.due ? (
        <Text variant="caption" color="danger" style={styles.hint}>
          {errors.due}
        </Text>
      ) : null}

      <Card padded style={styles.block}>
        <TextField label="Remark" optional multiline value={remark} onChangeText={setRemark} placeholder="What to do, and anything they should know" />
      </Card>

      <Pressable onPress={() => more.current?.open()} accessibilityRole="button" style={({ pressed }) => [styles.morePeople, pressed && styles.pressed]}>
        <Icon name="person" size={20} color={colors.link} />
        <Text variant="captionStrong" color="link" style={styles.link15}>
          More people: owners, viewers{extra ? ` (${extra})` : ''}
        </Text>
      </Pressable>

      <Sheet ref={more} title="More people" subtitle="Owners can change the task. Viewers can read it. Helpers do it too." snapPoints={['70%', '92%']}>
        <View style={styles.sheetFields}>
          <SelectField<number> multiple searchable label="Owners" options={options} value={owners} onChange={setOwners} placeholder="Just you" />
          <SelectField<number> multiple searchable label="Helpers" optional options={options.filter((o) => o.value !== who)} value={helpers} onChange={setHelpers} placeholder="No one" />
          <SelectField<number> multiple searchable label="Viewers" optional options={options} value={viewers} onChange={setViewers} placeholder="No one" />
        </View>
      </Sheet>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fonts.semibold },
  block: { marginTop: 12, marginHorizontal: space.gutter, borderRadius: radius.card, gap: 14 },
  flat: { marginHorizontal: space.gutter, borderRadius: radius.card },
  outlet: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  sectionTitle: { marginTop: 22, marginBottom: 10, marginHorizontal: 20 },
  people: { gap: 10, paddingHorizontal: space.gutter, paddingVertical: 2 },
  person: { borderRadius: radius.tile, borderWidth: 1, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6, alignItems: 'center', gap: 8 },
  load: { fontSize: 12, lineHeight: 16, marginTop: -4 },
  pressed: { opacity: 0.8 },
  check: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 10, marginHorizontal: 20 },
  // Full width, as the AddTask board draws the When rows.
  divider: { height: 1 },
  checkerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16 },
  morePeople: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 16, marginHorizontal: 20 },
  link15: { fontSize: 15 },
  sheetFields: { marginTop: 16, gap: 16 },
});
