import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { LocalFile } from '../../api/client';
import type { MediaSet } from '../../api/tasks';
import { DateField } from '../../components/DateField';
import { Icon } from '../../components/Icon';
import { PhotoStrip, RemotePhotos } from '../../components/PhotoStrip';
import { SelectField } from '../../components/SelectField';
import { StampButton, StampedCard } from '../../components/StampCard';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { isEmptyValue } from '../../lib/forms/conditions';
import { displayValue, isGps, optionGroups, optionList, peopleFor } from '../../lib/forms/schema';
import type { AnswerValue, FieldElement, FormElement, GpsAnswer, Person } from '../../lib/forms/types';
import { haptic } from '../../lib/haptics';
import { stampLocation } from '../../lib/location';
import { useColors } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { fonts } from '../../theme/type';

/** Up to this many short options show as buttons side by side; more open a list. */
const PILL_MAX = 4;
/** Two to a row fit a longer label than three to a row. */
const pillLabelMax = (count: number) => (count === 3 ? 12 : 20);
/** More options than this and a choose-many field opens a list too. */
const CHIP_MAX = 24;
/** A chosen chip is the same brand blue in light and dark (the FillForm2 boards). */
const CHIP_ON = '#0D729E';

export interface FieldProps {
  element: FieldElement;
  value: AnswerValue | undefined;
  onChange: (next: AnswerValue) => void;
  /** New photos for a file field. */
  files: LocalFile[];
  onFiles: (next: LocalFile[]) => void;
  /** Files already stored for this field (changing an entry). */
  storedFiles?: MediaSet | null;
  people: Person[];
  error?: string;
  /** The answer given last round, shown as a hint and never filled in. */
  previous?: AnswerValue;
  /** "Shown because you chose Partly." */
  because?: string | null;
}

/** One form element: a field to answer, or a line of text from the form's author. */
export function FormElementView(props: Omit<FieldProps, 'element'> & { element: FormElement }) {
  const { element } = props;
  if (element.kind === 'description') {
    return (
      <Text variant="body" color="ink2">
        {element.text || element.label}
      </Text>
    );
  }
  const field = <FormField {...props} element={element} />;
  if (!props.because) return field;
  return <Reveal because={props.because}>{field}</Reveal>;
}

/** A field that appeared because of an earlier answer sits in a tinted box and says why. */
function Reveal({ because, children }: { because: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.reveal, { backgroundColor: colors.scheme === 'dark' ? colors.panel : colors.ground }]}>
      {children}
      <Text variant="footnote" color="ink2">
        {because}
      </Text>
    </Animated.View>
  );
}

