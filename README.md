# よりそいAI（YorisoiAI）

70〜80代向けのスマートフォン支援アプリです。  
ホームは **操作支援 / 文章解説 / 危険性通知** の3ボタンのみ（フッターなし）。  
**どの画面もスクロールなし**で完結する設計です。

## 最終仕様（現行方針）

2026-11-12 以降の製品方針:

| 項目 | 内容 |
| --- | --- |
| AI | **端末内 Llama / WebLLM 系**が既定。クラウド Gemini は必須にしない |
| 支援の流れ | 相談（入力＋約4選択肢）→ 意図が不明ならアキネーター式で1問ずつ具体化 → **支援セッション** |
| 支援セッション | 利用者開始の画面フレーム → 端末内／ブラウザ内 OCR → **通知＋音声**で一つずつ案内 |
| 終了 | 通知「ここをタップで支援を終了」→ **解決した / 解決しなかった** → 再相談可 |
| プライバシー | 画像・画面映像は外部 AI に送らない（端末内 AI にも画像を渡さない）。APIキーをフロントに置かない |

旧 Phase 1〜7（Gemini Callable・手動スクショ OCR 中心）は参考実装として残っていますが、**最終仕様のフローが優先**です。

## いまの実装範囲（Web 試作 0.12 + Phase D）

| 経路 | 状態 |
| --- | --- |
| **Web 試作**（対応ブラウザ） | 「画面共有を開始」→ `getDisplayMedia` → 約5秒キャンバス → **Tesseract.js 日本語 OCR（ブラウザ内）** → 文字だけで案内。未対応ブラウザは **不可** と明示 |
| EAS development build（iPhone 実機） | 利用者がスクショ／写真から画面を選ぶ → **端末内 ML Kit 日本語 OCR** → 確認した文字だけ案内へ |
| Broadcast Upload（定期フレーム） | **未リンク**。サイレント監視はしません |
| Expo Go | ネイティブのライブ収録も ML Kit OCR も **動きません**（不可と明示） |
| 端末内 AI | Phase C どおり。未接続時は **AI未接続／デモ**（`live` は ready のときだけ） |

動くもの:

- ホーム（左「よりそいAI」・右設定・3大ボタン）
- 相談開始 → 端末内 `classifyIntent`（未接続時はヒューリスティック・**デモ**明示）
- 曖昧なら **アキネーター式**（1問・約4択＋自由記述・履歴保持）→ 明確化してから支援へ
- 支援セッション: **start → guiding → offer end → EndSupport**（できました／分かりません／もう一度聞く）
- Web: 画面共有ステータス・OCR・AI 状態、一時停止／停止。タブ非表示では背面処理しない
- 音声（Expo Speech / Web SpeechSynthesis）＋通知（可能な環境）。常に画面の文字も出す

## Web 試作の起動（Windows）

```bat
npm install
npm run web
```

または:

```bat
npx expo start --web
```

端末内 AI（WebLLM）も試す場合:

cmd.exe:

```bat
set EXPO_PUBLIC_ON_DEVICE_AI=true
npm run web
```

PowerShell:

```powershell
$env:EXPO_PUBLIC_ON_DEVICE_AI="true"
npm run web
```

- フラグを付けても **WebGPU 非対応・モデル取得失敗・初期化失敗**なら **AI未接続／デモ**のままです（`mode: live` にはしません）
- **画面共有と OCR は AI なしでも動きます**（案内はデモ脚本）。live とデモを混同しないでください

### Web のハード制限（偽らない）

- **画面共有**は `getDisplayMedia` 対応ブラウザ（Chrome / Edge / Firefox 等）かつ **HTTPS または localhost** が必要
- 未対応・拒否・終了時は「不可／停止」と表示。動いているように見せない
- **背面タブでは動かない**（非表示を検知して読み取りを止める）。通知があっても背面 OCR／AI はしません
- OCR は **Tesseract.js（無料 OSS）**。画像・映像をサーバーへ送らない。フレームは保持しない
- Tesseract の **言語データ／worker は公式 CDN から取得**します（APIキー不要）。これは画像アップロードではありません
- WebLLM は WebGPU 等が必要。失敗時は **AI未接続のままデモ**（`mode: live` にしない）
- 通知は画面の **「通知を許可」** を押したときだけ要求。拒否時は画面内文言のみ
- **APIキーをフロントに置かない**（端末内／ブラウザ内経路に秘密は不要）

### 追加依存（無料 OSS）

| パッケージ | 用途 | 料金 |
| --- | --- | --- |
| `tesseract.js` | ブラウザ内日本語 OCR | 無料（Apache-2.0） |
| `@mlc-ai/web-llm` | ブラウザ内 Llama（任意・フラグON時） | 無料（モデル配布は各ライセンス） |

## ネイティブ画面収録・OCR（iPhone）

Expo Go では **使えません**。EAS development build が必要です。

