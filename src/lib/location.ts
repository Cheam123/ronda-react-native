import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import type { GpsStamp } from '../api/outlets';
import { formatDateTime } from './format';

/**
 * Location is only ever read when the person taps Stamp location (or a form's
 * gps field is set to capture on its own). Nothing runs in the background,
 * and the permission asked for is "while using the app".
 */
export async function stampLocation(): Promise<GpsStamp | null> {
  const current = await Location.getForegroundPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Location.requestForegroundPermissionsAsync()).granted;
  if (!granted) {
    Alert.alert('We could not check your location', 'Turn on location for Ronda in your phone settings, then tap Stamp location again.', [
      { text: 'Close', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      lat: round(position.coords.latitude, 6),
      lng: round(position.coords.longitude, 6),
      accuracy: position.coords.accuracy != null ? Math.round(position.coords.accuracy) : null,
      captured_at: new Date(position.timestamp).toISOString(),
    };
  } catch {
    Alert.alert('We could not check your location', 'Move to a spot with a clear view of the sky, then try again.');
    return null;
  }
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * The stamp as readable text for a visit report's location field, which the
 * app can read back: "Stamped 3.11803, 101.62402 (±12 m), 6 Oct 2026, 10:42 AM".
 */
export function stampText(stamp: GpsStamp): string {
  const acc = stamp.accuracy != null ? ` (±${Math.round(stamp.accuracy)} m)` : '';
  return `Stamped ${stamp.lat.toFixed(5)}, ${stamp.lng.toFixed(5)}${acc}, ${formatDateTime(new Date(stamp.captured_at))}`;
}

/** Read a stamp back out of a location text. Null when it holds no coordinates. */
export function parseStampText(text: string | null | undefined): { lat: number; lng: number; accuracy: number | null; when: string | null } | null {
  if (!text) return null;
  const coords = /(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/.exec(text);
  if (!coords) return null;
  const acc = /±\s*(\d+)\s*m/.exec(text);
  const when = /\),\s*(.+)$/.exec(text) ?? /\d,\s*(\d{1,2} \w{3} \d{4}.*)$/.exec(text);
  return { lat: Number(coords[1]), lng: Number(coords[2]), accuracy: acc ? Number(acc[1]) : null, when: when ? when[1].trim() : null };
}

/** Metres between two points (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Further than this from the outlet's own stamp, the visit may not have been there. */
export const NEAR_OUTLET_METRES = 500;

/** "18 m" or "1.2 km". */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(1, Math.round(m))} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en-US')} km`;
}

/** Open directions in the phone's maps app: to the stamp if there is one, else the address. */
export function openDirections(target: { location?: { lat: number; lng: number } | null; address?: string | null; name?: string | null }) {
  const dest = target.location
    ? `${target.location.lat},${target.location.lng}`
    : encodeURIComponent([target.name, target.address].filter(Boolean).join(', '));
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${dest}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
  });
  Linking.openURL(url).catch(() => Alert.alert('We could not open the map', 'Check that a maps app is on this phone.'));
}
