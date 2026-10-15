import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { sendResetLink } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { haptic } from '../../lib/haptics';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';

/** Sends the same reset email as the web. The link opens the reset page there. */
export function ForgotPasswordScreen({ navigation, route }: RootScreenProps<'ForgotPassword'>) {
  const colors = useColors();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError('Enter the email you sign in with.');
      haptic.error();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendResetLink(email.trim());
      setSent(true);
      haptic.success();
    } catch (e) {
      setError(errorMessage(e));
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailScreen
      backLabel="Sign in"
      keyboard
      bottomBar={
        sent ? (
          <Button label="Back to sign in" onPress={() => navigation.goBack()} style={styles.flex} />
        ) : (
          <Button label="Send me a link" onPress={submit} loading={busy} style={styles.flex} />
        )
      }
    >
      <View style={styles.body}>
        <Text variant="title" accessibilityRole="header">
          Reset your password
        </Text>
        {sent ? (
          <View style={[styles.sent, { backgroundColor: colors.tones.good.tile }]} accessibilityLiveRegion="polite">
            <Icon name="check" size={22} color={colors.tones.good.ink} strokeWidth={2.6} />
            <Text variant="body" color={colors.tones.good.ink} style={styles.flex}>
              Check your email. We sent a link to {email.trim()}. It opens the Ronda page where you choose a new password.
            </Text>
          </View>
        ) : (
          <>
            <Text variant="body" color="ink2">
              Enter the email you sign in with. We will send you a link to choose a new password.
            </Text>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={submit}
              error={error ?? undefined}
            />
          </>
        )}
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  sent: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.tile, alignItems: 'flex-start' },
});
