import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { OutletRow } from '../../api/outlets';
import { useAuth } from '../../auth/AuthProvider';
import { Sheet, SheetAction, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { callNumber, messageNumber } from '../../lib/contact';
import { openDirections } from '../../lib/location';
import { kindLabel, outletName, visitedLabel } from '../../lib/outletCopy';

/** Press and hold an outlet: it lifts out with what reps do most there. */
export const OutletPreview = forwardRef<SheetHandle, { outlet: OutletRow | null; onOpen: (o: OutletRow) => void; onVisit: (o: OutletRow) => void; onOrder: (o: OutletRow) => void }>(
  function OutletPreview({ outlet: o, onOpen, onVisit, onOrder }, ref) {
    const { abilities } = useAuth();
    const close = () => (ref && typeof ref === 'object' ? ref.current?.close() : undefined);
    const run = (fn: () => void) => () => {
      close();
      fn();
    };
    const missing = 'Add a mobile number in Outlet details first.';

    return (
      <Sheet ref={ref} snapPoints={['60%', '85%']}>
        {o ? (
          <View>
            <Text variant="section" accessibilityRole="header" style={styles.title}>
              {outletName(o)}
            </Text>
            <Text variant="subhead" color="ink2">
              {kindLabel(o.kind)} · {visitedLabel(o.last_visit_at)}
            </Text>
            <View style={styles.actions}>
              {o.mobile ? <SheetAction label="Call" hint={o.mobile} onPress={run(() => callNumber(o.mobile, missing))} /> : null}
              {o.mobile ? <SheetAction label="Message" hint="WhatsApp, or a text message" onPress={run(() => messageNumber(o.mobile, undefined, missing))} /> : null}
              <SheetAction label="Directions" hint={o.address ?? undefined} onPress={run(() => openDirections({ location: o.location, address: o.address, name: outletName(o) }))} />
              {abilities.ife_report ? <SheetAction label="Log a visit" onPress={run(() => onVisit(o))} /> : null}
              {abilities.record_order ? <SheetAction label="Record an order" onPress={run(() => onOrder(o))} /> : null}
              <SheetAction label="Open the outlet" onPress={run(() => onOpen(o))} />
            </View>
          </View>
        ) : null}
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  title: { marginTop: 4 },
  actions: { marginTop: 12 },
});
