import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';
import type { LocalFile } from '../api/client';
import { askChoice } from '../components/ChoiceSheet';

function toLocalFile(asset: ImagePicker.ImagePickerAsset, index: number): LocalFile {
  const ext = (asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg').replace('jpeg', 'jpg');
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}-${index}.${ext}`,
    type: asset.mimeType ?? 'image/jpeg',
  };
}

/** Take a photo with the camera. Null when cancelled or not allowed. */
export async function takePhoto(): Promise<LocalFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Camera is off for Ronda', 'Turn on the camera for Ronda in your phone settings to take a photo.', [
      { text: 'Close', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.length) return null;
  return toLocalFile(result.assets[0], 0);
}

/** Choose photos from the phone (the system picker needs no permission). */
export async function choosePhotos(limit = 6): Promise<LocalFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.map(toLocalFile);
}

/** Ask camera or library, then return what was picked. */
export function addPhotos(limit = 6): Promise<LocalFile[]> {
  return new Promise((resolve) => {
    askChoice({
      title: 'Add a photo',
      choices: [
        { label: 'Take a photo', hint: 'With the camera', run: () => takePhoto().then((p) => resolve(p ? [p] : [])) },
        { label: 'Choose from photos', hint: 'From your phone', run: () => choosePhotos(limit).then(resolve) },
      ],
      onDismiss: () => resolve([]),
    });
  });
}
