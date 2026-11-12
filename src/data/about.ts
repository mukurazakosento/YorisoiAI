import { appConfig } from '../constants/config';

/** ノンスクロール画面向けに短く保つ */
export const ABOUT_TEXT = [
  `${appConfig.appName}は、操作支援・文章説明・安全性チェックでスマートフォンの困りごとを支えます。`,
  'AIは端末内 Llama / WebLLM 経路が既定です。未接続のときはデモと明示します。',
  '画面の文字は、自分で選んだスクショを端末内OCRで読み、確認した文だけ案内に使います。',
  `バージョン: ${appConfig.appVersion}`,
].join('\n\n');

export const PRIVACY_TEXT = [
  '画像・画面映像は外部AIに送りません（端末内処理が方針です）。端末内AIにも画像は渡しません。',
  'ほかのアプリを勝手に監視したり、ポップアップを自動検知したりはしません。',
  '当面のAIは端末内 Llama / WebLLM です。クラウドGeminiは必須にしません。',
  '電話番号などの調査を行う場合も、同意と確認済みの内容だけを扱います。',
  '「安全です」と断定する表示はしません。',
].join('\n\n');
