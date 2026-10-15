import { Alert, Linking } from 'react-native';

/**
 * Calling and messaging a person or an outlet. Numbers are stored in more
 * than one way ("012-345 6789", "60123456789"); WhatsApp needs the country
 * code, so a Malaysian number written with a leading 0 gets 60.
 */
export function whatsappDigits(mobile: string | null | undefined): string | null {
  const digits = (mobile ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('0') ? `6${digits}` : digits;
}

export function callNumber(mobile: string | null | undefined, missing = 'There is no phone number saved.') {
  const digits = (mobile ?? '').replace(/[^\d+]/g, '');
  if (!digits) return Alert.alert('No phone number', missing);
  Linking.openURL(`tel:${digits}`).catch(() => Alert.alert('We could not start the call', 'Check that this phone can make calls.'));
}

/** WhatsApp, with an optional message ready to send; a text message when WhatsApp is not there. */
export function messageNumber(mobile: string | null | undefined, text?: string, missing = 'There is no phone number saved.') {
  const wa = whatsappDigits(mobile);
  if (!wa) return Alert.alert('No phone number', missing);
  const body = text ? `?text=${encodeURIComponent(text)}` : '';
  Linking.openURL(`https://wa.me/${wa}${body}`).catch(() => Linking.openURL(`sms:${wa}${text ? `?body=${encodeURIComponent(text)}` : ''}`));
}
