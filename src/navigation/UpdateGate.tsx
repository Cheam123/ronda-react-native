import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchVersion } from '../api/auth';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { RondaRing } from '../motion/RondaRing';
import { useColors } from '../theme/ThemeProvider';

/** -1, 0 or 1, comparing dotted versions ("1.2.10" > "1.2.9"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Blocks the app when this build is older than the server's min_version. */
export function UpdateGate({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const current = Constants.expoConfig?.version ?? '1.0.0';
  const { data } = useQuery({ queryKey: ['version'], queryFn: fetchVersion, staleTime: 60 * 60 * 1000, retry: 1 });

  const mustUpdate = !!data?.min_version && compareVersions(current, data.min_version) < 0;
  if (!mustUpdate) return <>{children}</>;

  const openDownload = async () => {
    try {
      const body = await api.get<{ download_link?: string | null }>('download-link');
      if (body.download_link) await Linking.openURL(body.download_link);
    } catch {
      // Nothing more to do; the message stays on screen.
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.ground, paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
      <RondaRing size={56} spinning={false} accessibilityLabel="Ronda" />
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Please update Ronda
      </Text>
      <Text variant="body" color="ink2">
        This version ({current}) is too old to use. Update to version {data?.life_version ?? data?.min_version} to carry on with your round.
      </Text>
      <Button label="Update Ronda" onPress={openDownload} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: 24, gap: 12 },
  title: { marginTop: 20 },
  button: { marginTop: 'auto' },
});
