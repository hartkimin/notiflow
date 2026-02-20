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
            val sender = extras.getCharSequence("android.title")?.toString() ?: ""
            val content = extras.getCharSequence("android.text")?.toString() ?: ""

            // 빈 컨텐츠 무시
            if (sender.isBlank() && content.isBlank()) return

            val senderIconBase64 = extractLargeIcon(sbn)
            val attachedImageBase64 = extractAttachedImage(sbn)
            val contentIntent = sbn.notification?.contentIntent

            // 필터 매칭 전에 발신자 단위 캐시 저장
            // 필터에 매칭되지 않는 알림이라도, 같은 발신자의 이전 메시지에 딥링크 제공
            DeepLinkCache.storeBySender(packageName, sender, contentIntent)

            scope.launch {
                try {
                    val appName = resolveAppName(packageName)
                    processMessage(packageName, appName, sender, content, senderIconBase64, attachedImageBase64, contentIntent)
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

            // 고해상도 대응을 위해 프로필 아이콘 사이즈를 800px로 상향
            val size = 800
            
            // 소스 드로어블의 크기에 맞춰 비트맵 생성 (너무 작은 경우 800px로 확대)
            val width = if (largeIcon.intrinsicWidth > 0) largeIcon.intrinsicWidth else size
            val height = if (largeIcon.intrinsicHeight > 0) largeIcon.intrinsicHeight else size
            
            // 비율 유지를 위해 큰 쪽을 800으로 맞춤
            val scale = size.toFloat() / maxOf(width, height)
            val finalWidth = (width * scale).toInt()
            val finalHeight = (height * scale).toInt()

            val bitmap = Bitmap.createBitmap(finalWidth, finalHeight, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            largeIcon.setBounds(0, 0, finalWidth, finalHeight)
            largeIcon.draw(canvas)

            val stream = ByteArrayOutputStream()
            // 프로필은 선명도가 중요하므로 무손실 PNG 품질 100 사용
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            bitmap.recycle()
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e("NotiFlowListener", "Failed to extract large icon", e)
            null
        }
    }

    private fun extractAttachedImage(sbn: StatusBarNotification): String? {
        return try {
            val extras = sbn.notification?.extras ?: return null
            var picture: Bitmap? = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val icon = extras.getParcelable<android.graphics.drawable.Icon>(android.app.Notification.EXTRA_PICTURE_ICON)
                if (icon != null) {
                    val drawable = icon.loadDrawable(applicationContext)
                    if (drawable != null) {
                        picture = Bitmap.createBitmap(drawable.intrinsicWidth, drawable.intrinsicHeight, Bitmap.Config.ARGB_8888)
                        val canvas = android.graphics.Canvas(picture)
                        drawable.setBounds(0, 0, canvas.width, canvas.height)
                        drawable.draw(canvas)
                    }
                }
            }
            
            if (picture == null) {
                @Suppress("DEPRECATION")
                picture = extras.getParcelable<Bitmap>(android.app.Notification.EXTRA_PICTURE)
            }

            if (picture == null) return null

            // 원본 화질을 최대한 유지하도록 리사이징 로직 제거
            // 스마트폰 화면에서 보는 이미지는 압축 손실을 줄이는 것이 중요함
            val stream = ByteArrayOutputStream()
            // 고화질 유지를 위해 압축률 최소화 (품질 100, 무손실 PNG 사용)
            picture.compress(Bitmap.CompressFormat.PNG, 100, stream)
            // 비트맵 해제 생략 (원본이 알림에서 가져온 것이므로 시스템이 관리)
            
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e("NotiFlowListener", "Failed to extract attached image", e)
            null
        }
    }

    private suspend fun processMessage(
        packageName: String,
        appName: String,
        sender: String,
        content: String,
        senderIconBase64: String? = null,
        attachedImageBase64: String? = null,
        contentIntent: PendingIntent? = null
    ) {
        // Stage 0: Duplicate check (1분 이내 동일 패키지/발신자/내용 중복 방지)
        val oneMinuteAgo = System.currentTimeMillis() - 60_000
        val duplicate = messageRepository.findDuplicate(packageName, sender, content, oneMinuteAgo)
        if (duplicate != null) {
            Log.d("NotiFlowListener", "Ignoring duplicate message from $packageName ($sender)")
            return
        }

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
            senderIcon = senderIconBase64,
            attachedImage = attachedImageBase64
        )
        val insertedId = messageRepository.insert(message)
        DeepLinkCache.store(message.id, packageName, sender, contentIntent)

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
