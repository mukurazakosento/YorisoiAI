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
| 支援セッション | 利用者開始の画面フレーム → 端末内 OCR → **通知＋音声**で一つずつ案内 |
| 終了 | 通知「ここをタップで支援を終了」→ **解決した / 解決しなかった** → 再相談可 |
| プライバシー | 画像・画面映像は外部 AI に送らない（端末内 AI にも画像を渡さない） |

旧 Phase 1〜7（Gemini Callable・手動スクショ OCR 中心）は参考実装として残っていますが、**最終仕様のフローが優先**です。

## いまの実装範囲（Phase D）

**画面収録境界＋端末内 OCR の支援セッション配線**まで入りました。正直な稼働状況:

| 経路 | 状態 |
| --- | --- |
| EAS development build（iPhone 実機） | 利用者がスクショ／写真から画面を選ぶ → **端末内 ML Kit 日本語 OCR** → 確認した文字だけ案内へ |
| Broadcast Upload（定期フレーム） | **未リンク**。サイレント監視はしません |
| Expo Go / Web | ライブ収録も OCR も **動きません**（不可と明示。偽の成功なし） |
| 端末内 AI | Phase C どおり。未接続時は **デモ** |

動くもの:

- ホーム（左「よりそいAI」・右設定・3ボタン）
- 相談開始 → 端末内 `classifyIntent`（未接続時はヒューリスティック・**デモ**明示）
- 支援セッション: **start → guiding → offer end → EndSupport**
- **操作支援**: 「画面を読み取る」→ 確認済み文字で次の一手を組み直し
- **安全性チェック**: 電話／メールを開いたあと「画面の文字を調べる」（先に開く導線）
- **文章説明**: 相談で文章入力、または「ポップアップを読み取る」
- ローカル通知＋ Expo Speech。消音でも画面の文字は出ます

## 画面収録・OCR の実機での有効化

Expo Go や Web では **使えません**。次が必要です。

1. Windows から EAS development build を作成して iPhone に入れる（下記）
2. `npx expo start --dev-client` でそのビルドに接続する
3. 支援セッションで「画面を読み取る」等を押す
4. iPhone の写真ライブラリから、自分で撮ったスクリーンショットを選ぶ
5. 読み取った文字を確認・直して「この文字で進む」

ヒント:

- ほかのアプリの画面を読むには、**利用者が自分で**スクショするか、将来の Broadcast Upload（ユーザー開始の画面収録）が必要です
- コントロールセンターの画面収録を使っても、この版ではアプリがフレームを自動受信しません（Broadcast 未リンク）
- Google ML Kit 日本語モデルはシミュレータでは使えないことがあります（実機推奨）

## iOS でできること / できないこと（正直に）

### できること

- 利用者が自分で始めた画面収録（コントロールセンター等）や、自分で撮ったスクリーンショットを選ぶこと
- 選んだ画像を端末内 OCR（Google ML Kit 日本語）で読み、**確認した文字だけ**を案内に使うこと
- 支援セッション中に「画面を読み取る」で都度フレームを取り込むこと（自動スパイではない）
- 将来、ユーザー開始の Broadcast Upload Extension から定期フレームを受け取る設計（いまは未リンク）

### できないこと（偽らない）

- 他アプリ画面を無言で常時録画・監視すること（サイレントスパイ不可）
- ポップアップやダイアログを OS なしで自動検知すること（偽の自動検知もしない）
- Expo Go / Web でライブ画面収録や端末内 OCR を動かすこと
- 画像・画面映像を外部 AI / Firebase / Storage に送ること
- 他アプリをアプリ側から自動操作すること
- 断定的な「安全です」と表示すること

## 端末内 AI の試し方（Web）

```bat
set EXPO_PUBLIC_ON_DEVICE_AI=true
npm start
```

- キーボードの `w` で Web プレビュー
- WebGPU 非対応・ダウンロード失敗・初期化失敗 → **AI未接続**のまま（`mode: live` にはしません）
- 既定モデル ID: `Llama-3.2-1B-Instruct-q4f16_1-MLC`（`EXPO_PUBLIC_ON_DEVICE_MODEL_ID` で変更可。秘密ではない）
- **Web では画面収録／OCR は不可**です（上記のとおり）

