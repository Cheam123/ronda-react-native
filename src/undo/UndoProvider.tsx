import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';
import { GLIDE } from '../motion/curves';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '../api/client';
import { Icon } from '../components/Icon';
import { PressableScale } from '../components/Pressable';
import { Text } from '../components/Text';
import { haptic } from '../lib/haptics';
import { useColors } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

/**
 * The server has no "undo" for a status change, so the change waits on the
 * phone for 5 seconds first. Undo cancels it before anything is sent; leaving
 * the app sends whatever is still waiting.
 */

export const UNDO_MS = 5000;

interface Pending {
  key: string;
  message: string;
  run: () => Promise<unknown>;
  onUndo?: () => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ToastState {
  id: number;
  key?: string;
  message: string;
  tone: 'done' | 'error' | 'info';
}

interface UndoContextValue {
  /** Queue a change. It runs after 5 s unless Undo is tapped first. */
  /** `quiet`: no toast, for a screen that shows its own banner and Undo button. */
  schedule: (job: { key: string; message: string; run: () => Promise<unknown>; onUndo?: () => void; onDone?: () => void; onError?: (message: string) => void; quiet?: boolean }) => void;
  /** Cancel a queued change (the same as tapping Undo). */
  undo: (key: string) => void;
  /** Keys waiting to run, so lists can hide those rows meanwhile. */
  pending: Set<string>;
  /** A plain message in the same place (an error, or "Sent back"). */
  notify: (message: string, tone?: ToastState['tone']) => void;
  /** Lift the toast above a screen's own bottom bar or the tab bar. */
  setBottomOffset: (px: number) => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const jobs = useRef(new Map<string, Pending>());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [bottomOffset, setBottomOffset] = useState(108);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const syncPending = () => setPending(new Set(jobs.current.keys()));

  const showToast = useCallback((next: Omit<ToastState, 'id'>, ms = UNDO_MS) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    seq.current += 1;
    setToast({ ...next, id: seq.current });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const commit = useCallback(async (key: string) => {
    const job = jobs.current.get(key);
    if (!job) return;
    clearTimeout(job.timer);
    jobs.current.delete(key);
    syncPending();
    try {
      await job.run();
      job.onDone?.();
    } catch (e) {
      const message = errorMessage(e);
      haptic.error();
      job.onError?.(message);
      showToast({ message: `We could not save that. ${message}`, tone: 'error' }, 6000);
    }
  }, [showToast]);

  const schedule = useCallback<UndoContextValue['schedule']>(
    ({ key, message, run, onUndo, onDone, onError, quiet }) => {
      const existing = jobs.current.get(key);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => commit(key), UNDO_MS);
      jobs.current.set(key, { key, message, run, onUndo, onDone, onError, timer });
      syncPending();
      if (!quiet) showToast({ key, message, tone: 'done' });
    },
    [commit, showToast],
  );

  const undo = useCallback((key: string) => {
    const job = jobs.current.get(key);
    if (!job) return;
    clearTimeout(job.timer);
    jobs.current.delete(key);
    syncPending();
    job.onUndo?.();
    haptic.selection();
    setToast((t) => (t?.key === key ? null : t));
  }, []);

  const notify = useCallback((message: string, tone: ToastState['tone'] = 'info') => showToast({ message, tone }, 4000), [showToast]);

  // Leaving the app sends everything still waiting.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') [...jobs.current.keys()].forEach((key) => commit(key));
    });
    return () => sub.remove();
  }, [commit]);

  const value = useMemo(() => ({ schedule, undo, pending, notify, setBottomOffset }), [schedule, undo, pending, notify]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {toast ? <Toast key={toast.id} toast={toast} bottom={bottomOffset} onUndo={toast.key ? () => undo(toast.key!) : undefined} onClose={() => setToast(null)} /> : null}
    </UndoContext.Provider>
  );
}

function Toast({ toast, bottom, onUndo, onClose }: { toast: ToastState; bottom: number; onUndo?: () => void; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDone = toast.tone === 'done';
  const pendingUndo = isDone && !!onUndo;
  return (
    <Animated.View
      entering={SlideInDown.springify(GLIDE.duration).dampingRatio(GLIDE.dampingRatio)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(bottom, insets.bottom + 16) }]}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: colors.toast.bg, borderColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent' }]}
      >
        {isDone ? (
          <View style={[styles.tick, { backgroundColor: colors.check.fill }]}>
            <Icon name="check" size={14} color={colors.check.mark} strokeWidth={3.2} />
          </View>
        ) : toast.tone === 'error' ? (
          <Icon name="alert" size={22} color={colors.scheme === 'dark' ? '#FDA29B' : '#FDA29B'} />
        ) : null}
        <Text variant="bodyStrong" color={colors.toast.fg} style={styles.message}>
          {toast.message}
        </Text>
        {pendingUndo ? (
          <PressableScale onPress={onUndo} accessibilityLabel="Undo" style={styles.action}>
            <Text variant="bodyStrong" color={colors.toast.action} style={styles.actionText}>
              Undo
            </Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={onClose} accessibilityLabel="Close message" style={styles.action}>
            <Icon name="close" size={18} color={colors.toast.action} strokeWidth={2.4} />
          </PressableScale>
        )}
      </View>
    </Animated.View>
  );
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used inside UndoProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.gutter, right: space.gutter },
  toast: {
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, fontSize: 15, lineHeight: 20 },
  action: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 15 },
});
