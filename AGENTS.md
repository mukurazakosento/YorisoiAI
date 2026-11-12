# よりそいAI — agent notes

高齢者向け iPhone アプリ。**最終製品仕様**（Project store `docs/final-product-spec.md`）がマスター指示より優先。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`（firebase / zod など Expo 非管理パッケージは `npm install`）
- **AI 目標**: 端末内 Llama / WebLLM（未接続時は明示デモ）。クラウド Gemini は必須にしない
- 旧 `functions/` Gemini Callable は後方互換の任意経路
- 音声は Expo Speech（`src/services/speech/`）。displayText と voiceText を分離

## Hard rules

- **スクロール禁止**（`ScrollView` を常用しない。1画面に収める）
- APIキーをアプリ・チャット・コミットに書かない
- 画像・画面映像を外部 AI / Functions / Storage に送らない
- 未接続の AI・未実装の収録を動いているように見せない（`準備中` / `デモ` / `AI未接続`）
- Windows 向けコマンドを README に書く（ローカル iOS ビルドを前提にしない）
- Apple の証明書・パスワード・APIキーを README やコードに書かない
- iOS の他アプリ常時キャプチャ制限を正直に扱う

## Layout

`src/{components,screens,navigation,services/{ai,ocr,speech,security,firebase,session},hooks,types,constants,utils,data}`  
`functions/src/{ai,shared,...}`（旧 Gemini 経路）

## Phase A 画面フロー

Home → Consultation（入力+4択）→（不明なら）AiChoice → SupportSession（シェル）→ EndSupport（解決した/しなかった）

## Checks

```bat
npm run typecheck
npx expo start
```

OCR / 画面収録の本実装は EAS development build が必要。画像は端末外へ送らない。