export function FormField({ element, value, onChange, files, onFiles, storedFiles, people, error, previous }: FieldProps) {
  const optional = !element.mandatory;
  const offered = peopleFor(element, people);
  const last = previous !== undefined && !isEmptyValue(previous) ? `Last time: ${displayValue(element, previous, new Map(offered.map((p) => [p.id, p.name])))}` : null;
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';

  switch (element.type) {
    case 'text':
    case 'email':
    case 'tel':
    case 'textarea':
      return (
        <TextField
          label={element.label}
          optional={optional}
          value={text}
          onChangeText={(t) => onChange(t)}
          multiline={element.type === 'textarea'}
          keyboardType={element.type === 'email' ? 'email-address' : element.type === 'tel' ? 'phone-pad' : 'default'}
          autoCapitalize={element.type === 'email' ? 'none' : 'sentences'}
          autoComplete={element.type === 'email' ? 'email' : element.type === 'tel' ? 'tel' : 'off'}
          placeholder={element.placeholder ?? undefined}
          error={error}
          hint={last ?? undefined}
        />
      );
    case 'number':
      return (
        <TextField
          label={element.label}
          optional={optional}
          value={text}
          onChangeText={(t) => onChange(t.replace(/[^\d.-]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={element.placeholder ?? undefined}
          error={error}
          hint={last ?? rangeHint(element) ?? undefined}
        />
      );
    case 'date':
    case 'time':
      return <DateTimeInput element={element} value={text} onChange={onChange} error={error} hint={last} />;
    case 'select':
      return <SingleChoice element={element} value={text || null} onChange={onChange} error={error} hint={last} />;
    case 'multi-choice':
    case 'multi-select':
      return <ManyChoice element={element} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} error={error} hint={last} />;
    case 'checkbox':
      return <Checkboxes element={element} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} error={error} hint={last} />;
    case 'user': {
      const chosen = value != null && value !== '' ? Number(Array.isArray(value) ? value[0] : value) : null;
      // A deactivated person is not offered, unless they are the answer already.
      const pickable = offered.filter((p) => p.active !== false || p.id === chosen);
      return (
        <SelectField
          label={element.label}
          optional={optional}
          searchable
          options={pickable.map((p) => ({ value: p.id, label: p.name }))}
          value={chosen}
          onChange={(id) => onChange(id ?? null)}
          placeholder="Choose a person"
          error={error}
          hint={last ?? undefined}
        />
      );
    }
    case 'file':
      return <PhotoField element={element} files={files} onFiles={onFiles} stored={storedFiles} error={error} />;
    case 'gps':
      return <GpsField element={element} value={isGps(value) ? value : null} onChange={onChange} error={error} />;
    default:
      return null;
  }
}

function rangeHint(element: FieldElement): string | null {
  const min = element.min != null && element.min !== '' ? element.min : null;
  const max = element.max != null && element.max !== '' ? element.max : null;
  if (min != null && max != null) return `Between ${min} and ${max}`;
  if (min != null) return `${min} or more`;
  if (max != null) return `${max} or less`;
  return null;
}

/** The field's name, "(optional)", and how many to choose. */
export function FieldLabel({ element, extra, nativeID }: { element: FieldElement; extra?: string | null; nativeID?: string }) {
  const note = extra ?? (element.mandatory ? null : 'optional');
  return (
    <Text variant="captionStrong" color="body" nativeID={nativeID} style={styles.label}>
      {element.label}
      {note ? (
        <Text variant="caption" color="muted">
          {' '}
          ({note})
        </Text>
      ) : null}
    </Text>
  );
}

function Feedback({ error, hint }: { error?: string; hint?: string | null }) {
  if (error)
    return (
      <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
        {error}
      </Text>
    );
  return hint ? (
    <Text variant="caption" color="ink2">
      {hint}
    </Text>
  ) : null;
}

/* ----- date and time ----- */

const pad = (n: number) => String(n).padStart(2, '0');

function DateTimeInput({ element, value, onChange, error, hint }: { element: FieldElement; value: string; onChange: (v: AnswerValue) => void; error?: string; hint?: string | null }) {
  const isDate = element.type === 'date';
  const parsed = value ? (isDate ? parseIsoDay(value) : parseClock(value)) : null;
  const minDays = element.min_days != null ? Number(element.min_days) : null;
  const minimumDate = isDate && minDays != null && !Number.isNaN(minDays) ? addDays(minDays) : undefined;
  return (
    <View style={styles.field}>
      <FieldLabel element={element} />
      <DateField
        label={element.label}
        mode={isDate ? 'date' : 'time'}
        value={parsed}
        minimumDate={minimumDate}
        placeholder={isDate ? 'Choose a date' : 'Choose a time'}
        onChange={(d) => onChange(isDate ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`)}
        error={error}
      />
      {!error ? <Feedback hint={hint ?? (minimumDate && minDays! > 0 ? `${minDays} days from today at the earliest` : null)} /> : null}
    </View>
  );
}

function parseIsoDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function parseClock(value: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/* ----- choosing ----- */

function SingleChoice({ element, value, onChange, error, hint }: { element: FieldElement; value: string | null; onChange: (v: AnswerValue) => void; error?: string; hint?: string | null }) {
  const colors = useColors();
  const options = optionList(element);
  const pills = options.length > 0 && options.length <= PILL_MAX && options.every((o) => o.length <= pillLabelMax(options.length));
  const labelId = `lbl-${element.id}`;

  if (!pills) {
    return (
      <SelectField
        label={element.label}
        optional={!element.mandatory}
        searchable={options.length > 8}
        options={options.map((o) => ({ value: o, label: o }))}
        value={value}
        onChange={(v) => onChange(v ?? null)}
        error={error}
        hint={hint ?? undefined}
      />
    );
  }

  const dark = colors.scheme === 'dark';
  const columns = options.length === 4 ? 2 : options.length;
  return (
    <View style={styles.field}>
      <FieldLabel element={element} nativeID={labelId} />
      <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabelledBy={labelId}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => {
                haptic.selection();
                // Tapping the chosen one again clears an optional answer.
                onChange(on && !element.mandatory ? null : o);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.pill,
                {
                  flexBasis: `${100 / columns - 3}%`,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.brand : error ? colors.danger : colors.control,
                  backgroundColor: on ? colors.brandTint : colors.panel,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text variant="bodyStrong" align="center" color={on ? (dark ? '#A6DCF5' : colors.brandInk) : colors.body}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Feedback error={error} hint={hint} />
    </View>
  );
}

function chooseNote(element: FieldElement): string | null {
  const min = Number(element.min) || 0;
  const max = Number(element.max) || 0;
  if (min && max) return min === max ? `choose ${min}` : `choose ${min} to ${max}`;
  if (min) return `choose at least ${min}`;
  if (max) return `choose up to ${max}`;
  return element.mandatory ? 'choose at least 1' : 'choose any';
}

function ManyChoice({ element, value, onChange, error, hint }: { element: FieldElement; value: string[]; onChange: (v: AnswerValue) => void; error?: string; hint?: string | null }) {
  const colors = useColors();
  const groups = optionGroups(element);
  const all = groups.flatMap((g) => g.options);
  const max = Number(element.max) || 0;

  if (all.length > CHIP_MAX) {
    return (
      <SelectField
        multiple
        label={element.label}
        optional={!element.mandatory}
        searchable
        options={groups.flatMap((g) => g.options.map((o) => ({ value: o, label: o, group: g.group || undefined })))}
        value={value}
        onChange={(next) => onChange((max ? next.slice(0, max) : next).map(String))}
        error={error}
        hint={hint ?? chooseNote(element) ?? undefined}
      />
    );
  }

  const toggle = (o: string) => {
    haptic.selection();
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else if (!max || value.length < max) onChange([...value, o]);
    else haptic.warning();
  };

  return (
    <View style={styles.field}>
      <FieldLabel element={element} extra={chooseNote(element)} />
      {groups.map((g, i) => (
        <View key={`${g.group}-${i}`} style={styles.chipGroup}>
          {g.group ? (
            <Text variant="label" color="ink2">
              {g.group}
            </Text>
          ) : null}
          <View style={styles.chips}>
            {g.options.map((o) => {
              const on = value.includes(o);
              return (
                <Pressable
                  key={o}
                  onPress={() => toggle(o)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [
                    styles.chip,
                    on
                      ? { backgroundColor: CHIP_ON, borderColor: 'transparent', paddingLeft: 10 }
                      : { backgroundColor: colors.panel, borderColor: error ? colors.danger : colors.control },
                    { transform: [{ scale: pressed ? 0.96 : 1 }] },
                  ]}
                >
                  {on ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.8} /> : null}
                  <Text variant="captionStrong" color={on ? '#FFFFFF' : colors.body} style={styles.chipText}>
                    {o}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Feedback error={error} hint={hint} />
    </View>
  );
}

function Checkboxes({ element, value, onChange, error, hint }: { element: FieldElement; value: string[]; onChange: (v: AnswerValue) => void; error?: string; hint?: string | null }) {
  const colors = useColors();
  const options = optionList(element);
  const toggle = (o: string) => {
    haptic.selection();
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  };
  return (
    <View style={styles.field}>
      <FieldLabel element={element} />
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <Pressable key={o} onPress={() => toggle(o)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.7 }]}>
            <View style={[styles.box, { borderColor: on ? colors.brand : error ? colors.danger : colors.control, backgroundColor: on ? colors.brand : 'transparent' }]}>
              {on ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text variant="body" style={styles.flex}>
              {o}
            </Text>
          </Pressable>
        );
      })}
      <Feedback error={error} hint={hint} />
    </View>
  );
}

/* ----- photos and location ----- */

function PhotoField({ element, files, onFiles, stored, error }: { element: FieldElement; files: LocalFile[]; onFiles: (f: LocalFile[]) => void; stored?: MediaSet | null; error?: string }) {
  const { width } = useWindowDimensions();
  const size = Math.floor((Math.min(width, 520) - 40 - 20) / 3);
  const storedAll = stored ? [...stored.media, ...stored.documents] : [];
  return (
    <View style={styles.field}>
      <FieldLabel element={element} />
      {storedAll.length > 0 && files.length === 0 ? <RemotePhotos files={storedAll} size={size} /> : null}
      <PhotoStrip photos={files} onChange={onFiles} size={size} max={10} />
      <Feedback error={error} hint={storedAll.length > 0 && files.length > 0 ? `These replace the ${storedAll.length} already there.` : null} />
    </View>
  );
}

function GpsField({ element, value, onChange, error }: { element: FieldElement; value: GpsAnswer | null; onChange: (v: AnswerValue) => void; error?: string }) {
  const [busy, setBusy] = useState(false);
  const auto = (element.capture_mode ?? 'auto') === 'auto';
  const tried = useRef(false);

  const stamp = async () => {
    setBusy(true);
    try {
      const s = await stampLocation();
      if (s) {
        haptic.light();
        onChange({ lat: s.lat, lng: s.lng, accuracy: s.accuracy, captured_at: s.captured_at });
      }
    } finally {
      setBusy(false);
    }
  };

  // An "auto" stamp is taken once, when this step opens: the form's author
  // chose it, and the note below says so. Nothing runs in the background.
  useEffect(() => {
    if (!auto || value || tried.current) return;
    tried.current = true;
    stamp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const note = auto ? 'This form stamps your location when you open this step. We only store it with this form.' : 'We only store your location with this form.';
  return (
    <View style={styles.field}>
      <FieldLabel element={element} />
      {value ? (
        <StampedCard stamp={value} distance={null} onAgain={stamp} busy={busy} note="Saved with this form" style={styles.flush} />
      ) : (
        <StampButton onPress={stamp} busy={busy} hint={note} style={styles.flush} />
      )}
      {value ? (
        <Text variant="footnote" color="ink2">
          {note}
        </Text>
      ) : null}
      <Feedback error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  field: { gap: 8 },
  label: { fontFamily: fonts.semibold },
  reveal: { gap: 8, padding: 16, borderRadius: radius.tile, marginTop: -12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexGrow: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  chipGroup: { gap: 8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 15 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  flush: { marginTop: 0, marginHorizontal: 0 },
});
