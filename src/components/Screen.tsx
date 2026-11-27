import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { Platform, RefreshControl, StyleSheet, View, type FlatList, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import Animated, { Extrapolation, interpolate, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '../api/client';
import { haptic } from '../lib/haptics';
import { Moving } from '../motion/Moving';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useTabBarSpace } from '../navigation/TabBar';
import { usePreviousTitle } from '../navigation/usePreviousTitle';
import { useColors } from '../theme/ThemeProvider';
import { useUndo } from '../undo/UndoProvider';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

const COLLAPSE_AT = 44;

/**
 * Pull to refresh. The ring answers a pull only and stays until that fetch
 * settles; a refetch the app starts on its own (coming back to the app, after
 * a save) stays quiet. A pull that fails says why, and what was on screen
 * stays there.
 */
function usePullToRefresh(onRefresh?: () => Promise<unknown>) {
  const [pulled, setPulled] = useState(false);
  const { notify } = useUndo();
  const pull = () => {
    if (!onRefresh) return;
    haptic.light();
    setPulled(true);
    onRefresh()
      .then((result) => {
        // refetch() resolves even when it fails; the error is on its result (one, or several from Promise.all).
        const failed = (Array.isArray(result) ? result : [result]).find((r) => !!r && typeof r === 'object' && 'isError' in r && r.isError) as { error: unknown } | undefined;
        if (failed) notify(errorMessage(failed.error), 'error');
      })
      .catch((e) => notify(errorMessage(e), 'error'))
      .finally(() => setPulled(false));
  };
  return { pulled, pull };
}

/**
 * A long list in a screen. Only the rows on screen are drawn (a FlatList),
 * so a list of hundreds scrolls as smoothly as one of ten. Everything else
 * the screen shows (title, search, chips) scrolls above the rows.
 */
export interface ScreenList<T> {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactElement | null;
  /** Under the rows (a "show more" button, a link). */
  footer?: ReactNode;
  /** Rows slide into place when one leaves (quick-complete). */
  animateRows?: boolean;
}

interface TabScreenProps<T> {
  /** The large title; it folds into the top bar as the list scrolls. */
  title?: string;
  /** What the top bar says once the title has folded (defaults to the title). */
  compactTitle?: string;
  /** Shown above the large title (the date and the round buttons on Today). */
  header?: ReactNode;
  /** Buttons on the right of the large title (search, map, add). */
  titleAccessory?: ReactNode;
  children: ReactNode;
  /** Pull to refresh; return the fetch, so the ring stays until it is done. */
  onRefresh?: () => Promise<unknown>;
  /** Something pinned over the content (an Undo toast). */
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Rows drawn as they come on screen; children then sit above them. */
  list?: ScreenList<T>;
}

/** A tab's root screen: large title that collapses on scroll, room for the floating bar. */
export function TabScreen<T = never>({ title, compactTitle, header, titleAccessory, children, onRefresh, overlay, contentStyle, list }: TabScreenProps<T>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  // Tapping the tab you are on scrolls back to the top, as on iOS.
  const scroller = useRef<FlatList<T> & ScrollView>(null);
  useScrollToTop(scroller);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [COLLAPSE_AT - 12, COLLAPSE_AT + 8], [0, 1], Extrapolation.CLAMP),
  }));
  const bigStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, COLLAPSE_AT], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(y.value, [0, COLLAPSE_AT], [1, 0.92], Extrapolation.CLAMP) }],
  }));

  const { pulled, pull } = usePullToRefresh(onRefresh);
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={pulled}
      onRefresh={pull}
      tintColor={colors.brand}
      colors={[colors.brand]}
      progressBackgroundColor={colors.panel}
      progressViewOffset={insets.top}
    />
  ) : undefined;
  const contentContainerStyle = [{ paddingTop: insets.top + 14, paddingBottom: bottomSpace }, contentStyle];
  const top = (
    <>
      {header ? <View style={styles.header}>{header}</View> : null}
      {title ? (
        <View style={styles.titleRow}>
          <Animated.View style={[styles.titleWrap, bigStyle]}>
            <Text variant="largeTitle" accessibilityRole="header">
              {title}
            </Text>
          </Animated.View>
          {titleAccessory ? <View style={styles.accessory}>{titleAccessory}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.ground }]}>
      {list ? (
        <Animated.FlatList
          ref={scroller}
          data={list.data as T[]}
          keyExtractor={list.keyExtractor}
          renderItem={({ item, index }) => list.renderItem(item, index)}
          ListHeaderComponent={top}
          ListFooterComponent={list.footer ? <>{list.footer}</> : null}
          itemLayoutAnimation={list.animateRows ? LinearTransition.duration(300) : undefined}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          // Scrolling the list puts the keyboard away (a search box at the top).
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          refreshControl={refreshControl}
        />
      ) : (
        <Animated.ScrollView
          ref={scroller}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          refreshControl={refreshControl}
        >
          {top}
        </Animated.ScrollView>
      )}

      {/* Always behind the status bar, so content never slides under the clock before the compact bar fades in. */}
      <View pointerEvents="none" style={[styles.statusShield, { height: insets.top, backgroundColor: colors.ground }]} />
      {title ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.compact,
            // Solid, like the bottom bar: no blur, so see-through would show text under the title.
            { paddingTop: insets.top, backgroundColor: colors.ground, borderBottomColor: colors.line },
            barStyle,
          ]}
          importantForAccessibility="no-hide-descendants"
        >
          <Text variant="bodyStrong" style={styles.compactTitle} numberOfLines={1}>
            {compactTitle ?? title}
          </Text>
        </Animated.View>
      ) : null}
      {overlay}
    </View>
  );
}

