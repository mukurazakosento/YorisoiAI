# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
ホームは **操作支援 / 文章説明 / 安全性チェック** の3ボタンのみ（フッターなし）。  
**どの画面もスクロールなし**で完結する設計です。

## 最終仕様（現行方針）

2026-11-12 以降の製品方針:

| 項目 | 内容 |
| --- | --- |
| AI | **端末内 Llama / WebLLM 系**が既定。クラウド Gemini は必須にしない |
| 支援の流れ | 相談（入力＋約4選択肢）→ 意図が不明なら選択肢画面を繰り返す → **支援セッション** |
| 支援セッション | 画面収録 → 定期フレームの端末内 OCR → **通知＋音声**で一つずつ案内 |
| 終了 | 通知「ここをタップで支援を終了」→ **解決した / 解決しなかった** → 再相談可 |
| プライバシー | 画像・画面映像は外部 AI に送らない（端末内 AI にも画像を渡さない） |

旧 Phase 1〜7（Gemini Callable・手動スクショ OCR 中心）は参考実装として残っていますが、**最終仕様のフローが優先**です。

## いまの実装範囲（Phase C）

**端末内 AI サービスインターフェース**まで入りました。正直な稼働状況:

| 経路 | 状態 |
| --- | --- |
| Expo Web + WebLLM | コード配線済み。`EXPO_PUBLIC_ON_DEVICE_AI=true` かつ **WebGPU** があるときだけロード試行。失敗時は **AI未接続／デモ** |
| ネイティブ iOS/Android | **スキャフォールドのみ**（将来 llama.cpp / ExecuTorch）。いまは推論しない |
| この Cloud Agent / 多くの CI | モデル推論は走らない → 常にデモ |

動くもの:

- ホーム（左「よりそいAI」・右設定・3ボタン）
- 相談開始 → 端末内 `classifyIntent`（未接続時はヒューリスティック・**デモ**明示）
- 意図不明時の約4選択肢（未接続時はデモ固定／接続時はモデル生成）
- 支援セッション: **start → guiding → offer end → EndSupport**（手順は `displayText` / `voiceText` JSON）
- ローカル通知＋ Expo Speech。消音でも画面の文字は出ます
- 画面収録・定期 OCR は引き続き **準備中**（偽動作なし）

## 端末内 AI の試し方（Web）

```bat
set EXPO_PUBLIC_ON_DEVICE_AI=true
npm start
```

- キーボードの `w` で Web プレビュー
- WebGPU 非対応・ダウンロード失敗・初期化失敗 → **AI未接続**のまま（`mode: live` にはしません）
- 既定モデル ID: `Llama-3.2-1B-Instruct-q4f16_1-MLC`（`EXPO_PUBLIC_ON_DEVICE_MODEL_ID` で変更可。秘密ではない）

ネイティブ実機では WebLLM は動きません。`src/services/onDeviceAi/nativeScaffold.ts` が将来の差し替え口です。

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
| AI（既定） | `src/services/onDeviceAi`（WebLLM / ネイティブスキャフォールド）。未接続時はデモ明示 |
| AI（旧経路） | Firebase Cloud Functions + Gemini（`EXPO_PUBLIC_LEGACY_CLOUD_AI=true` のときだけ） |
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
    onDeviceAi/   # 端末内 AI（意図・選択肢・案内 JSON）
    session/      # デモ脚本コーパス・意図ヒューリスティック
    notifications/
    ai/           # 旧 Gemini クライアント（任意）
    ocr/
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

### 4. 確認コマンド

```bat
npm run typecheck
npm run smoke:on-device
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

## Phase C の試し方

1. `npm install`
2. `npm run typecheck`
3. `npm run smoke:on-device`
4. `npm run smoke:session`
5. `npm start` → Web または実機
6. ホームでいずれかの機能 → 相談（未接続時は **AI未接続・デモ判定** 表示）
7. 支援セッションで「できました」を押して一手ずつ進む（未接続時は **デモ**）
8. 曖昧な相談（「その他」など）→ 選択肢画面 → セッション

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

1. ネイティブ端末内 Llama（llama.cpp / ExecuTorch 等）の実リンク
2. iOS で可能な範囲の画面収録＋端末内 OCR（制約を UI / README に明示）
3. 収録フレームに応じた動的な次の一手
4. EAS 実機での通知・音声・WebLLM（Web）通し検証

## 秘密情報について

- APIキー・Apple / Expo の認証情報をチャット・README・コミットに書かないでください
- 端末内経路に APIキーは不要です
- 旧 Gemini 経路を使う場合のみ `firebase functions:secrets:set GEMINI_API_KEY` 等（必須ではありません）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
