# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
操作支援・文章解説・安全性検査の3機能に絞り、大きな文字と大きなボタンで迷わず使えることを最優先にしています。

現在の実装範囲は **第1〜4段階**（プロジェクト準備・画面・AI相談・端末内 OCR）です。

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI | Gemini（Firebase Cloud Functions v2 + `@google/genai`） |
| 検証 | Zod（壊れた JSON でもアプリを落とさない） |
| OCR | Google ML Kit Text Recognition v2 **日本語**（端末内のみ・ローカル Expo Module） |
| 画像選択 | Expo ImagePicker（写真ライブラリ） |
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
- **スクリーンショット画像は外部に送らない**（端末内 OCR のみ。Gemini / Firebase / Storage / クラッシュ解析へも送らない）
- **OCR で読み取った文字は、利用者が確認・修正したあとだけ相談に使う**
- **動いていない AI / OCR を動いているように見せない**（未接続・未対応は明示）
- 断定的な「安全です」は使わない

## ディレクトリ構成

```
src/
  components/     # 共通UI（ScreenshotOcrPanel など）
  screens/        # 画面
  navigation/     # 画面遷移
  services/
    ai/           # 相談クライアント・Zod・デモフォールバック
    ocr/          # 端末内OCR境界（選択・認識・一時ファイル削除）
    speech/       # 音声案内（未実装スタブ）
    security/     # 安全性検査（未実装スタブ）
    firebase/     # Firebase 公開設定のみ
  hooks/
  types/
  constants/
  utils/
  data/
modules/
  yorisoi-mlkit-ocr/   # ローカル Expo Module（iOS: ML Kit 日本語 / Android: 差し替え用スタブ）
functions/             # Cloud Functions v2（consultWithAi）
scripts/               # オフライン用スモーク
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

- キーボードの `w` で Web プレビュー（**OCR は Web では動きません**）
- Android エミュレータがある場合は `a`（Android OCR は未実装スタブ）
- **iOS の OCR 実機確認は下記の EAS development build が必須**です（Windows からはローカル iOS ビルド不可）

### 4. 確認コマンド

```bat
npm run typecheck
node scripts\smoke-ai-phase3.mjs
node scripts\smoke-ocr-phase4.mjs
```

Functions 側:

```bat
cd functions
npm install
npm run typecheck
```

## 端末内 OCR（第4段階）

### 方針

1. Expo ImagePicker で写真ライブラリからスクリーンショットを選ぶ
2. ローカル Expo Module `yorisoi-mlkit-ocr` が **Google ML Kit Text Recognition v2（日本語）** で端末内認識
3. 全文・ブロック・行・バウンディングボックス / 相対位置を構造化して返す
4. 利用者が文字を確認・修正してから、確認済みテキストだけが相談に渡る
5. OCR 後にキャッシュ上の一時画像を削除する

**Expo Go ではネイティブ OCR モジュールが入りません。**  
development build / EAS Build が必要です。クラウド VM や Web 上で画像をリモート OCR したように見せることはしません。

### EAS development build（Windows から iPhone）

Expo Go だけでは OCR などのカスタムネイティブが足りないため、**development build** を使います。

#### 初回準備

1. [Expo](https://expo.dev/) にサインアップ
2. 端末でログイン:

```bat
npx eas-cli login
npx eas init
```

`eas init` が `app.json` の `extra.eas.projectId` などを更新します。  
**秘密情報をチャットに貼らないでください。**

#### iOS development build の作成

```bat
npx eas build --platform ios --profile development
```

- Apple Developer Program への加入が必要です
- EAS がクラウド上でビルドするため、**Windows から実行できます**（Mac 不要）
- ビルド完了後、QR / リンクから iPhone にインストールします
- iPhone の **デベロッパモード** をオンにしてください（設定 → プライバシーとセキュリティ）
- 写真ライブラリの許可ダイアログで「許可」を選んでください

#### ビルド後の接続

```bat
npx expo start --dev-client
```

または:

```bat
npm start
```

development build アプリから同じ開発サーバーへ接続します。

#### シミュレータ用（Mac がある場合のみ）

```bat
npx eas build --platform ios --profile development-simulator
```

Google ML Kit 日本語モデルはシミュレータでは使えないことがあります。  
その場合アプリは「使えない」と明示し、成功したふりはしません。実機で確認してください。

### OCR の試し方（実機）

1. EAS development build を iPhone に入れる
2. `npx expo start --dev-client` で接続
3. 「操作支援」または「文章解説」を開く
4. 「写真からスクリーンショットを選ぶ」
5. 読み取った文字を確認・修正 →「この文字で相談する」
6. 「この内容で進む」で、確認済みテキストだけが相談に渡ることを確認

Web / Expo Go では、OCR ボタンを押すと「development build が必要」と明示されます（ダミー成功なし）。

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

## いま使えること / まだないこと

### 実装済み（Phase 1〜4）

- Expo + TypeScript プロジェクト
- ホーム画面（3つの大きな機能ボタン、設定）
- 相談画面（入力 + 初期選択肢 + AI/デモ応答表示）
- Firebase Cloud Functions v2 `consultWithAi`（Google Gen AI SDK）
- 構造化 JSON + Zod 検証、AI未接続明示とデモ選択肢
- **端末内 OCR（ImagePicker → ML Kit 日本語 → 確認/修正 → 確認済みテキストのみ相談へ）**
- **一時画像の削除、Expo Go 非対応の明示、Android 差し替え用スタブ**
- README による Secret Manager / EAS development build 手順（鍵をチャットに貼らせない）

### 未実装（後続段階）

- Android 向け ML Kit OCR の本実装（モジュール境界は用意済み）
- 操作支援の1ステップ案内（できました / もう一度聞く / 分かりません）（第5段階）
- 文章解説の本格レイアウト、電話番号 Search Grounding、Web Risk（第6段階）
- Expo Speech の本接続（第7段階）
- 実機 EAS 署名・ストア提出の本番運用（第8段階）

## Phase 4 の試し方（最短・オフライン）

1. `npm install`
2. `npm run typecheck`
3. `node scripts\smoke-ocr-phase4.mjs`
4. `npm start` → Web で「操作支援」を開き、OCR が「development build が必要」と出ることを確認（ダミー成功なし）

実機 OCR は上記 EAS development build 手順へ。

## 次の作業

1. EAS development build を実機に入れ、日本語スクリーンショットで OCR を確認
2. 第5段階: 操作支援の1ステップ案内（OCR 結果を案内に反映）
3. Android OCR の差し替え実装

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
