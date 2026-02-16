package com.hart.notimgmt.service.snooze

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.hart.notimgmt.MainActivity
import com.hart.notimgmt.R
import com.hart.notimgmt.data.repository.MessageRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SnoozeReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_SNOOZE_TRIGGER = "com.hart.notimgmt.SNOOZE_TRIGGER"
        const val ACTION_RE_SNOOZE = "com.hart.notimgmt.RE_SNOOZE"
        const val EXTRA_MESSAGE_ID = "messageId"
        private const val CHANNEL_ID = "snooze_reminders"
        private const val CHANNEL_NAME = "스누즈 리마인더"
        private const val TAG = "SnoozeReceiver"
    }

    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var snoozeManager: SnoozeManager

    override fun onReceive(context: Context, intent: Intent) {
        val messageId = intent.getStringExtra(EXTRA_MESSAGE_ID) ?: return

        when (intent.action) {
            ACTION_SNOOZE_TRIGGER -> handleSnoozeTriggered(context, messageId)
            ACTION_RE_SNOOZE -> handleReSnooze(context, messageId)
        }
    }

    private fun handleSnoozeTriggered(context: Context, messageId: String) {
        val pendingResult = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        scope.launch {
            try {
                val message = messageRepository.getById(messageId)
                if (message == null || message.isDeleted) {
                    Log.d(TAG, "Message $messageId not found or deleted, skipping snooze notification")
                    return@launch
                }

                // Clear snooze
                messageRepository.clearSnooze(messageId)

                // Create notification channel
                ensureNotificationChannel(context)

                // Open app intent
                val openIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("messageId", messageId)
                }
                val openPendingIntent = PendingIntent.getActivity(
                    context,
                    messageId.hashCode(),
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                // Re-snooze 1hr action
                val reSnoozeIntent = Intent(context, SnoozeReceiver::class.java).apply {
                    action = ACTION_RE_SNOOZE
                    putExtra(EXTRA_MESSAGE_ID, messageId)
                }
                val reSnoozePendingIntent = PendingIntent.getBroadcast(
                    context,
                    messageId.hashCode() + 1000,
                    reSnoozeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_launcher_foreground)
                    .setContentTitle("[리마인더] ${message.sender}")
                    .setContentText(message.content.take(100))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setContentIntent(openPendingIntent)
                    .addAction(R.drawable.ic_launcher_foreground, "열기", openPendingIntent)
                    .addAction(R.drawable.ic_launcher_foreground, "1시간 후", reSnoozePendingIntent)
                    .build()

                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(messageId.hashCode() + 5000, notification)

                Log.d(TAG, "Showed snooze reminder for message $messageId")
            } catch (e: Exception) {
                Log.e(TAG, "Error handling snooze trigger for $messageId", e)
            } finally {
                pendingResult.finish()
                scope.cancel()
            }
        }
    }

    private fun handleReSnooze(context: Context, messageId: String) {
        val pendingResult = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        scope.launch {
            try {
                val snoozeAt = System.currentTimeMillis() + 60 * 60 * 1000L
                messageRepository.setSnooze(messageId, snoozeAt)
                snoozeManager.scheduleSnooze(messageId, snoozeAt)

                // Dismiss the notification
                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.cancel(messageId.hashCode() + 5000)

                Log.d(TAG, "Re-snoozed message $messageId for 1 hour")
            } catch (e: Exception) {
                Log.e(TAG, "Error re-snoozing $messageId", e)
            } finally {
                pendingResult.finish()
                scope.cancel()
            }
        }
    }

    private fun ensureNotificationChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "스누즈 시간이 되면 다시 알림을 표시합니다"
        }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }
}
