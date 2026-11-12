import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type TextInputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** ノンスクロール相談画面向けに入力欄を低めにする */
  compact?: boolean;
};

export function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  compact = false,
}: TextInputFieldProps) {
  const { fontSize } = useSettings();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { fontSize: fontSize(baseFontSizes.body) }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={[
          styles.input,
          compact && styles.inputCompact,
          {
            fontSize: fontSize(baseFontSizes.input),
            lineHeight: Math.round(fontSize(baseFontSizes.input) * 1.35),
          },
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
  },
  input: {
    minHeight: layout.inputMinHeight,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: layout.borderRadius,
    backgroundColor: colors.inputBackground,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputCompact: {
    minHeight: layout.inputMinHeight,
    maxHeight: 96,
  },
});
