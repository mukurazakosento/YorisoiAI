import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type InfoCardProps = {
  message: string;
};

/** 未接続・注意などの説明用。装飾は最小限。 */
export function InfoCard({ message }: InfoCardProps) {
  const { fontSize } = useSettings();

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={[styles.text, { fontSize: fontSize(baseFontSizes.body) }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primarySoft,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
  },
  text: {
    color: colors.text,
    lineHeight: 28,
  },
});
