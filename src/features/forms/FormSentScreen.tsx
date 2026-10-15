import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Tag } from '../../components/Chips';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { Text } from '../../components/Text';
import { riseIn } from '../../motion/curves';
import { DoneRing } from '../../motion/DoneRing';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

const COPY = {
  sent: { title: 'Sent', ring: 'Form sent' },
  changed: { title: 'Changes saved', ring: 'Changes saved' },
  stage: { title: 'Your part is sent', ring: 'Your part is sent' },
} as const;

/** The form went through: the ring closes, and the record is one tap away. */
export function FormSentScreen({ route, navigation }: RootScreenProps<'FormSent'>) {
  const { recordId, title, formName, formId, kind, next } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const short = useWindowDimensions().height < 760;
  const reduced = useReducedMotion();
  // After the ring has closed, one after another.
  const enter = (i: number) => (reduced ? undefined : riseIn(500 + i * 110, 360));

  const sub =
    kind === 'stage'
      ? 'Thank you. The next step can start now.'
      : kind === 'changed'
        ? 'People now see your new answers.'
        : next
          ? `Next: ${next.charAt(0).toLowerCase()}${next.slice(1)}. You can change your answers until someone acts on it.`
          : 'It is saved in My records.';

  // A step or a change starts from this record: go back to it, not to a copy
  // stacked on top (whose back link would lead here again).
  const openRecord = () => {
    const state = navigation.getState();
    const prev = state.routes[state.index - 1];
    if (prev?.name === 'Record' && (prev.params as { id?: number } | undefined)?.id === recordId) navigation.goBack();
    else navigation.replace('Record', { id: recordId!, title });
  };

  return (
    // Scrolls when it does not fit (a short phone, large text); otherwise the buttons sit at the bottom.
    <ScrollView
      style={{ backgroundColor: colors.scheme === 'dark' ? colors.ground : colors.panel }}
      contentContainerStyle={[styles.fill, { paddingTop: insets.top + (short ? 28 : 70), paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.center}>
        <DoneRing size={120} accessibilityLabel={COPY[kind].ring} />
        <Animated.View entering={enter(0)}>
          <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>
            {COPY[kind].title}
          </Text>
          <Text variant="body" color="ink2" align="center" style={styles.sub}>
            {sub}
          </Text>
        </Animated.View>
      </View>

      {recordId ? (
        <Animated.View entering={enter(1)}>
          <PressableScale
            onPress={openRecord}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${formName}. Open the record`}
            style={[styles.card, { backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.ground }]}
          >
            <View style={styles.flex}>
              <Text variant="rowTitle">{title}</Text>
              <Text variant="subhead" color="ink2">
                {formName}
              </Text>
              {kind === 'sent' && next ? (
                <View style={styles.tag}>
                  <Tag size="large" text="In review" ink={colors.status.new.ink} bg={colors.status.new.bg} dot={colors.status.new.dot} />
                </View>
              ) : null}
            </View>
            <Icon name="chevronRight" size={20} color={colors.chevron} strokeWidth={2.2} />
          </PressableScale>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(2)} style={styles.bottom}>
        <Button label="Done" onPress={() => navigation.goBack()} />
        {kind === 'sent' ? <Button label="Fill in another" variant="ghost" onPress={() => navigation.replace('FillForm', { formId })} /> : null}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, paddingHorizontal: space.gutter },
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', paddingHorizontal: 12 },
  title: { marginTop: 24 },
  sub: { marginTop: 8, fontSize: 17, lineHeight: 25 },
  card: { marginTop: 32, borderRadius: radius.card, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tag: { marginTop: 10 },
  // The buttons sit where every bottom bar puts them, a little further in than the cards.
  bottom: { marginTop: 'auto', paddingTop: 20, gap: 6, marginHorizontal: space.side - space.gutter },
});
