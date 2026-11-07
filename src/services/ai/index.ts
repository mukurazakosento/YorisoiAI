import { appConfig } from '../../constants/config';
import type { AiResponse } from '../../types/ai';
import type { FeatureId } from '../../types/navigation';

export type ConsultRequest = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
};

/**
 * AI 相談サービスの境界。
 * 第3段階で Firebase Functions → Gemini に接続する。
 * ここでは「未接続」を明示し、偽の回答を返さない。
 */
export async function requestConsultation(
  _request: ConsultRequest,
): Promise<AiResponse> {
  if (!appConfig.aiConnected) {
    return {
      status: 'error',
      message:
        'AI相談はまだつながっていません。画面の入力と選択肢の確認までが使えます。',
    };
  }

  throw new Error('AI接続の実装は第3段階で追加します。');
}
