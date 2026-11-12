export { classifyIntentStub } from './intent';
export {
  buildDemoSessionScript,
  END_SUPPORT_DISPLAY,
  END_SUPPORT_VOICE,
} from './demoSteps';

/** 端末内 AI（最終仕様の既定経路） */
export {
  buildGuidanceScript,
  classifyIntent,
  generateClarifyChoices,
  getOnDeviceAiBanner,
  getOnDeviceAiStatus,
  initOnDeviceAi,
  isOnDeviceAiReady,
} from '../onDeviceAi';

/** 画面収録・フレーム OCR（Phase D） */
export {
  getCaptureAvailability,
  getFeatureCapturePath,
  isBroadcastUploadLinked,
  startCaptureSession,
  stopCaptureSession,
} from '../capture';
