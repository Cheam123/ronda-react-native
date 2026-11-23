import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage } from "../../api/client";
import {
  answerIdea,
  fetchDrinkIdeas,
  menuKeys,
  type DrinkIdea,
  type DrinkIdeas,
  type IdeaStatus,
} from "../../api/menu";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { askChoice } from "../../components/ChoiceSheet";
import { EmptyState, LoadError } from "../../components/EmptyState";
import { DetailsSkeleton } from "../../components/LoadingSkeletons";
import { DetailScreen } from "../../components/Screen";
import { Text } from "../../components/Text";
import { formatMoney, plural } from "../../lib/format";
import { haptic } from "../../lib/haptics";
import { failedToLoad } from "../../lib/query";
import type { RootScreenProps } from "../../navigation/types";
import { useColors } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

const SERVE: Record<DrinkIdea["serve"], string> = {
  hot: "Hot",
  iced: "Iced",
  either: "Hot or iced",
};

/** Reasons shown before "more reasons"; the strongest come first. */
const REASONS_SHOWN = 3;

const ANSWERS: { status: IdeaStatus; label: string }[] = [
  { status: "pitched", label: "Pitched" },
  { status: "accepted", label: "Accepted" },
  { status: "declined", label: "Declined" },
];

/**
 * Drinks this outlet could add, from its menu when it has one, what the owner
 * told the rep and the places around it. The rep marks what they did with each
 * idea, or orders the products it needs.
 */
export function DrinkIdeasScreen({
  route,
  navigation,
}: RootScreenProps<"DrinkIdeas">) {
  const { id, name } = route.params;
  const { abilities } = useAuth();
  const queryClient = useQueryClient();
  const ideas = useQuery({
    queryKey: menuKeys.ideas(id),
    queryFn: () => fetchDrinkIdeas(id),
  });
  const data = ideas.data;
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = useMutation({
    mutationFn: answerIdea,
    onMutate: (input) => {
      setSaving(input.recipeId);
      setError(null);
    },
    onSuccess: (answers) => {
      haptic.light();
      queryClient.setQueryData<DrinkIdeas>(menuKeys.ideas(id), (old) =>
        old ? { ...old, answers } : old,
      );
    },
    onError: (e) => setError(errorMessage(e)),
    onSettled: () => setSaving(null),
  });

  const pick = (idea: DrinkIdea, status: IdeaStatus) => {
    if (!data) return;
    const current = data.answers.drink_feedback[idea.recipe_id];
    const send = (next: IdeaStatus | "cleared", reason?: string) =>
      answer.mutate({
        leadId: id,
        recipeId: idea.recipe_id,
        menuScanId: data.menu_scan_id,
        status: next,
        reason,
      });

    // Tapping the answer already given takes it back.
    if (current === status) return send("cleared");
    if (status !== "declined") return send(status);

    askChoice({
      title: `Why did they decline ${idea.name}?`,
      choices: Object.entries(data.decline_reasons).map(([key, label]) => ({
        label,
        run: () => send("declined", key),
      })),
    });
  };

  return (
    <DetailScreen
      backLabel={name ?? "Outlet"}
      onRefresh={() => ideas.refetch()}
      bottomBar={
        <Button
          label={data?.menu_scan_id ? "Scan a newer menu" : "Scan their menu"}
          variant="secondary"
          style={styles.flex}
          onPress={() => navigation.navigate("ScanMenu", { id, name })}
        />
      }
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Drink ideas
      </Text>
      {data?.based_on.length ? (
        <Text variant="body" color="ink2" style={styles.lead}>
          Based on {listWords(data.based_on)}.
        </Text>
      ) : null}

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

      {ideas.isPending ? (
        <DetailsSkeleton label="Loading drink ideas" />
      ) : failedToLoad(ideas) || !data ? (
        <View style={styles.block}>
          <LoadError
            message={errorMessage(ideas.error)}
            onRetry={() => ideas.refetch()}
          />
        </View>
      ) : data.ideas.length === 0 ? (
        <View style={styles.block}>
          <EmptyState
            icon="review"
            title="No drink ideas yet"
            body={
              data.based_on.length
                ? "None of the drinks suits this outlet well enough right now, or the ones that would were declined lately."
                : "Too little is known about this outlet. Fill in what it needs on the outlet form, or scan its menu."
            }
            action={
              abilities.edit_lead
                ? {
                    label: "Edit outlet",
                    onPress: () => navigation.navigate("OutletForm", { id }),
                  }
                : undefined
            }
          />
        </View>
      ) : (
        data.ideas.map((idea) => (
          <IdeaCard
            key={idea.recipe_id}
            idea={idea}
            status={data.answers.drink_feedback[idea.recipe_id]}
            reason={
              data.decline_reasons[
                data.answers.drink_reasons[idea.recipe_id] ?? ""
              ]
            }
            busy={saving === idea.recipe_id}
            onAnswer={(status) => pick(idea, status)}
            onOrder={
              abilities.record_order
                ? () =>
                    navigation.navigate("RecordOrder", {
                      outletId: id,
                      suggested: idea.products
                        .filter((p) => !p.already_buys)
                        .map((p) => ({
                          productId: p.product_id,
                          quantity: p.quantity,
                        })),
                    })
                : undefined
            }
          />
        ))
      )}
    </DetailScreen>
  );
}

