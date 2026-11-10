# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
操作支援・文章解説・安全性検査の3機能に絞り、大きな文字と大きなボタンで迷わず使えることを最優先にしています。

現在の実装範囲は **第1〜7段階**（プロジェクト準備・画面・AI相談・端末内 OCR・操作支援の1ステップ案内・文章解説・安全性検査・音声案内）と、Windows から iPhone 実機へ入れるための **EAS development build 手順**です。

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
| 音声 | Expo Speech / iOS AVSpeechSynthesizer（開始・一時停止・再開・停止・もう一度聞く） |
| URL検査 | Google Web Risk（サーバー側・鍵未設定時は正直に未照合） |
| 電話番号調査 | Gemini Google Search Grounding（同意後・番号のみ） |
| ビルド | Expo EAS Build（iOS development build） |

### Gemini モデル（サーバー env のみ）

実装時に公式ドキュメントで確認した安定 ID:

| 用途 | 環境変数 | 既定値 |
| --- | --- | --- |
| 通常チャット | `GEMINI_MODEL_DEFAULT` | `gemini-3.5-flash-lite` |
| 調査 / Grounding | `GEMINI_MODEL_GROUNDING` | `gemini-3.8-flash` |

モデル ID はアプリコードに直書きせず、Functions の環境変数 / params で切り替えます。

## 重要なルール

- **APIキーをアプリやチャットに書かない**（Secret Manager + Cloud Functions）
- **スクリーンショット画像は外部に送らない**（端末内 OCR のみ。Gemini / Firebase / Storage / クラッシュ解析へも送らない）
- **OCR で読み取った文字は、利用者が確認・修正したあとだけ相談に使う**
- **動いていない AI / OCR を動いているように見せない**（未接続・未対応は明示）
- 断定的な「安全です」は使わない
- **Apple / Expo の認証情報をチャットや README に貼らない**（手順だけ記載）

## ディレクトリ構成

```
src/
  components/     # 共通UI（ScreenshotOcrPanel / SpeechControls など）
  screens/        # 画面
  navigation/     # 画面遷移
  services/
    ai/           # 相談クライアント・Zod・デモフォールバック
    ocr/          # 端末内OCR境界（選択・認識・一時ファイル削除）
    speech/       # 音声案内（Expo Speech: 開始/停止/一時停止/再開/再生）
    security/     # 電話番号・URL抽出（調査本体は Functions）
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
eas.json               # EAS Build プロファイル（development など）
```

## Windows での開発手順

### 1. 必要なもの

