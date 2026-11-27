import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { Sheet, SheetGroup, type SheetHandle } from '../../components/Sheet';
import { StatusSign } from '../../components/StatusSign';
import { Text } from '../../components/Text';
import { haptic } from '../../lib/haptics';
import { statusColors, statusLabel } from '../../lib/taskCopy';
import { RondaRing } from '../../motion/RondaRing';
import { settleIn, tickIn } from '../../motion/curves';
import { useReducedMotion } from '../../motion/useReducedMotion';
import { useColors } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';

/** What choosing a status does: start it, open the Mark as done sheet, or park it (5 s with Undo). */
export type StatusMove = 'start' | 'done' | 'kiv' | 'hold';

export interface StatusChoice {
  move: StatusMove;
  /** The status it moves the task to. */
  status: number;
  hint: string;
}


/** How long the tick shows on the chosen row before the sheet goes, so the choice is seen to land. */
const TICK_MS = 160;

/**
 * The task's status, pinned at the bottom of the task screen in thumb reach.
 * Shows where the task is, in its colour; opens the status sheet.
 */
export function StatusButton({ status, onPress, loading = false, animate = false, style }: { status: number; onPress: () => void; loading?: boolean; animate?: boolean; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const chip = statusColors(colors, status);
  const label = statusLabel(status);
  return (
    <PressableScale
      onPress={loading ? undefined : onPress}
      disabled={loading}
      scaleTo={0.98}
      accessibilityLabel={`Status: ${label}`}
      accessibilityHint="Opens the statuses you can choose"
      accessibilityState={{ busy: loading }}
      style={[styles.button, { backgroundColor: colors.secondary.bg, borderColor: colors.secondary.border }, style]}
    >
      <View style={styles.buttonText}>
        <Text variant="footnote" color="ink2">
          Status
        </Text>
        {/* A change settles in, like the pill at the top; opening the task does not. */}
        <Animated.View key={status} entering={animate ? settleIn() : undefined} style={styles.value}>
          <View style={[styles.dot, { backgroundColor: chip.dot }]} />
          <Text variant="bodyStrong" color={chip.ink} numberOfLines={1} style={styles.valueText}>
            {label}
          </Text>
        </Animated.View>
      </View>
      {loading ? <RondaRing size={22} color={colors.ink2} accessibilityLabel="Changing the status" /> : <Icon name="chevronUpDown" size={20} color={colors.chevron} strokeWidth={2.2} />}
    </PressableScale>
  );
}

interface TaskStatusSheetProps {
  /** Where the task is now: ticked, first in the list. */
  current: number;
  currentHint: string;
  /** Only the statuses this person may move it to. */
  choices: StatusChoice[];
  onPick: (move: StatusMove) => void;
  /** After the sheet has gone: the picked move runs here, so a sheet it opens never stacks on this one. */
  onClosed: () => void;
}

/**
 * The status sheet: a grouped list of the statuses this person can move the
 * task to, the current one ticked. Moving forward (in progress, done) is one
 * group; setting it aside (keep in view, on hold) the other.
 */
export const TaskStatusSheet = forwardRef<SheetHandle, TaskStatusSheetProps>(function TaskStatusSheet({ current, currentHint, choices, onPick, onClosed }, ref) {
  const reduced = useReducedMotion();
  const sheet = useRef<SheetHandle>(null);
  const [picked, setPicked] = useState<StatusMove | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useImperativeHandle(ref, () => ({
    open: () => {
      setPicked(null);
      sheet.current?.open();
    },
    close: () => sheet.current?.close(),
  }));

  const choose = (move: StatusMove | null) => {
    if (timer.current) return;
    if (move === null) {
      // The status it already has: nothing to change.
      sheet.current?.close();
      return;
    }
    haptic.selection();
    setPicked(move);
    onPick(move);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        sheet.current?.close();
      },
      reduced ? 0 : TICK_MS,
    );
  };

  const forward = choices.filter((c) => c.move === 'start' || c.move === 'done');
  const aside = choices.filter((c) => c.move === 'kiv' || c.move === 'hold');
  const rows = [{ move: null, status: current, hint: currentHint }, ...forward];

  return (
    <Sheet
      ref={sheet}
      title="Status"
      grouped
      fit
      onDismiss={() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setPicked(null);
        onClosed();
      }}
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Status" style={styles.groups}>
        <SheetGroup>
          {rows.map((r, i) => (
            <StatusRow key={r.status} status={r.status} hint={r.hint} on={picked ? r.move === picked : r.move === null} landed={!!picked && r.move === picked} last={i === rows.length - 1} onPress={() => choose(r.move)} />
          ))}
        </SheetGroup>
        {aside.length ? (
          <SheetGroup>
            {aside.map((r, i) => (
              <StatusRow key={r.status} status={r.status} hint={r.hint} on={r.move === picked} landed={r.move === picked} last={i === aside.length - 1} onPress={() => choose(r.move)} />
            ))}
          </SheetGroup>
        ) : null}
      </View>
    </Sheet>
  );
});

/** One status: its grey sign, its name, a plain hint, and the tick when it is the one. No tinted tile. */
function StatusRow({ status, hint, on, landed, last, onPress }: { status: number; hint: string; on: boolean; landed: boolean; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const label = statusLabel(status);
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${label}. ${hint}`}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressedRaised }]}
      >
        <StatusSign status={status} size={SIGN} knock={colors.raised} />
        <View style={styles.rowText}>
          <Text variant="body" style={[styles.rowLabel, on && styles.rowLabelOn]}>
            {label}
          </Text>
          <Text variant="caption" color="ink2">
            {hint}
          </Text>
        </View>
        <View style={styles.tickSlot}>
          {on ? (
            <Animated.View entering={landed && !reduced ? tickIn() : undefined}>
              <Icon name="check" size={22} color={colors.ink} strokeWidth={2.6} />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
      {last ? null : <View style={[styles.separator, { backgroundColor: colors.dividerRaised }]} />}
    </View>
  );
}

const SIGN = 22;
const ROW_SIDE = 16;
const ROW_GAP = 14;

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: radius.button, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 },
  buttonText: { flex: 1, minWidth: 0 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  valueText: { flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  groups: { marginTop: 16, gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, minHeight: 64, paddingVertical: 11, paddingHorizontal: ROW_SIDE },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 17, lineHeight: 23 },
  rowLabelOn: { fontFamily: 'InstrumentSans_600SemiBold' },
  tickSlot: { width: 24, alignItems: 'center' },
  // iOS-style inset: the line starts under the name, not under the sign.
  separator: { height: 1, marginLeft: ROW_SIDE + SIGN + ROW_GAP },
});
