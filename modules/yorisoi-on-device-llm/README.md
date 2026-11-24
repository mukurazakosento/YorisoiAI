# yorisoi-on-device-llm

Android-only Expo module: **MediaPipe LLM Inference** + **Gemma 3 1B IT int4** (`.task`).

## Honesty

- Images / screenshots are never passed to the model (text prompts only).
- `ready` / LIVE only after a successful probe `generate` on device.
- Cloud Agent / Expo Go / iOS / Web: module unavailable → AI未接続 / デモ.
- Model (~555 MB) is downloaded after explicit user consent; not bundled in the APK.

## Model

| Field | Value |
| --- | --- |
| Engine | MediaPipe Tasks GenAI (`com.google.mediapipe:tasks-genai`) |
| Model | Gemma 3 1B Instruct int4 (`.task`) |
| Size | ~555 MB |
| License | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |
| Default URL | Hugging Face LiteRT community mirror (override via options) |

## API (JS)

- `getNativeLlmStatus()` / `isNativeLlmLinked()`
- `setModelDownloadConsent(true)` — required before download
- `startModelDownload()` / `cancelModelDownload()` / progress events
- `loadModel()` → probe inference → ready
- `generateJson(prompt)` — chat completion string (caller parses JSON)
- `unloadModel()`
