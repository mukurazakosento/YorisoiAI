# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
ホームは **操作支援 / 文章説明 / 安全性チェック** の3ボタンのみ（フッターなし）。  
**どの画面もスクロールなし**で完結する設計です。

## 最終仕様（現行方針）

2026-11-12 以降の製品方針:

| 項目 | 内容 |
| --- | --- |
| AI | **端末内 Llama / WebLLM 系**を目標。クラウド Gemini は必須にしない |
| 支援の流れ | 相談（入力＋約4選択肢）→ 意図が不明なら選択肢画面を繰り返す → **支援セッション** |
| 支援セッション | 画面収録 → 定期フレームの端末内 OCR → **通知＋音声**で一つずつ案内 |
| 終了 | 通知「ここをタップで支援を終了」→ **解決した / 解決しなかった** → 再相談可 |
| プライバシー | 画像・画面映像は外部 AI に送らない（端末内処理） |

旧 Phase 1〜7（Gemini Callable・手動スクショ OCR 中心）は参考実装として残っていますが、**最終仕様のフローが優先**です。

## いまの実装範囲（Phase B）

**支援セッション＋通知＋音声**まで動きます。まだ動かないもの（動いているように見せません）:

- 画面収録（Broadcast / ReplayKit 等）→ UI は **準備中**
- 定期 OCR → UI は **準備中**
- 端末内 Llama / WebLLM の本接続 → 案内は明示 **デモ**

動くもの:

- ホーム（左「よりそいAI」・右設定・3ボタン）
- 相談開始（入力＋4選択肢、ノンスクロール）
- 意図不明時のデモ選択肢画面（**デモ**明示）
- 支援セッション状態機械: **start → guiding（一手ずつ）→ offer end → EndSupport**
- ローカル通知＋ Expo Speech（短い displayText / 詳しい voiceText）。消音でも画面の文字は出ます
- 通知「ここをタップで支援を終了」（OSが拒否したら画面内の同文言ボタン）
- 操作支援 / 文章説明 / 安全性チェック向けのデモ案内文
- 終了確認（解決した / 解決しなかった → 再相談）

## iOS の制限（正直に）

- **他アプリ画面の常時録画・ポップアップ自動検知は OS 制約が厳しい**です
- 可能な候補: ユーザー開始の画面収録、収録フレームからの端末内 OCR、通知＋音声
- アプリが他アプリを自動操作することはしません
- 断定的な「安全です」は使いません
- バックグラウンド通知が使えない場合は、画面内の「ここをタップで支援を終了」で同等に進めます

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI（目標） | 端末内 Llama / WebLLM 等（未接続時はデモ明示） |
| AI（旧経路） | Firebase Cloud Functions + Gemini（任意・必須ではない） |
| 音声 | Expo Speech（displayText / voiceText 分離） |
| 通知 | expo-notifications（ローカル通知） |
| ビルド | Expo EAS Build（iOS development build） |

## ディレクトリ構成

```
src/
  components/     # 共通UI（ノンスクロール Screen など）
  screens/        # Home / Consultation / AiChoice / SupportSession / EndSupport / Settings
  navigation/
  services/
    session/      # 意図判定・デモ案内スクリプト
    notifications/# ローカル通知
    ai/           # 旧 Gemini クライアント（後方互換）
    ocr/          # 端末内OCR境界（本セッション未配線）
    speech/
    security/
    firebase/
  hooks/
  types/
  constants/
  utils/
  data/
functions/        # 旧 Cloud Functions（任意）
modules/yorisoi-mlkit-ocr/
```

## Windows での開発手順

### 1. 必要なもの

- Windows 10/11
- [Node.js LTS](https://nodejs.org/)（推奨: 20 以上）
- Git
- エディタ: Cursor
- （実機確認時）Expo アカウント、**Apple Developer Program**、実機 iPhone

### 2. セットアップ

```bat
git clone https://github.com/mukurazakosento/YorisoiAI.git
cd YorisoiAI
npm install
```

### 3. 開発サーバー起動

```bat
npm start
```

- キーボードの `w` で Web プレビュー（Web では OS 通知の代わりに画面文言で案内）
- 通知・音声の実機確認は EAS development build が望ましいです
- 画面収録・本格 OCR・端末内 Llama は後続

### 4. 確認コマンド

```bat
npm run typecheck
npm run smoke:session
npm run smoke:speech
```

旧スモーク（Gemini / OCR 経路の参考）:

```bat
node scripts\smoke-ai-phase3.mjs
node scripts\smoke-ocr-phase4.mjs
node scripts\smoke-guidance-phase5.mjs
node scripts\smoke-safety-phase6.mjs
node scripts\smoke-speech-phase7.mjs
```

## Phase B の試し方

1. `npm install`
2. `npm run typecheck`
3. `npm run smoke:session`
4. `npm start` → Web または実機
5. ホームでいずれかの機能 → 相談で具体的な選択肢
6. 支援セッションで「できました」を押して一手ずつ進む（**デモ**表示）
7. 最後の「ここをタップで支援を終了」→ 解決した / 解決しなかった
8. 曖昧な相談（「その他」など）→ デモ選択肢画面 → セッション

## EAS development build（Windows から iPhone 実機）

通知・音声案内・将来の OCR を実機で確認するには **EAS development build** を使います。  
`eas.json` の `development` プロファイルが iOS 実機向けです。

### 初回に用意するもの（認証情報の中身はここに書きません）

1. **Expo アカウント**（[expo.dev](https://expo.dev/)）
2. **Apple Developer Program** への加入
3. 実機 **iPhone**
4. （推奨）EAS による **証明書・プロビジョニングプロファイル** の自動管理

**パスワード・証明書の中身・`.p12`・API キーを README やソースに書かないでください。**

```bat
npx eas-cli login
npx eas build --platform ios --profile development
```

### iPhone 側（デベロッパモード）

1. 必要なら **設定 → プライバシーとセキュリティ → デベロッパモード** をオン
2. 「信頼されていないデベロッパ」と出たら、設定から信頼する
3. 音声案内が出ないときは側面の消音スイッチと音量を確認（**Expo Speech**。消音でも画面の文字は読めます）

```bat
npx expo start --dev-client
```

## 後続フェーズ（未実装）

1. 端末内 AI（Llama / WebLLM 経路）。未接続は明示デモのまま
2. iOS で可能な範囲の画面収録＋端末内 OCR（制約を UI / README に明示）
3. 収録フレームに応じた動的な次の一手
4. EAS 実機での通知・音声の通し検証

## 秘密情報について

- APIキー・Apple / Expo の認証情報をチャット・README・コミットに書かないでください
- 旧 Gemini 経路を使う場合のみ `firebase functions:secrets:set GEMINI_API_KEY` 等（必須ではありません）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
