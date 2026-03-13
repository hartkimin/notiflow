package com.hart.notimgmt.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.RemoteViews
import com.hart.notimgmt.MainActivity
import com.hart.notimgmt.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * NotiRoute 홈 화면 위젯
 */
class NotiRouteWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "NotiRouteWidget"
        private const val ACTION_REFRESH = "com.hart.notimgmt.widget.ACTION_REFRESH"

        /**
         * 외부에서 위젯 업데이트를 트리거하는 메서드
         */
        fun updateWidgets(context: Context) {
            try {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val widgetIds = appWidgetManager.getAppWidgetIds(
                    ComponentName(context, NotiRouteWidgetProvider::class.java)
                )
                if (widgetIds.isNotEmpty()) {
                    val intent = Intent(context, NotiRouteWidgetProvider::class.java).apply {
                        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
                    }
                    context.sendBroadcast(intent)
                    Log.d(TAG, "Widget update broadcast sent for ${widgetIds.size} widgets")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update widgets", e)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        Log.d(TAG, "onUpdate called for ${appWidgetIds.size} widgets")
        for (appWidgetId in appWidgetIds) {
            updateWidgetAsync(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_REFRESH -> {
                Log.d(TAG, "Refresh action received")
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val appWidgetIds = appWidgetManager.getAppWidgetIds(
                    ComponentName(context, NotiRouteWidgetProvider::class.java)
                )
                for (appWidgetId in appWidgetIds) {
                    updateWidgetAsync(context, appWidgetManager, appWidgetId)
                }
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateWidgetAsync(context, appWidgetManager, appWidgetId)
    }

    private fun updateWidgetAsync(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        // 먼저 로딩 상태 표시
        showLoadingState(context, appWidgetManager, appWidgetId)

        // 백그라운드에서 데이터 로드
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val dataProvider = WidgetDataProvider(context.applicationContext)
                val data = dataProvider.getWidgetData()

                // UI 업데이트는 메인 스레드에서
                val views = createWidgetViews(context, data)
                setupClickListeners(context, views)
                appWidgetManager.updateAppWidget(appWidgetId, views)

                Log.d(TAG, "Widget $appWidgetId updated: today=${data.todayCount}, pending=${data.pendingCount}, urgent=${data.urgentCount}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update widget $appWidgetId", e)
                showErrorState(context, appWidgetManager, appWidgetId)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun showLoadingState(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_notiflow)
        views.setTextViewText(R.id.text_today_count, "-")
        views.setTextViewText(R.id.text_pending_count, "-")
        views.setTextViewText(R.id.text_urgent_count, "-")
        views.setTextViewText(R.id.text_last_updated, "로딩 중...")
        setupClickListeners(context, views)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun showErrorState(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_notiflow)
        views.setTextViewText(R.id.text_today_count, "!")
        views.setTextViewText(R.id.text_pending_count, "!")
        views.setTextViewText(R.id.text_urgent_count, "!")
        views.setTextViewText(R.id.text_last_updated, "탭하여 재시도")
        setupClickListeners(context, views)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun createWidgetViews(context: Context, data: WidgetData): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_notiflow)

        // 데이터 설정
        views.setTextViewText(R.id.text_today_count, data.todayCount.toString())
        views.setTextViewText(R.id.text_pending_count, data.pendingCount.toString())
        views.setTextViewText(R.id.text_urgent_count, data.urgentCount.toString())

        // 마지막 업데이트 시간
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        views.setTextViewText(
            R.id.text_last_updated,
            "업데이트: ${timeFormat.format(Date(data.lastUpdated))}"
        )

        return views
    }

    private fun setupClickListeners(context: Context, views: RemoteViews) {
        // 앱 열기 클릭
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, openAppPendingIntent)

        // 새로고침 버튼 클릭
        val refreshIntent = Intent(context, NotiRouteWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context,
            1,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent)
    }

    override fun onEnabled(context: Context) {
        Log.d(TAG, "Widget enabled (first widget added)")
    }

    override fun onDisabled(context: Context) {
        Log.d(TAG, "Widget disabled (last widget removed)")
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        Log.d(TAG, "Widgets deleted: ${appWidgetIds.toList()}")
    }
}

