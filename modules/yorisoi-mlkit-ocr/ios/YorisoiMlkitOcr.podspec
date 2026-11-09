require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'YorisoiMlkitOcr'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'yorisoi'
  s.homepage       = 'https://github.com/mukurazakosento/YorisoiAI'
  s.platforms      = {
    :ios => '15.5'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/mukurazakosento/YorisoiAI.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Google ML Kit Text Recognition v2 — Japanese (+ Latin) on-device model.
  s.dependency 'GoogleMLKit/TextRecognitionJapanese', '8.0.0'

  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
