# よりそいAI — agent notes

高齢者向け iPhone アプリ。**最終製品仕様**（Project store `docs/final-product-spec.md`）がマスター指示より優先。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`（firebase / zod / `@mlc-ai/web-llm` など Expo 非管理は `npm install`）
- **AI 既定**: 端末内 Llama 系（`src/services/onDeviceAi/`）。Web は WebLLM、ネイティブは llama.cpp / ExecuTorch スキャフォールド
- 未接続時は明示 **デモ / AI未接続**。`mode: live` はエンジン ready のときだけ
- **画面フレーム**: `src/services/capture/`（利用者開始のスクショ選択＋端末内 OCR。Broadcast Upload は未リンク）
- OCR: `modules/yorisoi-mlkit-ocr`（ML Kit 日本語・端末内のみ）。確認済みテキストだけ案内へ
- 旧 `functions/` Gemini Callable は `EXPO_PUBLIC_LEGACY_CLOUD_AI=true` の任意経路（必須にしない）
- 音声は Expo Speech（`src/services/speech/`）。displayText と voiceText を分離
- 通知は expo-notifications（`src/services/notifications/`）。拒否時は画面内文言へフォールバック

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
- Expo Go / Web でライブ収録や OCR が動くと主張しない

## Layout

`src/{components,screens,navigation,services/{capture,onDeviceAi,ai,ocr,speech,notifications,security,firebase,session},hooks,types,constants,utils,data}`  
`functions/src/{ai,shared,...}`（旧 Gemini 経路・任意）  
`modules/yorisoi-mlkit-ocr/`

## Phase C / Phase D 画面フロー

Home → Consultation（入力+4択・端末内意図判定）→（不明なら）AiChoice → SupportSession（Phase C: 端末内AI案内 / Phase D: 収録境界＋都度 OCR → guiding → offer_end）→ EndSupport

## Checks

```bat
npm run typecheck
npm run smoke:capture
npm run smoke:on-device
npm run smoke:session
npm run smoke:speech
npm run smoke:ocr
npx expo start
```

OCR / 画面フレーム読み取りは EAS development build が必要。画像は端末外へ送らない。  
WebLLM の実ロードは `EXPO_PUBLIC_ON_DEVICE_AI=true` かつ WebGPU 付きブラウザが必要（失敗時はデモのまま）。
