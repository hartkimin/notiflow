package com.hart.notimgmt.service.snooze

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.hart.notimgmt.data.repository.MessageRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var snoozeManager: SnoozeManager

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val pendingResult = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        scope.launch {
            try {
                val activeSnoozes = messageRepository.getActiveSnoozesOnce()
                if (activeSnoozes.isNotEmpty()) {
                    snoozeManager.rescheduleAll(activeSnoozes)
                    Log.d("BootReceiver", "Rescheduled ${activeSnoozes.size} snoozes after boot")
                }
            } catch (e: Exception) {
                Log.e("BootReceiver", "Failed to reschedule snoozes", e)
            } finally {
                pendingResult.finish()
                scope.cancel()
            }
        }
    }
}
