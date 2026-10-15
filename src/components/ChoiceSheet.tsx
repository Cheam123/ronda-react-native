import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Sheet, SheetAction, type SheetHandle } from './Sheet';

export interface Choice {
  label: string;
  hint?: string;
  tone?: 'ink' | 'danger';
  run: () => void;
}

interface Ask {
  title: string;
  subtitle?: string;
  choices: Choice[];
  /** Closed without a choice (a drag down, a tap outside, Android back). */
  onDismiss?: () => void;
}

let show: ((ask: Ask) => void) | null = null;

/**
 * A few actions to pick from, in the app's own sheet rather than a system
 * dialog. Callable from anywhere, plain functions too (adding a photo).
 */
export function askChoice(ask: Ask) {
  if (show) {
    show(ask);
    return;
  }
  // Before the host mounts (should not happen): the system dialog still works.
  Alert.alert(ask.title, ask.subtitle, [...ask.choices.map((c) => ({ text: c.label, onPress: c.run })), { text: 'Cancel', style: 'cancel' as const, onPress: ask.onDismiss }], {
    cancelable: true,
    onDismiss: ask.onDismiss,
  });
}

/** Mounted once, inside the bottom sheet provider. */
export function ChoiceSheetHost() {
  const sheet = useRef<SheetHandle>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const current = useRef<Ask | null>(null);
  const picked = useRef(false);

  useEffect(() => {
    show = (next) => {
      picked.current = false;
      current.current = next;
      setAsk(next);
      sheet.current?.open();
    };
    return () => {
      show = null;
    };
  }, []);

  return (
    <Sheet
      ref={sheet}
      title={ask?.title}
      subtitle={ask?.subtitle}
      fit
      // Over the sheet that asked (Mark as done), which stays open behind it.
      stacked
      onDismiss={() => {
        if (!picked.current) current.current?.onDismiss?.();
      }}
    >
      {ask?.choices.map((c) => (
        <SheetAction
          key={c.label}
          label={c.label}
          hint={c.hint}
          tone={c.tone}
          onPress={() => {
            picked.current = true;
            sheet.current?.close();
            c.run();
          }}
        />
      ))}
    </Sheet>
  );
}
