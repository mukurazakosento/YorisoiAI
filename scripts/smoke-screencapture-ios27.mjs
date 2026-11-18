/**
 * iOS 27 ScreenCaptureKit デモ境界のソース断言。
 * 実機フレーム証明はしない（エージェントに iOS 27 実機がないため）。
 * 使い方: npm run smoke:screencapture
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// --- Module layout ---
assert.ok(exists('modules/yorisoi-screencapture/package.json'));
assert.ok(exists('modules/yorisoi-screencapture/expo-module.config.json'));
assert.ok(exists('modules/yorisoi-screencapture/ios/YorisoiScreenCaptureModule.swift'));
assert.ok(exists('modules/yorisoi-screencapture/ios/ScreenCaptureSession.swift'));
assert.ok(exists('modules/yorisoi-screencapture/ios/ScreenCaptureFrameSink.swift'));
assert.ok(
  exists('modules/yorisoi-screencapture/plugin/withScreenCaptureBackgroundMode.js'),
);

const sessionSwift = read('modules/yorisoi-screencapture/ios/ScreenCaptureSession.swift');
assert.match(sessionSwift, /SCContentSharingPicker/);
assert.match(sessionSwift, /SCStream/);
assert.match(sessionSwift, /present\(\)/);
assert.match(sessionSwift, /iOS 27/);
assert.doesNotMatch(sessionSwift, /RPBroadcast|Broadcast Upload|ReplayKit/);
assert.match(sessionSwift, /Never writes|in memory only|Image\/video bytes stay in memory/i);

const sinkSwift = read('modules/yorisoi-screencapture/ios/ScreenCaptureFrameSink.swift');
assert.match(sinkSwift, /Never writes image\/video|in memory only/i);
assert.doesNotMatch(sinkSwift, /UIImageWriteToSavedPhotosAlbum|FileManager\.default\.createFile/);

const appJson = JSON.parse(read('app.json'));
assert.ok(
  appJson.expo.ios.infoPlist.UIBackgroundModes.includes('screen-capture'),
);
assert.ok(appJson.expo.ios.infoPlist.NSScreenCaptureUsageDescription);
assert.ok(
  appJson.expo.plugins.some(
    (p) =>
      typeof p === 'string' &&
      p.includes('withScreenCaptureBackgroundMode'),
  ),
);

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.dependencies['yorisoi-screencapture'],
  'file:./modules/yorisoi-screencapture',
);
assert.match(packageJson.scripts['smoke:screencapture'], /smoke-screencapture-ios27/);

// --- No Web / PR #11 contamination ---
assert.equal(exists('src/services/webCapture'), false);
assert.equal(exists('src/components/WebCapturePanel.tsx'), false);
assert.doesNotMatch(
  read('src/services/iosScreenCapture/session.ts'),
  /mediaDevices|getDisplayMedia/,
);
assert.doesNotMatch(
  read('src/screens/IosScreenCaptureDemoScreen.tsx'),
  /mediaDevices|getDisplayMedia|Tesseract|WebLLM/,
);

// --- Broadcast stays unlinked ---
const broadcast = read('src/services/capture/broadcast.ts');
assert.match(broadcast, /return false/);

// --- Demo UI honesty ---
const demoScreen = read('src/screens/IosScreenCaptureDemoScreen.tsx');
assert.doesNotMatch(demoScreen, /\bScrollView\b/);
assert.match(demoScreen, /frameCount|IosScreenCapturePanel/);
assert.doesNotMatch(demoScreen, /rebuildGuidance|recognizeJapanese|speak\(/);

const panel = read('src/components/IosScreenCapturePanel.tsx');
assert.match(panel, /frameCount/);
assert.match(panel, /lastFrameAt|最終受信/);
assert.doesNotMatch(panel, /\bScrollView\b/);

const settings = read('src/screens/SettingsScreen.tsx');
assert.match(settings, /IosScreenCaptureDemo/);

// --- JS service API ---
const serviceUrl = pathToFileURL(
  path.join(root, 'src/services/iosScreenCapture/index.ts'),
).href;
const {
  getIosScreenCaptureAvailability,
  getIosScreenCaptureSessionState,
  resetIosScreenCaptureSessionForTests,
} = await import(serviceUrl);

resetIosScreenCaptureSessionForTests();
const availability = getIosScreenCaptureAvailability();
assert.equal(typeof availability.supported, 'boolean');
assert.equal(typeof availability.label, 'string');
assert.equal(typeof availability.message, 'string');
// Node smoke: not a linked iOS 27 device
assert.equal(availability.supported, false);

const state = getIosScreenCaptureSessionState();
assert.equal(state.phase, 'unsupported');
assert.equal(state.frameCount, 0);
assert.equal(state.lastFrameAt, 0);

const readme = read('README.md');
assert.match(readme, /ScreenCaptureKit|画面共有デモ/);
assert.doesNotMatch(readme, /iOS 27 実機で背面フレーム取得を確認済み/);

console.log('smoke-screencapture-ios27: OK (source + Node honesty; no device proof)');
