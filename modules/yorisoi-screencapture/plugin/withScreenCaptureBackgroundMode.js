const {
  createRunOncePlugin,
  withInfoPlist,
} = require('expo/config-plugins');

const PACKAGE_NAME = 'yorisoi-screencapture';

/**
 * Ensures UIBackgroundModes includes screen-capture and
 * NSScreenCaptureUsageDescription is present for ScreenCaptureKit.
 */
function withScreenCaptureBackgroundMode(config) {
  return withInfoPlist(config, (config) => {
    const info = config.modResults;

    const modes = new Set(
      Array.isArray(info.UIBackgroundModes) ? info.UIBackgroundModes : [],
    );
    modes.add('screen-capture');
    info.UIBackgroundModes = Array.from(modes);

    if (!info.NSScreenCaptureUsageDescription) {
      info.NSScreenCaptureUsageDescription =
        'ほかのアプリの画面を、あなたが選んだときだけ読み取りの準備に使うため、画面収録の許可が必要です。映像は端末の外へ送りません。';
    }

    return config;
  });
}

module.exports = createRunOncePlugin(
  withScreenCaptureBackgroundMode,
  PACKAGE_NAME,
  '0.1.0',
);
