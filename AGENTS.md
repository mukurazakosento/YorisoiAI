# よりそいAI — agent notes

高齢者向け iPhone アプリ。**最終製品仕様**（Project store `docs/final-product-spec.md`）がマスター指示より優先。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`（firebase / zod / `@mlc-ai/web-llm` など Expo 非管理は `npm install`）
- **AI 既定**: 端末内（`src/services/onDeviceAi/`）。Web は WebLLM。Android ネイティブは MediaPipe GenAI + Gemma 3 1B int4（`modules/yorisoi-on-device-llm/`、同意後ダウンロード・probe 成功時のみ live）。iOS は未接続
- 未接続時は明示 **デモ / AI未接続**。`mode: live` はエンジン ready のときだけ
- **画面フレーム**: `src/services/capture/`（利用者開始のスクショ選択＋端末内 OCR。Broadcast Upload は未リンク）
- **Android 背面支援**: `modules/yorisoi-android-assist` + `src/services/androidAssist/`（MediaProjection＋FGS・操作支援は約20秒 OCR、文章説明は約4秒でポップアップ捕捉・変化時案内＋即時通知）。Android 14+ は画面全体共有を要求。**ポップアップ自動解説**は設定で一度オンにした AccessibilityService が常時稼働（Activity 非表示でも許可ダイアログを通知+TTS・自動タップなし・MediaProjection不要）。案内は OCR ラベル引用。iOS/Web/Expo Go では不可
- **ホーム**: 操作支援＋文章説明＋安全性チェック（`HOME_FEATURES`）。安全性は電話／メール選択後に MediaProjection 背面検出→通知+TTS（結果で Activity を前面に戻さない。自動発信・送信・タップなし）
- OCR: `modules/yorisoi-mlkit-ocr`（ML Kit 日本語・端末内のみ。Android は bundled モデル）。背面支援も同一 ML Kit 系を再利用（OCR Expo モジュールは増やさない）。確認済みテキストだけ案内へ
- 旧 `functions/` Gemini Callable は `EXPO_PUBLIC_LEGACY_CLOUD_AI=true` の任意経路（必須にしない）
- 音声は Expo Speech（`src/services/speech/`）。背面支援中は Android TTS も使用。displayText と voiceText を分離
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
- Expo Go / Web でライブ収録や OCR・背面支援が動くと主張しない
- MediaProjection トークンの stop 後再利用・ブート自動開始・他アプリ代行タップはしない

## Layout

`src/{components,screens,navigation,services/{capture,androidAssist,onDeviceAi,ai,ocr,speech,notifications,security,firebase,session},hooks,types,constants,utils,data}`  
`functions/src/{ai,shared,...}`（旧 Gemini 経路・任意）  
`modules/yorisoi-mlkit-ocr/`  
`modules/yorisoi-android-assist/`（Android のみ）  
`modules/yorisoi-on-device-llm/`（Android MediaPipe LLM）

## Phase C / Phase D 画面フロー

Home → Consultation（文字／音声の2択 → 入力・端末内意図判定）→（曖昧なときだけ）AiChoice →（Android 背面支援可なら）AndroidAssistConsent → SupportSession（端末内AI案内 / 手動 OCR / Android MediaProjection 背面支援 → guiding → offer_end）→ EndSupport

## Checks

```bat
npm run typecheck
npm run smoke:capture
npm run smoke:android-assist
npm run smoke:android-assist-guidance
npm run smoke:assist-ux-four
npm run smoke:popup-auto-assist
npm run smoke:ocr-aligned-guidance
npm run smoke:notify-privacy
npm run smoke:on-device
npm run smoke:operation-planner
npm run smoke:session
npm run smoke:speech
npm run smoke:ocr
npx expo start
```

OCR / 画面フレーム読み取り / Android 背面支援 / 端末内 LLM は EAS development または preview APK が必要。画像は端末外へ送らない。  
WebLLM の実ロードは `EXPO_PUBLIC_ON_DEVICE_AI=true` かつ WebGPU 付きブラウザが必要（失敗時はデモのまま）。  
ネイティブ LLM は同意→モデル取得→probe 成功後のみ live。Cloud Agent VM では MediaPipe 推論未実行（実機未確認を偽らない）。ヒューリスティックを live と偽らない。
