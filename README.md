# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
ホームは **操作支援 / 文章説明 / 安全性チェック** の3ボタンのみ（フッターなし）。  
**どの画面もスクロールなし**で完結する設計です。

## 最終仕様（現行方針）

2026-11-12 以降の製品方針:

| 項目 | 内容 |
| --- | --- |
| AI | **端末内 Llama / WebLLM 系**が既定。クラウド Gemini は必須にしない |
| 支援の流れ | 相談（**文字で入力 / 音声で入力**）→ 意図が曖昧なときだけ選択肢 → **支援セッション** |
| 支援セッション | 利用者開始の画面フレーム → 端末内 OCR → **通知＋音声**で一つずつ案内 |
| 終了 | 通知「ここをタップで支援を終了」→ **解決した / 解決しなかった** → 再相談可 |
| プライバシー | 画像・画面映像は外部 AI に送らない（端末内 AI にも画像を渡さない） |

旧 Phase 1〜7（Gemini Callable・手動スクショ OCR 中心）は参考実装として残っていますが、**最終仕様のフローが優先**です。

## いまの実装範囲（Android 背面支援 ＋ Phase D）

**Android MediaProjection 背面支援**と、画面収録境界＋端末内 OCR の支援セッション配線まで入りました。正直な稼働状況:

| 経路 | 状態 |
| --- | --- |
| EAS preview **APK**（Android 実機） | スクショ OCR に加え、**同意＋画面共有許可後**に MediaProjection＋FGS で背面支援（操作支援約20秒／文章説明は短い間隔・OCR引用の案内／ポップアップ検知→即時通知/TTS）。**実機未検証なら成功と書かない** |
| EAS development build（iPhone 実機） | 手動スクショ OCR。Broadcast / MediaProjection 背面支援は **なし** |
| Broadcast Upload 定期フレーム（iOS） | **未リンク** |
| Expo Go / Web | ライブ収録・ネイティブ OCR・背面支援は **動きません**（不可と明示） |
| 端末内 AI（ネイティブ Llama） | **未接続**。デモ判定・デモ案内を明示（`AI稼働中` にはしません） |

動くもの（コード上。実機確認は EAS APK 後）:

- ホーム（左「よりそいAI」・右設定・3ボタン）
- 相談開始（文字／音声の2択）→ 端末内 `classifyIntent`（未接続時はヒューリスティック・**デモ**明示）。曖昧なときだけ追加の選択肢
- Android: 同意画面 → 画面共有許可 → 背面でも案内継続（**代わりにタップ／送信はしない**）
- 支援セッション: **start → guiding → offer end → EndSupport**
- **操作支援**: 手動「画面を読み取る」または背面 OCR 変化で次の一手（LINEで孫に写真を送る脚本あり）
- **安全性チェック** / **文章説明**: 既存の手動 OCR 経路を維持
- ローカル通知＋ Expo Speech（背面中は Android TTS）。消音でも画面の文字は出ます

## 画面収録・OCR の実機での有効化

Expo Go や Web では **使えません**。Android は preview APK、iPhone は development build が必要です。

### Android（推奨・11/24 試作）

1. Windows から EAS で **APK** を作る（下記「EAS preview APK」）
2. 開発用 Android とおじいちゃん用 Android の **2台に同じ APK** を入れる
3. 支援セッションで「画面を読み取る」等を押す
4. 自分で撮ったスクリーンショットを選ぶ → 文字確認 →「この文字で進む」
5. ネットを切っても OCR・音声・ローカル通知は動く想定（クラウド AI は未接続のまま・デモ明示）

### iPhone

1. Windows から EAS development build を作成して入れる（下記）
2. `npx expo start --dev-client` でそのビルドに接続する
3. 支援セッションでスクショ選択 → 確認 → 案内更新

ヒント:

- ほかのアプリの画面を読むには、**利用者が自分で**スクショする必要があります（MediaProjection / Broadcast は未実装）
- Google ML Kit 日本語は iOS シミュレータでは使えないことがあります（実機推奨）
- Android の日本語モデルは **アプリ同梱（bundled）** なので、Play Services の後追いダウンロードに依存しません

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

## 音声入力について（正直な稼働）

相談画面の「音声で入力」は `expo-speech-recognition` を使います。

| 環境 | 状態 |
| --- | --- |
| EAS development build / preview APK | 端末の音声認識が使える場合あり（マイク・認識の許可が必要） |
| Expo Go | **動きません**（ネイティブモジュール未同梱）。画面で不可と明示し、文字入力へ誘導 |
| Web | ブラウザの SpeechRecognition 対応時のみ。未対応なら文字入力へ |

認識結果は必ず確認・修正できます。読み上げ（Expo Speech）とは別機能です。

## 端末内 AI の試し方（Web）

```bat
set EXPO_PUBLIC_ON_DEVICE_AI=true
npm start
```

- キーボードの `w` で Web プレビュー
- WebGPU 非対応・ダウンロード失敗・初期化失敗 → **AI未接続**のまま（`mode: live` にはしません）
- Web 既定モデル ID: `Llama-3.2-1B-Instruct-q4f16_1-MLC`（`EXPO_PUBLIC_ON_DEVICE_MODEL_ID` で変更可。秘密ではない）
- **Web では画面収録／OCR は不可**です（上記のとおり）

### Android ネイティブ（MediaPipe + Gemma 3 1B）

