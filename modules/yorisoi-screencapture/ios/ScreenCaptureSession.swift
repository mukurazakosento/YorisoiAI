import ExpoModulesCore
import Foundation

#if canImport(UIKit)
import UIKit
#endif

#if canImport(ScreenCaptureKit)
import ScreenCaptureKit
#endif
import CoreMedia

typealias ScreenCaptureEventEmitter = (_ name: String, _ body: [String: Any]?) -> Void

/**
 Owns SCContentSharingPicker + SCStream for the iOS 27+ capture demo.
 Image/video bytes stay in memory only (frame counters / sizes); nothing is saved or uploaded.
 */
final class ScreenCaptureSession: NSObject {
  static let shared = ScreenCaptureSession()

  private let sink = ScreenCaptureFrameSink()
  private let stateLock = NSLock()
  private var phase: String = "idle"
  private var lastErrorCode: String?
  private var emit: ScreenCaptureEventEmitter?
  private var startPromise: Promise?
  private var pickerActive = false

#if canImport(ScreenCaptureKit)
  private var stream: SCStream?
#endif

  private override init() {
    super.init()
  }

  func attachEmitter(_ emitter: @escaping ScreenCaptureEventEmitter) {
    emit = emitter
  }

  func isSupported() -> Bool {
#if canImport(ScreenCaptureKit)
    if #available(iOS 27.0, *) {
      return true
    }
#endif
    return false
  }

  func getStatus() -> [String: Any] {
    let snap = sink.snapshot
    stateLock.lock()
    let phaseValue = phase
    let errorCode = lastErrorCode
    stateLock.unlock()

    var body: [String: Any] = [
      "phase": phaseValue,
      "frameCount": snap.frameCount,
      "lastFrameAt": snap.lastFrameAtMs,
      "width": snap.width,
      "height": snap.height,
      "supported": isSupported()
    ]
    if let errorCode {
      body["errorCode"] = errorCode
    }
    return body
  }

  func startFullDisplayCapture(promise: Promise) {
    guard isSupported() else {
      setPhase("unsupported", errorCode: "unsupported")
      promise.reject(
        "UNSUPPORTED",
        "この iPhone の iOS では画面共有デモは使えません（iOS 27 が必要です）。"
      )
      return
    }

#if canImport(ScreenCaptureKit)
    if #available(iOS 27.0, *) {
      stateLock.lock()
      if startPromise != nil || phase == "picking" || phase == "streaming" {
        stateLock.unlock()
        promise.reject("BUSY", "すでに画面共有の開始処理中、または共有中です。")
        return
      }
      startPromise = promise
      lastErrorCode = nil
      stateLock.unlock()

      sink.reset()
      setPhase("picking", errorCode: nil)

      let picker = SCContentSharingPicker.shared
      picker.add(self)
      picker.isActive = true
      var config = SCContentSharingPickerConfiguration()
      config.showsMicrophoneControl = false
      picker.defaultConfiguration = config
      pickerActive = true
      picker.present()
      return
    }
#endif

    setPhase("unsupported", errorCode: "unsupported")
    promise.reject(
      "UNSUPPORTED",
      "このビルドでは ScreenCaptureKit を使えません。Xcode 27 と iOS 27 実機が必要です。"
    )
  }

  func stopCapture(promise: Promise) {
#if canImport(ScreenCaptureKit)
    if #available(iOS 27.0, *) {
      tearDownPicker()
      let existing = stream
      stream = nil
      Task {
        if let existing {
          do {
            try await existing.stopCapture()
          } catch {
            // Stopping after system cancel may already have ended the stream.
          }
        }
        self.rejectStartIfPending(code: "STOPPED", message: "画面共有を停止しました。")
        self.setPhase("stopped", errorCode: nil)
        promise.resolve(nil)
      }
      return
    }
#endif
    rejectStartIfPending(code: "STOPPED", message: "画面共有を停止しました。")
    setPhase("stopped", errorCode: nil)
    promise.resolve(nil)
  }

  // MARK: - Private

  private func setPhase(_ next: String, errorCode: String?) {
    stateLock.lock()
    phase = next
    if let errorCode {
      lastErrorCode = errorCode
    } else if next == "streaming" || next == "picking" || next == "idle" {
      lastErrorCode = nil
    }
    stateLock.unlock()
    emit?("onPhase", ["phase": next, "errorCode": errorCode as Any])
  }

  private func rejectStartIfPending(code: String, message: String) {
    stateLock.lock()
    let pending = startPromise
    startPromise = nil
    stateLock.unlock()
    pending?.reject(code, message)
  }

  private func resolveStartIfPending() {
    stateLock.lock()
    let pending = startPromise
    startPromise = nil
    stateLock.unlock()
    pending?.resolve(nil)
  }

