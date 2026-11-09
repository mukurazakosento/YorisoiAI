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
};

export function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
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
          {
            fontSize: fontSize(baseFontSizes.input),
            lineHeight: Math.round(fontSize(baseFontSizes.input) * 1.4),
          },
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
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
    paddingVertical: 14,
  },
});
