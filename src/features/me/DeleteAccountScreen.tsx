import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { requestAccountDeletion } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { haptic } from '../../lib/haptics';

/** Turns the account off at once; the office erases the data by hand. */
export function DeleteAccountScreen() {
  const { forget } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = () =>
    Alert.alert('Delete your account?', 'You will be signed out on every phone, and you cannot sign in again.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: submit },
    ]);

  const submit = async () => {
    setBusy(true);
    try {
      await requestAccountDeletion(reason.trim());
      haptic.warning();
      Alert.alert('Request sent', 'Your account is turned off. The office will erase your data and email you when it is done.');
      await forget();
    } catch (e) {
      haptic.error();
      Alert.alert('We could not send your request', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailScreen backLabel="Me" keyboard bottomBar={<Button label="Delete my account" variant="danger" onPress={confirm} loading={busy} style={styles.flex} />}>
      <View style={styles.body}>
        <Text variant="title" accessibilityRole="header">
          Delete my account
        </Text>
        <Text variant="body" color="ink2">
          Your account is turned off right away and you are signed out. The office then erases your personal data. Visits, orders and tasks you recorded stay with your company.
        </Text>
        <TextField
          label="Why are you leaving?"
          optional
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={1000}
          placeholder="This helps us improve Ronda"
        />
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
});
