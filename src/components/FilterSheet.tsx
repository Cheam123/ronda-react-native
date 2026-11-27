import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { haptic } from '../lib/haptics';
import { tickIn } from '../motion/curves';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Sheet, SheetGroup, type SheetHandle } from './Sheet';
import { Text } from './Text';

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

interface FilterSheetProps<K extends string> {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** The sheet's title ("Show outlets"); the button is read as "Show outlets: Customers". */
  title: string;
}

/** How long the tick shows on the chosen row before the sheet goes, as in the status sheet. */
const TICK_MS = 160;

/**
 * A round button beside a tab's title that opens a bottom sheet of the lists
 * it can show, each with its count and a tick on the one on screen. Choosing
 * one switches the list behind the sheet, lands the tick, then closes. The
 * same grouped sheet as the status sheet, in thumb reach.
 */
export function FilterSheet<K extends string>({ options, value, onChange, title }: FilterSheetProps<K>) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const sheet = useRef<SheetHandle>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<K | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const chosen = options.find((o) => o.key === value) ?? options[0];
  // Any choice but the first narrows the list: the button stays lit, so it is not forgotten.
  const narrowed = value !== options[0]?.key;
  const isDark = colors.scheme === 'dark';

  const show = () => {
    haptic.selection();
    setPicked(null);
    setOpen(true);
    sheet.current?.open();
  };
  const choose = useCallback(
    (key: K) => {
      if (timer.current) return;
      if (key === value) {
        // The list already on screen: nothing to change.
        sheet.current?.close();
        return;
      }
      haptic.selection();
      setPicked(key);
      onChange(key);
      timer.current = setTimeout(
        () => {
          timer.current = null;
          sheet.current?.close();
        },
        reduced ? 0 : TICK_MS,
      );
    },
    [onChange, reduced, value],
  );

  return (
    <>
      <PressableScale
        onPress={show}
        scaleTo={0.92}
        hitSlop={4}
        accessibilityLabel={`${title}: ${chosen?.label ?? ''}`}
        accessibilityHint="Opens the lists you can choose"
        accessibilityState={{ expanded: open }}
        style={[
          styles.button,
          {
            backgroundColor: open || narrowed ? colors.pressedRaised : isDark ? colors.raised : colors.panel,
            borderColor: colors.cardRing,
          },
        ]}
      >
        <Icon name="filter" size={20} color={colors.body} strokeWidth={2.2} />
      </PressableScale>
      <Sheet
        ref={sheet}
        title={title}
        grouped
        fit
        onDismiss={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          setPicked(null);
          setOpen(false);
        }}
      >
        <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.groups}>
          <SheetGroup>
            {options.map((o, i) => (
              <FilterRow
                key={o.key}
                option={o}
                on={(picked ?? value) === o.key}
                landed={picked === o.key}
                last={i === options.length - 1}
                onPress={() => choose(o.key)}
              />
            ))}
          </SheetGroup>
        </View>
      </Sheet>
    </>
  );
}

/** One list to show: its name, its count, and the tick when it is the one. */
function FilterRow<K extends string>({ option, on, landed, last, onPress }: { option: FilterOption<K>; on: boolean; landed: boolean; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={option.count !== undefined ? `${option.label}, ${option.count}` : option.label}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressedRaised }]}
      >
        <Text variant="body" style={[styles.label, on && styles.labelOn]}>
          {option.label}
        </Text>
        {option.count !== undefined ? (
          <Text variant="subhead" color="muted">
            {option.count}
          </Text>
        ) : null}
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

const ROW_SIDE = 16;

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  groups: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 14, paddingHorizontal: ROW_SIDE },
  label: { flex: 1, minWidth: 0, fontSize: 17, lineHeight: 23 },
  labelOn: { fontFamily: 'InstrumentSans_600SemiBold' },
  tickSlot: { width: 24, alignItems: 'center' },
  // iOS-style inset: the line starts under the name.
  separator: { height: 1, marginLeft: ROW_SIDE },
});
