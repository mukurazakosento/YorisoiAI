# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
操作支援・文章解説・安全性検査の3機能に絞り、大きな文字と大きなボタンで迷わず使えることを最優先にしています。

現在の実装範囲は **第1〜3段階**（プロジェクト準備・画面・AI相談と動的選択肢）です。

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI | Gemini（Firebase Cloud Functions v2 + `@google/genai`） |
| 検証 | Zod（壊れた JSON でもアプリを落とさない） |
| OCR（予定） | Google ML Kit Text Recognition v2（端末内のみ） |
| 音声（予定） | Expo Speech / iOS AVSpeechSynthesizer |
| ビルド | Expo EAS Build（iOS development build） |

### Gemini モデル（サーバー env のみ）

実装時に公式ドキュメントで確認した安定 ID:

| 用途 | 環境変数 | 既定値 |
| --- | --- | --- |
| 通常チャット | `GEMINI_MODEL_DEFAULT` | `gemini-3.5-flash-lite` |
| 調査 / Grounding（後続） | `GEMINI_MODEL_GROUNDING` | `gemini-3.8-flash` |

モデル ID はアプリコードに直書きせず、Functions の環境変数 / params で切り替えます。

## 重要なルール

- **APIキーをアプリやチャットに書かない**（Secret Manager + Cloud Functions）
- **スクリーンショット画像は外部に送らない**（端末内 OCR のみ。AI にも画像を送らない）
- **動いていない AI を動いているように見せない**（未接続は「AI未接続」と明示し、デモ案内と区別）
- 断定的な「安全です」は使わない

## ディレクトリ構成

```
src/
  components/     # 共通UI
  screens/        # 画面
  navigation/     # 画面遷移
  services/
    ai/           # 相談クライアント・Zod・デモフォールバック
    ocr/          # 端末内OCR（未実装スタブ）
    speech/       # 音声案内（未実装スタブ）
    security/     # 安全性検査（未実装スタブ）
    firebase/     # Firebase 公開設定のみ
  hooks/
  types/
  constants/
  utils/
  data/
functions/        # Cloud Functions v2（consultWithAi）
scripts/          # オフライン用スモーク
```

## Windows での開発手順

### 1. 必要なもの

