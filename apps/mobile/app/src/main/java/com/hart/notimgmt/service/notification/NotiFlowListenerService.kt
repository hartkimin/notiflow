package com.hart.notimgmt.service.notification

import android.app.PendingIntent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.model.AppFilterMode
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.repository.AppFilterRepository
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.FilterRuleRepository
import com.hart.notimgmt.data.repository.MessageRepository
import com.hart.notimgmt.data.repository.StatusStepRepository
import com.hart.notimgmt.data.sync.SyncManager
import com.hart.notimgmt.widget.NotiFlowWidgetProvider
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class NotiFlowListenerService : NotificationListenerService() {

    @Inject lateinit var filterRuleRepository: FilterRuleRepository
    @Inject lateinit var messageRepository: MessageRepository
    @Inject lateinit var statusStepRepository: StatusStepRepository
    @Inject lateinit var appFilterRepository: AppFilterRepository
    @Inject lateinit var categoryRepository: CategoryRepository
    @Inject lateinit var appPreferences: AppPreferences
    @Inject lateinit var captureNotificationHelper: CaptureNotificationHelper
    @Inject lateinit var syncManager: SyncManager

    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        Log.e("NotiFlowListener", "Coroutine error", throwable)
    }
    private var scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + exceptionHandler)
    private val filterEngine = MessageFilterEngine()

    override fun onListenerConnected() {
        super.onListenerConnected()
        // Recreate scope in case it was cancelled by a previous disconnect
        if (!scope.coroutineContext[Job]!!.isActive) {
            scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + exceptionHandler)
        }
        // 자동 삭제 실행
        scope.launch {
            try {
                val days = appPreferences.autoDeleteDays
                if (days > 0) {
                    val cutoff = System.currentTimeMillis() - (days.toLong() * 24 * 60 * 60 * 1000)
                    messageRepository.softDeleteOlderThan(cutoff)
                }
            } catch (e: Exception) {
                Log.e("NotiFlowListener", "Auto-delete failed", e)
            }
        }
        // 활성 알림의 PendingIntent를 발신자 단위로 프리캐싱
        // 서비스 재연결 시 캐시를 복구하여 딥링크 히트율 향상
        scope.launch {
            try {
                val active = activeNotifications ?: return@launch
                for (sbn in active) {
                    val pi = sbn.notification?.contentIntent ?: continue
                    val pkg = sbn.packageName ?: continue
                    if (pkg == "android" || pkg == applicationContext.packageName) continue
                    val sender = sbn.notification?.extras
                        ?.getCharSequence("android.title")?.toString() ?: continue
                    DeepLinkCache.storeBySender(pkg, sender, pi)
                }
            } catch (e: Exception) {
                Log.e("NotiFlowListener", "Deep link pre-cache failed", e)
            }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        try {
            val packageName = sbn.packageName ?: return

            // Skip system UI and own package
            if (packageName == "android" || packageName == applicationContext.packageName) return

            val extras = sbn.notification?.extras ?: return
            val sender = extras.getCharSequence("android.title")?.toString() ?: return
            val content = extras.getCharSequence("android.text")?.toString() ?: return

            // 빈 컨텐츠 무시
            if (sender.isBlank() && content.isBlank()) return

            val senderIconBase64 = extractLargeIcon(sbn)
            val contentIntent = sbn.notification?.contentIntent

            // 필터 매칭 전에 발신자 단위 캐시 저장
            // 필터에 매칭되지 않는 알림이라도, 같은 발신자의 이전 메시지에 딥링크 제공
            DeepLinkCache.storeBySender(packageName, sender, contentIntent)

            scope.launch {
                try {
                    val appName = resolveAppName(packageName)
                    processMessage(packageName, appName, sender, content, senderIconBase64, contentIntent)
                } catch (e: Exception) {
                    Log.e("NotiFlowListener", "Failed to process message from $packageName", e)
                }
            }
        } catch (e: Exception) {
            Log.e("NotiFlowListener", "Error reading notification", e)
        }
    }

    private fun resolveAppName(packageName: String): String {
        val pm = applicationContext.packageManager
        return try {
            val appInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getApplicationInfo(packageName, 0)
            }
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }
    }

    private fun extractLargeIcon(sbn: StatusBarNotification): String? {
        return try {
            val extras = sbn.notification?.extras ?: return null
            val largeIcon = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                sbn.notification.getLargeIcon()?.loadDrawable(applicationContext)
            } else {
                @Suppress("DEPRECATION")
                val bmp = extras.getParcelable<Bitmap>("android.largeIcon")
                if (bmp != null) android.graphics.drawable.BitmapDrawable(resources, bmp) else null
            }
            if (largeIcon == null) return null

            val size = 128
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            largeIcon.setBounds(0, 0, size, size)
            largeIcon.draw(canvas)

            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 80, stream)
            bitmap.recycle()
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e("NotiFlowListener", "Failed to extract large icon", e)
            null
        }
    }

    private suspend fun processMessage(
        packageName: String,
        appName: String,
        sender: String,
        content: String,
        senderIconBase64: String? = null,
        contentIntent: PendingIntent? = null
    ) {
        // Stage 1: App filter check
        if (!isAppAllowed(packageName)) return

        // Stage 2: Keyword filter matching - 모든 매칭 규칙 찾기
        val activeRules = filterRuleRepository.getActiveRules()
        val matchedRules = filterEngine.findAllMatchingRules(activeRules, sender, content, packageName = packageName)

        // Stage 3: 필터에 매칭되지 않은 경우 무시
        if (matchedRules.isEmpty()) return

        val firstStatus = statusStepRepository.getFirstStep()

        // 카테고리 우선순위에 따라 상위 카테고리에만 저장
        val categoryOrder = categoryRepository.getActiveCategoryIdsOrdered()
        val topCategoryRule = matchedRules
            .distinctBy { it.categoryId }
            .minByOrNull { rule ->
                val index = categoryOrder.indexOf(rule.categoryId)
                if (index == -1) Int.MAX_VALUE else index
            } ?: return

        val message = CapturedMessageEntity(
            categoryId = topCategoryRule.categoryId,
            matchedRuleId = topCategoryRule.id,
            source = packageName,
            appName = appName,
            sender = sender,
            content = content,
            statusId = firstStatus?.id,
            senderIcon = senderIconBase64
        )
        val insertedId = messageRepository.insert(message)
        DeepLinkCache.store(message.id, packageName, sender, contentIntent)

        // 클라우드 동기화 트리거 (이미 진행 중이면 skip)
        syncManager.forceSync()

        // 위젯 업데이트
        NotiFlowWidgetProvider.updateWidgets(applicationContext)

        captureNotificationHelper.showCaptureNotification(
            messageId = insertedId,
            appName = appName,
            sender = sender,
            contentPreview = content.take(100)
        )
    }

    private suspend fun isAppAllowed(packageName: String): Boolean {
        val filter = appFilterRepository.getByPackageName(packageName)
        return when (appPreferences.appFilterMode) {
            AppFilterMode.WHITELIST -> {
                // No apps selected yet → allow all (avoid silent drop on fresh install)
                if (filter == null) {
                    appFilterRepository.countAllowed() == 0
                } else {
                    filter.isAllowed
                }
            }
            AppFilterMode.BLACKLIST -> {
                // Selected apps (isAllowed=true) are the ones to BLOCK
                // No apps selected yet → allow all
                if (filter == null) true
                else !filter.isAllowed
            }
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        scope.cancel()
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
