import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { formatDate, formatTime } from '../lib/format';
import { useColors } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (next: Date) => void;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  /** Show as a row inside a card ("Next visit   Mon, 12 Oct 2026 ›"). */
  row?: boolean;
  error?: string;
}

/** A date or time picked with the phone's own picker. */
export function DateField({ label, value, onChange, mode = 'date', minimumDate, maximumDate, placeholder = 'Choose', row = false, error }: DateFieldProps) {
  const colors = useColors();
  const [iosOpen, setIosOpen] = useState(false);
  const shown = value ? (mode === 'date' ? formatDate(value) : formatTime(value)) : placeholder;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode,
        minimumDate,
        maximumDate,
        is24Hour: false,
        // Called only when a date is chosen (not on Cancel).
        onValueChange: (_e, d) => onChange(d),
      });
    } else {
      setIosOpen((v) => !v);
    }
  };

  return (
    <View>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ? shown : 'not chosen'}`}
        accessibilityHint="Opens a picker"
        style={({ pressed }) => [
          row ? styles.row : [styles.box, { borderColor: error ? colors.danger : colors.control, backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel }],
          pressed && { opacity: 0.7 },
        ]}
      >
        {row ? (
          <Text variant="subhead" color="ink2" style={styles.flex}>
            {label}
          </Text>
        ) : null}
        <Text variant={row ? 'subhead' : 'body'} color={value ? 'ink' : 'muted'} style={row ? styles.rowValue : styles.flex}>
          {shown}
        </Text>
        <Icon name={row ? 'chevronRight' : mode === 'date' ? 'calendar' : 'clock'} size={18} color={colors.chevron} strokeWidth={2.2} />
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          display="inline"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_e, d) => onChange(d)}
        />
      ) : null}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontFamily: 'InstrumentSans_600SemiBold' },
});
