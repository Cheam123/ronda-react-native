import { useNavigation } from '@react-navigation/native';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Platform, RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { Extrapolation, interpolate, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../lib/haptics';
import { useTabBarSpace } from '../navigation/TabBar';
import { usePreviousTitle } from '../navigation/usePreviousTitle';
import { useColors } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

const COLLAPSE_AT = 44;

/**
 * Pull to refresh. The ring answers a pull only and stays until that fetch
 * settles; a refetch the app starts on its own (coming back to the app, after
 * a save) stays quiet.
 */
function usePullToRefresh(onRefresh?: () => Promise<unknown>) {
  const [pulled, setPulled] = useState(false);
  const pull = () => {
    if (!onRefresh) return;
    haptic.light();
    setPulled(true);
    onRefresh()
      .catch(() => undefined)
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
          data={list.data as T[]}
          keyExtractor={list.keyExtractor}
          renderItem={({ item, index }) => list.renderItem(item, index)}
          ListHeaderComponent={top}
          ListFooterComponent={list.footer ? <>{list.footer}</> : null}
          itemLayoutAnimation={list.animateRows ? LinearTransition.duration(300) : undefined}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={contentContainerStyle}
          refreshControl={refreshControl}
        />
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={contentContainerStyle} refreshControl={refreshControl}>
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

  const body = (
    <>
      {top}
      {children}
    </>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.ground, paddingTop: insets.top }]}>
      {list ? (
        <Animated.FlatList
          data={list.data as T[]}
          keyExtractor={list.keyExtractor}
          renderItem={({ item, index }) => list.renderItem(item, index)}
          ListHeaderComponent={body}
          ListFooterComponent={list.footer ? <>{list.footer}</> : null}
          itemLayoutAnimation={list.animateRows ? LinearTransition.duration(300) : undefined}
          refreshControl={refresh}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
        />
      ) : keyboard ? (
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}>
          {body}
        </KeyboardAwareScrollView>
      ) : (
        <Animated.ScrollView refreshControl={refresh} keyboardShouldPersistTaps="handled" contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}>
          {body}
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, minHeight: 48 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 48, paddingRight: 8, maxWidth: '70%' },
  backLabel: { fontFamily: 'InstrumentSans_500Medium', fontSize: 17 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6, minHeight: 52 },
  modalSide: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  modalRight: { alignItems: 'flex-end' },
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
