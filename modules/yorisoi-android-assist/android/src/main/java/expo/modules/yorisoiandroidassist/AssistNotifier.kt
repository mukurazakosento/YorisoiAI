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

  fun buildForegroundNotification(context: Context, body: String): Notification {
    ensureChannel(context)
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pending = if (launch != null) {
      PendingIntent.getActivity(
        context,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } else {
      null
    }

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle("よりそいAI（支援中）")
      .setContentText(body)
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setOngoing(true)
      .setContentIntent(pending)
      .setOnlyAlertOnce(true)
      .build()
  }

  fun showGuidance(context: Context, title: String, body: String) {
    ensureChannel(context)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pending = if (launch != null) {
      PendingIntent.getActivity(
        context,
        1,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } else {
      null
    }
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setContentIntent(pending)
      .setAutoCancel(true)
      .build()
    manager.notify(GUIDANCE_ID, notification)
  }

  fun cancelGuidance(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(GUIDANCE_ID)
  }
}
