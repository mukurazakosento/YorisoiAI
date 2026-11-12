import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type ChoiceButtonProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
};

export function ChoiceButton({
  label,
  selected = false,
  onPress,
  compact = false,
}: ChoiceButtonProps) {
  const { fontSize } = useSettings();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
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
        numberOfLines={2}
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  compact: {
    minHeight: layout.choiceMinHeight,
    paddingVertical: 8,
    flex: 1,
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
    lineHeight: 24,
  },
  selectedLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
});
