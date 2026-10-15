import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SITE_ROOT, type LocalFile } from '../api/client';
import { addPhotos } from '../lib/photos';
import { useColors } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** A server file path is a full URL in production (S3); make a relative one absolute. */
export function fileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
}

interface PhotoStripProps {
  photos: LocalFile[];
  onChange?: (next: LocalFile[]) => void;
  size?: number;
  max?: number;
}

/** Photos being added to a record, with an "Add photo" tile at the end. */
export function PhotoStrip({ photos, onChange, size = 72, max = 6 }: PhotoStripProps) {
  const colors = useColors();
  const add = async () => {
    const picked = await addPhotos(max - photos.length);
    if (picked.length) onChange?.([...photos, ...picked].slice(0, max));
  };
  return (
    <View style={styles.row}>
      {photos.map((p, i) => (
        <View key={`${p.uri}-${i}`} style={[styles.thumb, { width: size, height: size, backgroundColor: colors.line }]}>
          <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
          {onChange ? (
            <PressableScale
              onPress={() => onChange(photos.filter((_, j) => j !== i))}
              accessibilityLabel={`Remove photo ${i + 1}`}
              hitSlop={8}
              style={[styles.remove, { backgroundColor: 'rgba(16,24,40,0.7)' }]}
            >
              <Icon name="close" size={14} color="#FFFFFF" strokeWidth={2.6} />
            </PressableScale>
          ) : null}
        </View>
      ))}
      {onChange && photos.length < max ? (
        <PressableScale
          onPress={add}
          accessibilityLabel="Add a photo"
          style={[styles.add, { width: size, height: size, borderColor: colors.control, backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel }]}
        >
          <Icon name="camera" size={24} color={colors.ink2} />
          {size >= 96 ? (
            <Text variant="label" color="ink2">
              Add photo
            </Text>
          ) : null}
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Photos already on the server. A failed load shows the file name instead. */
export function RemotePhotos({ files, size = 96 }: { files: { id: number; file_path: string; name: string }[]; size?: number }) {
  return (
    <View style={styles.row}>
      {files.map((f, i) => (
        <RemotePhoto key={f.id} url={fileUrl(f.file_path)} label={files.length > 1 ? `Photo ${i + 1} of ${files.length}` : 'Photo'} size={size} />
      ))}
    </View>
  );
}

/** A saved photo. Stored file names are long codes, so the label is "Photo 2 of 3" instead. */
function RemotePhoto({ url, label, size }: { url: string | null; label: string; size: number }) {
  const colors = useColors();
  const [failed, setFailed] = useState(!url);
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: colors.line }]}>
      {failed ? (
        <View style={styles.fallback} accessible accessibilityLabel={`${label}, no preview`}>
          <Icon name="camera" size={22} color={colors.ink2} />
          {size >= 80 ? (
            <Text variant="footnote" color="ink2" align="center">
              No preview
            </Text>
          ) : null}
        </View>
      ) : (
        <Image source={{ uri: url! }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailed(true)} accessibilityLabel={label} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { borderRadius: 14, overflow: 'hidden' },
  remove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  add: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  fallback: { flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
