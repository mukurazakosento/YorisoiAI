import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

/**
 * 全画面ノンスクロール。ScrollView は使わない（最終仕様の絶対制約）。
 */
export function Screen({ children, style, contentStyle }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top', 'left', 'right']}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 16,
    gap: layout.sectionGap,
  },
});
