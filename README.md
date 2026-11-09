# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
操作支援・文章解説・安全性検査の3機能に絞り、大きな文字と大きなボタンで迷わず使えることを最優先にしています。

現在の実装範囲は **第1段階（プロジェクト準備）** と **第2段階（画面・デザイン）** です。

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| OCR（予定） | Google ML Kit Text Recognition v2（端末内のみ） |
| AI（予定） | Gemini（Firebase Cloud Functions 経由） |
| 音声（予定） | Expo Speech / iOS AVSpeechSynthesizer |
| ビルド | Expo EAS Build（iOS development build） |

## 重要なルール

- **APIキーをアプリやチャットに書かない**（Secret Manager + Cloud Functions）
- **スクリーンショット画像は外部に送らない**（端末内 OCR のみ）
- **動いていない AI を動いているように見せない**（未接続は画面で明示）
- 断定的な「安全です」は使わない

## ディレクトリ構成

```
src/
  components/     # 共通UI
  screens/        # 画面
  navigation/     # 画面遷移
  services/
    ai/           # AI相談（未接続スタブ）
    ocr/          # 端末内OCR（未実装スタブ）
    speech/       # 音声案内（未実装スタブ）
    security/     # 安全性検査（未実装スタブ）
    firebase/     # Firebase接続（未設定スタブ）
  hooks/
  types/
  constants/
  utils/
  data/
functions/        # Cloud Functions（第3段階以降）
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

### 4. TypeScript 確認

```bat
npx tsc --noEmit
```

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

シミュレータ用:

```bat
npx eas build --platform ios --profile development-simulator
```

### ビルド後の接続

```bat
npm start
```

development build アプリから同じ開発サーバーへ接続します。

## Apple Developer 準備メモ

チャットやリポジトリに証明書・`.p8`・パスワードを貼らないでください。

1. [Apple Developer](https://developer.apple.com/) で Program に加入
2. EAS に Apple アカウントを連携（`eas credentials` でも可）
3. Bundle ID: `com.yorisoi.ai`（`app.json` と一致）
4. 実機を登録し、development build をインストール
5. iPhone でデベロッパモードを有効化

## Firebase / Gemini 準備メモ（第3段階以降）

まだアプリには接続していません。準備するときは次を想定してください。

1. Firebase プロジェクトを作成（Blaze 推奨: Cloud Functions）
2. Cloud Functions（第2世代）を追加
3. Google AI Studio / Google Cloud で Gemini API を有効化
4. APIキーは **Google Cloud Secret Manager** に保存（アプリに埋め込まない）
5. 必要に応じて App Check を有効化
6. Web Risk も同様にサーバー側のみで利用

ローカル用の値は `.env` や EAS Secrets / Firebase コンソールで管理し、**会話やコミットに含めない**でください。

`.gitignore` には `.env*.local` が含まれています。追加の秘密ファイルもコミットしないでください。

## いま使えること / まだないこと

### 実装済み（Phase 1 + 2）

- Expo + TypeScript プロジェクト
- 保守しやすい `src/` 構成と `functions/` スタブ
- ホーム画面（「よりそいAI」ヘッダー、設定歯車、3つの大きな機能ボタン、フッターなし）
- 各機能の相談画面シェル（入力欄 + 初期選択肢）
- 設定画面（音声オンオフ、読み上げ速度、文字サイズ、個人情報、アプリについて）
- 設定の端末内永続化
- AI 未接続の明示表示

### 未実装（後続段階）

- Gemini 接続・動的選択肢（第3段階）
- 端末内 OCR（第4段階）
- 操作支援の1ステップ案内（第5段階）
- 文章解説・安全性検査の本処理（第6段階）
- Expo Speech の本接続（第7段階）
- 実機 EAS 署名・ストア提出の本番運用（第8段階）

## プレビューのしかた（最短）

1. `npm install`
2. `npm start`
3. ブラウザで Web を開く（画面遷移と文字サイズ変更の確認用）
4. iPhone 実機は `eas build --platform ios --profile development` のあと、development build で確認

## 次の作業

1. Expo / EAS プロジェクト ID を自分のアカウントで初期化
2. Apple Developer 連携で iOS development build を作成
3. 第3段階: Firebase Functions + Gemini（キー未設定時は未接続を明示したまま）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
