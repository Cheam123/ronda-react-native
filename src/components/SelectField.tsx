import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { useColors } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Sheet, type SheetHandle } from './Sheet';
import { Text } from './Text';
import { TextField } from './TextField';

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
  /** Heading the option sits under (multi-select categories). */
  group?: string;
}

interface BaseProps<V extends string | number> {
  label: string;
  options: SelectOption<V>[];
  placeholder?: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  /** Show a search box (long lists such as cities or products). */
  searchable?: boolean;
  disabled?: boolean;
}

interface SingleProps<V extends string | number> extends BaseProps<V> {
  multiple?: false;
  value: V | null;
  onChange: (next: V | null) => void;
}

interface MultiProps<V extends string | number> extends BaseProps<V> {
  multiple: true;
  value: V[];
  onChange: (next: V[]) => void;
}

/** A field that opens a sheet of choices. One or many. */
export function SelectField<V extends string | number>(props: SingleProps<V> | MultiProps<V>) {
  const { label, options, placeholder = 'Choose', optional, error, hint, searchable, disabled } = props;
  const colors = useColors();
  const sheet = useRef<SheetHandle>(null);
  const [query, setQuery] = useState('');

  const selected = props.multiple ? props.value : props.value === null || props.value === undefined ? [] : [props.value];
  const shown = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)
    .join(', ');

  const pick = (v: V) => {
    haptic.selection();
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(props.value === v && optional ? null : v);
      sheet.current?.close();
    }
  };

  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <View style={styles.wrap}>
      <Text variant="captionStrong" color="body">
        {label}
        {optional ? (
          <Text variant="caption" color="muted">
            {' '}
            (optional)
          </Text>
        ) : null}
      </Text>
      <Pressable
        onPress={() => !disabled && sheet.current?.open()}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown || 'not chosen'}`}
        accessibilityHint="Opens the choices"
        style={({ pressed }) => [
          styles.box,
          {
            borderColor: error ? colors.danger : colors.control,
            backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel,
            opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text variant="body" color={shown ? 'ink' : 'muted'} style={styles.flex} numberOfLines={3}>
          {shown || placeholder}
        </Text>
        <Icon name="chevronDown" size={20} color={colors.chevron} strokeWidth={2.2} />
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="ink2">
          {hint}
        </Text>
      ) : null}

      <Sheet ref={sheet} title={label} snapPoints={options.length > 6 || searchable ? ['70%', '92%'] : ['50%', '80%']} onDismiss={() => setQuery('')}>
        {searchable ? (
          <View style={styles.search}>
            <TextField inSheet value={query} onChangeText={setQuery} placeholder="Search" accessibilityLabel={`Search ${label}`} leading={<Icon name="search" size={20} color={colors.muted} strokeWidth={2} />} />
          </View>
        ) : null}
        <View style={styles.options} accessibilityRole={props.multiple ? undefined : 'radiogroup'}>
          {visible.map((o, i) => {
            const on = selected.includes(o.value);
            const heading = o.group && (i === 0 || visible[i - 1].group !== o.group) ? o.group : null;
            return (
              <View key={String(o.value)}>
                {heading ? (
                  <Text variant="label" color="ink2" style={styles.group}>
                    {heading}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => pick(o.value)}
                  accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.hint ? `${o.label}. ${o.hint}` : o.label}
                  style={({ pressed }) => [styles.option, { borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.pressed }]}
                >
                  <View style={styles.flex}>
                    <Text variant="body" style={on ? styles.on : undefined}>
                      {o.label}
                    </Text>
                    {o.hint ? (
                      <Text variant="caption" color="ink2">
                        {o.hint}
                      </Text>
                    ) : null}
                  </View>
                  {props.multiple ? (
                    <View style={[styles.check, { borderColor: on ? colors.brand : colors.control, backgroundColor: on ? colors.brand : 'transparent' }]}>
                      {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  ) : on ? (
                    <Icon name="check" size={20} color={colors.brand} strokeWidth={2.6} />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
          {visible.length === 0 ? (
            <Text variant="subhead" color="ink2" style={styles.none}>
              Nothing matches “{query}”.
            </Text>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  box: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { marginTop: 12 },
  options: { marginTop: 8 },
  group: { marginTop: 16, marginBottom: 4 },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  on: { fontFamily: 'InstrumentSans_600SemiBold' },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  none: { marginTop: 12 },
});
