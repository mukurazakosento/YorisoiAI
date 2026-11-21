const {
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

/**
 * Adds MediaProjection Foreground Service permissions and the assist service.
 * Does not add boot receivers or auto-start.
 */
function withYorisoiAndroidAssist(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
    ];

    for (const name of permissions) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === name,
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    if (!app.service) {
      app.service = [];
    }

    const serviceName =
      'expo.modules.yorisoiandroidassist.AssistForegroundService';
    const already = app.service.some(
      (s) => s.$?.['android:name'] === serviceName,
    );
    if (!already) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaProjection',
        },
      });
    }

    return config;
  });
}

module.exports = withYorisoiAndroidAssist;
