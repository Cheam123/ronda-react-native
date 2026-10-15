import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { LocalFile } from '../../api/client';
import { homeKey } from '../../api/home';
import { taskActions, taskKeys } from '../../api/tasks';
import { haptic } from '../../lib/haptics';
import { firstName } from '../../lib/format';
import { useUndo } from '../../undo/UndoProvider';

interface DoneInput {
  id: number;
  status: number;
  checker?: string | null;
  remark?: string | null;
  photos?: LocalFile[];
  invoiceNo?: string | null;
  sales?: string | null;
}

/** Status changes for the rep's task screens, with Undo where the board shows it. */
export function useTaskActions() {
  const queryClient = useQueryClient();
  const { schedule, undo, pending, notify } = useUndo();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: homeKey });
  }, [queryClient]);

  /** Mark as done after the 5 s Undo window. A New task is started first. */
  const markDone = useCallback(
    (input: DoneInput, callbacks: { onUndo?: () => void; onDone?: () => void; quiet?: boolean } = {}) => {
      haptic.success();
      const who = input.checker ? input.checker : 'Your manager';
      schedule({
        key: doneKey(input.id),
        message: `Done. ${who} checks it next.`,
        run: async () => {
          if (Number(input.status) === 1) await taskActions.start(input.id);
          await taskActions.done(input.id, input);
        },
        onUndo: callbacks.onUndo,
        quiet: callbacks.quiet,
        onDone: () => {
          refresh();
          callbacks.onDone?.();
        },
        onError: () => refresh(),
      });
    },
    [schedule, refresh],
  );

  const start = useCallback(
    async (id: number) => {
      haptic.light();
      await taskActions.start(id);
      refresh();
    },
    [refresh],
  );

  const keepInView = useCallback(
    async (id: number, remark?: string | null) => {
      await taskActions.keepInView(id, remark);
      haptic.selection();
      notify('Kept in view. It moves out of your open tasks.');
      refresh();
    },
    [notify, refresh],
  );

  const hold = useCallback(
    async (id: number, remark?: string | null) => {
      await taskActions.hold(id, remark);
      haptic.selection();
      notify('Put on hold.');
      refresh();
    },
    [notify, refresh],
  );

  /** Verify (checker), after the Undo window. */
  const verify = useCallback(
    (id: number, doer: string | null, callbacks: { onUndo?: () => void; onDone?: () => void; quiet?: boolean } = {}) => {
      haptic.success();
      schedule({
        key: `task-verify-${id}`,
        message: `Verified. ${doer ? firstName(doer) : 'They'} see${doer ? 's' : ''} it in Done.`,
        run: () => taskActions.verify(id),
        onUndo: callbacks.onUndo,
        quiet: callbacks.quiet,
        onDone: () => {
          refresh();
          callbacks.onDone?.();
        },
        onError: () => refresh(),
      });
    },
    [schedule, refresh],
  );

  /** Send back with a reason (checker), after the Undo window. */
  const sendBack = useCallback(
    (id: number, reason: string, doer: string | null, callbacks: { onUndo?: () => void; onDone?: () => void; quiet?: boolean } = {}) => {
      haptic.warning();
      schedule({
        key: `task-back-${id}`,
        message: `Sent back to ${doer ? firstName(doer) : 'them'} with your reason.`,
        run: () => taskActions.sendBack(id, reason),
        onUndo: callbacks.onUndo,
        quiet: callbacks.quiet,
        onDone: () => {
          refresh();
          callbacks.onDone?.();
        },
        onError: () => refresh(),
      });
    },
    [schedule, refresh],
  );

  return { markDone, start, keepInView, hold, verify, sendBack, undo, pending, refresh };
}

export const doneKey = (id: number) => `task-done-${id}`;
