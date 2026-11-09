# yorisoi-mlkit-ocr

ローカル Expo Module（よりそいAI 専用）。

- **iOS**: Google ML Kit Text Recognition v2（`JapaneseTextRecognizerOptions`）で端末内 OCR
- **Android**: 差し替え用スタブ（`isAvailable() == false`。成功したふりをしない）
- 画像バイナリはアップロードしない。URI を端末内で読み取るだけ

Expo Go ではネイティブがリンクされないため使えません。EAS development build が必要です。
