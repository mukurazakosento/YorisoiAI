import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type FeatureButtonProps = {
  title: string;
  description: string;
  onPress: () => void;
};

export function FeatureButton({ title, description, onPress }: FeatureButtonProps) {
  const { fontSize } = useSettings();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}。${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.title, { fontSize: fontSize(baseFontSizes.title) }]}>
          {title}
        </Text>
        <Text
          style={[
            styles.description,
            { fontSize: fontSize(baseFontSizes.body) },
          ]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: layout.featureButtonMinHeight,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: layout.borderRadius,
    paddingVertical: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.primarySoft,
  },
  textWrap: {
    gap: 6,
  },
  title: {
    color: colors.primary,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    lineHeight: 26,
  },
});
