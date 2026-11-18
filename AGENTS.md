# よりそいAI — agent notes

高齢者向け iPhone アプリ。**最終製品仕様**（Project store `docs/final-product-spec.md`）がマスター指示より優先。Web 試作は `docs/web-prototype-spec.md`。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`（firebase / zod / `@mlc-ai/web-llm` / `tesseract.js` など Expo 非管理は `npm install`）
- **AI 既定**: 端末内 Llama 系（`src/services/onDeviceAi/`）。Web は WebLLM、ネイティブは llama.cpp / ExecuTorch スキャフォールド
- 未接続時は明示 **デモ / AI未接続**。`mode: live` はエンジン ready のときだけ
- **画面フレーム（ネイティブ）**: `src/services/capture/`（利用者開始のスクショ選択＋端末内 OCR。Broadcast Upload は未リンク）
- **画面共有（Web 試作）**: `src/services/webCapture/`（`getDisplayMedia` → 約5秒キャンバス → **Tesseract.js 日本語**。ネイティブ capture と分離）
- OCR ネイティブ: `modules/yorisoi-mlkit-ocr`（ML Kit 日本語・端末内のみ）。確認済みテキストだけ案内へ
- 旧 `functions/` Gemini Callable は `EXPO_PUBLIC_LEGACY_CLOUD_AI=true` の任意経路（必須にしない）
- 音声は Expo Speech（`src/services/speech/`）。Web では SpeechSynthesis。displayText と voiceText を分離
- 通知は expo-notifications（`src/services/notifications/`）。Web では Notification API（可能な環境）。拒否時は画面内文言へフォールバック

## Hard rules

- **スクロール禁止**（`ScrollView` を常用しない。1画面に収める）
- APIキーをアプリ・チャット・コミットに書かない
- 画像・画面映像を外部 AI / Functions / Storage に送らない（端末内 AI にも画像を渡さない）
- 未接続の AI・未リンクの収録を動いているように見せない（`不可` / `デモ` / `AI未接続` / Broadcast 未リンク）
- サイレントな他アプリ監視・偽のポップアップ自動検知をしない
- Windows 向けコマンドを README に書く（ローカル iOS ビルドを前提にしない）
- Apple の証明書・パスワード・APIキーを README やコードに書かない
- iOS の他アプリ常時キャプチャ制限を正直に扱う
- 断定的な「安全です」は使わない
- Expo Go でライブ収録や ML Kit OCR が動くと主張しない
- Web 試作の画面共有は **対応ブラウザ＋ secure context** のみ。未対応は不可と明示。背面タブでは動かないと明示

## Layout

`src/{components,screens,navigation,services/{capture,webCapture,onDeviceAi,ai,ocr,speech,notifications,security,firebase,session},hooks,types,constants,utils,data}`  
`functions/src/{ai,shared,...}`（旧 Gemini 経路・任意）  
`modules/yorisoi-mlkit-ocr/`

## Phase C / Phase D / Web 試作 画面フロー

Home → Consultation（入力+4択・端末内意図判定）→（不明なら）AiChoice（アキネーター・履歴＋自由記述）→ SupportSession（ネイティブ: 収録境界＋都度 OCR / Web: 画面共有＋Tesseract → guiding → offer_end）→ EndSupport

## Checks

```bat
npm run typecheck
npm run smoke:capture
npm run smoke:on-device
npm run smoke:session
npm run smoke:speech
npm run smoke:ocr
npm run smoke:web
npx expo start
npx expo start --web
```

OCR / 画面フレーム読み取り（ネイティブ）は EAS development build が必要。画像は端末外へ送らない。  
WebLLM の実ロードは `EXPO_PUBLIC_ON_DEVICE_AI=true` かつ WebGPU 付きブラウザが必要（失敗時はデモのまま）。  
Web 画面共有は `getDisplayMedia` 対応ブラウザが必要（失敗・拒否時は不可／停止を明示）。
