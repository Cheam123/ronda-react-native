import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { riseIn } from '../../motion/curves';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { askRonda, draftFollowUp, type ChatTurn } from '../../api/assistant';
import { errorMessage, isApiError } from '../../api/client';
import { fetchOutlet, outletKeys } from '../../api/outlets';
import { Icon, RingIcon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { Segmented } from '../../components/Segmented';
import { Text } from '../../components/Text';
import { messageNumber } from '../../lib/contact';
import { haptic } from '../../lib/haptics';
import { RondaRing } from '../../motion/RondaRing';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { fonts } from '../../theme/type';

type Entry =
  | { kind: 'user'; text: string }
  | { kind: 'answer'; text: string }
  | { kind: 'draft'; topic: Topic };

type Topic = 'last_visit' | 'last_order' | 'suggested';

const STARTERS = ['What should I raise today?', 'What did they order last month?', 'Any open problems here?'];
const TOPICS: { key: Topic; label: string }[] = [
  { key: 'last_visit', label: 'After the visit' },
  { key: 'last_order', label: 'After the order' },
  { key: 'suggested', label: 'Suggested products' },
];

/** Questions about one outlet, answered by Claude from that outlet's records. */
export function AskRondaScreen({ route, navigation }: RootScreenProps<'AskRonda'>) {
  const { id, name } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const outlet = useQuery({ queryKey: outletKeys.detail(id), queryFn: () => fetchOutlet(id) });

  const history = (): ChatTurn[] =>
    entries.flatMap<ChatTurn>((e) => (e.kind === 'user' ? [{ role: 'user', content: e.text }] : e.kind === 'answer' ? [{ role: 'assistant', content: e.text }] : []));

  const ask = useMutation({
    mutationFn: (question: string) => askRonda(id, [...history(), { role: 'user', content: question }]),
    onSuccess: (reply) => {
      haptic.light();
      setEntries((e) => [...e, { kind: 'answer', text: reply }]);
    },
    onError: (e, question) => {
      if (isApiError(e) && e.status === 503 && /not set up/i.test(e.message)) setUnavailable(e.message);
      setEntries((list) => list.filter((x, i) => !(i === list.length - 1 && x.kind === 'user' && x.text === question)));
      setDraft(question);
      haptic.error();
      if (!(isApiError(e) && e.status === 503 && /not set up/i.test(e.message))) setUnavailable(errorMessage(e));
    },
  });

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setDraft('');
    setUnavailable(null);
    setEntries((e) => [...e, { kind: 'user', text: q }]);
    ask.mutate(q);
  };

  const startDraft = () => {
    haptic.selection();
    setEntries((e) => [...e, { kind: 'user', text: 'Draft a follow-up message' }, { kind: 'draft', topic: 'last_visit' }]);
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <View style={[styles.mark, { backgroundColor: colors.brandTint }]}>
          <RingIcon size={24} color={colors.brand} dot={colors.coral} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong" accessibilityRole="header" style={styles.headTitle}>
            Ask Ronda
          </Text>
          <Text variant="footnote" color="ink2" numberOfLines={1}>
            About {name ?? 'this outlet'}
          </Text>
        </View>
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Close" style={[styles.close, { backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.divider }]}>
          <Icon name="close" size={18} color={colors.ink2} strokeWidth={2.4} />
        </PressableScale>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.thread} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: !reduced })} keyboardShouldPersistTaps="handled">
        {entries.length === 0 ? (
          <Text variant="subhead" color="ink2" style={styles.intro}>
            Ask about this outlet. Ronda answers from its visits, orders and tasks, and can draft a follow-up message for you.
          </Text>
        ) : null}
        {entries.map((e, i) =>
          e.kind === 'user' ? (
            <Animated.View key={i} entering={reduced ? undefined : riseIn(0, 240)} style={[styles.userBubble, { backgroundColor: colors.primary.bg }]}>
              <Text variant="body" color={colors.primary.fg}>
                {e.text}
              </Text>
            </Animated.View>
          ) : e.kind === 'answer' ? (
            <Animated.View key={i} entering={reduced ? undefined : riseIn()} style={styles.answer}>
              <Text variant="body" selectable>
                {e.text}
              </Text>
              <View style={styles.answerFoot}>
                <Text variant="footnote" color="muted" style={styles.flex}>
                  From this outlet’s visits, orders and tasks · Claude (Amazon Bedrock)
                </Text>
                <PressableScale
                  onPress={() => {
                    Clipboard.setStringAsync(e.text);
                    haptic.selection();
                  }}
                  accessibilityLabel="Copy answer"
                  style={styles.iconButton}
                >
                  <Icon name="copy" size={18} color={colors.ink2} />
                </PressableScale>
              </View>
            </Animated.View>
          ) : (
            <DraftCard key={i} outletId={id} mobile={outlet.data?.mobile ?? null} />
          ),
        )}
        {ask.isPending ? (
          <View style={styles.thinking}>
            <RondaRing size={24} accessibilityLabel="Ronda is answering" />
            <Text variant="caption" color="ink2">
              Ronda is reading the records…
            </Text>
          </View>
        ) : null}
        {unavailable ? (
          <View style={[styles.notice, { backgroundColor: colors.tones.serious.tile }]} accessibilityLiveRegion="polite">
            <Text variant="caption" color={colors.tones.serious.ink}>
              {unavailable}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.composer, { borderTopColor: colors.divider, backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starters} keyboardShouldPersistTaps="handled">
            <Starter label="Draft a follow-up message" onPress={startDraft} />
            {STARTERS.map((s) => (
              <Starter key={s} label={s} onPress={() => send(s)} />
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <View style={[styles.field, { backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.divider }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask about this outlet"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                accessibilityLabel="Ask about this outlet"
                onSubmitEditing={() => send(draft)}
                returnKeyType="send"
                style={[styles.input, { color: colors.ink }]}
              />
            </View>
            <PressableScale
              onPress={() => send(draft)}
              disabled={!draft.trim() || ask.isPending}
              accessibilityLabel="Send"
              style={[styles.send, { backgroundColor: draft.trim() ? colors.primary.bg : colors.line }]}
            >
              <Icon name="arrowUp" size={20} color={draft.trim() ? colors.primary.fg : colors.muted} strokeWidth={2.4} />
            </PressableScale>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Starter({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={[styles.starter, { borderColor: colors.line, backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.panel }]}>
      <Text variant="caption" color="body" style={styles.starterText}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** A follow-up message draft: pick a topic and a language, then copy or open WhatsApp. */
function DraftCard({ outletId, mobile }: { outletId: number; mobile: string | null }) {
  const colors = useColors();
  const [language, setLanguage] = useState<'en' | 'ms'>('en');
  const [topic, setTopic] = useState<Topic>('last_visit');
  const draft = useQuery({
    queryKey: ['assistant', 'draft', outletId, language, topic],
    queryFn: () => draftFollowUp(outletId, { language, topic }),
    staleTime: Infinity,
  });
  const text = draft.data?.text ?? '';

  const openWhatsApp = () => messageNumber(mobile, text, 'Add a mobile number in Outlet details first.');

  return (
    <View style={[styles.draft, { backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.ground }]}>
      <Segmented
        size="small"
        accessibilityLabel="Language"
        value={language}
        onChange={setLanguage}
        segments={[
          { key: 'en', label: 'English' },
          { key: 'ms', label: 'Bahasa Melayu' },
        ]}
      />
      <View style={styles.topicRow}>
        {TOPICS.map((t) => (
          <PressableScale
            key={t.key}
            onPress={() => {
              haptic.selection();
              setTopic(t.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: topic === t.key }}
            style={[styles.topic, { borderColor: topic === t.key ? colors.brand : colors.line, backgroundColor: topic === t.key ? colors.brandTint : 'transparent' }]}
          >
            <Text variant="label" color={topic === t.key ? colors.brandInk : colors.ink2}>
              {t.label}
            </Text>
          </PressableScale>
        ))}
      </View>
      {draft.isPending ? (
        <View style={styles.thinking}>
          <RondaRing size={22} accessibilityLabel="Writing the message" />
          <Text variant="caption" color="ink2">
            Writing the message…
          </Text>
        </View>
      ) : draft.isError ? (
        <Text variant="caption" color="danger" style={styles.draftText}>
          {errorMessage(draft.error)}
        </Text>
      ) : (
        <>
          <Text variant="subhead" selectable style={styles.draftText}>
            {text}
          </Text>
          <Text variant="footnote" color="muted">
            {draft.data?.source === 'bedrock'
              ? 'Written by Claude (Amazon Bedrock) from this outlet’s records. Check it before you send.'
              : 'Written from this outlet’s records. Check it before you send.'}
          </Text>
          <View style={styles.draftActions}>
            <PressableScale
              onPress={() => {
                Clipboard.setStringAsync(text);
                haptic.selection();
              }}
              accessibilityRole="button"
              style={[styles.draftButton, { borderColor: colors.control, borderWidth: 1, backgroundColor: colors.panel }]}
            >
              <Text variant="captionStrong" color="body">
                Copy
              </Text>
            </PressableScale>
            {mobile ? (
              <PressableScale onPress={openWhatsApp} accessibilityRole="button" style={[styles.draftButton, { backgroundColor: colors.primary.bg }]}>
                <Text variant="captionStrong" color={colors.primary.fg}>
                  Open in WhatsApp
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 17 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  thread: { padding: 16, gap: 16 },
  intro: { marginTop: 8 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '82%', borderRadius: 20, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14 },
  answer: { gap: 8 },
  answerFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  notice: { padding: 12, borderRadius: 14 },
  composer: { borderTopWidth: 1, paddingTop: 10, gap: 10 },
  starters: { gap: 8, paddingHorizontal: 16 },
  starter: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  starterText: { fontFamily: fonts.medium },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 12 },
  field: { flex: 1, minHeight: 46, borderRadius: 23, paddingHorizontal: 16, justifyContent: 'center' },
  input: { fontFamily: fonts.regular, fontSize: 16, minHeight: 44 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  draft: { borderRadius: radius.card, padding: 14, gap: 12 },
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topic: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, justifyContent: 'center' },
  draftText: { lineHeight: 22 },
  draftActions: { flexDirection: 'row', gap: 8 },
  draftButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
});
