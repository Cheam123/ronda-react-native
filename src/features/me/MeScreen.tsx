import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SITE_ROOT } from '../../api/client';
import { fetchMeStats, meKeys } from '../../api/me';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Card, ListRow } from '../../components/Card';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { Text } from '../../components/Text';
import { formatMoney } from '../../lib/format';
import { askForPush, pushAllowed } from '../../lib/push';
import type { RootScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import type { ThemePreference } from '../../theme/ThemeProvider';

const ROLE_LABEL = { 0: 'Admin', 1: 'Manager', 2: 'Field Rep' } as const;

export function MeScreen({ navigation }: RootScreenProps<'Me'>) {
  const { user, role, signOut, abilities } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const [locationLabel, setLocationLabel] = useState('When I stamp');
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const stats = useQuery({ queryKey: meKeys.stats, queryFn: fetchMeStats });
  // At the largest text sizes the three tiles stack, so nothing is cut off.
  const large = useWindowDimensions().fontScale > 1.35;

  const checkPush = useCallback(() => {
    pushAllowed().then(setPushOn);
  }, []);
  useEffect(checkPush, [checkPush]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocationLabel(p.granted ? 'When I stamp' : p.canAskAgain ? 'Not asked yet' : 'Turned off'))
      .catch(() => {});
  }, []);

  if (!user) return null;
  const st = stats.data;
  const tiles = [
    { label: 'Visits', value: st ? String(st.month.visits) : '–' },
    ...(abilities.record_order || (st?.month.orders ?? 0) > 0 ? [{ label: 'Orders', value: st ? String(st.month.orders) : '–', hint: st && st.month.orders ? formatMoney(st.month.orders_value) : null }] : []),
    { label: 'Forms', value: st ? String(st.month.forms) : '–' },
  ];

  const notifications = async () => {
    await askForPush();
    checkPush();
  };
  const userCode = user.username || `U${String(user.id).padStart(5, '0')}`;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need your email and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  const explainLocation = () =>
    Alert.alert(
      'Location',
      'Ronda records your location only when you tap Stamp location on a visit or a form. You can change the permission in your phone settings.',
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ],
    );

  return (
    <DetailScreen backLabel={role === 'rep' ? 'Today' : 'Team'}>
      <View style={styles.header}>
        <Avatar name={user.name} size={80} brand />
        <Text variant="title2" align="center" accessibilityRole="header" style={styles.name}>
          {user.name}
        </Text>
        <Text variant="subhead" color="ink2" align="center">
          {ROLE_LABEL[user.type] ?? 'Field Rep'} ·{' '}
          <Text variant="mono" color="ink2" style={styles.code}>
            {userCode}
          </Text>
        </Text>
        <Text variant="caption" color="muted" align="center">
          {user.email}
        </Text>
      </View>

      <View style={[styles.tiles, large && styles.tilesStacked]} accessible accessibilityLabel={`This month: ${tiles.map((t) => `${t.value} ${t.label.toLowerCase()}`).join(', ')}`}>
        {tiles.map((t) => (
          <Card key={t.label} style={[styles.tile, !large && styles.flex]}>
            <View style={styles.tileInner}>
              <Text variant="captionStrong" color="ink2">
                {t.label}
              </Text>
              <Text variant="number">{t.value}</Text>
              {'hint' in t && t.hint ? (
                <Text variant="footnote" color="ink2" numberOfLines={1} adjustsFontSizeToFit>
                  {t.hint}
                </Text>
              ) : null}
            </View>
          </Card>
        ))}
      </View>
      <Text variant="footnote" color="ink2" align="center" style={styles.month}>
        This month, {st?.month_label ?? ''}
      </Text>

      <Text variant="label" color="ink2" style={styles.groupLabel} accessibilityRole="header">
        My records
      </Text>
      <Card style={styles.card}>
        <ListRow onPress={() => navigation.navigate('MyVisits')} chevron>
          <Text variant="body" style={[styles.rowText, styles.flex]}>
            Visit reports
          </Text>
          <Text variant="subhead" color="ink2">
            {st?.totals.visits ?? ''}
          </Text>
        </ListRow>
        <ListRow onPress={() => navigation.navigate('Records')} chevron divider={abilities.record_order}>
          <Text variant="body" style={[styles.rowText, styles.flex]}>
            Form records
          </Text>
          <Text variant="subhead" color="ink2">
            {st?.totals.forms ?? ''}
          </Text>
        </ListRow>
        {abilities.record_order ? (
          <ListRow onPress={() => navigation.navigate('MyOrders')} chevron divider={false}>
            <Text variant="body" style={[styles.rowText, styles.flex]}>
              Orders I recorded
            </Text>
            <Text variant="subhead" color="ink2">
              {st?.totals.orders ?? ''}
            </Text>
          </ListRow>
        ) : null}
      </Card>

      <Text variant="label" color="ink2" style={styles.groupLabel} accessibilityRole="header">
        Settings
      </Text>
      <Card style={styles.card}>
        <View style={[styles.appearance, { borderBottomColor: colors.divider }]}>
          <Text variant="body" style={styles.rowText} nativeID="appearance-label">
            Appearance
          </Text>
          <Segmented<ThemePreference>
            size="small"
            accessibilityLabel="Appearance"
            value={preference}
            onChange={setPreference}
            segments={[
              { key: 'light', label: 'Light' },
              { key: 'dark', label: 'Dark' },
              { key: 'system', label: 'System' },
            ]}
          />
        </View>
        <ListRow onPress={notifications} chevron accessibilityLabel={`Notifications, ${pushOn ? 'Focus alerts on' : 'off'}`}>
          <Text variant="body" style={[styles.rowText, styles.flex]}>
            Notifications
          </Text>
          <Text variant="subhead" color="ink2">
            {pushOn === null ? '' : pushOn ? 'Focus alerts on' : 'Off'}
          </Text>
        </ListRow>
        <ListRow onPress={explainLocation} chevron accessibilityLabel={`Location, ${locationLabel}`}>
          <Text variant="body" style={[styles.rowText, styles.flex]}>
            Location
          </Text>
          <Text variant="subhead" color="ink2">
            {locationLabel}
          </Text>
        </ListRow>
        <ListRow onPress={() => navigation.navigate('ForgotPassword', { email: user.email })} chevron divider={false}>
          <Text variant="body" style={[styles.rowText, styles.flex]}>
            Change password
          </Text>
        </ListRow>
      </Card>

      <Card style={[styles.card, styles.gap]}>
        <ListRow onPress={() => Linking.openURL(`${SITE_ROOT}/privacy`)} accessibilityHint="Opens in your browser">
          <Text variant="body" style={styles.rowText}>
            Privacy
          </Text>
        </ListRow>
        <ListRow onPress={() => Linking.openURL(`${SITE_ROOT}/terms`)} accessibilityHint="Opens in your browser">
          <Text variant="body" style={styles.rowText}>
            Terms
          </Text>
        </ListRow>
        <ListRow onPress={() => navigation.navigate('DeleteAccount')} divider={false}>
          <Text variant="body" color="danger" style={styles.rowText}>
            Delete my account
          </Text>
        </ListRow>
      </Card>

      <PressableScale
        onPress={confirmSignOut}
        style={[styles.signOut, { backgroundColor: colors.panel, borderColor: colors.cardRing }]}
        accessibilityLabel="Sign out"
      >
        <Text variant="bodyStrong" color="danger">
          Sign out
        </Text>
      </PressableScale>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  name: { marginTop: 12 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 22, marginHorizontal: space.gutter },
  tilesStacked: { flexDirection: 'column' },
  tile: { borderRadius: radius.tile },
  tileInner: { paddingVertical: 14, paddingHorizontal: 14, gap: 2 },
  month: { marginTop: 10, marginHorizontal: 20 },
  code: { fontSize: 13.5 },
  groupLabel: { marginTop: 28, marginBottom: 8, marginHorizontal: 20 },
  card: { marginHorizontal: space.gutter },
  gap: { marginTop: 22 },
  appearance: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 10, borderBottomWidth: 1 },
  rowText: { fontSize: 16 },
  signOut: { marginHorizontal: space.gutter, marginTop: 16, minHeight: 52, borderRadius: radius.card, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
