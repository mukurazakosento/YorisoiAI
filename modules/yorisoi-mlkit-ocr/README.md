# yorisoi-mlkit-ocr

ローカル Expo Module（よりそいAI 専用）。

- **iOS**: Google ML Kit Text Recognition v2（`JapaneseTextRecognizerOptions`）で端末内 OCR
- **Android**: 同 API の **bundled** 日本語モデル（`com.google.mlkit:text-recognition-japanese`）。Play Services 後追い DL に依存しない
- `file://` / `content://`（Android）とローカルファイル URI（iOS）を端末内で読み取るだけ
- 画像バイナリはアップロードしない。不可時は正直エラー（成功したふりをしない）

Expo Go / Web ではネイティブがリンクされないため使えません。EAS development build または preview APK が必要です。
