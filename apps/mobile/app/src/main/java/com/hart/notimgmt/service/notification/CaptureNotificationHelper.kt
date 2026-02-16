package com.hart.notimgmt.service.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.hart.notimgmt.MainActivity
import com.hart.notimgmt.R
import com.hart.notimgmt.data.preferences.AppPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CaptureNotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appPreferences: AppPreferences
) {
    companion object {
        const val CHANNEL_ID = "capture_alerts"
        private const val CHANNEL_NAME = "캡처 알림"
        private val notificationId = AtomicInteger(1000)
    }

    init {
        createChannel()
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "새로운 메시지가 캡처되었을 때 알림을 표시합니다"
        }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    fun showCaptureNotification(
        messageId: String,
        appName: String,
        sender: String,
        contentPreview: String
    ) {
        if (!appPreferences.captureNotificationEnabled) return

        val currentNotificationId = notificationId.getAndUpdate { id ->
            if (id >= 9999) 1000 else id + 1
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("messageId", messageId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, currentNotificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Quick action: 다음 상태
        val nextStatusIntent = Intent(context, QuickActionReceiver::class.java).apply {
            action = QuickActionReceiver.ACTION_NEXT_STATUS
            putExtra(QuickActionReceiver.EXTRA_MESSAGE_ID, messageId)
            putExtra(QuickActionReceiver.EXTRA_NOTIFICATION_ID, currentNotificationId)
        }
        val nextStatusPendingIntent = PendingIntent.getBroadcast(
            context, currentNotificationId + 10000, nextStatusIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Quick action: 1시간 후 스누즈
        val snoozeIntent = Intent(context, QuickActionReceiver::class.java).apply {
            action = QuickActionReceiver.ACTION_SNOOZE_1HR
            putExtra(QuickActionReceiver.EXTRA_MESSAGE_ID, messageId)
            putExtra(QuickActionReceiver.EXTRA_NOTIFICATION_ID, currentNotificationId)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context, currentNotificationId + 20000, snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("[$appName] $sender")
            .setContentText(contentPreview)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .addAction(0, "다음 상태", nextStatusPendingIntent)
            .addAction(0, "1시간 후 알림", snoozePendingIntent)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(currentNotificationId, notification)
    }
}
