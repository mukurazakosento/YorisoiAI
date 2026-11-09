# よりそいAI — agent notes

高齢者向け iPhone アプリ。マスター指示は Project store の `docs/master-dev-instructions.md` を優先する。

## Stack

- Expo SDK（`package.json` の `expo` 版を確認）+ React Native + TypeScript
- 画面遷移は **React Navigation Native Stack**（`src/navigation/`）。Expo Router は使わない
- 依存追加は `npx expo install <package>`

## Hard rules

- APIキーをアプリ・チャット・コミットに書かない
- 画像（スクショ）を外部 AI / Functions / Storage に送らない
- 未接続の AI を動いているように見せない
- Windows 向けコマンドを README に書く（ローカル iOS ビルドを前提にしない）

## Layout

`src/{components,screens,navigation,services/{ai,ocr,speech,security,firebase},hooks,types,constants,utils,data}`  
`functions/` は第3段階以降。

## Checks

```bat
npm run typecheck
npx expo start
```