function IdeaCard({
  idea,
  status,
  reason,
  busy,
  onAnswer,
  onOrder,
}: {
  idea: DrinkIdea;
  status: IdeaStatus | undefined;
  reason: string | undefined;
  busy: boolean;
  onAnswer: (status: IdeaStatus) => void;
  onOrder?: () => void;
}) {
  const colors = useColors();
  const [allReasons, setAllReasons] = useState(false);
  const toOrder = idea.products.filter((p) => !p.already_buys);
  const has = idea.products.filter((p) => p.already_buys);
  const reasons = allReasons
    ? idea.reasons
    : idea.reasons.slice(0, REASONS_SHOWN);

  return (
    <Card style={[styles.card, status === "declined" && styles.declined]}>
      <Text variant="rowTitle" accessibilityRole="header">
        {idea.name}
      </Text>
      <Text variant="caption" color="ink2" style={styles.meta}>
        {SERVE[idea.serve]} · {formatMoney(idea.cost_per_serve)} of ingredients
        a serve
      </Text>
      {idea.description ? (
        <Text variant="subhead" style={styles.gap}>
          {idea.description}
        </Text>
      ) : null}

      {reasons.length ? (
        <View style={styles.reasons}>
          {reasons.map((text) => (
            <Text key={text} variant="subhead" color="ink2">
              ✓ {text}
            </Text>
          ))}
          {idea.reasons.length > REASONS_SHOWN ? (
            <Text
              variant="captionStrong"
              color="link"
              style={styles.more}
              onPress={() => setAllReasons(!allReasons)}
              accessibilityRole="button"
              accessibilityState={{ expanded: allReasons }}
            >
              {allReasons
                ? "Fewer reasons"
                : `${idea.reasons.length - REASONS_SHOWN} more reasons`}
            </Text>
          ) : null}
        </View>
      ) : null}

      {has.length ? (
        <Text variant="subhead" color="ink2" style={styles.gap}>
          Already buys {has.map((p) => p.name).join(", ")}
        </Text>
      ) : null}
      <Text variant="subhead" style={styles.gap}>
        {toOrder.length
          ? `Needs ${toOrder.map((p) => `${p.name} (${[p.quantity, p.unit].filter(Boolean).join(" ")} a month)`).join(", ")}`
          : "Needs nothing new. They already buy everything it takes."}
      </Text>
      {toOrder.length ? (
        <Text variant="caption" color="ink2" style={styles.meta}>
          About {formatMoney(idea.est_monthly_value)} a month to start
        </Text>
      ) : null}

      <View
        style={[styles.answers, { borderTopColor: colors.divider }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={`What happened with ${idea.name}`}
      >
        {ANSWERS.map((a) => (
          <Button
            key={a.status}
            label={a.label}
            size="medium"
            variant={
              status === a.status
                ? a.status === "declined"
                  ? "danger"
                  : "primary"
                : "secondary"
            }
            disabled={busy}
            style={styles.flex}
            onPress={() => onAnswer(a.status)}
          />
        ))}
      </View>
      {status === "declined" && reason ? (
        <Text variant="caption" color="ink2" style={styles.meta}>
          Declined: {reason}
        </Text>
      ) : null}
      {onOrder && toOrder.length ? (
        <Button
          label={`Order ${plural(toOrder.length, "product")}`}
          size="medium"
          variant="ghost"
          style={styles.order}
          onPress={onOrder}
        />
      ) : null}
    </Card>
  );
}

/** "a, b and c" */
function listWords(words: string[]): string {
  return words.length <= 1
    ? words.join("")
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { marginHorizontal: 20, marginTop: 8 },
  lead: { marginHorizontal: 20, marginTop: 4 },
  block: { marginTop: 20 },
  card: {
    marginHorizontal: space.gutter,
    marginTop: 16,
    borderRadius: radius.card,
    padding: 18,
  },
  declined: { opacity: 0.7 },
  meta: { marginTop: 4 },
  gap: { marginTop: 10 },
  reasons: { marginTop: 10, gap: 4 },
  more: { marginTop: 2, paddingVertical: 4, alignSelf: "flex-start" },
  answers: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  order: { marginTop: 8 },
});