#if canImport(ScreenCaptureKit)
  @available(iOS 27.0, *)
  private func tearDownPicker() {
    guard pickerActive else { return }
    let picker = SCContentSharingPicker.shared
    picker.isActive = false
    picker.remove(self)
    pickerActive = false
  }

  @available(iOS 27.0, *)
  private func beginStream(with filter: SCContentFilter) {
    Task {
      do {
        if let previous = self.stream {
          try? await previous.stopCapture()
          self.stream = nil
        }

        let config = SCStreamConfiguration()
        // Low rate is enough to prove background frame delivery.
        config.minimumFrameInterval = CMTime(value: 1, timescale: 2)
        config.queueDepth = 3
#if canImport(UIKit)
        // Modest pixel budget; we only read width/height then drop the buffer.
        let bounds = UIScreen.main.bounds
        let scale = UIScreen.main.scale
        config.width = Int(bounds.width * scale)
        config.height = Int(bounds.height * scale)
#endif

        let newStream = SCStream(filter: filter, configuration: config, delegate: self)
        try newStream.addStreamOutput(self, type: .screen, sampleHandlerQueue: .main)
        try await newStream.startCapture()
        self.stream = newStream
        self.setPhase("streaming", errorCode: nil)
        self.resolveStartIfPending()
      } catch {
        let mapped = Self.mapStreamError(error)
        self.stream = nil
        self.setPhase("error", errorCode: mapped.code)
        self.emit?("onError", [
          "code": mapped.code,
          "message": mapped.message
        ])
        self.rejectStartIfPending(code: mapped.code, message: mapped.message)
      }
    }
  }

  private static func mapStreamError(_ error: Error) -> (code: String, message: String) {
    let ns = error as NSError
    let text = ns.localizedDescription
    if text.localizedCaseInsensitiveContains("missingBackgroundMode")
      || ns.domain.localizedCaseInsensitiveContains("SCStream")
        && text.localizedCaseInsensitiveContains("background") {
      return (
        "missingBackgroundMode",
        "背面での画面取得には UIBackgroundModes の screen-capture が必要です。"
      )
    }
    return ("stream_error", "画面共有を開始できませんでした: \(text)")
  }
#endif
}

// MARK: - Picker observer (iOS 27+)

#if canImport(ScreenCaptureKit)
@available(iOS 27.0, *)
extension ScreenCaptureSession: SCContentSharingPickerObserver {
  func contentSharingPicker(
    _ picker: SCContentSharingPicker,
    didUpdateWith filter: SCContentFilter,
    for stream: SCStream?
  ) {
    if let stream {
      Task {
        try? await stream.updateContentFilter(filter)
      }
      return
    }
    beginStream(with: filter)
  }

  func contentSharingPicker(
    _ picker: SCContentSharingPicker,
    didCancelFor stream: SCStream?
  ) {
    tearDownPicker()
    setPhase("stopped", errorCode: "canceled")
    emit?("onError", [
      "code": "canceled",
      "message": "画面共有の選択をキャンセルしました。"
    ])
    rejectStartIfPending(
      code: "CANCELED",
      message: "画面共有の選択をキャンセルしました。"
    )
  }

  func contentSharingPickerStartDidFailWithError(_ error: Error) {
    tearDownPicker()
    let message = "画面共有ピッカーを開けませんでした: \(error.localizedDescription)"
    setPhase("error", errorCode: "unavailable")
    emit?("onError", [
      "code": "unavailable",
      "message": message
    ])
    rejectStartIfPending(code: "UNAVAILABLE", message: message)
  }
}

@available(iOS 27.0, *)
extension ScreenCaptureSession: SCStreamOutput, SCStreamDelegate {
  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of type: SCStreamOutputType
  ) {
    guard type == .screen else { return }
    // Metadata only — sample buffer is not retained, encoded, or written.
    if let payload = sink.noteSampleBuffer(sampleBuffer) {
      emit?("onFrame", payload)
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: Error) {
    let mapped = Self.mapStreamError(error)
    self.stream = nil
    tearDownPicker()
    setPhase("error", errorCode: mapped.code)
    emit?("onError", [
      "code": mapped.code,
      "message": mapped.message
    ])
  }
}

#endif
