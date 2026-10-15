import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { errorMessage, SITE_ROOT } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { haptic } from '../../lib/haptics';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';

/**
 * The corner ring sits this far above the safe-area top, so its dot floats
 * above the logo as on the board (-142 under a 47 pt status bar) on every
 * phone, not level with the wordmark where the status bar is shorter.
 */
const DECOR_ABOVE_INSET = 189;

export function SignInScreen({ navigation }: RootScreenProps<'SignIn'>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const isDark = colors.scheme === 'dark';
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const coverStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      haptic.error();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errorMessage(e));
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: isDark ? colors.ground : colors.panel }]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        onScroll={onScroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}
      >
        {/* The big quiet ring in the corner. It scrolls with the form, so the keyboard never pushes text under it. */}
        <Svg width={340} height={340} viewBox="0 0 100 100" style={[styles.decor, { top: insets.top - DECOR_ABOVE_INSET }]} pointerEvents="none">
          <Circle
            cx={50}
            cy={50}
            r={34}
            fill="none"
            stroke={isDark ? '#132433' : '#EAF3F7'}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray="178 35.6"
            transform="rotate(-60 50 50)"
          />
          <Circle cx={50} cy={16} r={5} fill={colors.coral} />
        </Svg>

        <View style={styles.logo} accessible accessibilityLabel="Ronda">
          <Svg width={34} height={34} viewBox="0 0 100 100">
            <Circle
              cx={50}
              cy={50}
              r={34}
              fill="none"
              stroke={colors.brand}
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray="178 35.6"
              transform="rotate(-60 50 50)"
            />
            <Circle cx={50} cy={16} r={8} fill={colors.coral} />
          </Svg>
          <Image
            source={isDark ? require('../../../assets/brand/wordmark-white.png') : require('../../../assets/brand/wordmark-ink.png')}
            style={styles.wordmark}
            contentFit="contain"
          />
        </View>

        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          Ready for your round?
        </Text>
        <Text variant="body" color="ink2" style={styles.lead}>
          Sign in with the email and password your manager set up for you.
        </Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            placeholder="you@company.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            style={styles.big}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            style={styles.big}
            trailing={
              <PressableScale
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={styles.eye}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={22} color={colors.muted} strokeWidth={1.8} />
              </PressableScale>
            }
          />
          <View style={styles.forgotRow}>
            <PressableScale onPress={() => navigation.navigate('ForgotPassword', { email })} accessibilityRole="link" style={styles.forgot}>
              <Text variant="captionStrong" color="link" style={styles.forgotText}>
                Forgot password?
              </Text>
            </PressableScale>
          </View>

          {error ? (
            <View style={[styles.error, { backgroundColor: colors.tones.critical.tile }]} accessibilityLiveRegion="assertive">
              <Icon name="alert" size={20} color={colors.tones.critical.ink} />
              <Text variant="caption" color={colors.tones.critical.ink} style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <Button label="Sign in" onPress={submit} loading={busy} style={styles.submit} />
          <Text variant="caption" color="muted" align="center">
            New to Ronda? Your manager adds your account.
          </Text>
        </View>

        <View style={styles.legal}>
          <PressableScale accessibilityRole="link" onPress={() => Linking.openURL(`${SITE_ROOT}/privacy`)} style={styles.legalLink}>
            <Text variant="footnote" color="muted">
              Privacy
            </Text>
          </PressableScale>
          <PressableScale accessibilityRole="link" onPress={() => Linking.openURL(`${SITE_ROOT}/terms`)} style={styles.legalLink}>
            <Text variant="footnote" color="muted">
              Terms
            </Text>
          </PressableScale>
        </View>
      </KeyboardAwareScrollView>

      {/* Once the form scrolls, this keeps text from running under the clock. */}
      <Animated.View pointerEvents="none" style={[styles.statusCover, { height: insets.top, backgroundColor: isDark ? colors.ground : colors.panel }, coverStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  decor: { position: 'absolute', left: 168, transform: [{ rotate: '225deg' }] },
  statusCover: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { width: 94, height: 26 },
  title: { marginTop: 40 },
  lead: { marginTop: 10, maxWidth: 320 },
  form: { marginTop: 32, gap: 18 },
  big: { fontSize: 17 },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  forgotRow: { alignItems: 'flex-end', marginTop: -10 },
  forgot: { minHeight: 48, justifyContent: 'center' },
  forgotText: { fontSize: 15 },
  error: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, alignItems: 'flex-start' },
  errorText: { flex: 1 },
  submit: { marginTop: 4 },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 'auto', paddingTop: 32 },
  legalLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
});
