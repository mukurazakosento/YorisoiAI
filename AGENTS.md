# よりそいAI — agent notes

高齢者向け iPhone アプリ。マスター指示は Project store の `docs/master-dev-instructions.md` を優先する。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`（firebase / zod など Expo 非管理パッケージは `npm install`）
- AI はアプリ直叩き禁止。`functions/` の Callable → `@google/genai`
- モデル ID は Functions の env/params のみ（既定: `gemini-3.5-flash-lite`）

## Hard rules

- APIキーをアプリ・チャット・コミットに書かない（`firebase functions:secrets:set GEMINI_API_KEY`）
- 画像（スクショ）を外部 AI / Functions / Storage に送らない
- 未接続の AI を動いているように見せない（`AI未接続` + デモラベル）
- Windows 向けコマンドを README に書く（ローカル iOS ビルドを前提にしない）

## Layout

`src/{components,screens,navigation,services/{ai,ocr,speech,security,firebase},hooks,types,constants,utils,data}`  
`functions/src/{ai,shared,...}`

## Checks

```bat
npm run typecheck
node scripts\smoke-ai-phase3.mjs
cd functions && npm run typecheck
npx expo start
```
