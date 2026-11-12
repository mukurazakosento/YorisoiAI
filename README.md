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

## いまの実装範囲（Phase A）

**UIシェル＋状態機械スタブ**までです。次はまだ動きません（動いているように見せません）:

- 画面収録（Broadcast / ReplayKit 等）
- 定期 OCR
- 端末内 Llama / WebLLM の本接続
- 機能ごとの通知・音声の本配線

動くもの:

- ホーム（左「よりそいAI」・右設定・3ボタン）
- 相談開始（入力＋4選択肢、ノンスクロール）
- 意図不明時のデモ選択肢画面（**デモ**明示）
- 支援セッション画面の構造のみ（各欄は **準備中**）
- 終了確認（解決した / 解決しなかった → 再相談）

## iOS の制限（正直に）

- **他アプリ画面の常時録画・ポップアップ自動検知は OS 制約が厳しい**です
- 可能な候補: ユーザー開始の画面収録、収録フレームからの端末内 OCR、通知＋音声
- アプリが他アプリを自動操作することはしません
- 断定的な「安全です」は使いません

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI（目標） | 端末内 Llama / WebLLM 等（未接続時はデモ明示） |
| AI（旧経路） | Firebase Cloud Functions + Gemini（任意・必須ではない） |
| 音声 | Expo Speech（後続で本配線） |
| ビルド | Expo EAS Build（iOS development build） |

## ディレクトリ構成

```
src/
  components/     # 共通UI（ノンスクロール Screen など）
  screens/        # Home / Consultation / AiChoice / SupportSession / EndSupport / Settings
  navigation/
  services/
    session/      # 意図判定スタブなど
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
- [Node.js LTS](https://nodejs.org/)（推奨: 20 系）
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

- キーボードの `w` で Web プレビュー
- Phase A の画面シェル確認は Web でも可能です
- 画面収録・本格 OCR・端末内 Llama は後続（実機 / 専用ビルドが必要）

### 4. 確認コマンド

```bat
npm run typecheck
```

旧スモーク（Gemini / OCR 経路の参考）:

```bat
node scripts\smoke-ai-phase3.mjs
node scripts\smoke-ocr-phase4.mjs
node scripts\smoke-guidance-phase5.mjs
node scripts\smoke-safety-phase6.mjs
node scripts\smoke-speech-phase7.mjs
```

## Phase A の試し方

1. `npm install`
2. `npm run typecheck`
3. `npm start` → Web または実機
4. ホームで「操作支援」「文章説明」「安全性チェック」を確認
5. 相談で選択肢を押す → 支援セッション（準備中表示）
6. 「その他」や短い曖昧な文 → デモ選択肢画面
7. 「支援を終了する」→ 解決した / 解決しなかった

## 後続フェーズ（この README の Phase A では未実装）

1. 支援セッション状態機械の本実装（収録フレーム・指示ループ）
2. 端末内 AI（Llama / WebLLM 経路）。未接続は明示デモ
3. iOS で可能な範囲の画面収録＋端末内 OCR（制約を UI / README に明示）
4. 通知＋音声の本配線
5. 三機能の差分化（操作支援 / 安全性チェック / 文章説明）
6. EAS 実機検証

## 秘密情報について

- APIキー・Apple / Expo の認証情報をチャット・README・コミットに書かないでください
- 旧 Gemini 経路を使う場合のみ `firebase functions:secrets:set GEMINI_API_KEY` 等（必須ではありません）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
