import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { memo, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { GLIDE } from '../motion/curves';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Icon, RingIcon, type IconName } from '../components/Icon';
import { Text } from '../components/Text';
import { haptic } from '../lib/haptics';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useColors } from '../theme/ThemeProvider';
import { RecordButton } from './RecordButton';

/** Icon per tab route. Today and Team use the Ronda ring. */
const TAB_ICONS: Record<string, IconName | 'ring'> = {
  Today: 'ring',
  Team: 'ring',
  Outlets: 'outlets',
  Tasks: 'tasks',
  MgrTasks: 'tasks',
  Review: 'review',
  Forms: 'forms',
};

/** Above this text size the labels drop and the icons grow (TodayLarge board). */
const LARGE_TEXT = 1.35;

/** Height of the floating bar plus its gap to the screen edge, for content padding. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return (fontScale > LARGE_TEXT ? 72 : 64) + Math.max(insets.bottom + 4, 20) + 24;
}

export function TabBar({ state, descriptors, navigation, withRecord }: BottomTabBarProps & { withRecord: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const large = fontScale > LARGE_TEXT;
  const height = large ? 72 : 64;
  const bottom = Math.max(insets.bottom + 4, 20);
  const fadeHeight = bottom + height + 32;
  const count = state.routes.length;

  // The capsule follows the tab's index, in percent of the bar, so it never
  // depends on a measured width. It is drawn by its own memoised component:
  // when the bar re-renders for anything else (a badge, a refetch), React
  // would otherwise put the capsule back where it was first drawn.
  const at = useSharedValue(state.index);
  useEffect(() => {
    at.value = reduced ? state.index : withSpring(state.index, GLIDE);
  }, [state.index, reduced, at]);

  const isDark = colors.scheme === 'dark';
  // A real blur on iOS; Android gets a solid bar (the blur needs a target view there).
  // Fully solid: without the blur, text under a see-through bar shows sharp.
  const solidBg = isDark ? '#1A2230' : '#FFFFFF';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* As on the board: the fade starts 32 pt above the bar and is full only behind it. */}
      <Svg pointerEvents="none" style={[styles.fade, { height: fadeHeight }]} width="100%" height={fadeHeight}>
        <Defs>
          <LinearGradient id="tabfade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.ground} stopOpacity={0} />
            <Stop offset="0.55" stopColor={colors.ground} stopOpacity={0.92} />
            <Stop offset="1" stopColor={colors.ground} stopOpacity={0.92} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tabfade)" />
      </Svg>

      <View pointerEvents="box-none" style={[styles.row, { bottom, height }]}>
        <View
          accessibilityRole="tablist"
          style={[
            styles.bar,
            {
              height,
              borderRadius: height / 2,
              shadowOpacity: isDark ? 0.5 : 0.14,
              borderColor: colors.tabBar.ring,
              backgroundColor: Platform.OS === 'ios' ? 'transparent' : solidBg,
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: height / 2 }]}>
              <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar.bg }]} />
            </View>
          ) : null}

          {/* Remounted on a new colour or size, so it starts from the current tab. */}
          <Capsule key={`${colors.tabBar.capsule}-${count}-${height}`} at={at} count={count} color={colors.tabBar.capsule} radius={(height - 8) / 2} />

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const badge = options.tabBarBadge;
            const tint = focused ? colors.tabBar.active : colors.tabBar.inactive;
            const iconName = TAB_ICONS[route.name] ?? 'tasks';
            const iconSize = large ? 30 : 24;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic.selection();
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                style={({ pressed }) => [styles.tab, pressed && { transform: [{ scale: 0.92 }] }]}
              >
                <View>
                  {iconName === 'ring' ? (
                    <RingIcon size={iconSize} color={tint} dot={focused ? colors.coral : tint} strokeWidth={focused ? 2.2 : 1.9} />
                  ) : (
                    <Icon name={iconName} size={iconSize} color={tint} strokeWidth={focused ? 2.2 : 1.9} />
                  )}
                  {badge !== undefined && badge !== null && badge !== '' && badge !== 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.tabBar.badge }]}>
                      <Text variant="tab" color="#FFFFFF" allowFontScaling={false} style={styles.badgeText}>
                        {String(badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {large ? null : (
                  <Text
                    variant="tab"
                    color={tint}
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{ fontFamily: focused ? 'InstrumentSans_700Bold' : 'InstrumentSans_600SemiBold' }}
                  >
                    {label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
        {withRecord ? <RecordButton size={height} /> : null}
      </View>
    </View>
  );
}

const Capsule = memo(function Capsule({ at, count, color, radius }: { at: SharedValue<number>; count: number; color: string; radius: number }) {
  const place = useAnimatedStyle(() => ({ left: `${(at.value * 100) / count}%` }));
  return (
    <View pointerEvents="none" style={styles.track}>
      <Animated.View style={[styles.capsule, { width: `${100 / count}%`, backgroundColor: color, borderRadius: radius }, place]} />
    </View>
  );
});

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: {
    flex: 1,
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 10,
  },
  clip: { overflow: 'hidden' },
  // The tabs' area inside the bar's 4 pt padding; the capsule moves along it.
  track: { position: 'absolute', top: 4, bottom: 4, left: 4, right: 4 },
  capsule: { position: 'absolute', top: 0, bottom: 0 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  badge: {
    position: 'absolute',
    top: -4,
    left: 16,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'InstrumentSans_700Bold', fontSize: 11, lineHeight: 14 },
});
