package expo.modules.yorisoiandroidassist

import android.content.Intent
import android.media.projection.MediaProjection

/**
 * Holds the one-shot MediaProjection result Intent until the FGS consumes it.
 * After stop / consume, the Intent is cleared — no token reuse.
 */
object AssistProjectionHolder {
  @Volatile
  private var pendingResultCode: Int = 0

  @Volatile
  private var pendingData: Intent? = null

  @Volatile
  private var activeProjection: MediaProjection? = null

  @Synchronized
  fun stashPermissionResult(resultCode: Int, data: Intent) {
    // Replace any previous unused result; never reuse a stopped projection.
    pendingResultCode = resultCode
    pendingData = Intent(data)
    activeProjection = null
  }

  @Synchronized
  fun hasPendingPermission(): Boolean = pendingData != null

  @Synchronized
  fun takePendingPermission(): Pair<Int, Intent>? {
    val data = pendingData ?: return null
    val code = pendingResultCode
    pendingData = null
    pendingResultCode = 0
    return Pair(code, data)
  }

  @Synchronized
  fun setActiveProjection(projection: MediaProjection?) {
    activeProjection = projection
  }

  @Synchronized
  fun getActiveProjection(): MediaProjection? = activeProjection

  @Synchronized
  fun clearAll() {
    try {
      activeProjection?.stop()
    } catch (_: Exception) {
      // best-effort
    }
    activeProjection = null
    pendingData = null
    pendingResultCode = 0
  }
}
