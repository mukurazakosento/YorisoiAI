import ExpoModulesCore
import UIKit
import MLKitVision
import MLKitTextRecognitionCommon
import MLKitTextRecognitionJapanese

/**
 On-device OCR using Google ML Kit Text Recognition v2 (Japanese).
 Image bytes are processed locally only — never uploaded by this module.
 */
public class YorisoiMlkitOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("YorisoiMlkitOcr")

    Function("isAvailable") { () -> Bool in
      #if targetEnvironment(simulator)
      // ML Kit Text Recognition Japanese pods typically lack arm64 simulator slices.
      // Report unavailable rather than pretending remote OCR succeeded.
      return false
      #else
      return true
      #endif
    }

    AsyncFunction("recognizeText") { (uri: String, promise: Promise) in
      #if targetEnvironment(simulator)
      promise.reject(
        "OCR_SIMULATOR_UNSUPPORTED",
        "iOS シミュレータでは Google ML Kit 日本語 OCR を使えません。実機の development build でお試しください。画像は外部へ送っていません。"
      )
      return
      #else
      guard let url = Self.resolveFileURL(uri) else {
        promise.reject("INVALID_URI", "画像の場所が正しくありません: \(uri)")
        return
      }

      let path = url.path
      guard FileManager.default.fileExists(atPath: path),
            let image = UIImage(contentsOfFile: path) else {
        promise.reject("IMAGE_LOAD_FAILED", "画像を読み込めませんでした。別のスクリーンショットを選んでください。")
        return
      }

      let visionImage = VisionImage(image: image)
      visionImage.orientation = image.imageOrientation

      let options = JapaneseTextRecognizerOptions()
      let recognizer = TextRecognizer.textRecognizer(options: options)

      recognizer.process(visionImage) { result, error in
        if let error = error {
          promise.reject(
            "RECOGNITION_FAILED",
            "文字を読み取れませんでした: \(error.localizedDescription)"
          )
          return
        }

        guard let result = result else {
          promise.reject("RECOGNITION_FAILED", "文字認識の結果が空でした。")
          return
        }

        var blocks: [[String: Any]] = []
        for block in result.blocks {
          var lines: [[String: Any]] = []
          for line in block.lines {
            var elements: [[String: Any]] = []
            for element in line.elements {
              elements.append([
                "text": element.text,
                "boundingBox": Self.boxDict(element.frame)
              ])
            }
            lines.append([
              "text": line.text,
              "boundingBox": Self.boxDict(line.frame),
              "elements": elements
            ])
          }
          blocks.append([
            "text": block.text,
            "boundingBox": Self.boxDict(block.frame),
            "lines": lines
          ])
        }

        promise.resolve([
          "text": result.text,
          "blocks": blocks,
          "engine": "mlkit-japanese"
        ])
      }
      #endif
    }
  }

  private static func resolveFileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return url
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    return URL(string: uri)
  }

  private static func boxDict(_ frame: CGRect) -> [String: Double] {
    [
      "x": Double(frame.origin.x),
      "y": Double(frame.origin.y),
      "width": Double(frame.size.width),
      "height": Double(frame.size.height)
    ]
  }
}