interface DetailScreenProps<T> {
  /** Label of the back link: the screen you came from. */
  backLabel?: string;
  /** Right side of the top row (a More button, a reference). */
  topRight?: ReactNode;
  children: ReactNode;
  /** Main actions, pinned at the bottom (rule 5). */
  bottomBar?: ReactNode;
  /** Pull to refresh; return the fetch, so the ring stays until it is done. */
  onRefresh?: () => Promise<unknown>;
  overlay?: ReactNode;
  /** Use the keyboard-aware scroll view (forms). */
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Replace the back link with a "Cancel / Title / action" row. */
  modalHeader?: { title: string; onCancel: () => void; cancelLabel?: string; action?: { label: string; onPress: () => void; disabled?: boolean } };
  /** Rows drawn as they come on screen; children then sit above them. */
  list?: ScreenList<T>;
  /** From useFieldScroll: lets a form bring the field to fix into view (keyboard forms only). */
  fieldScroll?: FieldScroll;
}

export interface FieldScroll {
  ref: RefObject<KeyboardAwareScrollViewRef | null>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Spread on the View around a field, named by the key its error uses. Not collapsable, so Android keeps a view to measure. */
  anchor: (key: string) => { ref: (node: View | null) => void; collapsable: false };
  /** Scroll so the first of these keys that has a field sits near the top. */
  show: (keys: string[]) => void;
}

/**
 * A form that fails its checks scrolls to the first field to fix, as FillForm
 * does a step at a time, so a rep who taps Submit at the bottom sees why.
 * Fields sit inside cards, so their place is measured on screen.
 */
export function useFieldScroll(): FieldScroll {
  const reduced = useReducedMotion();
  const ref = useRef<KeyboardAwareScrollViewRef>(null);
  const offset = useRef(0);
  const nodes = useRef(new Map<string, View>());
  return useMemo(
    () => ({
      ref,
      onScroll: (e) => {
        offset.current = e.nativeEvent.contentOffset.y;
      },
      anchor: (key) => ({
        ref: (node) => {
          if (node) nodes.current.set(key, node);
          else nodes.current.delete(key);
        },
        collapsable: false,
      }),
      show: (keys) => {
        const node = keys.map((k) => nodes.current.get(k)).find(Boolean);
        const scroller = ref.current as unknown as (View & KeyboardAwareScrollViewRef) | null;
        if (!node || !scroller) return;
        scroller.measureInWindow((_x, top) => {
          node.measureInWindow((_fx, y) => {
            scroller.scrollTo({ y: Math.max(0, offset.current + y - top - 24), animated: !reduced });
          });
        });
      },
    }),
    [reduced],
  );
}

