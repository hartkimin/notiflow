package com.hart.notimgmt.service.notification

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.hart.notimgmt.data.model.StatusChangeItem
import com.hart.notimgmt.data.model.parseStatusHistory
import com.hart.notimgmt.data.model.serializeStatusHistory
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.StatusStepRepository
import com.hart.notimgmt.service.snooze.SnoozeManager
import com.hart.notimgmt.widget.NotiFlowWidgetProvider
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class QuickActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_NEXT_STATUS = "com.hart.notimgmt.ACTION_NEXT_STATUS"
        const val ACTION_SNOOZE_1HR = "com.hart.notimgmt.ACTION_SNOOZE_1HR"
        const val EXTRA_MESSAGE_ID = "messageId"
        const val EXTRA_NOTIFICATION_ID = "notificationId"
        private const val TAG = "QuickActionReceiver"
    }

    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var statusStepRepository: StatusStepRepository
    @Inject lateinit var snoozeManager: SnoozeManager

    override fun onReceive(context: Context, intent: Intent) {
        val messageId = intent.getStringExtra(EXTRA_MESSAGE_ID) ?: return
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)

        val pendingResult = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        scope.launch {
            try {
                when (intent.action) {
                    ACTION_NEXT_STATUS -> handleNextStatus(messageId)
                    ACTION_SNOOZE_1HR -> handleSnooze1Hr(messageId)
                }

                // Dismiss the capture notification
                if (notificationId >= 0) {
                    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    manager.cancel(notificationId)
                }

                // Update widgets
                NotiFlowWidgetProvider.updateWidgets(context)
            } catch (e: Exception) {
                Log.e(TAG, "Error handling quick action for $messageId", e)
            } finally {
                pendingResult.finish()
                scope.cancel()
            }
        }
    }

    private suspend fun handleNextStatus(messageId: String) {
        val message = messageRepository.getById(messageId) ?: return
        val steps = statusStepRepository.getAllOnce()
        if (steps.isEmpty()) return

        val currentIndex = steps.indexOfFirst { it.id == message.statusId }
        val nextIndex = if (currentIndex < 0) 0 else (currentIndex + 1).coerceAtMost(steps.lastIndex)
        val nextStep = steps[nextIndex]

        val fromStep = if (currentIndex >= 0) steps[currentIndex] else null
        val history = parseStatusHistory(message.statusHistory).toMutableList()
        history.add(
            StatusChangeItem(
                fromStatusId = message.statusId,
                fromStatusName = fromStep?.name,
                toStatusId = nextStep.id,
                toStatusName = nextStep.name
            )
        )

        messageRepository.updateStatusWithHistory(
            messageId, nextStep.id, serializeStatusHistory(history)
        )
        Log.d(TAG, "Moved message $messageId to status ${nextStep.name}")
    }

    private suspend fun handleSnooze1Hr(messageId: String) {
        val snoozeAt = System.currentTimeMillis() + 60 * 60 * 1000L
        messageRepository.setSnooze(messageId, snoozeAt)
        snoozeManager.scheduleSnooze(messageId, snoozeAt)
        Log.d(TAG, "Snoozed message $messageId for 1 hour")
    }
}
