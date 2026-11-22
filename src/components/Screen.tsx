import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';

type ScreenProps = {
  children: ReactNode;
  /** Solid footer (buttons). Sits above system nav; content does not go under it. */
  footer?: ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  footerStyle?: ViewStyle;
};

/**
 * 全画面ノンスクロール。ScrollView は使わない（最終仕様の絶対制約）。
 * 下部は safe area + 任意の無地フッターでシステムナビとボタンの重なりを避ける。
 */
export function Screen({
  children,
  footer,
  style,
  contentStyle,
  footerStyle,
}: ScreenProps) {
  return (
    <SafeAreaView
      style={[styles.safe, style]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
      {footer ? (
        <View style={[styles.footer, footerStyle]}>{footer}</View>
      ) : null}
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
    paddingBottom: 8,
    gap: layout.sectionGap,
    minHeight: 0,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.headerBorder,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
});
