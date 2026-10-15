import { usePreventRemove } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import Animated, { Easing, SlideInLeft, SlideInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, type LocalFile } from '../../api/client';
import {
  answerErrors,
  cloneEntry,
  fetchEntry,
  fetchForm,
  fetchParents,
  fillStage,
  formKeys,
  needsAssignee,
  submitForm,
  updateEntry,
  type Entry,
  type FormDefinition,
  type NeedsAssignee,
  type ParentOption,
} from '../../api/forms';
import { homeKey } from '../../api/home';
import { useAuth } from '../../auth/AuthProvider';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading, LoadError } from '../../components/EmptyState';
import { Icon, type IconName } from '../../components/Icon';
import { PressableScale } from '../../components/Pressable';
import { BottomBar } from '../../components/Screen';
import { Sheet, type SheetHandle } from '../../components/Sheet';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { formatDayMonth, formatDate } from '../../lib/format';
import { conditionFields, isEmptyValue, resolveVisibility } from '../../lib/forms/conditions';
import { buildSteps, displayValue, formNames, isField, type FormStep } from '../../lib/forms/schema';
import type { AnswerValue, Answers, FieldElement, FormElement } from '../../lib/forms/types';
import { processPreview, sendLabel, type PreviewStep } from '../../lib/formCopy';
import { haptic } from '../../lib/haptics';
import { useReducedMotion } from '../../motion/useReducedMotion';
import type { RootScreenProps, RootStackParamList } from '../../navigation/types';
import { useColors } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { fonts } from '../../theme/type';
import { AnswerRows, usePeople } from './AnswerRows';
import { FormElementView } from './FormField';

type Mode = NonNullable<RootStackParamList['FillForm']['mode']>;
type Parent = { id: number; reference: string; title: string };

/**
 * Fill in a form, one section per screen, then Check and send. The same
 * flow starts a form, fills one in again, changes answers no one has acted
 * on yet, and fills in a step that is someone's turn.
 */
export function FillFormScreen({ route, navigation }: RootScreenProps<'FillForm'>) {
  const { formId, entryId, parent } = route.params;
  const mode: Mode = route.params.mode ?? 'new';
  const needsEntry = (mode === 'edit' || mode === 'stage') && !!entryId;

  const form = useQuery({ queryKey: formKeys.form(formId), queryFn: () => fetchForm(formId), enabled: mode !== 'again' });
  const clone = useQuery({ queryKey: ['forms', 'clone', entryId], queryFn: () => cloneEntry(entryId!), enabled: mode === 'again' && !!entryId, gcTime: 0 });
  const entry = useQuery({ queryKey: formKeys.entry(entryId ?? 0), queryFn: () => fetchEntry(entryId!), enabled: needsEntry });

  const def = mode === 'again' ? clone.data?.form : form.data;
  const failed = (mode === 'again' ? clone.error : form.error) ?? (needsEntry ? entry.error : null);
  const ready = !!def && (!needsEntry || !!entry.data);

  if (failed) {
    return (
      <Frame onClose={() => navigation.goBack()}>
        <LoadError message={errorMessage(failed)} onRetry={() => (mode === 'again' ? clone.refetch() : (form.refetch(), entry.refetch()))} />
      </Frame>
    );
  }
  if (!ready) {
    return (
      <Frame onClose={() => navigation.goBack()}>
        <Loading label="Opening the form" />
      </Frame>
    );
  }

  // The answers start from what is there: a copy when filling in again (but
  // not its photos or stamp), the stored answers when changing or adding a part.
  let initial: Answers = {};
  if (mode === 'again') {
    for (const a of clone.data?.prefill ?? []) if (a.id && a.type !== 'file' && a.type !== 'gps') initial[a.id] = a.value;
  } else if (entry.data) {
    initial = Object.fromEntries(entry.data.form_elements.map((a) => [a.id, a.value]));
  }

  return <FillFlow mode={mode} form={def!} entry={entry.data ?? null} initial={initial} initialParent={parent ?? null} navigation={navigation} />;
}

function Frame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: colors.scheme === 'dark' ? colors.ground : colors.panel, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <CloseButton onPress={onClose} />
      </View>
      {children}
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} accessibilityLabel="Close the form" scaleTo={0.92} style={[styles.close, { backgroundColor: colors.divider }]}>
      <Icon name="close" size={20} color={colors.body} strokeWidth={2.2} />
    </PressableScale>
  );
}

