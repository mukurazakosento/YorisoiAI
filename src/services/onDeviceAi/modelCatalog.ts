/**
 * On-device model catalog (public metadata — not secrets).
 */
export const ANDROID_NATIVE_MODEL = {
  engine: 'mediapipe-genai',
  modelId: 'gemma-3-1b-it-int4',
  displayName: 'Gemma 3 1B Instruct (int4)',
  /** ~555 MB */
  approxBytes: 555 * 1024 * 1024,
  license: 'Gemma Terms of Use',
  licenseUrl: 'https://ai.google.dev/gemma/terms',
  fileName: 'gemma3-1b-it-int4.task',
  /** User must consent in-app before download. */
  defaultDownloadUrl:
    'https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int4.task',
  japaneseNote:
    '多言語（日本語含む）。操作支援の短い JSON 計画向け。大きめの自由記述は得意ではない。',
  ramNote: '推奨: 4GB+ RAM の実機。エミュレータは非推奨。',
} as const;

export const MODEL_CONSENT_EXPLAIN_JA = [
  'よりそいAIの操作支援を端末の中だけで賢くするために、',
  'Google の小型AIモデル（Gemma 3 1B、約550MB）をこの端末に保存します。',
  '画像や画面の映像は送りません。文字の案内だけに使います。',
  'インターネットはダウンロード時だけ必要で、その後はオフラインで動きます。',
  '利用は Gemma の利用規約に従います。同意しない場合は、これまでどおりデモ案内のみです。',
].join('');