/** A pushed screen: back link, no tab bar, actions at the bottom. */
export function DetailScreen<T = never>({
  backLabel,
  topRight,
  children,
  bottomBar,
  onRefresh,
  overlay,
  keyboard = false,
  contentStyle,
  modalHeader,
  list,
  fieldScroll,
}: DetailScreenProps<T>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const previous = usePreviousTitle();
  // Name the link after the screen it goes back to; the screen's guess is the fallback.
  const back = previous ?? (backLabel && backLabel !== 'Back' ? backLabel : null);
  const bottomPad = bottomBar ? 120 + insets.bottom : 32 + insets.bottom;

  const top = modalHeader ? (
    <View style={styles.modalHeader}>
      <PressableScale onPress={modalHeader.onCancel} accessibilityLabel={modalHeader.cancelLabel ?? 'Cancel'} style={styles.modalSide}>
        <Text variant="body" color="link" style={styles.link}>
          {modalHeader.cancelLabel ?? 'Cancel'}
        </Text>
      </PressableScale>
      <Text variant="bodyStrong" accessibilityRole="header" align="center" style={styles.modalTitle} numberOfLines={2}>
        {modalHeader.title}
      </Text>
      <View style={[styles.modalSide, styles.modalRight]}>
        {modalHeader.action ? (
          <PressableScale
            onPress={modalHeader.action.disabled ? undefined : modalHeader.action.onPress}
            accessibilityLabel={modalHeader.action.label}
            accessibilityState={{ disabled: !!modalHeader.action.disabled }}
            style={styles.modalAction}
          >
            <Text variant="bodyStrong" color="link" style={[styles.link, modalHeader.action.disabled && { opacity: 0.45 }]}>
              {modalHeader.action.label}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  ) : (
    <View style={styles.topRow}>
      {navigation.canGoBack() ? (
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel={back ? `Back to ${back}` : 'Back'} style={styles.back}>
          <Icon name="chevronLeft" size={26} color={colors.link} strokeWidth={2.2} />
          <Text variant="body" color="link" style={styles.backLabel} numberOfLines={1}>
            {back ?? 'Back'}
          </Text>
        </PressableScale>
      ) : (
        <View />
      )}
      {topRight}
    </View>
  );

  const { pulled, pull } = usePullToRefresh(onRefresh);
  const refresh = onRefresh ? (
    <RefreshControl
      refreshing={pulled}
      onRefresh={pull}
      tintColor={colors.brand}
      colors={[colors.brand]}
      progressBackgroundColor={colors.panel}
    />
  ) : undefined;

  // The back link (or Cancel / Save) stays pinned at the top, as an iOS bar does,
  // instead of scrolling away with the page; a hairline fades in under it once
  // the content passes beneath. At rest the screen looks as it did.
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const edge = useDerivedValue(() => interpolate(y.value, [0, 12], [0, 1], Extrapolation.CLAMP));

  return (
    <View style={[styles.fill, { backgroundColor: colors.ground, paddingTop: insets.top }]}>
      <View style={[styles.pinned, { backgroundColor: colors.ground }]}>
        {top}
        {/* Through Moving, so a re-render of the screen never resets the line while it is scrolled. */}
        <Moving value={edge} kind="fade" pointerEvents="none" style={[styles.pinnedEdge, { backgroundColor: colors.line }]} />
      </View>
      {list ? (
        <Animated.FlatList
          data={list.data as T[]}
          keyExtractor={list.keyExtractor}
          renderItem={({ item, index }) => list.renderItem(item, index)}
          ListHeaderComponent={<>{children}</>}
          ListFooterComponent={list.footer ? <>{list.footer}</> : null}
          itemLayoutAnimation={list.animateRows ? LinearTransition.duration(300) : undefined}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={refresh}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
        />
      ) : keyboard ? (
        <KeyboardAwareScrollView
          ref={fieldScroll?.ref}
          onScroll={(e) => {
            fieldScroll?.onScroll(e);
            y.set(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={refresh}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
        >
          {children}
        </Animated.ScrollView>
      )}
      {bottomBar ? <BottomBar>{bottomBar}</BottomBar> : null}
      {overlay}
    </View>
  );
}

/** The frosted strip that holds a screen's main actions. onPanel: over a white screen (a form being filled in). */
export function BottomBar({ children, onPanel = false }: { children: ReactNode; onPanel?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bottomBar,
        {
          paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'ios' ? 0 : 4),
          // Solid: without a blur behind it, a see-through bar shows the list's text under its own.
          backgroundColor: onPanel && colors.scheme !== 'dark' ? colors.panel : colors.ground,
          borderTopColor: colors.scheme === 'dark' ? colors.divider : onPanel ? 'rgba(16,24,40,0.08)' : 'rgba(16,24,40,0.06)',
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  titleWrap: { flex: 1, transformOrigin: 'left bottom' },
  accessory: { flexDirection: 'row', gap: 8 },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: { paddingVertical: 11, fontSize: 17 },
  statusShield: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Above the scroll view, so the content slides under it; zIndex keeps it over a row that is pressed or animating.
  pinned: { zIndex: 1 },
  pinnedEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, minHeight: 48 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, paddingRight: 8, maxWidth: '70%' },
  backLabel: { fontFamily: 'InstrumentSans_500Medium', fontSize: 17 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6, minHeight: 52 },
  modalSide: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  modalRight: { alignItems: 'flex-end' },
  // The whole side is the target, as Cancel's is: 48 tall, not just the word.
  modalAction: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  modalTitle: { flex: 2, fontSize: 17 },
  link: { fontSize: 17, lineHeight: 22 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
  },
});
