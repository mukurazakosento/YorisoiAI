import Foundation
import CoreMedia

#if canImport(CoreVideo)
import CoreVideo
#endif

/**
 Counts ScreenCaptureKit screen sample buffers in memory only.
 Never writes image/video bytes to disk or the network.
 */
final class ScreenCaptureFrameSink {
  private let lock = NSLock()
  private var frameCount: Int = 0
  private var lastFrameAtMs: Double = 0
  private var lastWidth: Int = 0
  private var lastHeight: Int = 0
  private var lastEmitAt: CFTimeInterval = 0
  /// Emit to JS at most ~2 times per second to keep the bridge light.
  private let minEmitInterval: CFTimeInterval = 0.5

  var snapshot: (frameCount: Int, lastFrameAtMs: Double, width: Int, height: Int) {
    lock.lock()
    defer { lock.unlock() }
    return (frameCount, lastFrameAtMs, lastWidth, lastHeight)
  }

  func reset() {
    lock.lock()
    frameCount = 0
    lastFrameAtMs = 0
    lastWidth = 0
    lastHeight = 0
    lastEmitAt = 0
    lock.unlock()
  }

  /**
   - Returns: metadata to forward to JS when the emit throttle allows; otherwise nil.
   */
  func noteSampleBuffer(_ sampleBuffer: CMSampleBuffer) -> [String: Any]? {
    var width = 0
    var height = 0
#if canImport(CoreVideo)
    if let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) {
      width = CVPixelBufferGetWidth(imageBuffer)
      height = CVPixelBufferGetHeight(imageBuffer)
    }
#endif

    let nowMs = Date().timeIntervalSince1970 * 1000
    let now = CFAbsoluteTimeGetCurrent()

    lock.lock()
    frameCount += 1
    lastFrameAtMs = nowMs
    if width > 0 { lastWidth = width }
    if height > 0 { lastHeight = height }
    let count = frameCount
    let w = lastWidth
    let h = lastHeight
    let shouldEmit = (now - lastEmitAt) >= minEmitInterval
    if shouldEmit {
      lastEmitAt = now
    }
    lock.unlock()

    guard shouldEmit else {
      return nil
    }

    return [
      "frameCount": count,
      "width": w,
      "height": h,
      "timestamp": nowMs
    ]
  }
}
