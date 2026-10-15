import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/type';
import { Text } from './Text';

interface TextFieldProps extends TextInputProps {
  label?: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  /** Something inside the field on the right (a show-password button). */
  trailing?: ReactNode;
  /** Something inside the field on the left (an "RM" prefix). */
  leading?: ReactNode;
  mono?: boolean;
  /** Wraps onto more lines as it fills, starting one line tall (a title). */
  grow?: boolean;
  /** Inside a bottom sheet: use the sheet's input so the keyboard lifts the sheet. */
  inSheet?: boolean;
}

/** A labelled input, 50+ tall, radius 14, with a focus ring and an error line. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, optional, error, hint, trailing, leading, mono, inSheet, style, multiline: multilineProp, grow = false, onFocus, onBlur, ...rest },
  ref,
) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.control;
  const Input = (inSheet ? BottomSheetTextInput : TextInput) as typeof TextInput;
  const multiline = multilineProp || grow;
  const tall = multilineProp && !grow;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="captionStrong" color="body" nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
          {label}
          {optional ? (
            <Text variant="caption" color="muted">
              {' '}
              (optional)
            </Text>
          ) : null}
        </Text>
      ) : null}
      {/*
        Only colours change on focus. Adding or removing style props here
        (a shadow, say) changes the native view tree on Android, which remounts
        the input and drops its focus straight away.
      */}
      <View
        style={[
          styles.box,
          {
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            backgroundColor: colors.scheme === 'dark' ? colors.raised : colors.panel,
            minHeight: tall ? 104 : 52,
            alignItems: tall ? 'stretch' : 'center',
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: focused && !error ? 'rgba(13,114,158,0.14)' : 'transparent' }]}
        />
        {leading}
        <Input
          ref={ref}
          {...rest}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: colors.ink,
              fontFamily: mono ? fonts.mono : fonts.regular,
              fontSize: mono ? 15 : 16,
              textAlignVertical: tall ? 'top' : 'center',
              // Even padding above and below, so one line of text sits in the middle.
              paddingVertical: tall || grow ? 12 : 10,
            },
            style,
          ]}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="ink2">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  // The soft focus halo, always mounted; only its colour changes.
  ring: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 18, borderWidth: 4 },
  // Android adds extra space above the text by default, which sits it high.
  input: { flex: 1, minWidth: 0, minHeight: 48, includeFontPadding: false },
});
