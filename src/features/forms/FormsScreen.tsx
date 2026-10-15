import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { fetchFormTurns, fetchRecords, formKeys, type FormTurn } from '../../api/forms';
import { useAuth } from '../../auth/AuthProvider';
import { Card, ListRow } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Skeleton, TextBone } from '../../components/LoadingSkeletons';
import { MetaLine } from '../../components/PlaceAndNote';
import { TabScreen } from '../../components/Screen';
import { SearchBox } from '../../components/SearchBox';
import { Text } from '../../components/Text';
import { plural } from '../../lib/format';
import { isMyTurn, turnAction, turnParts, turnSubtitle } from '../../lib/formCopy';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootStackParamList } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { FormCatalogue, useFormCatalogue } from './FormCatalogue';

/** Forms: what is waiting on you, your records, and the forms you can start. */
export function FormsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useColors();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const { query: catalogue, search } = useFormCatalogue(text);
  const turns = useQuery({ queryKey: formKeys.turns, queryFn: fetchFormTurns });
  const records = useQuery({ queryKey: formKeys.records, queryFn: fetchRecords });

  const waiting = turns.data ?? [];
  const mine = records.data ?? [];
  const inReview = mine.filter((r) => r.status === 'pending' && !isMyTurn(r, user?.name)).length;
  const searching = search.length > 0;

  const refresh = () => Promise.all([catalogue.refetch(), turns.refetch(), records.refetch()]);

  return (
    <TabScreen title="Forms" onRefresh={refresh}>
      <SearchBox value={text} onChange={setText} placeholder="Search forms" accessibilityLabel="Search forms" />

      {!searching && waiting.length > 0 ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(260)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="section" accessibilityRole="header">
              Your turn
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.tabBar.badge }]} accessibilityLabel={`${waiting.length} waiting`}>
              <Text variant="label" color="#FFFFFF" style={styles.badgeText}>
                {waiting.length}
              </Text>
            </View>
          </View>
          <Card style={styles.card}>
            {waiting.map((t, i) => (
              <TurnRow key={t.entry_id} turn={t} last={i === waiting.length - 1} onPress={() => navigation.navigate('Record', { id: t.entry_id, title: t.record_title })} />
            ))}
          </Card>
        </Animated.View>
      ) : null}

      {!searching ? (
        <Card style={[styles.card, styles.records]}>
          <ListRow onPress={() => navigation.navigate('Records')} divider={false} chevron style={styles.recordsRow}>
            <View style={[styles.tile, { backgroundColor: colors.tones.neutral.tile }]}>
              <Icon name="records" size={22} color={colors.tones.neutral.ink} />
            </View>
            <View style={styles.flex}>
              <Text variant="rowTitle">My records</Text>
              {records.isPending ? (
                <Skeleton label="Loading your records">
                  <TextBone variant="subhead" width={96} />
                </Skeleton>
              ) : (
                <Text variant="subhead" color="ink2">
                  {mine.length === 0 ? 'Forms you send are kept here' : `${plural(mine.length, 'record')}${inReview ? ` · ${inReview} in review` : ''}`}
                </Text>
              )}
            </View>
          </ListRow>
        </Card>
      ) : null}

      <View style={styles.start}>
        <Text variant="section" accessibilityRole="header" style={styles.startTitle}>
          {searching ? 'Forms' : 'Start a form'}
        </Text>
        <FormCatalogue
          forms={catalogue.data?.forms ?? []}
          groups={catalogue.data?.form_groups ?? []}
          loading={catalogue.isPending}
          error={catalogue.error}
          onRetry={() => catalogue.refetch()}
          search={search}
          onPick={(f) => navigation.navigate('FillForm', { formId: f.id })}
        />
      </View>
    </TabScreen>
  );
}

function TurnRow({ turn, last, onPress }: { turn: FormTurn; last: boolean; onPress: () => void }) {
  const colors = useColors();
  const approval = turn.stage_type === 'approval';
  const tone = approval ? colors.tones.brand : colors.tones.form;
  const action = turnAction(turn);
  return (
    <ListRow onPress={onPress} divider={!last} dividerInset={76} chevron style={styles.turnRow} accessibilityLabel={`${turn.record_title}. ${turnSubtitle(turn)}. ${action}`}>
      <View style={[styles.tile, styles.turnTile, { backgroundColor: tone.tile }]}>
        <Icon name={approval ? 'review' : 'forms'} size={22} color={tone.ink} />
      </View>
      <View style={styles.flex}>
        <Text variant="rowTitle">{turn.record_title}</Text>
        {/* Too long for one line: the form, then who sent it and when. */}
        <MetaLine parts={turnParts(turn)} splitAt={1} variant="subhead" />
        <Text variant="subhead" color="brandInk" style={styles.action}>
          {action}
        </Text>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { marginTop: 32 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  card: { marginHorizontal: space.gutter, borderRadius: radius.card },
  records: { marginTop: 16 },
  recordsRow: { paddingVertical: 16, paddingHorizontal: 18 },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  turnRow: { paddingVertical: 18, paddingHorizontal: 18, alignItems: 'flex-start' },
  turnTile: { alignSelf: 'flex-start' },
  action: { marginTop: 8, fontFamily: fonts.semibold },
  start: { marginTop: 36 },
  startTitle: { marginHorizontal: 20 },
});
