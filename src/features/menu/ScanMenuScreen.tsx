import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage, type LocalFile } from "../../api/client";
import {
  confirmMenuScan,
  fetchServerReadsPhotos,
  menuKeys,
  sendMenuScan,
  type DrinkOption,
  type MenuRow,
  type MenuScan,
  type RowChange,
} from "../../api/menu";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CheckCircle } from "../../components/CheckCircle";
import { EmptyState } from "../../components/EmptyState";
import { PhotoStrip } from "../../components/PhotoStrip";
import { DetailScreen } from "../../components/Screen";
import { SelectField } from "../../components/SelectField";
import { Text } from "../../components/Text";
import { formatMoney, plural } from "../../lib/format";
import { haptic } from "../../lib/haptics";
import {
  canReadMenus,
  readMenuPhotos,
  type MenuFragment,
} from "../../lib/menuReader";
import type { RootScreenProps } from "../../navigation/types";
import { useColors } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

const MAX_PHOTOS = 4;

/** "Not one of our drinks" in the drink picker. */
const NOT_A_DRINK = 0;

/**
 * Photograph an outlet's drinks menu: the server reads it (Amazon Textract)
 * when it is set up to, else the phone reads it first (Google ML Kit); the
 * server finds the drinks on it, the rep checks what was found and saves it.
 * The outlet's drink ideas then leave out what it already sells.
 */
