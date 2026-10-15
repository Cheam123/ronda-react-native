import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { PressableScale } from '../components/Pressable';
import { Text } from '../components/Text';
import { haptic } from '../lib/haptics';
import { EASE_IN, EASE_OUT } from '../motion/curves';
import { Moving } from '../motion/Moving';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

interface RecordAction {
  key: 'visit' | 'order' | 'form' | 'outlet';
  title: string;
  sub: string;
  icon: IconName;
  tone: 'brand' | 'good' | 'form' | 'serious';
}

const ACTIONS: RecordAction[] = [
  { key: 'visit', title: 'Log a visit', sub: 'With a location stamp', icon: 'visits', tone: 'brand' },
  { key: 'order', title: 'Record an order', sub: 'Products and quantities', icon: 'receipt', tone: 'good' },
  { key: 'form', title: 'Start a form', sub: 'Checks and requests', icon: 'forms', tone: 'form' },
  { key: 'outlet', title: 'Add an outlet', sub: 'A new prospect', icon: 'outlets', tone: 'serious' },
];

/** The round Record button beside the rep's tab bar, and the menu it opens. */
export function RecordButton({ size = 64 }: { size?: number }) {
  const colors = useColors();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);

  // Stable, so the open menu never redraws because of them.
  const close = useCallback(() => setOpen(false), []);
  const pick = useCallback(
    (action: RecordAction['key']) => {
      setOpen(false);
      haptic.selection();
      switch (action) {
        case 'visit':
          navigation.navigate('LogVisit', {});
          break;
        case 'order':
          navigation.navigate('RecordOrder', {});
          break;
        case 'form':
          navigation.navigate('StartForm');
          break;
        case 'outlet':
          navigation.navigate('OutletForm', {});
          break;
      }
    },
    [navigation],
  );

  return (
    <>
      <PressableScale
        onPress={() => {
          haptic.selection();
          setOpen(true);
        }}
        accessibilityLabel="Record"
        accessibilityHint="Log a visit, record an order, start a form or add an outlet"
        scaleTo={0.92}
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.record.bg, shadowOpacity: colors.scheme === 'dark' ? 0.5 : 0.28 },
        ]}
      >
        <Icon name="plus" size={size > 64 ? 32 : 28} color={colors.record.fg} strokeWidth={2.2} />
      </PressableScale>
      <RecordMenu open={open} onClose={close} onPick={pick} buttonSize={size} />
    </>
  );
}

/** Opening: the sheet rises in from the Record button. Closing is quicker. */
const OPEN_MS = 280;
const CLOSE_MS = 170;

function RecordMenu({
  open,
  onClose,
  onPick,
  buttonSize,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (key: RecordAction['key']) => void;
  buttonSize: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { fontScale, height } = useWindowDimensions();
  const bottom = Math.max(insets.bottom + 4, 20);
  const isDark = colors.scheme === 'dark';
  // 0 closed, 1 open. The menu stays mounted until it has animated out: a
  // Modal taken away at once would vanish before anything could move.
  const shown = useSharedValue(0);
  const turn = useDerivedValue(() => shown.value * 45);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      shown.value = withTiming(1, { duration: reduced ? 0 : OPEN_MS, easing: EASE_OUT });
    } else if (mounted) {
      shown.value = withTiming(0, { duration: reduced ? 0 : CLOSE_MS, easing: EASE_IN }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [open, mounted, reduced, shown]);

  const tone = (t: RecordAction['tone']) => colors.tones[t].ink;
  // At very large text the tiles stack into one column.
  const columns = fontScale > 1.35 ? 1 : 2;
  // Redraw the moving parts only for a new look; the value carries on.
  const look = `${colors.scheme}-${columns}`;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Moving value={shown} kind="fade" style={StyleSheet.absoluteFill} contentKey={look}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(16,24,40,0.42)' }]} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Moving>

      <Moving
        value={shown}
        kind="reveal"
        accessibilityViewIsModal
        contentKey={look}
        style={[
          styles.sheet,
          {
            bottom: bottom + buttonSize + 12,
            maxHeight: height - (bottom + buttonSize + 12) - insets.top - 12,
            backgroundColor: isDark ? colors.raised : colors.panel,
            shadowOpacity: isDark ? 0.55 : 0.28,
          },
        ]}
      >
        <Text variant="section" accessibilityRole="header" style={styles.title}>
          Record
        </Text>
        <ScrollView bounces={false} contentContainerStyle={[styles.grid, columns === 1 && styles.gridSingle]}>
          {ACTIONS.map((a) => (
            <View key={a.key} style={columns === 1 ? styles.tileFull : styles.tileHalf}>
              <PressableScale
                onPress={() => onPick(a.key)}
                accessibilityLabel={`${a.title}. ${a.sub}`}
                style={[styles.tile, columns === 2 && styles.tileFill, { backgroundColor: isDark ? colors.raised : colors.ground, borderColor: colors.cardRing, borderWidth: isDark ? 1 : 0 }]}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.panel }]}>
                  <Icon name={a.icon} size={22} color={tone(a.tone)} />
                </View>
                <View>
                  <Text variant="bodyStrong" style={styles.tileTitle}>
                    {a.title}
                  </Text>
                  <Text variant="caption" color="ink2">
                    {a.sub}
                  </Text>
                </View>
              </PressableScale>
            </View>
          ))}
        </ScrollView>
      </Moving>

      {/* The close button sits over the Record button and fades in as the + turns into an x. */}
      <View pointerEvents="box-none" style={[styles.closeRow, { bottom }]}>
        <Moving value={shown} kind="fade" contentKey={look} pointerEvents="box-none">
          <PressableScale
            onPress={onClose}
            accessibilityLabel="Close"
            scaleTo={0.92}
            style={[styles.close, { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2, backgroundColor: isDark ? colors.record.bg : colors.panel }]}
          >
            <Moving value={turn} kind="rotate" contentKey={look}>
              <Icon name="plus" size={28} color={isDark ? colors.record.fg : colors.ink} strokeWidth={2.2} />
            </Moving>
          </PressableScale>
        </Moving>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 12,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 30,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 60,
    elevation: 24,
    // It grows out of the Record button, at the bottom right.
    transformOrigin: 'right bottom',
  },
  title: { marginHorizontal: 4, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridSingle: { flexDirection: 'column' },
  // Two per row: a basis under half leaves room for the gap; grow fills it.
  tileHalf: { flexBasis: '40%', flexGrow: 1 },
  tileFull: { width: '100%' },
  tile: { gap: 10, padding: 14, borderRadius: radius.card, minHeight: 126 },
  // Both tiles in a row as tall as the taller one (a title that wraps).
  tileFill: { flex: 1 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 16, lineHeight: 21 },
  closeRow: { position: 'absolute', right: 16 },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    shadowOpacity: 0.3,
    elevation: 12,
  },
});
