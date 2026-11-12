import { appConfig } from '../constants/config';

/** ノンスクロール画面向けに短く保つ */
export const ABOUT_TEXT = [
  `${appConfig.appName}は、操作支援・文章説明・安全性チェックでスマートフォンの困りごとを支えます。`,
  'いまの版は最終仕様向けの画面シェルです。画面収録・端末内Llama・通知の本実装は後続です。',
  `バージョン: ${appConfig.appVersion}`,
].join('\n\n');

export const PRIVACY_TEXT = [
  '画像・画面映像は外部AIに送りません（端末内処理が方針です）。',
  '当面のAI目標は端末内 Llama / WebLLM です。クラウドGeminiは必須にしません。',
  '電話番号などの調査を行う場合も、同意と確認済みの内容だけを扱います。',
  '「安全です」と断定する表示はしません。',
].join('\n\n');
