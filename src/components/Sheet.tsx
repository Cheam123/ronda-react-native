import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE_OUT } from '../motion/curves';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface SheetHandle {
  open: () => void;
  close: () => void;
}

interface SheetProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Two heights: half and full (the "How it feels" board). */
  snapPoints?: (string | number)[];
  /** As tall as its content (up to 92% of the screen), instead of fixed heights: for short action sheets. */
  fit?: boolean;
  /** Opens over another sheet without closing it (a picker that a sheet asks for). */
  stacked?: boolean;
  /** Fixed buttons at the bottom of the sheet. */
  footer?: ReactNode;
  onDismiss?: () => void;
}

/** A sheet that opens halfway; drag up for more room, down to close. */
export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  { title, subtitle, children, snapPoints = ['55%', '92%'], fit = false, stacked = false, footer, onDismiss },
  ref,
) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const modal = useRef<BottomSheetModal>(null);
  const [open, setOpen] = useState(false);
  // Glides up and settles. The default on Android is an exponential ease that
  // covers most of the way in the first frames, so the sheet snaps up instead.
  const animationConfigs = useBottomSheetTimingConfigs({ duration: reduced ? 1 : 320, easing: EASE_OUT });

  // Android back closes the sheet first, instead of leaving the screen under it.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      modal.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  useImperativeHandle(ref, () => ({
    open: () => {
      // Counts as open from the start, so a back press while it slides up closes it too.
      setOpen(true);
      modal.current?.present();
    },
    close: () => modal.current?.dismiss(),
  }));

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={colors.scheme === 'dark' ? 0.6 : 0.42} pressBehavior="close" />
    ),
    [colors.scheme],
  );

  // Buttons stay pinned to the bottom of the sheet at either height.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, borderTopColor: colors.divider },
          ]}
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom, colors],
  );

  return (
    <BottomSheetModal
      ref={modal}
      snapPoints={fit ? undefined : snapPoints}
      enableDynamicSizing={fit}
      stackBehavior={stacked ? 'push' : 'switch'}
      maxDynamicContentSize={fit ? Math.round(windowHeight * 0.92) : undefined}
      backdropComponent={backdrop}
      onChange={(index) => setOpen(index >= 0)}
      onDismiss={() => {
        setOpen(false);
        onDismiss?.();
      }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      animateOnMount={!reduced}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.control, width: 38, height: 5 }}
      accessibilityLabel={title}
      footerComponent={footer ? renderFooter : undefined}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: footer ? 110 + insets.bottom : insets.bottom + 24 }]}>
        {title ? (
          <Text variant="section" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="subhead" color="ink2" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

/** A row of choices inside a sheet (More actions). */
export function SheetAction({ label, hint, onPress, tone = 'ink' }: { label: string; hint?: string; onPress: () => void; tone?: 'ink' | 'danger' }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [styles.action, { borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
    >
      <Text variant="body" color={tone === 'danger' ? 'danger' : 'ink'} style={styles.actionLabel}>
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" color="ink2">
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8 },
  subtitle: { marginTop: 6 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { paddingVertical: 14, borderBottomWidth: 1, minHeight: 52, justifyContent: 'center' },
  actionLabel: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 17, lineHeight: 24 },
});
