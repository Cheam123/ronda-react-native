import { useQuery } from '@tanstack/react-query';
import { Linking, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { fetchOutletMedia, outletKeys } from '../../api/outlets';
import { Card, ListRow } from '../../components/Card';
import { EmptyState, LoadError } from '../../components/EmptyState';
import { DocumentsSkeleton } from '../../components/LoadingSkeletons';
import { Icon } from '../../components/Icon';
import { fileUrl, RemotePhotos } from '../../components/PhotoStrip';
import { DetailScreen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { formatDate } from '../../lib/format';
import type { RootScreenProps } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

/** Photos and files kept on an outlet. */
export function OutletDocumentsScreen({ route }: RootScreenProps<'OutletDocuments'>) {
  const { id, name } = route.params;
  const colors = useColors();
  const media = useQuery({ queryKey: outletKeys.media(id), queryFn: () => fetchOutletMedia(id) });
  const photos = media.data?.media ?? [];
  const docs = media.data?.documents ?? [];

  return (
    <DetailScreen backLabel={name ?? 'Outlet'} onRefresh={() => media.refetch()}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Documents
      </Text>
      {media.isPending ? (
        <DocumentsSkeleton />
      ) : media.isError ? (
        <View style={styles.block}>
          <LoadError message={errorMessage(media.error)} onRetry={() => media.refetch()} />
        </View>
      ) : photos.length + docs.length === 0 ? (
        <View style={styles.block}>
          <EmptyState icon="document" title="No files yet" body="Photos and files added to this outlet on the web or in the app show up here." />
        </View>
      ) : (
        <>
          {photos.length ? (
            <>
              <Text variant="captionStrong" color="ink2" style={styles.group}>
                Photos
              </Text>
              <View style={styles.photos}>
                <RemotePhotos files={photos} size={104} />
              </View>
            </>
          ) : null}
          {docs.length ? (
            <>
              <Text variant="captionStrong" color="ink2" style={styles.group}>
                Files
              </Text>
              <Card style={styles.card}>
                {docs.map((d, i) => (
                  <ListRow
                    key={d.id}
                    divider={i < docs.length - 1}
                    onPress={() => {
                      const url = fileUrl(d.file_path);
                      if (url) Linking.openURL(url);
                    }}
                    accessibilityHint="Opens the file"
                  >
                    <Icon name="document" size={22} color={colors.ink2} />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong" numberOfLines={2}>
                        {d.name}
                      </Text>
                      <Text variant="caption" color="ink2">
                        {d.uploaded_by} · {formatDate(d.created_at)}
                      </Text>
                    </View>
                  </ListRow>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 8 },
  block: { marginTop: 20 },
  group: { marginTop: 24, marginBottom: 10, marginHorizontal: 20, fontSize: 15 },
  photos: { marginHorizontal: space.gutter },
  card: { marginHorizontal: space.gutter },
});
