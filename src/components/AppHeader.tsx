import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { appConfig } from '../constants/config';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';

type AppHeaderProps = {
  title?: string;
  showSettings?: boolean;
  showBack?: boolean;
  onPressSettings?: () => void;
  onPressBack?: () => void;
};

export function AppHeader({
  title = appConfig.appName,
  showSettings = false,
  showBack = false,
  onPressSettings,
  onPressBack,
}: AppHeaderProps) {
  const { fontSize } = useSettings();

  return (
    <View style={styles.wrap}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="戻る"
            onPress={onPressBack}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Text style={[styles.iconText, { fontSize: fontSize(baseFontSizes.button) }]}>
              ←
            </Text>
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      <Text
        style={[styles.title, { fontSize: fontSize(baseFontSizes.header) }]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>

      <View style={[styles.side, styles.sideRight]}>
        {showSettings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="設定を開く"
            onPress={onPressSettings}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Text style={[styles.iconText, { fontSize: fontSize(baseFontSizes.button) }]}>
              ⚙
            </Text>
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.headerBorder,
    backgroundColor: colors.headerBackground,
    marginHorizontal: -layout.screenPadding,
    paddingHorizontal: layout.screenPadding,
  },
  side: {
    width: 56,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '700',
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
  },
  iconText: {
    color: colors.primary,
    fontWeight: '600',
  },
  pressed: {
    backgroundColor: colors.primarySoft,
  },
});