- Windows 10/11
- [Node.js LTS](https://nodejs.org/)（推奨: 20 系）
- Git
- エディタ: Cursor
- （実機確認時）Expo アカウント、Apple Developer アカウント、実機 iPhone

PowerShell または コマンドプロンプトで作業します。

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
- Android エミュレータがある場合は `a`
- iOS 実機確認は下記の EAS development build を使います（Windows からはローカル iOS ビルド不可）

### 4. 確認コマンド

```bat
npm run typecheck
node scripts\smoke-ai-phase3.mjs
```

Functions 側:

```bat
cd functions
npm install
npm run typecheck
```

## Firebase / Gemini の設定（秘密をチャットに貼らない）

アプリ本体には **Gemini APIキーを入れません**。  
サーバー（Cloud Functions）だけが Secret Manager 経由で鍵を読みます。

### A. Firebase プロジェクト

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成（Functions 利用のため Blaze 推奨）
2. ウェブアプリを追加し、**公開してよい**設定（`apiKey` / `authDomain` / `projectId` / `appId`）だけ控える
3. リポジトリで:

```bat
npm install -g firebase-tools
firebase login
copy .firebaserc.example .firebaserc
```

`.firebaserc` の `YOUR_FIREBASE_PROJECT_ID` を自分のプロジェクト ID に書き換えます（コミットしない想定。`.gitignore` 済み）。

### B. Gemini APIキーを Secret Manager へ

1. [Google AI Studio](https://aistudio.google.com/) などで Gemini APIキーを発行
2. **キーの文字列をチャットや Issue に貼らない**
3. ターミナルで（値はプロンプト入力。履歴に残さないよう注意）:

```bat
firebase functions:secrets:set GEMINI_API_KEY
```

Functions の params:

- `GEMINI_API_KEY` … Secret（必須・上記コマンドで設定）
- `GEMINI_MODEL_DEFAULT` … 文字列（既定 `gemini-3.5-flash-lite`。必要ならデプロイ環境の params / `.env` で上書き）

ローカルエミュレータ用に `functions/.env` を作る場合も **コミット禁止**です。値をチャットに貼らないでください。

### C. Functions のデプロイ

```bat
cd functions
npm install
cd ..
firebase deploy --only functions
```

デプロイされる Callable: `consultWithAi`（リージョン `asia-northeast1`）

### D. アプリ側の公開設定のみ

ルートに `.env` を作成（`.env.example` を参考。**コミットしない**）:

```bat
EXPO_PUBLIC_FIREBASE_API_KEY=（公開用）
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=（公開用）
EXPO_PUBLIC_FIREBASE_PROJECT_ID=（公開用）
EXPO_PUBLIC_FIREBASE_APP_ID=（公開用）
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=asia-northeast1
EXPO_PUBLIC_AI_CONNECTED=true
```

- `EXPO_PUBLIC_*` はクライアントに埋め込まれる公開値だけにしてください
- `EXPO_PUBLIC_AI_CONNECTED=true` かつ Firebase 公開設定があるときだけ live 呼び出しを試みます
- 未設定時は画面に **「AI未接続」** と出し、**デモ用案内**を使います（本物の AI のふりをしません）

EAS を使う場合は、同じ名前を EAS Secrets / プロジェクト環境変数へ登録してください。値をチャットに貼らないでください。

## Expo EAS（iPhone 開発用ビルド）

Expo Go だけでは将来のネイティブ OCR などが足りないため、**development build** を基本とします。

### 初回準備

1. [Expo](https://expo.dev/) にサインアップ
2. 端末でログイン:

```bat
npx eas-cli login
npx eas init
```

`eas init` が `app.json` の `extra.eas.projectId` などを更新します。  
**秘密情報をチャットに貼らないでください。**

### iOS development build

```bat
npx eas build --platform ios --profile development
```

- Apple Developer Program への加入が必要です
- EAS がクラウド上でビルドするため、Windows から実行できます
- ビルド完了後、QR / リンクから iPhone にインストールします
- iPhone の **デベロッパモード** をオンにしてください（設定 → プライバシーとセキュリティ）

### ビルド後の接続

```bat
npm start
```

development build アプリから同じ開発サーバーへ接続します。

## いま使えること / まだないこと

### 実装済み（Phase 1〜3）

- Expo + TypeScript プロジェクト
- ホーム画面（3つの大きな機能ボタン、設定、フッターなし）
- 相談画面（入力 + 初期選択肢 + AI/デモ応答表示）
- Firebase Cloud Functions v2 `consultWithAi`（Google Gen AI SDK）
- 構造化 JSON（status / message / question / choices / displayText / voiceText など）+ Zod 検証
- Firebase 未設定時の「AI未接続」明示とラベル付きデモ選択肢
- 動的選択肢の配線（例: 「LINEがおかしい」→絞り込み、「スマホが変」→簡単な追加質問）
- README による Secret Manager 手順（鍵をチャットに貼らせない）

### 未実装（後続段階）

- 端末内 OCR（第4段階）
- 操作支援の1ステップ案内（できました / もう一度聞く / 分かりません）（第5段階）
- 文章解説の本格レイアウト、電話番号 Search Grounding、Web Risk（第6段階）
- Expo Speech の本接続（第7段階）
- 実機 EAS 署名・ストア提出の本番運用（第8段階）

## Phase 3 の試し方（最短）

1. `npm install`
2. `npm start` → Web で「操作支援」を開く
3. バナーに **AI未接続** と出ることを確認
4. 「LINEがおかしい」と入力 → 「この内容で進む」
5. デモ案内と、通知が届かない等の **絞り込み選択肢**が出ることを確認
6. 「スマホが変」と入力 → **一つずつの追加質問**系デモになることを確認
7. Firebase / Gemini を用意したあとは `.env` で公開設定と `EXPO_PUBLIC_AI_CONNECTED=true` を入れ、Functions デプロイ後に同じ操作で live 応答を確認

## 次の作業

1. Firebase プロジェクトと `GEMINI_API_KEY` シークレットを自分の環境で設定
2. 第4段階: 端末内 OCR（画像は外部送信しない）
3. 第5段階: 操作支援の1ステップ案内

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
