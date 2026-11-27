package expo.modules.yorisoiandroidassist

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

object AssistNotifier {
  const val CHANNEL_ID = "yorisoi-android-assist"
  const val FOREGROUND_ID = 42041
  const val GUIDANCE_ID = 42042

  /**
   * Heads-up / FGS instruction lines must stay ≤17 Japanese characters.
   * TTS and in-app displayText stay full length at the call site.
   */
  const val MAX_INSTRUCTION_CHARS = 17

  /** Truncate notify title/body to [MAX_INSTRUCTION_CHARS] (ellipsis when cut). */
  fun truncateForNotify(text: String, maxChars: Int = MAX_INSTRUCTION_CHARS): String {
    val trimmed = text.trim()
    if (trimmed.length <= maxChars) {
      return trimmed
    }
    if (maxChars <= 1) {
      return trimmed.take(maxChars)
    }
    return trimmed.take(maxChars - 1) + "…"
  }

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) {
      return
    }
    val channel = NotificationChannel(
      CHANNEL_ID,
      "よりそいAIの背面支援",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "画面を読み取りながらの案内（画像は端末の外へ送りません）"
    }
    manager.createNotificationChannel(channel)
  }

  /**
   * Foreground notification with pause/resume/stop via Service PendingIntents
   * (does not require bringing the app to the foreground).
   * Content tap may open the app; action buttons must not depend on that.
   */
  fun buildForegroundNotification(
    context: Context,
    body: String,
    paused: Boolean,
  ): Notification {
    ensureChannel(context)
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentPending = if (launch != null) {
      PendingIntent.getActivity(
        context,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } else {
      null
    }

    val safeBody = truncateForNotify(AssistSecretRedactor.forPublicText(body))
    val title = truncateForNotify(
      if (paused) "よりそいAI（一時停止）" else "よりそいAI（支援中）",
    )
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(safeBody)
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setOngoing(true)
      .setContentIntent(contentPending)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)

    if (paused) {
      builder.addAction(
        0,
        "再開",
        serviceActionPending(context, AssistForegroundService.ACTION_RESUME, 11),
      )
    } else {
      builder.addAction(
        0,
        "一時停止",
        serviceActionPending(context, AssistForegroundService.ACTION_PAUSE, 10),
      )
    }
    // Always allow stop without opening the app.
    builder.addAction(
      0,
      "終了",
      serviceActionPending(context, AssistForegroundService.ACTION_STOP, 12),
    )

    return builder.build()
  }

  /**
   * Heads-up guidance as soon as a new instruction is ready.
   * Cancel+repost so OEM grouping / prior silent updates do not swallow the alert.
   *
   * @param openAppOnTap when false (安全性チェック結果), tapping the notification
   *   must not bring the Activity to the front — pause/resume/stop stay on the FGS.
   */
  fun showGuidance(
    context: Context,
    title: String,
    body: String,
    openAppOnTap: Boolean = true,
  ) {
    ensureChannel(context)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val pending = if (openAppOnTap) {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        PendingIntent.getActivity(
          context,
          1,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      } else {
        null
      }
    } else {
      // Keep tap inert for safety results (no Activity reopen).
      null
    }
    val safeTitle = truncateForNotify(title)
    val safeBody = truncateForNotify(AssistSecretRedactor.forPublicText(body))
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(safeTitle)
      .setContentText(safeBody)
      .setStyle(NotificationCompat.BigTextStyle().bigText(safeBody))
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setAutoCancel(true)
      .setOnlyAlertOnce(false)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      // Lock screen: hide guidance detail (PII / OCR quotes).
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .addAction(
        0,
        "終了",
        serviceActionPending(context, AssistForegroundService.ACTION_STOP, 13),
      )
    if (pending != null) {
      builder.setContentIntent(pending)
    }
    // Force a fresh alert for this guidance id.
    manager.cancel(GUIDANCE_ID)
    manager.notify(GUIDANCE_ID, builder.build())
  }

  fun cancelGuidance(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(GUIDANCE_ID)
  }

  private fun serviceActionPending(
    context: Context,
    action: String,
    requestCode: Int,
  ): PendingIntent {
    val intent = Intent(context, AssistForegroundService::class.java).apply {
      this.action = action
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    // getForegroundService delivers to the FGS without opening the Activity.
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      PendingIntent.getForegroundService(context, requestCode, intent, flags)
    } else {
      PendingIntent.getService(context, requestCode, intent, flags)
    }
  }
}
