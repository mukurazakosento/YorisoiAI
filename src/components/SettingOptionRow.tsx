import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type Option = {
  label: string;
  value: string | number | boolean;
};

type SettingOptionRowProps = {
  title: string;
  description?: string;
  options: Option[];
  selectedValue: string | number | boolean;
  onSelect: (value: string | number | boolean) => void;
};

export function SettingOptionRow({
  title,
  description,
  options,
  selectedValue,
  onSelect,
}: SettingOptionRowProps) {
  const { fontSize } = useSettings();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { fontSize: fontSize(baseFontSizes.bodyLarge) }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[styles.description, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      ) : null}
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  { fontSize: fontSize(baseFontSizes.body) },
                  selected && styles.optionLabelSelected,
                ]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  option: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: layout.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    backgroundColor: colors.primarySoft,
  },
  optionLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: colors.primary,
  },
});
