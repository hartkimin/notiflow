package com.hart.notimgmt.service.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.FilterRuleRepository
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.StatusStepRepository
import com.hart.notimgmt.widget.NotiFlowWidgetProvider
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import javax.inject.Inject

@AndroidEntryPoint
class SmsReceiver : BroadcastReceiver() {

    @Inject lateinit var filterRuleRepository: FilterRuleRepository
    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var statusStepRepository: StatusStepRepository
    @Inject lateinit var categoryRepository: CategoryRepository
    @Inject lateinit var appPreferences: AppPreferences
    @Inject lateinit var captureNotificationHelper: CaptureNotificationHelper

    private val filterEngine = MessageFilterEngine()

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (!appPreferences.smsCaptureEnabled) return

        val pendingResult = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        scope.launch {
            try {
                withTimeout(9_000) {
                    messages.forEach { smsMessage ->
                        val sender = smsMessage.displayOriginatingAddress ?: return@forEach
                        val content = smsMessage.displayMessageBody ?: return@forEach

                        val activeRules = filterRuleRepository.getActiveRules()
                        val matchedRules = filterEngine.findAllMatchingRules(activeRules, sender, content, phoneNumber = sender, packageName = "SMS")

                        // 필터에 매칭되지 않은 경우 무시
                        if (matchedRules.isEmpty()) return@forEach

                        val firstStatus = statusStepRepository.getFirstStep()

                        // 카테고리 우선순위에 따라 상위 카테고리에만 저장
                        val categoryOrder = categoryRepository.getActiveCategoryIdsOrdered()
                        val topCategoryRule = matchedRules
                            .distinctBy { it.categoryId }
                            .minByOrNull { rule ->
                                val index = categoryOrder.indexOf(rule.categoryId)
                                if (index == -1) Int.MAX_VALUE else index
                            } ?: return@forEach

                        val insertedId = messageRepository.insert(
                            CapturedMessageEntity(
                                categoryId = topCategoryRule.categoryId,
                                matchedRuleId = topCategoryRule.id,
                                source = "SMS",
                                appName = "SMS",
                                sender = sender,
                                content = content,
                                statusId = firstStatus?.id
                            )
                        )

                        // 위젯 업데이트
                        context?.let { NotiFlowWidgetProvider.updateWidgets(it) }

                        captureNotificationHelper.showCaptureNotification(
                            messageId = insertedId,
                            appName = "SMS",
                            sender = sender,
                            contentPreview = content.take(100)
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("SmsReceiver", "Error processing SMS", e)
            } finally {
                pendingResult.finish()
                scope.cancel()
            }
        }
    }
}
