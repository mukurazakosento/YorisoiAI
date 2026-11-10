import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import { riskLevelLabel } from '../services/ai/schema';
import type { AiResponse, AiRiskLevel } from '../types/ai';
import { SpeechControls } from './SpeechControls';

type SafetyResultPanelProps = {
  response: AiResponse;
};

/**
 * 安全性検査結果: 3段階リスク・推奨行動・実在出典のみ・URL検査状態。
 * 断定的な安全宣言は表示しない。画面文言は常時表示し、音声は別経路。
 */
export function SafetyResultPanel({
  response,
}: SafetyResultPanelProps) {
  const { fontSize } = useSettings();
  const riskLevel: AiRiskLevel = response.riskLevel ?? 'insufficient_info';
  const tone = riskTone(riskLevel);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {response.mode === 'demo' || response.mode === 'offline' ? (
        <Text
          style={[styles.modeLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {response.mode === 'demo' ? 'デモ案内' : 'AI未接続'}
        </Text>
      ) : null}

      <View style={[styles.badge, { borderColor: tone.border, backgroundColor: tone.bg }]}>
        <Text
          style={[
            styles.badgeText,
            { color: tone.text, fontSize: fontSize(baseFontSizes.bodyLarge) },
          ]}
        >
          {riskLevelLabel(riskLevel)}
        </Text>
      </View>

      {response.message ? (
        <Text
          style={[styles.message, { fontSize: fontSize(baseFontSizes.body) }]}
        >
          {response.message}
        </Text>
      ) : null}

      {response.rationale ? (
        <Text
          style={[styles.rationale, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {response.rationale}
        </Text>
      ) : null}

      {response.recommendedActions &&
      response.recommendedActions.length > 0 ? (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: fontSize(baseFontSizes.bodyLarge) },
            ]}
          >
            次にできること
          </Text>
          {response.recommendedActions.map((action) => (
            <Text
              key={action}
              style={[
                styles.actionItem,
                { fontSize: fontSize(baseFontSizes.body) },
              ]}
            >
              ・{action}
            </Text>
          ))}
        </View>
      ) : null}

      {response.urlChecks && response.urlChecks.length > 0 ? (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: fontSize(baseFontSizes.bodyLarge) },
            ]}
          >
            リンクの確認
          </Text>
          {response.urlChecks.map((check) => (
            <View key={`${check.url}-${check.status}`} style={styles.urlRow}>
              <Text
                style={[
                  styles.urlText,
                  { fontSize: fontSize(baseFontSizes.caption) },
                ]}
                numberOfLines={2}
              >
                {check.url}
              </Text>
              <Text
                style={[
                  styles.urlStatus,
                  { fontSize: fontSize(baseFontSizes.body) },
                ]}
              >
                {urlStatusLabel(check.status)}：{check.message}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {response.sources && response.sources.length > 0 ? (
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: fontSize(baseFontSizes.bodyLarge) },
            ]}
          >
            情報源（実際の検索結果）
          </Text>
          {response.sources.map((source) => (
            <Pressable
              key={`${source.title}-${source.url}`}
              onPress={() => {
                void Linking.openURL(source.url).catch(() => {
                  // 開けなくても文言は残す
                });
              }}
              accessibilityRole="link"
            >
              <Text
                style={[
                  styles.sourceTitle,
                  { fontSize: fontSize(baseFontSizes.body) },
                ]}
              >
                {source.title}
              </Text>
              <Text
                style={[
                  styles.sourceUrl,
                  { fontSize: fontSize(baseFontSizes.caption) },
                ]}
                numberOfLines={2}
              >
                {source.url}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text
          style={[styles.noSources, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          表示できる公開情報の出典リンクはありません。情報が無いことを安全の証拠にはしません。
        </Text>
      )}

      <SpeechControls
        voiceText={response.voiceText}
        displayFallback={response.displayText || response.message}
      />
    </View>
  );
}

function riskTone(riskLevel: AiRiskLevel): {
  bg: string;
  border: string;
  text: string;
} {
  switch (riskLevel) {
    case 'dangerous':
      return {
        bg: '#F8E8E8',
        border: colors.danger,
        text: colors.danger,
      };
    case 'caution':
      return {
        bg: '#F8F0E0',
        border: colors.warning,
        text: colors.warning,
      };
    case 'insufficient_info':
    default:
      return {
        bg: colors.primarySoft,
        border: colors.primary,
        text: colors.primary,
      };
  }
}

function urlStatusLabel(
  status: NonNullable<AiResponse['urlChecks']>[number]['status'],
): string {
  switch (status) {
    case 'unsafe':
      return '危険の可能性';
    case 'unknown':
      return '判定できず';
    case 'not_configured':
      return '照合未設定';
    case 'skipped':
      return '照合スキップ';
    case 'error':
      return '照合エラー';
    default:
      return '不明';
  }
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  modeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  badge: {
    borderWidth: 2,
    borderRadius: layout.borderRadius,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  badgeText: {
    fontWeight: '700',
    lineHeight: 30,
  },
  message: {
    color: colors.text,
    lineHeight: 28,
  },
  rationale: {
    color: colors.textMuted,
    lineHeight: 24,
  },
  section: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  actionItem: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
  urlRow: {
    gap: 4,
  },
  urlText: {
    color: colors.textMuted,
  },
  urlStatus: {
    color: colors.textSecondary,
    lineHeight: 26,
  },
  sourceTitle: {
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 28,
    textDecorationLine: 'underline',
  },
  sourceUrl: {
    color: colors.textMuted,
    marginBottom: 8,
  },
  noSources: {
    color: colors.textMuted,
    lineHeight: 24,
  },
});