- モジュール: `modules/yorisoi-on-device-llm/`（EAS development / preview APK）
- 設定画面で同意のうえ約 550MB をダウンロード → probe 成功時のみ **端末内AI接続**
- 画像は渡しません。操作支援の次の一手 JSON 計画に使います（自動タップなし）
- Cloud Agent / Expo Go では推論できません。実機での確認が必要です

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI（既定） | `src/services/onDeviceAi`（Web: WebLLM / Android: MediaPipe Gemma）。未接続時はデモ明示 |
| 画面フレーム | `src/services/capture`（利用者開始・確認済み文字のみ） |
| Android 背面支援 | MediaProjection＋FGS（`modules/yorisoi-android-assist` / `src/services/androidAssist`） |
| OCR | Google ML Kit 日本語（`modules/yorisoi-mlkit-ocr`、端末内のみ。背面支援も同系 ML Kit） |
| AI（旧経路） | Firebase Cloud Functions + Gemini（`EXPO_PUBLIC_LEGACY_CLOUD_AI=true` のときだけ） |
| 音声 | Expo Speech（読み上げ）＋ expo-speech-recognition（音声入力）。displayText / voiceText 分離 |
| 通知 | expo-notifications（ローカル通知） |
| ビルド | Expo EAS Build（Android preview APK / iOS development build） |

## ディレクトリ構成

```
src/
  components/     # 共通UI（ノンスクロール Screen / SessionCapturePanel など）
  screens/        # Home / Consultation / AiChoice / SupportSession / EndSupport / Settings
  navigation/
  services/
    capture/         # 画面収録境界・OS制限・確認済みフレーム文字
    androidAssist/   # Android MediaProjection 背面支援（JS 境界）
    onDeviceAi/      # 端末内 AI（意図・選択肢・案内 JSON）
    session/         # デモ脚本コーパス・意図ヒューリスティック
    notifications/
    ocr/             # 端末内 OCR（選択・認識・一時ファイル削除）
    ai/              # 旧 Gemini クライアント（任意）
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
modules/yorisoi-android-assist/
```

## Windows での開発手順

### 1. 必要なもの

- Windows 10/11
- [Node.js LTS](https://nodejs.org/)（推奨: 20 以上）
- Git
- エディタ: Cursor
- （実機確認時）Expo アカウント、実機 Android（APK 直入れ）または Apple Developer + iPhone

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
npm run smoke:android-assist
npm run smoke:popup-auto-assist
npm run smoke:ocr-aligned-guidance
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

## EAS preview APK（Windows から Android 2台）

Google Play 公開は不要です。`eas.json` の `preview`（および同内容の `preview-apk`）は `android.buildType: apk` です。

### 初回に用意するもの（秘密の中身はここに書きません）

1. **Expo アカウント**（[expo.dev](https://expo.dev/)）
2. 実機 Android **2台**（開発用＋おじいちゃん用）
3. （初回のみ）EAS が求める Android キーストアは **EAS に管理させる**（パスワードを README に書かない）

```bat
npx eas-cli login
npx eas build --platform android --profile preview
```

ビルド完了後、Expo のビルドページから **APK をダウンロード**し、2台とも同じファイルを入れます。

### Android への入れ方（2台共通）

1. 端末で「提供元不明のアプリ」／「この提供元を許可」をオン（機種により文言が異なります）
2. APK を開き、インストール
3. 初回起動で **写真** と **通知** の許可をオン
4. ホーム → 相談 → 支援セッション → スクショ OCR → 案内 → 音声／通知 → 終了、の流れを確認
5. **機内モード**にして、OCR・音声・画面内案内がローカルで動くことを確認（クラウド必須機能は「デモ／AI未接続」のまま）

docomo 店頭などオフライン想定: 事前に Wi‑Fi のある場所で APK を入れて一度起動し、許可を済ませておく。日本語 OCR モデルは APK 同梱です。

## EAS development build（Windows から iPhone 実機）

iPhone で通知・音声・OCR を確認するには **EAS development build** を使います。  
`eas.json` の `development` プロファイルが iOS 実機向けです。

### 初回に用意するもの（認証情報の中身はここに書きません）

1. **Expo アカウント**
2. **Apple Developer Program** への加入
3. 実機 **iPhone**
4. （推奨）EAS による証明書・プロビジョニングの自動管理

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

### OCR の試し方（実機・Android / iPhone 共通）

1. ホーム → いずれかの機能 → 相談 → 支援セッション
2. （安全性チェックなら）先に電話／メールを開いて「できました」
3. 「画面を読み取る」／「画面の文字を調べる」／「ポップアップを読み取る」
4. スクショを選び、文字を確認して「この文字で進む」
5. 案内が確認済み文字に合わせて更新されること

## 後続フェーズ（未実装）

1. ReplayKit Broadcast Upload Extension の本リンク（ユーザー開始の定期フレーム）
2. Android MediaProjection による定期フレーム（今回はやらない）
3. ネイティブ端末内 Llama（llama.cpp / ExecuTorch 等）の実リンク
4. 収録フレームに応じたより動的な次の一手（モデル接続時）
5. 実機 2 台での通知・音声・OCR 通し検証（mukku- 側）

## 秘密情報について

- APIキー・Apple / Expo の認証情報をチャット・README・コミットに書かないでください
- 端末内経路に APIキーは不要です
- 旧 Gemini 経路を使う場合のみ `firebase functions:secrets:set GEMINI_API_KEY` 等（必須ではありません）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
