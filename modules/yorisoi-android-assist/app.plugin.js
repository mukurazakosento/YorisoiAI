const {
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

/**
 * Adds MediaProjection FGS + optional AccessibilityService for system dialog text.
 * Does not add boot receivers or auto-start. Does not edit app.json EAS ids.
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

    const fgsName =
      'expo.modules.yorisoiandroidassist.AssistForegroundService';
    if (!app.service.some((s) => s.$?.['android:name'] === fgsName)) {
      app.service.push({
        $: {
          'android:name': fgsName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaProjection',
        },
      });
    }

    const a11yName =
      'expo.modules.yorisoiandroidassist.AssistDialogAccessibilityService';
    const a11yExisting = app.service.find(
      (s) => s.$?.['android:name'] === a11yName,
    );
    if (a11yExisting) {
      // Ensure exported=true (intent-filter + API 31+) and BIND permission.
      a11yExisting.$ = {
        ...(a11yExisting.$ || {}),
        'android:name': a11yName,
        'android:exported': 'true',
        'android:permission':
          'android.permission.BIND_ACCESSIBILITY_SERVICE',
      };
    } else {
      app.service.push({
        $: {
          'android:name': a11yName,
          'android:exported': 'true',
          'android:permission':
            'android.permission.BIND_ACCESSIBILITY_SERVICE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.accessibilityservice.AccessibilityService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/yorisoi_assist_accessibility',
            },
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withYorisoiAndroidAssist;
