import ExpoModulesCore

/**
 Expo bridge for the iOS 27+ ScreenCaptureKit capture demo.
 Frames are counted in memory only — never saved or uploaded by this module.
 */
public class YorisoiScreenCaptureModule: Module {
  public func definition() -> ModuleDefinition {
    Name("YorisoiScreenCapture")

    Events("onFrame", "onPhase", "onError")

    OnCreate {
      ScreenCaptureSession.shared.attachEmitter { [weak self] name, body in
        self?.sendEvent(name, body ?? [:])
      }
    }

    Function("isSupported") { () -> Bool in
      ScreenCaptureSession.shared.isSupported()
    }

    Function("getStatus") { () -> [String: Any] in
      ScreenCaptureSession.shared.getStatus()
    }

    AsyncFunction("startFullDisplayCapture") { (promise: Promise) in
      ScreenCaptureSession.shared.startFullDisplayCapture(promise: promise)
    }

    AsyncFunction("stopCapture") { (promise: Promise) in
      ScreenCaptureSession.shared.stopCapture(promise: promise)
    }
  }
}