export function ScanMenuScreen({
  route,
  navigation,
}: RootScreenProps<"ScanMenu">) {
  const { id, name } = route.params;
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const [fragments, setFragments] = useState<MenuFragment[]>([]);
  const [draft, setDraft] = useState<MenuScan | null>(null);
  const [drinks, setDrinks] = useState<DrinkOption[]>([]);
  const [changes, setChanges] = useState<Record<number, RowChange>>({});
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Textract couldn't read the photos: the phone may read them instead.
  const [phoneFallback, setPhoneFallback] = useState(false);

  // Whether the server reads the photos itself. Unknown (offline) counts as no.
  const reader = useQuery({
    queryKey: menuKeys.reader(id),
    queryFn: () => fetchServerReadsPhotos(id),
    staleTime: 5 * 60_000,
  });
  const serverReads = reader.data === true;
  const phoneReads = canReadMenus();

  const changePhotos = (next: LocalFile[]) => {
    setPhotos(next);
    setError(null);
    setPhoneFallback(false);
  };

  const read = async (onPhone = !serverReads) => {
    setBusy("reading");
    setError(null);
    setPhoneFallback(false);
    // Reading on the phone and sending to the server each fail in their own way.
    let sending = false;
    try {
      // When the server reads the photos, they go as they are. Read on the
      // phone, they still go with their text: an empty reading is answered
      // with "nothing could be read".
      const lines = onPhone ? await readMenuPhotos(photos) : [];
      setFragments(lines);
      sending = true;
      const result = await sendMenuScan(
        id,
        lines,
        photos,
        onPhone && serverReads ? "phone" : undefined,
      );
      setDraft(result.scan);
      setDrinks(result.drinks);
      setChanges({});
      setCopied(false);
      haptic.light();
    } catch (e) {
      setError(
        sending
          ? errorMessage(e)
          : "The phone could not read these photos. Try again with a sharper photo.",
      );
      if (sending && !onPhone && phoneReads) setPhoneFallback(true);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy("saving");
    setError(null);
    try {
      await confirmMenuScan(draft.id, Object.values(changes));
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: menuKeys.ideas(id) });
      navigation.replace("DrinkIdeas", { id, name });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const change = (row: MenuRow, next: Omit<RowChange, "id">) =>
    setChanges((prev) => ({
      ...prev,
      [row.id]: { ...prev[row.id], id: row.id, ...next },
    }));

  // Each line with where it sits (x, y, width, height in pixels): the format "php artisan menu:check" reads.
  const copy = async () => {
    const text = photos
      .map((_, page) =>
        [
          `Photo ${page + 1} (x,y,width,height | text)`,
          ...fragments
            .filter((line) => line.page === page)
            .map(
              (line) =>
                `${line.x},${line.y},${line.width},${line.height} | ${line.text}`,
            ),
        ].join("\n"),
      )
      .join("\n\n");
    await Clipboard.setStringAsync(text);
    setCopied(true);
  };

  if (!phoneReads && !serverReads && !reader.isPending) {
    return (
      <DetailScreen backLabel={name ?? "Outlet"}>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          Scan menu
        </Text>
        <View style={styles.block}>
          <EmptyState
            icon="camera"
            title="This phone can't read menus"
            body="Reading a menu needs a newer version of Android or iOS. You can type the menu in on the web instead."
          />
        </View>
      </DetailScreen>
    );
  }

  if (draft) {
    const kept = (row: MenuRow) => changes[row.id]?.kept ?? row.kept;
    const named = (row: MenuRow) =>
      changes[row.id] && "recipe_id" in changes[row.id]
        ? (changes[row.id].recipe_id ?? null)
        : row.recipe_id;
    const onMenu =
      draft.matched.filter(kept).length +
      draft.unrecognised.filter((row) => named(row)).length;

    return (
      <DetailScreen
        backLabel={name ?? "Outlet"}
        bottomBar={
          <>
            <Button
              label="Retake"
              variant="secondary"
              style={styles.flex}
              disabled={busy !== null}
              onPress={() => setDraft(null)}
            />
            <Button
              label={`Save ${plural(onMenu, "drink")}`}
              style={styles.flexMore}
              loading={busy === "saving"}
              onPress={save}
            />
          </>
        }
      >
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          Check the menu
        </Text>
        <Text variant="body" color="ink2" style={styles.lead}>
          Untick anything that isn&apos;t on their menu, and name any drink we
          didn&apos;t recognise.
          {draft.price_label && draft.median_price !== null
            ? ` ${draft.price_label} prices: the middle drink is ${formatMoney(draft.median_price)}.`
            : ""}
        </Text>

        {error ? (
          <Text
            variant="subhead"
            color="danger"
            style={styles.lead}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

        <Text
          variant="section"
          accessibilityRole="header"
          style={styles.heading}
        >
          Found on the menu
        </Text>
        {draft.matched.length === 0 ? (
          <Text variant="subhead" color="ink2" style={styles.lead}>
            None of our drinks were found. Name any you see below, or retake the
            photos closer.
          </Text>
        ) : (
          <Card style={styles.card}>
            {draft.matched.map((row, index) => (
              <FoundRow
                key={row.id}
                row={row}
                kept={kept(row)}
                last={index === draft.matched.length - 1}
                onToggle={() => change(row, { kept: !kept(row) })}
              />
            ))}
          </Card>
        )}

        {draft.unrecognised.length > 0 ? (
          <>
            <Text
              variant="section"
              accessibilityRole="header"
              style={styles.heading}
            >
              Not recognised
            </Text>
            <Text variant="subhead" color="ink2" style={styles.lead}>
              Priced lines that match none of our drinks: often food, or a drink
              under another name.
            </Text>
            {draft.unrecognised.map((row) => (
              <Card key={row.id} style={styles.card}>
                <SelectField<number>
                  label={row.text}
                  options={[
                    { value: NOT_A_DRINK, label: "Not one of our drinks" },
                    ...drinks,
                  ]}
                  searchable
                  value={named(row) ?? NOT_A_DRINK}
                  onChange={(next) =>
                    change(row, {
                      recipe_id: next && next !== NOT_A_DRINK ? next : null,
                    })
                  }
                />
              </Card>
            ))}
          </>
        ) : null}

        {fragments.length > 0 ? (
          <Button
            label={copied ? "Copied" : "Copy what the phone read"}
            variant="ghost"
            size="medium"
            style={styles.copy}
            onPress={copy}
          />
        ) : null}
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      backLabel={name ?? "Outlet"}
      bottomBar={
        <Button
          label={busy === "reading" ? "Reading the menu…" : "Read menu"}
          style={styles.flex}
          disabled={photos.length === 0 || reader.isPending}
          loading={busy === "reading"}
          onPress={() => read()}
        />
      }
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Scan menu
      </Text>
      <Text variant="body" color="ink2" style={styles.lead}>
        Photograph the drinks menu, up to {MAX_PHOTOS} photos.{" "}
        {serverReads ? "Ronda reads it" : "Your phone reads it"}, then you check
        what was found before it is saved.
      </Text>

      <Card style={styles.card}>
        <Text variant="captionStrong" color="ink2">
          For a good read
        </Text>
        <Text variant="subhead" style={styles.tip}>
          Fill the frame with the menu, hold the phone straight and avoid glare.
          Menu only, no people.
        </Text>
      </Card>

      <View style={styles.photos}>
        <PhotoStrip
          photos={photos}
          onChange={changePhotos}
          size={104}
          max={MAX_PHOTOS}
        />
      </View>

      {error ? (
        <Text
          variant="subhead"
          color="danger"
          style={styles.lead}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
      {phoneFallback ? (
        <Button
          label="Read on this phone instead"
          variant="secondary"
          size="medium"
          style={styles.copy}
          disabled={busy !== null}
          onPress={() => read(true)}
        />
      ) : null}
    </DetailScreen>
  );
}

/** A drink found on the menu: the drink, the line it came from, and a tick to keep it. */
function FoundRow({
  row,
  kept,
  last,
  onToggle,
}: {
  row: MenuRow;
  kept: boolean;
  last: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.divider },
      ]}
    >
      <CheckCircle
        checked={kept}
        onPress={onToggle}
        accessibilityLabel={`${row.drink}, on their menu`}
      />
      <View style={styles.flex}>
        <Text variant="rowTitle" color={kept ? "ink" : "muted"}>
          {row.drink}
        </Text>
        <Text variant="subhead" color="ink2">
          {row.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexMore: { flex: 1.6, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  heading: { marginHorizontal: 20, marginTop: 28 },
  block: { marginTop: 20 },
  card: {
    marginHorizontal: space.gutter,
    marginTop: 12,
    borderRadius: radius.card,
    padding: 16,
  },
  tip: { marginTop: 4 },
  photos: { marginHorizontal: space.gutter, marginTop: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  copy: { marginHorizontal: space.gutter, marginTop: 20 },
});