ネイティブ実機では WebLLM は動きません。`src/services/onDeviceAi/nativeScaffold.ts` が将来の差し替え口です。

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI（既定） | `src/services/onDeviceAi`（WebLLM / ネイティブスキャフォールド）。未接続時はデモ明示 |
| 画面フレーム | `src/services/capture`（利用者開始・確認済み文字のみ） |
| OCR | Google ML Kit 日本語（`modules/yorisoi-mlkit-ocr`、端末内のみ） |
| AI（旧経路） | Firebase Cloud Functions + Gemini（`EXPO_PUBLIC_LEGACY_CLOUD_AI=true` のときだけ） |
| 音声 | Expo Speech（displayText / voiceText 分離） |
| 通知 | expo-notifications（ローカル通知） |
| ビルド | Expo EAS Build（iOS development build） |

## ディレクトリ構成

```
src/
  components/     # 共通UI（ノンスクロール Screen / SessionCapturePanel など）
  screens/        # Home / Consultation / AiChoice / SupportSession / EndSupport / Settings
  navigation/
  services/
    capture/      # 画面収録境界・OS制限・確認済みフレーム文字
    onDeviceAi/   # 端末内 AI（意図・選択肢・案内 JSON）
    session/      # デモ脚本コーパス・意図ヒューリスティック
    notifications/
    ocr/          # 端末内 OCR（選択・認識・一時ファイル削除）
    ai/           # 旧 Gemini クライアント（任意）
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

- キーボードの `w` で Web プレビュー（OCR・ライブ収録は動きません）
- 通知・音声・OCR の実機確認は EAS development build が必要です

### 4. 確認コマンド

```bat
npm run typecheck
npm run smoke:capture
npm run smoke:on-device
npm run smoke:session
npm run smoke:speech
npm run smoke:ocr
```

旧スモーク（Gemini 経路の参考）:

```bat
node scripts\smoke-ai-phase3.mjs
node scripts\smoke-guidance-phase5.mjs
node scripts\smoke-safety-phase6.mjs
```

## Phase D の試し方

1. `npm install`
2. `npm run typecheck`
3. `npm run smoke:capture`
4. `npm run smoke:session`
5. Web: 支援セッションで「読み取り不可（Web）」と出ること
6. 実機（EAS development build）: スクショ選択 → 確認 → 案内更新

## EAS development build（Windows から iPhone 実機）

通知・音声案内・OCR・画面フレーム読み取りを実機で確認するには **EAS development build** を使います。  
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
3. 写真ライブラリの許可ダイアログで「許可」を選ぶ（OCR 用）
4. 音声案内が出ないときは側面の消音スイッチと音量を確認（**Expo Speech**。消音でも画面の文字は読めます）

```bat
npx expo start --dev-client
```

### OCR の試し方（実機）

1. ホーム → いずれかの機能 → 相談 → 支援セッション
2. （安全性チェックなら）先に電話／メールを開いて「できました」
3. 「画面を読み取る」／「画面の文字を調べる」／「ポップアップを読み取る」
4. スクショを選び、文字を確認して「この文字で進む」
5. 案内が確認済み文字に合わせて更新されること

## 後続フェーズ（未実装）

1. ReplayKit Broadcast Upload Extension の本リンク（ユーザー開始の定期フレーム）
2. ネイティブ端末内 Llama（llama.cpp / ExecuTorch 等）の実リンク
3. 収録フレームに応じたより動的な次の一手（モデル接続時）
4. Android OCR の本実装
5. EAS 実機での通知・音声・OCR 通し検証

## 秘密情報について

- APIキー・Apple / Expo の認証情報をチャット・README・コミットに書かないでください
- 端末内経路に APIキーは不要です
- 旧 Gemini 経路を使う場合のみ `firebase functions:secrets:set GEMINI_API_KEY` 等（必須ではありません）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