- Windows 10/11
- [Node.js LTS](https://nodejs.org/)（推奨: 20 系）
- Git
- エディタ: Cursor
- （実機確認時）Expo アカウント、**Apple Developer Program**、実機 iPhone

PowerShell または コマンドプロンプトで作業します。  
**Mac が無くても** EAS のクラウドビルドで iPhone 用アプリを作れます。

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

- キーボードの `w` で Web プレビュー（**OCR は Web では動きません**。音声はブラウザ TTS になることがあります）
- Android エミュレータがある場合は `a`（Android OCR は未実装スタブ）
- **iOS の OCR・実機音声確認は下記の EAS development build が必須**です（Windows からはローカル iOS ビルド不可）

### 4. 確認コマンド

```bat
npm run typecheck
node scripts\smoke-ai-phase3.mjs
node scripts\smoke-ocr-phase4.mjs
node scripts\smoke-guidance-phase5.mjs
node scripts\smoke-safety-phase6.mjs
node scripts\smoke-speech-phase7.mjs
```

Functions 側:

```bat
cd functions
npm install
npm run typecheck
```

## 音声案内（第7段階）

- Expo Speech 経由で iOS 標準の AVSpeechSynthesizer が日本語（`ja-JP`）を読み上げます
- 画面用の短い文（`displayText`）と、音声用の詳しい文（`voiceText`）は別管理です
- **消音モードでも画面の文字は必ず表示**します
- 操作: もう一度聞く / 一時停止 / 続きから聞く / 読み上げを止める
- 設定: 音声案内オン・オフ、読み上げ速度（初期値はややゆっくり `0.85`）。AsyncStorage に保存
- 音が出ないとき: iPhone 側面のスイッチ（消音）と音量ボタンを確認してください（設定画面にも同じ説明があります）

操作支援・文章解説・安全性検査で `voiceText` がある結果に音声コントロールを接続しています。

## EAS development build（Windows から iPhone 実機）

Expo Go だけでは OCR などのカスタムネイティブが足りないため、**development build** を使います。  
`eas.json` の `development` プロファイルが iOS 実機向けです（`developmentClient: true` / `simulator: false`）。

### 初回に用意するもの（認証情報の中身はここに書きません）

次は **あなた自身のアカウントで用意**してください。値やファイルをチャット・Issue・コミットに貼らないでください。

1. **Expo アカウント**（[expo.dev](https://expo.dev/)）
2. **Apple Developer Program** への加入（有料。個人または組織）
3. Apple ID で [Apple Developer](https://developer.apple.com/) にサインインできること
4. 実機 **iPhone**（ケーブルまたは同一ネットワーク）
5. （推奨）EAS に任せる **資格情報の自動管理**（証明書・プロビジョニングプロファイル）

EAS が管理する場合でも、Apple 側で次が必要になることがあります（画面の案内に従ってください）。

- 開発用証明書（Development Certificate）
- App ID / Bundle Identifier（本リポジトリ既定: `com.yorisoi.ai`）
- 開発用プロビジョニングプロファイル（実機の UDID 登録を含む）
- 初回ビルド時の Apple へのログイン / チーム選択（EAS CLI が誘導）

**パスワード・証明書の中身・`.p12`・API キーを README やソースに書かないでください。**  
自分の端末のパスワードマネージャーや EAS の Credentials 画面で管理します。

### 初回コマンド

```bat
npx eas-cli login
npx eas init
```

`eas init` が `app.json` の `extra.eas.projectId` などを更新します。  
**秘密情報をチャットに貼らないでください。**

資格情報を確認・設定する場合（対話式。値は端末にだけ入力）:

```bat
npx eas credentials -p ios
```

### iOS development build の作成

```bat
npx eas build --platform ios --profile development
```

- EAS がクラウド上でビルドするため、**Windows から実行できます**（Mac 不要）
- ビルド完了後、Expo のビルドページの QR / リンクから iPhone にインストールします
- 社内配布（`distribution: internal`）のため、登録した実機向けになります

### iPhone 側の準備（デベロッパモード）

1. ビルドをインストールしたあと、必要なら **設定 → プライバシーとセキュリティ → デベロッパモード** をオン
2. 再起動の案内が出たら従う
3. 「信頼されていないデベロッパ」と出たら、設定からデベロッパを信頼する
4. 写真ライブラリの許可ダイアログで「許可」を選ぶ（OCR 用）
5. 音声が出ないときは側面の消音スイッチと音量を確認

### ビルド後の接続

```bat
npx expo start --dev-client
```

または:

```bat
npm start
```

development build アプリから同じ開発サーバーへ接続します。

### シミュレータ用（Mac がある場合のみ）

```bat
npx eas build --platform ios --profile development-simulator
```

Google ML Kit 日本語モデルはシミュレータでは使えないことがあります。  
その場合アプリは「使えない」と明示し、成功したふりはしません。実機で確認してください。

### OCR の試し方（実機）

1. EAS development build を iPhone に入れる
2. `npx expo start --dev-client` で接続
3. 「操作支援」「文章解説」「安全性検査」のいずれかを開く
4. 「写真からスクリーンショットを選ぶ」
5. 読み取った文字を確認・修正 →「この文字で相談する」
6. 「この内容で進む」で、確認済みテキストだけが相談に渡ることを確認
7. 安全性検査で電話番号の場合は、番号確認のあと **公開情報検索への同意** が必要です（番号以外は送りません）

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
- `GEMINI_MODEL_GROUNDING` … 文字列（既定 `gemini-3.8-flash`。電話番号の公開情報調査）
- `WEBRISK_API_KEY` … Secret（任意。URL検査。未設定でもアプリは動き、照合は「未設定」と明示）

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

### 実装済み（Phase 1〜7）

- Expo + TypeScript プロジェクト
- ホーム画面（3つの大きな機能ボタン、設定）
- 相談画面（入力 + 初期選択肢 + AI/デモ応答表示）
- Firebase Cloud Functions v2 `consultWithAi`（Google Gen AI SDK）
- 構造化 JSON + Zod 検証、AI未接続明示とデモ選択肢
- **端末内 OCR（ImagePicker → ML Kit 日本語 → 確認/修正 → 確認済みテキストのみ相談へ）**
- **一時画像の削除、Expo Go 非対応の明示、Android 差し替え用スタブ**
- **操作支援の1ステップ案内（displayText / voiceText、できました / もう一度聞く / 分かりません）**
- **確認済み OCR テキストを案内文脈に任意利用（画像・生OCR・layoutHints は送らない）**
- **文章解説（表示文 / 簡単に言うと / 操作後 / 注意 / 判断ポイント。文脈不足では許可・拒否を勧めない）**
- **安全性検査（電話番号: 確認→同意→Search Grounding、SMS/メール分析、Web Risk 枠。出典捏造なし・「安全です」禁止）**
- **GEMINI 未設定時は mode=offline（Firebase だけ生きていても live にしない）**
- **Expo Speech 本格 UX（開始・一時停止・再開・停止・もう一度聞く、速度、オン/オフ永続化、消音時も画面文言）**
- **EAS `development` プロファイルと Windows 向け実機ビルド・署名・デベロッパモード手順（認証情報の中身は記載しない）**

### 未実装（後続）

- Android 向け ML Kit OCR の本実装（モジュール境界は用意済み）
- App Store 提出・本番署名の運用手順の詳細化
- live Gemini / 実機での通し品質チューニング（利用者側の鍵・Apple アカウントが必要）

## Phase 7 の試し方（最短・オフライン）

1. `npm install`
2. `npm run typecheck`
3. `npm run smoke:ai`
4. `npm run smoke:ocr`
5. `npm run smoke:guidance`
6. `npm run smoke:safety`
7. `npm run smoke:speech`
8. `npm start`
   - 「操作支援」→ 案内開始 → もう一度聞く / 一時停止 / 続きから聞く
   - 「文章解説」「安全性検査」でも音声コントロールが出ることを確認
   - 設定で音声オフにすると読み上げず、画面文字は残る

実機 OCR・実機音声は上記 EAS development build 手順へ。

## 次の作業

1. EAS development build を実機に入れ、OCR・音声・解説・安全性検査を通し確認
2. Apple Developer / Expo の資格情報は各自のアカウントで管理（チャットに貼らない）
3. 必要なら App Store 提出用の production プロファイル運用を詰める
4. Android OCR の差し替え実装

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
