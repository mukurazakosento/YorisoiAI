# よりそいAI — agent notes

高齢者向け iPhone アプリ。**最終製品仕様**（Project store `docs/final-product-spec.md`）がマスター指示より優先。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`（firebase / zod / `@mlc-ai/web-llm` など Expo 非管理は `npm install`）
- **AI 既定**: 端末内 Llama 系（`src/services/onDeviceAi/`）。Web は WebLLM、ネイティブは llama.cpp / ExecuTorch スキャフォールド
- 未接続時は明示 **デモ / AI未接続**。`mode: live` はエンジン ready のときだけ
- 旧 `functions/` Gemini Callable は `EXPO_PUBLIC_LEGACY_CLOUD_AI=true` の任意経路（必須にしない）
- 音声は Expo Speech（`src/services/speech/`）。displayText と voiceText を分離
- 通知は expo-notifications（`src/services/notifications/`）。拒否時は画面内文言へフォールバック

## Hard rules

- **スクロール禁止**（`ScrollView` を常用しない。1画面に収める）
- APIキーをアプリ・チャット・コミットに書かない
- 画像・画面映像を外部 AI / Functions / Storage に送らない（端末内 AI にも画像を渡さない）
- 未接続の AI・未実装の収録を動いているように見せない（`準備中` / `デモ` / `AI未接続`）
- Windows 向けコマンドを README に書く（ローカル iOS ビルドを前提にしない）
- Apple の証明書・パスワード・APIキーを README やコードに書かない
- iOS の他アプリ常時キャプチャ制限を正直に扱う
- 断定的な「安全です」は使わない

## Layout

`src/{components,screens,navigation,services/{onDeviceAi,ai,ocr,speech,notifications,security,firebase,session},hooks,types,constants,utils,data}`  
`functions/src/{ai,shared,...}`（旧 Gemini 経路・任意）

## Phase C 画面フロー

Home → Consultation（入力+4択・端末内意図判定）→（不明なら）AiChoice（動的〜4択）→ SupportSession（start→guiding→offer_end）→ EndSupport

## Checks

```bat
npm run typecheck
npm run smoke:on-device
npm run smoke:session
npm run smoke:speech
npx expo start
```

OCR / 画面収録の本実装は EAS development build が必要。画像は端末外へ送らない。  
WebLLM の実ロードは `EXPO_PUBLIC_ON_DEVICE_AI=true` かつ WebGPU 付きブラウザが必要（失敗時はデモのまま）。
