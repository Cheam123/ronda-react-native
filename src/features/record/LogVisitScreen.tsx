import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { errorMessage, type LocalFile } from '../../api/client';
import { homeKey } from '../../api/home';
import { fetchOutlet, outletKeys, type GpsStamp } from '../../api/outlets';
import { taskKeys } from '../../api/tasks';
import { logVisit } from '../../api/visits';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Skeleton, TextBone } from '../../components/LoadingSkeletons';
import { DateField } from '../../components/DateField';
import { PhotoStrip } from '../../components/PhotoStrip';
import { PressableScale } from '../../components/Pressable';
import { StampButton, StampedCard } from '../../components/StampCard';
import { DetailScreen } from '../../components/Screen';
import { SwitchRow } from '../../components/Switch';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { distanceMeters, stampLocation, stampText } from '../../lib/location';
import { outletName } from '../../lib/outletCopy';
import { rememberTaskSales } from '../../lib/visitHandoff';
import type { RootScreenProps } from '../../navigation/types';
import { useConfirmLeave } from '../../navigation/useConfirmLeave';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** File a visit report at an outlet, with a location stamp when the rep taps for one. */
export function LogVisitScreen({ route, navigation }: RootScreenProps<'LogVisit'>) {
  const { outletId, taskId } = route.params ?? {};
  const colors = useColors();
  const queryClient = useQueryClient();
  const { abilities } = useAuth();
  const [visitedAt] = useState(() => new Date());
  const [stamp, setStamp] = useState<GpsStamp | null>(null);
  const [stamping, setStamping] = useState(false);
  const [what, setWhat] = useState('');
  const [problem, setProblem] = useState('');
  const [advice, setAdvice] = useState('');
  const [support, setSupport] = useState(false);
  const [supportNeeded, setSupportNeeded] = useState('');
  const [sales, setSales] = useState('');
  const [invoice, setInvoice] = useState('');
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const [nextVisit, setNextVisit] = useState<Date>(() => new Date(Date.now() + 7 * 86_400_000));
  const [plan, setPlan] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allowLeave = useConfirmLeave(
    !!(what.trim() || problem.trim() || advice.trim() || supportNeeded.trim() || sales.trim() || invoice.trim() || plan.trim() || photos.length || stamp),
    { title: 'Discard this visit?', keep: 'Keep editing' },
  );

  const outlet = useQuery({ queryKey: outletKeys.detail(outletId ?? 0), queryFn: () => fetchOutlet(outletId!), enabled: !!outletId });
  const o = outlet.data;
  const distance = stamp && o?.location ? distanceMeters(stamp, o.location) : null;

  const submit = useMutation({
    mutationFn: () =>
      logVisit({
        outletId: outletId!,
        taskId: taskId ?? null,
        whatHappened: what,
        problem,
        advice,
        needsSupport: support,
        supportNeeded,
        nextVisit: iso(nextVisit),
        plan,
        location: stamp ? stampText(stamp) : o ? [outletName(o), o.address].filter(Boolean).join(', ') : 'Not stamped',
        photos,
      }),
    onSuccess: () => {
      haptic.success();
      if (taskId) rememberTaskSales(taskId, { sales: sales.trim() || null, invoiceNo: invoice.trim() || null });
      queryClient.invalidateQueries({ queryKey: outletKeys.visits(outletId!) });
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: homeKey });
      // Then an order, if they buy (the board's flow).
      allowLeave();
      if (abilities.record_order) navigation.replace('RecordOrder', { outletId: outletId!, fromVisit: true });
      else navigation.goBack();
    },
    onError: (e) => {
      haptic.error();
      Alert.alert('We could not submit the visit', errorMessage(e));
    },
  });

  const doStamp = async () => {
    setStamping(true);
    try {
      const s = await stampLocation();
      if (s) {
        haptic.light();
        setStamp(s);
      }
    } finally {
      setStamping(false);
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!outletId) next.outlet = 'Choose the outlet you visited.';
    if (!what.trim()) next.what = 'Write what happened on this visit.';
    if (!plan.trim()) next.plan = 'Add a plan for the next visit.';
    if (support && !supportNeeded.trim()) next.support = 'Say what support they need.';
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.error();
      return false;
    }
    return true;
  };

  const confirmSubmit = () => {
    if (!validate()) return;
    if (!stamp) {
      Alert.alert('Submit without a location stamp?', 'A stamp shows the visit happened at the outlet. You can still submit without one.', [
        { text: 'Stamp first', style: 'cancel', onPress: doStamp },
        { text: 'Submit anyway', onPress: () => submit.mutate() },
      ]);
      return;
    }
    submit.mutate();
  };

  return (
    <DetailScreen
      keyboard
      modalHeader={{ title: 'Log a visit', onCancel: () => navigation.goBack() }}
      bottomBar={<Button label="Submit visit" loading={submit.isPending} style={styles.flex} onPress={confirmSubmit} />}
    >
      {/* Only when the visit came from an outlet or a task: then the outlet really is filled in. */}
      {outletId ? (
        <View style={[styles.banner, { backgroundColor: colors.brandTint }]}>
          <Text variant="caption" color={colors.brandInk}>
            We pre-filled the outlet and time to save you time.
          </Text>
        </View>
      ) : null}

      <Card style={styles.block}>
        <View style={styles.outletRow}>
          {o ? <Avatar name={outletName(o)} size={40} shape="tile" /> : <View style={[styles.emptyTile, { backgroundColor: colors.divider }]}>
              <Icon name="outlets" size={22} color={colors.ink2} />
            </View>}
          <View style={styles.flex}>
            <Text variant="footnote" color="ink2">
              Outlet
            </Text>
            {!o && outletId ? (
              <Skeleton label="Loading the outlet">
                <TextBone variant="bodyStrong" width={150} />
              </Skeleton>
            ) : (
              <Text variant="bodyStrong">{o ? outletName(o) : 'Choose an outlet'}</Text>
            )}
          </View>
          {taskId ? null : (
            <PressableScale onPress={() => navigation.navigate('PickOutlet', { purpose: 'visit' })} accessibilityRole="button" style={styles.change}>
              <Text variant="captionStrong" color="link" style={styles.changeText}>
                {outletId ? 'Change' : 'Choose'}
              </Text>
            </PressableScale>
          )}
        </View>
        {errors.outlet ? (
          <Text variant="caption" color="danger" style={styles.inlineError}>
            {errors.outlet}
          </Text>
        ) : null}
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <View style={styles.visitedRow}>
          <Text variant="subhead" color="ink2">
            Visited
          </Text>
          <Text variant="subhead" style={styles.strong}>
            Today, {formatTime(visitedAt)}
          </Text>
        </View>
      </Card>

      {stamp ? (
        <StampedCard stamp={stamp} distance={distance} onAgain={doStamp} busy={stamping} note="Location saved with this visit" />
      ) : (
        <StampButton onPress={doStamp} busy={stamping} hint="We only store your GPS location when you stamp this form." />
      )}

      <Text variant="label" color="ink2" style={styles.sectionLabel} accessibilityRole="header">
        The visit
      </Text>
      <Card padded style={styles.formCard}>
        <TextField label="What happened" value={what} onChangeText={setWhat} multiline error={errors.what} placeholder="Who you met and what you talked about" />
        <TextField label="Problem" optional value={problem} onChangeText={setProblem} placeholder="Anything that went wrong" />
        <TextField label="Advice or opportunity" optional value={advice} onChangeText={setAdvice} placeholder="A chance to sell more, or a tip" />
        <SwitchRow label="They need support" hint="Your manager sees it in Review." value={support} onChange={setSupport} />
        {support ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <TextField label="What support?" value={supportNeeded} onChangeText={setSupportNeeded} error={errors.support} placeholder="For example: check the grinder" />
          </Animated.View>
        ) : null}
      </Card>

      {taskId ? (
        <>
          <Text variant="label" color="ink2" style={styles.sectionLabel} accessibilityRole="header">
            Sales
          </Text>
          <Card padded style={[styles.formCard, styles.salesRow]}>
            <View style={styles.flex}>
              <TextField
                label="Sales amount"
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
              <TextField label="Invoice no." value={invoice} onChangeText={setInvoice} autoCapitalize="characters" mono placeholder="INV-0000" />
            </View>
          </Card>
          <Text variant="footnote" color="ink2" style={styles.salesHint}>
            These go on the task when you mark it as done.
          </Text>
        </>
      ) : null}

      <Text variant="label" color="ink2" style={styles.sectionLabel} accessibilityRole="header">
        Photos
      </Text>
      <View style={styles.photos}>
        <PhotoStrip photos={photos} onChange={setPhotos} size={104} />
      </View>

      <Text variant="label" color="ink2" style={styles.sectionLabel} accessibilityRole="header">
        Follow-up
      </Text>
      <Card style={styles.formCardFlat}>
        <DateField row label="Next visit" value={nextVisit} onChange={setNextVisit} minimumDate={new Date()} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <View style={styles.planWrap}>
          <TextField label="Plan" value={plan} onChangeText={setPlan} error={errors.plan} placeholder="For example: bring oat milk" />
        </View>
      </Card>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fonts.semibold },
  banner: { marginTop: 6, marginHorizontal: space.gutter, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  block: { marginTop: 12, marginHorizontal: space.gutter, borderRadius: radius.card },
  outletRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  emptyTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  change: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  changeText: { fontSize: 15 },
  inlineError: { marginHorizontal: 16, marginBottom: 8 },
  divider: { height: 1, marginLeft: 16 },
  visitedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  sectionLabel: { marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  formCard: { marginHorizontal: space.gutter, borderRadius: radius.card, gap: 16 },
  formCardFlat: { marginHorizontal: space.gutter, borderRadius: radius.card },
  salesRow: { flexDirection: 'row', gap: 12 },
  rm: { marginRight: 6 },
  salesHint: { marginHorizontal: 20, marginTop: 6 },
  photos: { marginHorizontal: space.gutter },
  planWrap: { padding: 16 },
});