interface FlowProps {
  mode: Mode;
  form: FormDefinition;
  entry: Entry | null;
  initial: Answers;
  initialParent: Parent | null;
  navigation: RootScreenProps<'FillForm'>['navigation'];
}

function FillFlow({ mode, form, entry, initial, initialParent, navigation }: FlowProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const queryClient = useQueryClient();
  const { people, names: listed } = usePeople();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [files, setFiles] = useState<Record<string, LocalFile[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [touched, setTouched] = useState(false);
  const [title, setTitle] = useState('');
  const [parent, setParent] = useState<Parent | null>(initialParent);
  const [need, setNeed] = useState<NeedsAssignee | null>(null);
  const assigneeSheet = useRef<SheetHandle>(null);
  const parentSheet = useRef<SheetHandle>(null);
  const leaving = useRef(false);
  const scroller = useRef<KeyboardAwareScrollViewRef>(null);
  const fieldsY = useRef(0);
  const fieldY = useRef<Record<string, number>>({});
  const [parentAsked, setParentAsked] = useState(false);

  const schema = useMemo(() => ({ groups: form.groups ?? [], elements: form.elements ?? [] }), [form]);
  const names = useMemo(() => formNames(form.elements, listed), [form, listed]);
  const visible = useMemo(() => resolveVisibility(schema, answers), [schema, answers]);
  const deferred = useMemo(() => new Set(form.deferred_element_ids ?? []), [form]);
  const editable = useMemo(() => new Set(entry?.editable_element_ids ?? []), [entry]);
  const isStage = mode === 'stage';
  const canAnswer = (el: FormElement) => (isStage ? editable.has(el.id) : !deferred.has(el.id));

  const steps = useMemo(() => {
    if (!isStage) return buildSteps(schema, visible, (el) => !deferred.has(el.id));
    const hidden = (el: FormElement) => entry?.field_permissions?.[el.id] === 'hidden';
    return buildSteps(schema, visible, (el) => !hidden(el)).filter((s) => s.elements.some((el) => editable.has(el.id)));
  }, [isStage, schema, visible, deferred, editable, entry]);

  const index = Math.min(step, steps.length);
  const reviewing = index >= steps.length;
  const current = steps[index] as FormStep | undefined;
  const defaultTitle = `${form.name}, ${formatDayMonth(new Date())}`;

  /* ----- answers ----- */

  const setAnswer = (id: string, value: AnswerValue) => {
    setTouched(true);
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(({ [id]: _, ...rest }) => rest);
  };
  const setFieldFiles = (id: string, list: LocalFile[]) => {
    setTouched(true);
    setFiles((prev) => ({ ...prev, [id]: list }));
    if (errors[id]) setErrors(({ [id]: _, ...rest }) => rest);
  };

  const checkStep = (s: FormStep): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const el of s.elements) {
      if (!isField(el) || !canAnswer(el)) continue;
      const message = fieldProblem(el, answers[el.id], files[el.id] ?? []);
      if (message) out[el.id] = message;
    }
    return out;
  };

  /* ----- moving between screens ----- */

  const go = (next: number) => {
    setDirection(next > index ? 1 : -1);
    setStep(next);
  };

  const next = () => {
    if (!current) return;
    const problems = checkStep(current);
    if (Object.keys(problems).length) {
      setErrors(problems);
      haptic.error();
      // Bring the first field to fix into view.
      const first = current.elements.find((el) => problems[el.id]);
      const y = first ? fieldY.current[first.id] : undefined;
      if (y != null) scroller.current?.scrollTo({ y: Math.max(0, fieldsY.current + y - 24), animated: !reduced });
      return;
    }
    haptic.light();
    go(index + 1);
  };

  const back = () => {
    if (index > 0) go(index - 1);
  };

  const leave = () => {
    leaving.current = true;
    navigation.goBack();
  };
  const close = () => {
    if (!touched) return leave();
    Alert.alert('Leave this form?', 'Your answers are not saved.', [
      { text: 'Keep filling in', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leave },
    ]);
  };

  // Back (the Android button or a swipe) steps back a screen; leaving with answers asks first.
  usePreventRemove(touched || index > 0, ({ data }) => {
    if (leaving.current) return navigation.dispatch(data.action);
    if (index > 0 && (data.action.type === 'GO_BACK' || data.action.type === 'POP')) return back();
    if (!touched) return navigation.dispatch(data.action);
    Alert.alert('Leave this form?', 'Your answers are not saved.', [
      { text: 'Keep filling in', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  /* ----- sending ----- */

  const payload = (): Answers => {
    const out: Answers = {};
    for (const el of schema.elements) {
      if (!isField(el) || !canAnswer(el)) continue;
      if (el.type === 'file') {
        // New photos travel as files; untouched stored ones keep their answer.
        if ((files[el.id]?.length ?? 0) === 0 && mode !== 'new' && mode !== 'again' && !isEmptyValue(answers[el.id])) out[el.id] = answers[el.id];
        continue;
      }
      out[el.id] = visible[el.id] === false ? null : (answers[el.id] ?? null);
    }
    return out;
  };

  const send = useMutation({
    mutationFn: (assigneeIds: number[]) => {
      const body = { answers: payload(), files, assigneeIds };
      if (mode === 'edit') return updateEntry(entry!.id, body);
      if (mode === 'stage') return fillStage(entry!.id, body);
      return submitForm(form.id, { ...body, recordTitle: title.trim() || defaultTitle, parentId: parent?.id ?? null });
    },
    onSuccess: (res) => {
      // The Sent screen's ring plays the success haptic as it closes.
      leaving.current = true;
      queryClient.invalidateQueries({ queryKey: formKeys.all });
      queryClient.invalidateQueries({ queryKey: homeKey });
      const first = processPreview(form.process)[1];
      navigation.replace('FormSent', {
        recordId: res.record_id ?? entry?.id ?? null,
        title: mode === 'new' || mode === 'again' ? title.trim() || defaultTitle : (entry?.record_title ?? form.name),
        formName: form.name,
        formId: form.id,
        kind: mode === 'edit' ? 'changed' : mode === 'stage' ? 'stage' : 'sent',
        next: first && first.kind !== 'branch' ? first.title : null,
      });
    },
    onError: (e) => {
      const pick = needsAssignee(e);
      if (pick) {
        setNeed(pick);
        assigneeSheet.current?.open();
        return;
      }
      haptic.error();
      const problems = answerErrors(e);
      const at = steps.findIndex((s) => s.elements.some((el) => problems[el.id]));
      if (at >= 0) {
        setErrors(problems);
        go(at);
        return;
      }
      Alert.alert(mode === 'edit' ? 'We could not save your changes' : 'We could not send the form', errorMessage(e));
    },
  });

  /* ----- layout ----- */

  const bg = reviewing ? colors.ground : colors.scheme === 'dark' ? colors.ground : colors.panel;
  const entering = reduced ? undefined : (direction === 1 ? SlideInRight : SlideInLeft).duration(260).easing(Easing.out(Easing.cubic));
  const nextTitle = steps[index + 1]?.title;
  const primaryLabel = mode === 'edit' ? 'Save changes' : isStage ? 'Send your part' : sendLabel(form.process);

  return (
    <View style={[styles.fill, { backgroundColor: bg, paddingTop: insets.top }]}>
      {reviewing ? (
        <View style={styles.reviewHeader}>
          {steps.length > 0 ? (
            <PressableScale onPress={back} accessibilityLabel="Back to your answers" style={styles.backLink}>
              <Icon name="chevronLeft" size={26} color={colors.link} strokeWidth={2.2} />
              <Text variant="body" color="link" style={styles.backText}>
                Back
              </Text>
            </PressableScale>
          ) : (
            <CloseButton onPress={close} />
          )}
          <Text variant="captionStrong" align="center" numberOfLines={1} style={styles.headerTitle}>
            {form.name}
          </Text>
          <View style={styles.reviewSide} />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <CloseButton onPress={close} />
            <View style={styles.headerMiddle}>
              <Text variant="captionStrong" align="center" numberOfLines={1} style={styles.formName}>
                {form.name}
              </Text>
              <Text variant="footnote" color="ink2" align="center" numberOfLines={1}>
                {isStage || mode === 'edit' ? (entry?.record_title ?? '') : (form.group?.name ?? '')}
              </Text>
            </View>
            <View style={styles.headerSide} />
          </View>
          <Progress count={steps.length} at={index} />
        </>
      )}

      <KeyboardAwareScrollView ref={scroller} key={`step-${index}`} bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 132 + insets.bottom }}>
        <Animated.View entering={entering}>
          {reviewing ? (
            <Review
              mode={mode}
              form={form}
              steps={steps}
              answers={answers}
              files={files}
              entry={entry}
              names={names}
              canAnswer={canAnswer}
              visible={visible}
              title={title}
              onTitle={setTitle}
              defaultTitle={defaultTitle}
              parent={parent}
              onParent={() => {
                setParentAsked(true);
                parentSheet.current?.open();
              }}
              onRemoveParent={() => setParent(null)}
              onEdit={go}
            />
          ) : current ? (
            <View>
              {steps.length > 1 ? (
                <Text variant="captionStrong" color="brandInk" style={styles.stepOf}>
                  Step {index + 1} of {steps.length}
                </Text>
              ) : (
                <View style={styles.stepOf} />
              )}
              <Text style={[styles.stepTitle, { color: colors.ink }]} accessibilityRole="header">
                {current.title}
              </Text>
              {index === 0 && form.description && !isStage ? (
                <Text variant="body" color="ink2" style={styles.intro}>
                  {form.description}
                </Text>
              ) : null}
              {isStage && index === 0 ? (
                <Text variant="body" color="ink2" style={styles.intro}>
                  Fill in your part. The other answers are there for you to read.
                </Text>
              ) : null}
              <View style={styles.fields} onLayout={(ev) => (fieldsY.current = ev.nativeEvent.layout.y)}>
                {current.elements.map((el) => (
                  <View key={el.id} onLayout={(ev) => (fieldY.current[el.id] = ev.nativeEvent.layout.y)}>
                    {isField(el) && !canAnswer(el) ? (
                      <ReadOnly element={el} value={answers[el.id]} names={names} />
                    ) : (
                      <FormElementView
                        element={el}
                        value={answers[el.id]}
                        onChange={(v) => setAnswer(el.id, v)}
                        files={files[el.id] ?? []}
                        onFiles={(list) => setFieldFiles(el.id, list)}
                        storedFiles={entry?.attachments?.[el.id] ?? null}
                        people={people}
                        error={errors[el.id]}
                        previous={entry?.previous_answers?.[el.id]}
                        because={becauseText(el, current, answers, schema.elements, names)}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAwareScrollView>

      <BottomBar onPanel={!reviewing}>
        {reviewing ? (
          <Button label={primaryLabel} loading={send.isPending} style={styles.flex} onPress={() => send.mutate([])} />
        ) : (
          <View style={styles.bar}>
            {index > 0 ? <Button label="Back" variant="secondary" onPress={back} style={styles.backButton} /> : null}
            <Button
              label={nextTitle ? `Next: ${nextTitle}` : 'Next: Check and send'}
              icon={<Icon name="arrowRight" size={20} color={colors.primary.fg} strokeWidth={2.2} />}
              iconAfter
              onPress={next}
              style={styles.flex}
            />
          </View>
        )}
      </BottomBar>

      <Sheet ref={assigneeSheet} title={need ? `Who should handle "${need.name}"?` : 'Choose a person'} subtitle="They get it next. Nothing is sent until you choose." snapPoints={['60%', '92%']}>
        {(need?.candidates ?? []).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              assigneeSheet.current?.close();
              send.mutate([p.id]);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.personRow, { borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
          >
            <Avatar name={p.name} size={36} />
            <Text variant="body" style={styles.flex}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </Sheet>

      {mode === 'new' || mode === 'again' ? (
        <ParentSheet
          ref={parentSheet}
          formId={form.id}
          active={parentAsked}
          onPick={(p) => {
            setParent(p);
            parentSheet.current?.close();
          }}
        />
      ) : null}
    </View>
  );
}

/** What is wrong with an answer, in plain words; null when it is fine. */
function fieldProblem(el: FieldElement, value: AnswerValue | undefined, newFiles: LocalFile[]): string | null {
  const empty = el.type === 'file' ? newFiles.length === 0 && isEmptyValue(value) : isEmptyValue(value);
  if (empty) {
    if (!el.mandatory) return null;
    switch (el.type) {
      case 'select':
      case 'user':
        return el.type === 'user' ? 'Choose a person.' : 'Choose one.';
      case 'multi-choice':
      case 'multi-select':
      case 'checkbox':
        return 'Choose at least one.';
      case 'date':
        return 'Choose a date.';
      case 'time':
        return 'Choose a time.';
      case 'file':
        return 'Add a photo.';
      case 'gps':
        return 'Stamp your location.';
      default:
        return 'Fill this in.';
    }
  }
  if (el.type === 'number') {
    const n = Number(String(value));
    if (Number.isNaN(n)) return 'Enter a number.';
    const min = el.min != null && el.min !== '' ? Number(el.min) : null;
    const max = el.max != null && el.max !== '' ? Number(el.max) : null;
    if (min != null && n < min) return `Enter ${min} or more.`;
    if (max != null && n > max) return `Enter ${max} or less.`;
  }
  if (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(String(value))) return 'Enter an email address, like name@example.com.';
  if ((el.type === 'multi-choice' || el.type === 'multi-select') && Array.isArray(value)) {
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 0;
    if (min && value.length < min) return `Choose at least ${min}.`;
    if (max && value.length > max) return `Choose no more than ${max}.`;
  }
  return null;
}

/** "Shown because you chose Partly." when a field depends on one answer on the same screen. */
function becauseText(el: FormElement, step: FormStep, answers: Answers, all: FormElement[], names: Map<number, string>): string | null {
  const fields = [...new Set(conditionFields(el.visible_when))];
  if (fields.length !== 1 || !step.elements.some((e) => e.id === fields[0])) return null;
  const source = all.find((e) => e.id === fields[0]);
  const value = answers[fields[0]];
  if (!source || !isField(source) || isEmptyValue(value)) return null;
  return `Shown because you chose ${displayValue(source, value, names)}.`;
}

function ReadOnly({ element, value, names }: { element: FieldElement; value: AnswerValue | undefined; names: Map<number, string> }) {
  return (
    <View style={styles.readOnly} accessible accessibilityLabel={`${element.label}: ${displayValue(element, value, names)}`}>
      <Text variant="captionStrong" color="ink2">
        {element.label}
      </Text>
      <Text variant="body" color={isEmptyValue(value) ? 'muted' : 'ink'}>
        {displayValue(element, value, names)}
      </Text>
    </View>
  );
}

/** The segments over a step: done ones full, the current one filling in. */
function Progress({ count, at }: { count: number; at: number }) {
  const colors = useColors();
  if (count < 2) return null;
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={`Step ${at + 1} of ${count}`} accessibilityValue={{ min: 1, max: count, now: at + 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: colors.line }]}>
          {i < at ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D729E' }]} /> : i === at ? <Filling /> : null}
        </View>
      ))}
    </View>
  );
}

function Filling() {
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) width.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [reduced, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return <Animated.View style={[styles.segmentFill, style]} />;
}

/* ----- Check and send ----- */

interface ReviewProps {
  mode: Mode;
  form: FormDefinition;
  steps: FormStep[];
  answers: Answers;
  files: Record<string, LocalFile[]>;
  entry: Entry | null;
  names: Map<number, string>;
  canAnswer: (el: FormElement) => boolean;
  visible: Record<string, boolean>;
  title: string;
  onTitle: (t: string) => void;
  defaultTitle: string;
  parent: Parent | null;
  onParent: () => void;
  onRemoveParent: () => void;
  onEdit: (step: number) => void;
}

function Review({ mode, form, steps, answers, files, entry, names, canAnswer, title, onTitle, defaultTitle, parent, onParent, onRemoveParent, onEdit }: ReviewProps) {
  const colors = useColors();
  const starting = mode === 'new' || mode === 'again';
  const preview = starting ? processPreview(form.process) : [];
  const firstBlocks = form.process[0] && form.process[0].type !== 'branch' && form.process[0].type !== 'cc';

  return (
    <View>
      <Text style={[styles.reviewTitle, { color: colors.ink }]} accessibilityRole="header">
        {mode === 'edit' ? 'Check your changes' : 'Check and send'}
      </Text>

      {starting ? (
        <Card padded style={styles.reviewCard}>
          <TextField label="Name this record" value={title} onChangeText={onTitle} placeholder={defaultTitle} hint="People see this name in their lists. Leave it empty to use the one shown." />
        </Card>
      ) : null}

      {starting ? (
        <Card style={styles.reviewCard}>
          {parent ? (
            <View style={styles.parentRow}>
              <Icon name="link" size={20} color={colors.ink2} />
              <View style={styles.flex}>
                <Text variant="footnote" color="ink2">
                  Follows up on
                </Text>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {parent.title}
                </Text>
                <Text variant="mono" color="ink2">
                  {parent.reference}
                </Text>
              </View>
              <PressableScale onPress={onRemoveParent} accessibilityRole="button" accessibilityLabel="Remove the link" style={styles.textButton}>
                <Text variant="captionStrong" color="link" style={styles.link15}>
                  Remove
                </Text>
              </PressableScale>
            </View>
          ) : (
            <Pressable onPress={onParent} accessibilityRole="button" style={({ pressed }) => [styles.parentRow, pressed && { backgroundColor: colors.pressed }]}>
              <Icon name="link" size={20} color={colors.ink2} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Link to an earlier record</Text>
                <Text variant="footnote" color="ink2">
                  Optional. For a return visit or a follow-up.
                </Text>
              </View>
              <Icon name="chevronRight" size={20} color={colors.chevron} strokeWidth={2.2} />
            </Pressable>
          )}
        </Card>
      ) : null}

      {steps.length === 0 ? (
        <Card padded style={styles.reviewCard}>
          <Text variant="body" color="ink2">
            There is nothing for you to fill in. Send it to move it on.
          </Text>
        </Card>
      ) : null}

      {steps.map((s, i) => {
        const items = s.elements.filter((el): el is FieldElement => isField(el) && canAnswer(el));
        if (!items.length) return null;
        return (
          <Card key={s.id} style={styles.answerCard}>
            <View style={styles.answerHead}>
              <Text variant="rowTitle" accessibilityRole="header" style={styles.flex}>
                {s.title}
              </Text>
              <PressableScale onPress={() => onEdit(i)} accessibilityRole="button" accessibilityLabel={`Change ${s.title}`} style={styles.textButton}>
                <Text variant="captionStrong" color="link" style={styles.link15}>
                  Edit
                </Text>
              </PressableScale>
            </View>
            <AnswerRows
              first={false}
              names={names}
              items={items.map((el) => ({ element: el, value: answers[el.id], local: files[el.id], stored: entry?.attachments?.[el.id] ?? null }))}
            />
          </Card>
        );
      })}

      {preview.length > 1 ? (
        <Card padded style={styles.reviewCard}>
          <Text variant="rowTitle" accessibilityRole="header">
            After you send
          </Text>
          <View style={styles.timeline}>
            {preview.map((p, i) => (
              <PreviewRow key={p.key} step={p} last={i === preview.length - 1} />
            ))}
          </View>
          {firstBlocks ? (
            <Text variant="caption" color="ink2" style={[styles.after, { borderTopColor: colors.divider }]}>
              You can change your answers until someone acts on it.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {mode === 'edit' ? (
        <Text variant="caption" color="ink2" align="center" style={styles.editNote}>
          Saving replaces your answers. The steps start again from the first one.
        </Text>
      ) : null}
      {entry && mode === 'stage' && entry.submitted_by_name ? (
        <Text variant="caption" color="ink2" align="center" style={styles.editNote}>
          {entry.submitted_by_name} sent this on {formatDate(entry.submitted_at)}.
        </Text>
      ) : null}
    </View>
  );
}

const PREVIEW_ICON: Record<PreviewStep['kind'], IconName> = { you: 'person', approval: 'review', fill: 'forms', cc: 'message', branch: 'sliders' };

function PreviewRow({ step, last }: { step: PreviewStep; last: boolean }) {
  const colors = useColors();
  const { user } = useAuth();
  const tone = step.kind === 'approval' ? colors.tones.form : step.kind === 'fill' ? colors.tones.suggest : colors.tones.neutral;
  return (
    <View style={styles.previewRow}>
      {!last ? <View style={[styles.previewLine, { backgroundColor: colors.line }]} /> : null}
      {step.kind === 'you' ? (
        <Avatar name={user?.name ?? 'You'} size={28} brand />
      ) : (
        <View style={[styles.previewDot, { backgroundColor: tone.tile }]}>
          <Icon name={PREVIEW_ICON[step.kind]} size={15} color={tone.ink} strokeWidth={2.2} />
        </View>
      )}
      <View style={styles.flex}>
        <Text variant="bodyStrong">{step.title}</Text>
        {step.note ? (
          <Text variant="caption" color="ink2">
            {step.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ----- linking to an earlier record ----- */


/** Records of this form to follow up on. Fetched only once the sheet has been asked for. */
const ParentSheet = forwardRef<SheetHandle, { formId: number; active: boolean; onPick: (p: Parent) => void }>(function ParentSheet({ formId, active, onPick }, ref) {
  const colors = useColors();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const parents = useQuery({ queryKey: formKeys.parents(formId, search), queryFn: () => fetchParents(formId, search), enabled: active });

  return (
    <Sheet ref={ref} title="Link to an earlier record" subtitle="Records of this form you can see, newest first." snapPoints={['70%', '92%']} onDismiss={() => setText('')}>
      <View style={styles.sheetSearch}>
        <TextField inSheet value={text} onChangeText={setText} placeholder="Search by name or REC number" accessibilityLabel="Search records" leading={<Icon name="search" size={20} color={colors.muted} strokeWidth={2} />} />
      </View>
      {parents.isLoading ? <Loading /> : null}
      {parents.data?.length === 0 ? (
        <Text variant="subhead" color="ink2" style={styles.sheetEmpty}>
          {search ? `No records match “${search}”.` : 'There are no earlier records of this form yet.'}
        </Text>
      ) : null}
      {(parents.data ?? []).map((p: ParentOption) => (
        <Pressable
          key={p.id}
          onPress={() => onPick({ id: p.id, reference: p.reference, title: p.title })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.parentOption, { borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
        >
          <Text variant="bodyStrong">{p.title}</Text>
          <Text variant="caption" color="ink2">
            <Text variant="mono" color="ink2">
              {p.reference}
            </Text>
            {p.opened_by ? ` · ${p.opened_by}` : ''}
            {p.opened_at ? ` · ${formatDate(p.opened_at)}` : ''}
            {p.follow_up_count ? ` · ${p.follow_up_count} follow-up${p.follow_up_count === 1 ? '' : 's'}` : ''}
          </Text>
        </Pressable>
      ))}
    </Sheet>
  );
});


const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6, minHeight: 56 },
  headerMiddle: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerSide: { width: 52 },
  formName: { fontSize: 15 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, minHeight: 56 },
  backLink: { flexDirection: 'row', alignItems: 'center', minHeight: 48, width: 88 },
  reviewSide: { width: 88 },
  backText: { fontFamily: fonts.medium, fontSize: 17 },
  headerTitle: { flex: 1, fontSize: 15 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 12, marginHorizontal: 20 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: '#0D729E' },
  stepOf: { marginTop: 24, marginHorizontal: 20 },
  stepTitle: { marginTop: 2, marginHorizontal: 20, fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  intro: { marginTop: 8, marginHorizontal: 20 },
  fields: { marginTop: 28, marginHorizontal: 20, gap: 28 },
  readOnly: { gap: 2 },
  bar: { flex: 1, flexDirection: 'row', gap: 10 },
  backButton: { width: 96 },
  reviewTitle: { marginTop: 12, marginHorizontal: 20, fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  reviewCard: { marginTop: 16, marginHorizontal: space.gutter, borderRadius: radius.card },
  answerCard: { marginTop: 12, marginHorizontal: space.gutter, borderRadius: radius.card, paddingHorizontal: 18, paddingBottom: 8 },
  answerHead: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  textButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  link15: { fontSize: 15 },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18, minHeight: 64 },
  timeline: { marginTop: 14 },
  previewRow: { flexDirection: 'row', gap: 14, paddingBottom: 16 },
  previewLine: { position: 'absolute', left: 13, top: 30, bottom: 0, width: 2 },
  previewDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  after: { marginTop: 2, paddingTop: 12, borderTopWidth: 1 },
  editNote: { marginTop: 14, marginHorizontal: 24 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1 },
  sheetSearch: { marginTop: 12 },
  sheetEmpty: { marginTop: 16 },
  parentOption: { paddingVertical: 12, minHeight: 56, borderBottomWidth: 1, gap: 2 },
});
