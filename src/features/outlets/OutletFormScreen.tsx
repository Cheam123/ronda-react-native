import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { errorMessage, isApiError, type LocalFile } from '../../api/client';
import { fetchOutlet, fetchOutletOptions, outletKeys, saveOutlet, type GpsStamp, type OutletDetail } from '../../api/outlets';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { PhotoStrip } from '../../components/PhotoStrip';
import { PressableScale } from '../../components/Pressable';
import { DetailScreen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { formatDate, formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { stampLocation } from '../../lib/location';
import type { RootScreenProps } from '../../navigation/types';
import { useConfirmLeave } from '../../navigation/useConfirmLeave';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

/** Add an outlet, or change one. The server calls it a lead. */
export function OutletFormScreen({ route, navigation }: RootScreenProps<'OutletForm'>) {
  const id = route.params?.id;
  const existing = useQuery({ queryKey: outletKeys.detail(id ?? 0), queryFn: () => fetchOutlet(id!), enabled: !!id });

  // Changing an outlet: fill the form once, from the outlet as it loaded.
  if (id && !existing.data) {
    return (
      <DetailScreen modalHeader={{ title: 'Edit outlet', onCancel: () => navigation.goBack() }}>
        <Loading />
      </DetailScreen>
    );
  }
  return <OutletFormBody id={id} initial={existing.data ?? null} navigation={navigation} />;
}

function OutletFormBody({ id, initial: o, navigation }: { id?: number; initial: OutletDetail | null; navigation: RootScreenProps<'OutletForm'>['navigation'] }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: outletKeys.options, queryFn: fetchOutletOptions, staleTime: 30 * 60_000 });

  const [shop, setShop] = useState(o?.business_name ?? '');
  const [company, setCompany] = useState(o?.name ?? '');
  const [mobile, setMobile] = useState(o?.mobile ?? '');
  const [email, setEmail] = useState(o?.email ?? '');
  const [address, setAddress] = useState(o?.address ?? '');
  const [postcode, setPostcode] = useState(o?.postcode ?? '');
  const [stateId, setStateId] = useState<number | null>(o?.state_id ?? null);
  const [cityId, setCityId] = useState<number | null>(o?.city_id ?? null);
  const [category, setCategory] = useState<number | null>(o?.business_category_id ?? null);
  const [source, setSource] = useState<number | null>(o?.lead_source_id ?? null);
  const [size, setSize] = useState<string | null>(o?.size_band ?? null);
  const [seats, setSeats] = useState(o?.seats ? String(o.seats) : '');
  const [segment, setSegment] = useState<string | null>(o?.segment ?? null);
  const [customerId, setCustomerId] = useState(o?.customer_id ?? '');
  const [remark, setRemark] = useState(o?.remarks ?? '');
  const [stamp, setStamp] = useState<GpsStamp | null | undefined>(undefined);
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Anything changed from the outlet as it loaded (or from empty, for a new one).
  const changed =
    shop !== (o?.business_name ?? '') ||
    company !== (o?.name ?? '') ||
    mobile !== (o?.mobile ?? '') ||
    email !== (o?.email ?? '') ||
    address !== (o?.address ?? '') ||
    postcode !== (o?.postcode ?? '') ||
    remark !== (o?.remarks ?? '') ||
    customerId !== (o?.customer_id ?? '') ||
    seats !== (o?.seats ? String(o.seats) : '') ||
    stamp !== undefined ||
    photos.length > 0;
  const allowLeave = useConfirmLeave(changed, { title: id ? 'Discard your changes?' : 'Discard this outlet?', keep: 'Keep editing' });

  const save = useMutation({
    mutationFn: () =>
      saveOutlet({
        id,
        name: company.trim() || shop.trim(),
        business_name: shop.trim() || null,
        mobile: mobile.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        postcode: postcode.trim() || null,
        state_id: stateId,
        city_id: cityId,
        businesscat: category,
        leadsource: source,
        size_band: size,
        seats: seats ? Number(seats) : null,
        segment,
        customer_id: customerId.trim() || null,
        remark: remark.trim() || null,
        // Only send a stamp when one was taken; leaving it out keeps the saved one.
        ...(stamp !== undefined ? { gps: stamp } : {}),
        files: photos,
      }),
    onSuccess: ({ id: savedId }) => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      allowLeave();
      if (id) navigation.goBack();
      else navigation.replace('Outlet', { id: savedId, name: shop.trim() || company.trim() });
    },
    onError: (e) => {
      haptic.error();
      if (isApiError(e) && Object.keys(e.fieldErrors).length) {
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.fieldErrors)) map[k] = v[0];
        setErrors(map);
      }
      Alert.alert(id ? 'We could not save the outlet' : 'We could not add the outlet', errorMessage(e));
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!shop.trim() && !company.trim()) next.business_name = 'Enter the shop name.';
    if (!mobile.trim()) next.mobile = 'Enter a mobile number.';
    else if (mobile.replace(/\D/g, '').length < 8) next.mobile = 'Check the mobile number.';
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.error();
      return;
    }
    save.mutate();
  };

  const doStamp = async () => {
    const s = await stampLocation();
    if (s) {
      haptic.light();
      setStamp(s);
    }
  };

  const opts = options.data;
  const cities = (opts?.cities ?? []).filter((c) => !stateId || !c.state_id || c.state_id === stateId);
  const savedStamp = o?.location ?? null;
  const shownStamp = stamp === undefined ? savedStamp : stamp;

  return (
    <DetailScreen
      keyboard
      modalHeader={{ title: id ? 'Edit outlet' : 'Add an outlet', onCancel: () => navigation.goBack() }}
      bottomBar={<Button label={id ? 'Save changes' : 'Add outlet'} loading={save.isPending} style={styles.flex} onPress={submit} />}
    >
      <Text variant="label" color="ink2" style={styles.section} accessibilityRole="header">
        The outlet
      </Text>
      <Card padded style={styles.card}>
        <TextField label="Shop name" value={shop} onChangeText={setShop} error={errors.business_name} placeholder="For example: Daily Grind SS2" />
        <TextField label="Company" optional value={company} onChangeText={setCompany} error={errors.name} placeholder="The registered company name" />
        <SelectField
          label="Type"
          optional
          value={category}
          onChange={setCategory}
          options={(opts?.business_category ?? []).map((o) => ({ value: Number(o.value), label: o.label }))}
          searchable
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <SelectField label="Size" optional value={size} onChange={setSize} options={(opts?.size_bands ?? []).map((o) => ({ value: String(o.value), label: o.label }))} />
          </View>
          <View style={styles.flex}>
            <TextField label="Seats" optional value={seats} onChangeText={(t) => setSeats(t.replace(/\D/g, ''))} keyboardType="number-pad" error={errors.seats} />
          </View>
        </View>
        <SelectField label="Price level" optional value={segment} onChange={setSegment} options={(opts?.segments ?? []).map((o) => ({ value: String(o.value), label: o.label }))} />
        <TextField label="Customer ID" optional mono value={customerId} onChangeText={setCustomerId} autoCapitalize="characters" hint="Leave empty for a prospect." />
      </Card>

      <Text variant="label" color="ink2" style={styles.section} accessibilityRole="header">
        Contact
      </Text>
      <Card padded style={styles.card}>
        <TextField label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" error={errors.mobile} placeholder="012 345 6789" maxLength={15} />
        <TextField label="Email" optional value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
      </Card>

      <Text variant="label" color="ink2" style={styles.section} accessibilityRole="header">
        Where
      </Text>
      <Card padded style={styles.card}>
        <TextField label="Address" optional value={address} onChangeText={setAddress} multiline error={errors.address} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Postcode" optional value={postcode} onChangeText={setPostcode} keyboardType="number-pad" />
          </View>
        </View>
        <SelectField
          label="State"
          optional
          searchable
          value={stateId}
          onChange={(v) => {
            setStateId(v);
            setCityId(null);
          }}
          options={(opts?.states ?? []).map((o) => ({ value: Number(o.value), label: o.label }))}
        />
        <SelectField label="City" optional searchable value={cityId} onChange={setCityId} options={cities.map((o) => ({ value: Number(o.value), label: o.label }))} />
        <PressableScale
          onPress={doStamp}
          accessibilityRole="button"
          accessibilityHint="We only store your GPS location when you stamp."
          style={[styles.stamp, { borderColor: shownStamp ? colors.tones.good.dot : '#84ADC2', backgroundColor: shownStamp ? colors.tones.good.tile : colors.panel }]}
        >
          <Icon name="pin" size={22} color={shownStamp ? colors.tones.good.ink : colors.brand} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" color={shownStamp ? colors.tones.good.ink : colors.ink}>
              {shownStamp ? 'Location stamped' : 'Stamp the outlet’s location'}
            </Text>
            <Text variant="footnote" color="ink2">
              {shownStamp
                ? `${formatDate(shownStamp.captured_at)}, ${formatTime(shownStamp.captured_at)}. Tap to stamp again while you are at the outlet.`
                : 'Do this while you are at the outlet. We only store your location when you stamp.'}
            </Text>
          </View>
        </PressableScale>
      </Card>

      <Text variant="label" color="ink2" style={styles.section} accessibilityRole="header">
        More
      </Text>
      <Card padded style={styles.card}>
        <SelectField label="How we found them" optional value={source} onChange={setSource} options={(opts?.lead_source ?? []).map((o) => ({ value: Number(o.value), label: o.label }))} />
        <TextField label="Remark" optional value={remark} onChangeText={setRemark} multiline />
        <View style={styles.gap}>
          <Text variant="captionStrong" color="body">
            Photos and files{' '}
            <Text variant="caption" color="muted">
              (optional)
            </Text>
          </Text>
          <PhotoStrip photos={photos} onChange={setPhotos} />
        </View>
      </Card>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card, gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.inner, borderWidth: 1.5, borderStyle: 'dashed' },
  gap: { gap: 8 },
});
