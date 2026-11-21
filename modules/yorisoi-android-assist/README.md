# yorisoi-android-assist

Android-only Expo Module for **よりそいAI** background assist.

- **MediaProjection** system consent → **Foreground Service** (`mediaProjection`)
- One **VirtualDisplay** + ImageReader (~3s frames)
- On-device **ML Kit Japanese** OCR (same library family as `yorisoi-mlkit-ocr`; not a second OCR Expo module)
- Local notification + Android TTS while assisting
- Pause / resume / stop; **no** MediaProjection token reuse after stop; **no** boot autostart

iOS / Web / Expo Go: not linked — callers must show honesty labels (`不可` / `未対応`).

Images stay on-device and are not persisted after OCR.
