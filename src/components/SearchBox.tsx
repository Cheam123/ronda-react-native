import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { fonts } from '../theme/type';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

/** The rounded search field at the top of a list (Outlets, Forms). */
export function SearchBox({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
  style,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.panel, borderColor: colors.cardRing }, style]}>
      <Icon name="search" size={20} color={colors.muted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.brand}
        accessibilityLabel={accessibilityLabel}
        returnKeyType="search"
        style={[styles.input, { color: colors.ink }]}
      />
      {value ? (
        <IconButton tone="plain" size={36} onPress={() => onChange('')} accessibilityLabel="Clear the search">
          <Icon name="close" size={18} color={colors.muted} strokeWidth={2.2} />
        </IconButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 14, marginHorizontal: space.gutter, minHeight: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, minHeight: 46 },
});
