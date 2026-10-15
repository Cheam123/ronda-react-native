import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * Leaving a form with something typed in asks first, whether by Cancel, the
 * Android back button or a swipe. Call the returned `allowLeave()` just
 * before leaving on purpose (after a save), so that does not ask.
 */
export function useConfirmLeave(dirty: boolean, copy: { title: string; keep: string; body?: string; leave?: string }) {
  const navigation = useNavigation();
  const leaving = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(
      copy.title,
      copy.body ?? 'What you entered is not saved.',
      [
        { text: copy.keep, style: 'cancel' },
        { text: copy.leave ?? 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
      // Android back, or a tap outside, keeps editing.
      { cancelable: true },
    );
  });

  return useCallback(() => {
    leaving.current = true;
  }, []);
}