1. Windows から EAS development build を作成して iPhone に入れる（下記）
2. `npx expo start --dev-client` でそのビルドに接続する
3. 支援セッションで「画面を読み取る」等を押す
4. 写真ライブラリから、自分で撮ったスクリーンショットを選ぶ
5. 読み取った文字を確認・直して「この文字で進む」

ヒント:

- ほかのアプリの画面を読むには、**利用者が自分で**スクショするか、将来の Broadcast Upload が必要です
- コントロールセンターの画面収録を使っても、この版ではアプリがフレームを自動受信しません（Broadcast 未リンク）

## iOS でできること / できないこと（正直に）

### できること

- 利用者が自分で始めた画面収録や、自分で撮ったスクリーンショットを選ぶこと
- 選んだ画像を端末内 OCR（Google ML Kit 日本語）で読み、**確認した文字だけ**を案内に使うこと
- 支援セッション中に都度フレームを取り込むこと（自動スパイではない）

### できないこと（偽らない）

- 他アプリ画面を無言で常時録画・監視すること（サイレントスパイ不可）
- ポップアップやダイアログを OS なしで自動検知すること
- Expo Go でネイティブのライブ画面収録や ML Kit OCR を動かすこと
- 画像・画面映像を外部 AI / Firebase / Storage に送ること
- 他アプリをアプリ側から自動操作すること
- 断定的な「安全です」と表示すること

## 技術構成

| 領域 | 採用 |
| --- | --- |
| アプリ | React Native / Expo (SDK 58) / TypeScript |
| ナビゲーション | React Navigation（Native Stack） |
| 設定保存 | AsyncStorage（端末内） |
| AI（既定） | `src/services/onDeviceAi`（WebLLM / ネイティブスキャフォールド）。未接続時はデモ明示 |
| 画面フレーム（ネイティブ） | `src/services/capture`（利用者開始・確認済み文字のみ） |
| 画面共有（Web） | `src/services/webCapture`（getDisplayMedia + Tesseract.js） |
| OCR（ネイティブ） | Google ML Kit 日本語（`modules/yorisoi-mlkit-ocr`） |
| AI（旧経路） | Firebase Cloud Functions + Gemini（`EXPO_PUBLIC_LEGACY_CLOUD_AI=true` のときだけ） |
| 音声 | Expo Speech / Web SpeechSynthesis（displayText / voiceText 分離） |
| 通知 | expo-notifications / Web Notification API |
| ビルド | Expo EAS Build（iOS development build） |

## ディレクトリ構成

```
src/
  components/     # Screen / SessionCapturePanel / WebCapturePanel など
  screens/        # Home / Consultation / AiChoice / SupportSession / EndSupport / Settings
  navigation/
  services/
    capture/      # ネイティブ画面収録境界・OS制限
    webCapture/   # Web getDisplayMedia + Tesseract（ネイティブと分離）
    onDeviceAi/   # 端末内 AI（意図・選択肢・案内 JSON）
    session/      # デモ脚本・意図ヒューリスティック
    notifications/
    ocr/          # ネイティブ OCR
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

- キーボードの `w`、または `npm run web` で Web 試作
- ネイティブの通知・ML Kit OCR の実機確認は EAS development build が必要です

### 4. 確認コマンド

```bat
npm run typecheck
npm run smoke:capture
npm run smoke:on-device
npm run smoke:session
npm run smoke:speech
npm run smoke:ocr
npm run smoke:web
```

旧スモーク（Gemini 経路の参考）:

```bat
node scripts\smoke-ai-phase3.mjs
node scripts\smoke-guidance-phase5.mjs
node scripts\smoke-safety-phase6.mjs
```

## Web 試作の試し方

1. `npm install`
2. `npm run typecheck`
3. `npm run smoke:web`
4. `npm run web` でブラウザを開く
5. ホームの3ボタン → 相談 →（曖昧なら）確認を繰り返す → 支援セッション
6. 「画面共有を開始」→ 共有する画面を選ぶ → 読み取り文字で案内が更新されること
7. タブを隠すと読み取りが止まること／未対応ブラウザでは不可と出ること

## EAS development build（Windows から iPhone 実機）

ネイティブの通知・音声案内・ML Kit OCR・画面フレーム読み取りを実機で確認するには **EAS development build** を使います。  
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

## 後続フェーズ（未実装）

1. ReplayKit Broadcast Upload Extension の本リンク（ユーザー開始の定期フレーム）
2. ネイティブ端末内 Llama（llama.cpp / ExecuTorch 等）の実リンク
3. 収録フレームに応じたより動的な次の一手（モデル接続時）
4. Android OCR の本実装
5. EAS 実機での通知・音声・OCR 通し検証

## 秘密情報について

- APIキー・Apple / Expo の認証情報をチャット・README・コミットに書かないでください
- 端末内／Web 試作経路に APIキーは不要です
- 旧 Gemini 経路を使う場合のみ `firebase functions:secrets:set GEMINI_API_KEY` 等（必須ではありません）

## ライセンス

リポジトリルートの `LICENSE` を参照してください。
