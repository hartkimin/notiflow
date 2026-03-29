package com.hart.notimgmt.service.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.hart.notimgmt.MainActivity
import com.hart.notimgmt.R
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.sync.SyncManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class NotiRouteFcmService : FirebaseMessagingService() {

    @Inject
    lateinit var appPreferences: AppPreferences

    @Inject
    lateinit var syncManager: SyncManager

    companion object {
        private const val TAG = "NotiRouteFcm"
        private const val CHANNEL_ID = "orders"
        private const val CHANNEL_NAME = "주문 알림"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed")
        appPreferences.fcmToken = token
        // 새 토큰을 Supabase에 즉시 등록
        syncManager.refreshDeviceRegistration()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received: ${message.data}")

        when (message.data["type"]) {
            "sync_request" -> {
                Log.d(TAG, "Sync request received via FCM")
                syncManager.forceSync(clearRequest = true)
            }
            else -> {
                val title = message.notification?.title ?: message.data["title"] ?: "NotiFlow"
                val body = message.notification?.body ?: message.data["body"] ?: ""
                showNotification(title, body, message.data)
            }
        }
    }

    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>
    ) {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notificationId = data["order_id"]?.toIntOrNull()
            ?: System.currentTimeMillis().toInt()

        // 알림 클릭 시 앱 실행
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            data["order_id"]?.let { putExtra("order_id", it) }
        }
        val pendingIntent = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "새 주문 생성 시 알림"
            }
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}

