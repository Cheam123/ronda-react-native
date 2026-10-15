import { useQuery } from '@tanstack/react-query';
import { Linking, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchOutlet, outletKeys } from '../../api/outlets';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadError, Loading } from '../../components/EmptyState';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDate } from '../../lib/format';
import { outletName } from '../../lib/outletCopy';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

/** Everything on file about an outlet: who, where, what kind. */
export function OutletDetailsScreen({ route, navigation }: RootScreenProps<'OutletDetails'>) {
  const { id, name } = route.params;
  const { abilities } = useAuth();
  const outlet = useQuery({ queryKey: outletKeys.detail(id), queryFn: () => fetchOutlet(id) });
  const o = outlet.data;

  const groups: { title: string; rows: { label: string; value: string | null | undefined; mono?: boolean; link?: string }[] }[] = o
    ? [
        {
          title: 'The outlet',
          rows: [
            { label: 'Shop name', value: o.business_name },
            { label: 'Company', value: o.name },
            { label: 'Customer ID', value: o.customer_id, mono: true },
            { label: 'Type', value: o.business_category },
            { label: 'Size', value: o.size_band_label },
            { label: 'Seats', value: o.seats ? String(o.seats) : null },
            { label: 'Price level', value: o.segment_label },
          ],
        },
        {
          title: 'Contact',
          rows: [
            { label: 'Mobile', value: o.mobile, link: o.mobile ? `tel:${o.mobile.replace(/[^\d+]/g, '')}` : undefined },
            { label: 'Email', value: o.email, link: o.email ? `mailto:${o.email}` : undefined },
          ],
        },
        {
          title: 'Where',
          rows: [
            { label: 'Address', value: o.address },
            { label: 'Postcode', value: o.postcode },
            { label: 'City', value: o.city },
            { label: 'State', value: o.state },
            { label: 'Location stamp', value: o.location ? `Stamped ${formatDate(o.location.captured_at)}` : 'Not stamped yet' },
          ],
        },
        {
          title: 'Notes',
          rows: [
            { label: 'Source', value: o.source },
            { label: 'Looked after by', value: o.subscriber },
            { label: 'Added', value: formatDate(o.created_at) },
            { label: 'Remark', value: o.remarks },
          ],
        },
      ]
    : [];

  return (
    <DetailScreen
      backLabel={name ?? 'Outlet'}
      onRefresh={() => outlet.refetch()}
      bottomBar={abilities.edit_lead && o ? <Button label="Edit outlet" style={styles.flex} onPress={() => navigation.navigate('OutletForm', { id })} /> : undefined}
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Outlet details
      </Text>
      {o ? (
        <Text variant="body" color="ink2" style={styles.lead}>
          {outletName(o)}
        </Text>
      ) : null}
      {outlet.isPending ? (
        <Loading />
      ) : outlet.isError || !o ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(outlet.error)} onRetry={() => outlet.refetch()} />
        </View>
      ) : (
        groups.map((g) => {
          const rows = g.rows.filter((r) => r.value);
          if (!rows.length) return null;
          return (
            <View key={g.title}>
              <Text variant="captionStrong" color="ink2" accessibilityRole="header" style={styles.group}>
                {g.title}
              </Text>
              <Card style={styles.card}>
                {rows.map((r, i) => (
                  <DetailRow key={r.label} {...r} last={i === rows.length - 1} />
                ))}
              </Card>
            </View>
          );
        })
      )}
    </DetailScreen>
  );
}

function DetailRow({ label, value, mono, link, last }: { label: string; value?: string | null; mono?: boolean; link?: string; last: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="subhead" color="ink2">
        {label}
      </Text>
      <Text
        variant={mono ? 'mono' : 'subhead'}
        color={link ? 'link' : 'ink'}
        style={styles.value}
        onPress={link ? () => Linking.openURL(link) : undefined}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 20 },
  group: { marginTop: 24, marginBottom: 10, marginHorizontal: 20, fontSize: 15 },
  card: { marginHorizontal: space.gutter, paddingHorizontal: 16, borderRadius: radius.card },
  row: { paddingVertical: 13, gap: 2 },
  value: { fontFamily: 'InstrumentSans_500Medium' },
});
