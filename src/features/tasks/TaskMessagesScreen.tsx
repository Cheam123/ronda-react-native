import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteChat, editChat, fetchChat, markChatRead, plainText, sendChat, type ChatMessage } from '../../api/chat';
import { errorMessage, type LocalFile } from '../../api/client';
import { homeKey } from '../../api/home';
import { taskKeys } from '../../api/tasks';
import { useAuth } from '../../auth/AuthProvider';
import { LoadError, Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PhotoStrip, RemotePhotos } from '../../components/PhotoStrip';
import { PressableScale } from '../../components/Pressable';
import { Sheet, SheetAction, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { formatDate, formatTime, isSameDay, parseDate } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { addPhotos } from '../../lib/photos';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/type';

const EDIT_WINDOW_MIN = 15;

/** Talk with the checker on one task. */
/** Minutes since a moment. Outside the component: it reads the clock, so it must not run during render. */
function minutesSince(d: Date): number {
  return (Date.now() - d.getTime()) / 60000;
}

export function TaskMessagesScreen({ route, navigation }: RootScreenProps<'TaskMessages'>) {
  const { id, title } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const input = useRef<TextInput>(null);

  const chat = useQuery({ queryKey: taskKeys.chat(id), queryFn: () => fetchChat(id), refetchInterval: 20_000 });

  // Opening the thread reads it.
  useEffect(() => {
    markChatRead(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
        queryClient.invalidateQueries({ queryKey: homeKey });
      })
      .catch(() => {});
  }, [id, queryClient]);

  const send = useMutation({
    mutationFn: async () => {
      const text = draft.trim();
      if (editing) await editChat(editing.id, text);
      else await sendChat(id, text, photos);
    },
    onSuccess: () => {
      haptic.success();
      setDraft('');
      setPhotos([]);
      setEditing(null);
      chat.refetch();
    },
    onError: (e) => {
      haptic.error();
      Alert.alert(editing ? 'We could not change your message' : 'We could not send your message', errorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: (m: ChatMessage) => deleteChat(m.id),
    onSuccess: () => chat.refetch(),
    onError: (e) => Alert.alert('We could not delete your message', errorMessage(e)),
  });

  // Press and hold your own message: Edit (for 15 minutes) or Delete, in the app's sheet.
  const actionsSheet = useRef<SheetHandle>(null);
  const [acting, setActing] = useState<{ message: ChatMessage; editable: boolean } | null>(null);
  const onLongPress = (m: ChatMessage) => {
    if (m.submitted_by !== user?.id) return;
    const created = parseDate(m.created_at);
    haptic.light();
    setActing({ message: m, editable: created ? minutesSince(created) <= EDIT_WINDOW_MIN : false });
    actionsSheet.current?.open();
  };
  const editActing = () => {
    actionsSheet.current?.close();
    if (!acting) return;
    setEditing(acting.message);
    setDraft(plainText(acting.message.message));
    input.current?.focus();
  };
  const deleteActing = () => {
    actionsSheet.current?.close();
    if (acting) remove.mutate(acting.message);
  };

  const messages = chat.data ?? [];
  const canSend = (draft.trim().length > 0 || photos.length > 0) && !send.isPending;

  return (
    <View style={[styles.fill, { backgroundColor: colors.ground, paddingTop: insets.top }]}>
      <View style={[styles.top, { borderBottomColor: colors.line }]}>
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Back to the task" style={styles.back}>
          <Icon name="chevronLeft" size={26} color={colors.link} strokeWidth={2.2} />
          <Text variant="body" color="link" style={styles.backLabel}>
            Task
          </Text>
        </PressableScale>
        <View style={styles.topTitle}>
          <Text variant="bodyStrong" align="center" accessibilityRole="header">
            Messages
          </Text>
          {title ? (
            <Text variant="footnote" color="ink2" align="center" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        <View style={styles.back} />
      </View>

      {chat.isPending ? (
        <Loading label="Loading messages" />
      ) : chat.isError ? (
        <View style={styles.pad}>
          <LoadError message={errorMessage(chat.error)} onRetry={() => chat.refetch()} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.listContent, messages.length === 0 && styles.emptyContent]}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text variant="subhead" color="ink2" align="center">
              No messages yet. Ask your checker a question or tell them how it is going.
            </Text>
          }
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const created = parseDate(item.created_at);
            const prevDate = prev ? parseDate(prev.created_at) : null;
            const newDay = created && (!prevDate || !isSameDay(created, prevDate));
            return (
              <>
                {newDay && created ? (
                  <Text variant="label" color="muted" align="center" style={styles.day}>
                    {isSameDay(created, new Date()) ? 'Today' : formatDate(created)}
                  </Text>
                ) : null}
                <Bubble message={item} mine={item.submitted_by === user?.id} onLongPress={() => onLongPress(item)} />
              </>
            );
          }}
        />
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.composer, { borderTopColor: colors.line, backgroundColor: colors.ground, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {editing ? (
            <View style={styles.editingRow}>
              <Text variant="caption" color="ink2" style={styles.fill}>
                Changing your message
              </Text>
              <PressableScale onPress={() => { setEditing(null); setDraft(''); }} accessibilityLabel="Stop changing the message" style={styles.small}>
                <Text variant="captionStrong" color="link">
                  Cancel
                </Text>
              </PressableScale>
            </View>
          ) : null}
          {photos.length ? (
            <View style={styles.photoRow}>
              <PhotoStrip photos={photos} onChange={setPhotos} size={56} />
            </View>
          ) : null}
          <View style={styles.inputRow}>
            {editing ? null : (
              <PressableScale
                onPress={async () => setPhotos([...photos, ...(await addPhotos(4 - photos.length))].slice(0, 4))}
                accessibilityLabel="Add a photo"
                style={styles.round}
              >
                <Icon name="camera" size={22} color={colors.ink2} />
              </PressableScale>
            )}
            <View style={[styles.field, { backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel, borderColor: colors.control }]}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                multiline
                accessibilityLabel="Message"
                style={[styles.input, { color: colors.ink }]}
              />
            </View>
            <PressableScale
              onPress={() => canSend && send.mutate()}
              disabled={!canSend}
              accessibilityLabel={editing ? 'Save the message' : 'Send'}
              style={[styles.round, { backgroundColor: canSend ? colors.primary.bg : colors.line }]}
            >
              <Icon name={editing ? 'check' : 'arrowUp'} size={20} color={canSend ? colors.primary.fg : colors.muted} strokeWidth={2.4} />
            </PressableScale>
          </View>
        </View>
      </KeyboardStickyView>
      <Sheet ref={actionsSheet} title="Your message" subtitle={acting && !acting.editable ? 'Messages can be changed for 15 minutes after you send them.' : undefined} fit>
        {acting?.editable ? (
          <SheetAction label="Edit" hint="Change what it says" onPress={editActing} />
        ) : null}
        <SheetAction label="Delete" tone="danger" hint="Removes it for everyone" onPress={deleteActing} />
      </Sheet>
    </View>
  );
}

function Bubble({ message, mine, onLongPress }: { message: ChatMessage; mine: boolean; onLongPress: () => void }) {
  const colors = useColors();
  const text = plainText(message.message);
  const images = message.document_uploads.filter((d) => ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(d.file_type));
  const files = message.document_uploads.filter((d) => !images.includes(d));
  const edited = message.updated_at && message.updated_at !== message.created_at;
  return (
    <PressableScale
      onLongPress={onLongPress}
      scaleTo={0.99}
      accessibilityLabel={`${mine ? 'You' : message.submit_by_name}, ${formatTime(message.created_at)}: ${text}`}
      accessibilityHint={mine ? 'Press and hold to change or delete' : undefined}
      style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirsWrap]}
    >
      {mine ? null : (
        <Text variant="label" color="ink2" style={styles.name}>
          {message.submit_by_name}
        </Text>
      )}
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary.bg, borderBottomRightRadius: 6 }
            : { backgroundColor: colors.panel, borderColor: colors.cardRing, borderWidth: 1, borderBottomLeftRadius: 6 },
        ]}
      >
        {text ? (
          <Text variant="body" color={mine ? colors.primary.fg : colors.ink} selectable>
            {text}
          </Text>
        ) : null}
        {images.length ? (
          <View style={text ? styles.attach : undefined}>
            <RemotePhotos files={images.map((d) => ({ id: d.id, file_path: d.file_path, name: d.file_name }))} size={140} />
          </View>
        ) : null}
        {files.map((f) => (
          <Text key={f.id} variant="caption" color={mine ? colors.primary.fg : colors.ink2} style={styles.attach}>
            {f.file_name}
          </Text>
        ))}
      </View>
      <Text variant="footnote" color="muted" style={styles.time}>
        {formatTime(message.created_at)}
        {edited ? ' · edited' : ''}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { paddingTop: 16 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 48, width: 92 },
  backLabel: { fontFamily: fonts.medium, fontSize: 17 },
  topTitle: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  day: { marginVertical: 8 },
  bubbleWrap: { maxWidth: '82%', gap: 4 },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsWrap: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  name: { marginLeft: 4 },
  bubble: { borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 },
  attach: { marginTop: 8 },
  time: { marginHorizontal: 4 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 12, gap: 8 },
  editingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  small: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  photoRow: { paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, minHeight: 46, justifyContent: 'center' },
  input: { fontFamily: fonts.regular, fontSize: 16, maxHeight: 120, paddingVertical: 10 },
});
