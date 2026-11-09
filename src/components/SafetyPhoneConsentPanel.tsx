import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import { InfoCard } from './InfoCard';
import { PrimaryButton } from './PrimaryButton';
import { TextInputField } from './TextInputField';

type SafetyPhoneConsentPanelProps = {
  phoneNumber: string;
  onChangePhoneNumber: (value: string) => void;
  busy?: boolean;
  onSearch: () => void;
  onCancel?: () => void;
};

/**
 * 電話番号の確認・修正と、公開情報検索への事前同意 UI。
 * 同意前に検索へ送らない。送るのは番号のみ。
 */
export function SafetyPhoneConsentPanel({
  phoneNumber,
  onChangePhoneNumber,
  busy = false,
  onSearch,
  onCancel,
}: SafetyPhoneConsentPanelProps) {
  const { fontSize } = useSettings();
  const canSearch = phoneNumber.trim().length >= 10 && !busy;

  return (
    <View style={styles.wrap}>
      <Text
        style={[styles.title, { fontSize: fontSize(baseFontSizes.bodyLarge) }]}
      >
        電話番号の確認
      </Text>
      <Text
        style={[styles.lead, { fontSize: fontSize(baseFontSizes.body) }]}
      >
        読み取った番号を確認・修正してください。次の調査では、この番号だけをインターネットの公開情報検索に送ります。
      </Text>

      <TextInputField
        label="調べる電話番号"
        value={phoneNumber}
        onChangeText={onChangePhoneNumber}
        placeholder="例：09012345678"
      />

      <InfoCard message="同意すると、番号だけがサーバー経由で Google 検索（公開情報）に送られます。氏名や着信履歴の他の文字は送りません。画像も送りません。" />

      <PrimaryButton
        label={busy ? '調べています…' : '同意して、この番号を公開情報で調べる'}
        onPress={onSearch}
        disabled={!canSearch}
      />

      {onCancel ? (
        <PrimaryButton
          label="調べない"
          variant="secondary"
          onPress={onCancel}
          disabled={busy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  lead: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
});
