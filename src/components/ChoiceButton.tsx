import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type ChoiceButtonProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceButton({ label, selected = false, onPress }: ChoiceButtonProps) {
  const { fontSize } = useSettings();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          { fontSize: fontSize(baseFontSizes.body) },
          selected && styles.selectedLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minButtonHeight,
    borderRadius: layout.borderRadius,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    color: colors.text,
    lineHeight: 28,
  },
  selectedLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
});
