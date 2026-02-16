package com.hart.notimgmt.widget

import android.content.Context
import android.util.Log
import androidx.room.Room
import com.hart.notimgmt.data.db.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Calendar

/**
 * 위젯에서 사용할 데이터를 제공하는 클래스
 */
class WidgetDataProvider(private val context: Context) {

    companion object {
        private const val TAG = "WidgetDataProvider"
        private const val DATABASE_NAME = "mednoti.db"

        @Volatile
        private var INSTANCE: AppDatabase? = null

        private fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }

    private val todayStart: Long
        get() = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    private val urgentThreshold: Long
        get() = System.currentTimeMillis() - 24 * 60 * 60 * 1000

    suspend fun getWidgetData(): WidgetData = withContext(Dispatchers.IO) {
        try {
            val database = getDatabase(context)
            val messageDao = database.capturedMessageDao()
            val statusStepDao = database.statusStepDao()

            // 첫 번째 상태 (미확인) ID 가져오기
            val firstStatus = statusStepDao.getFirstStep()
            val firstStatusId = firstStatus?.id

            Log.d(TAG, "First status ID: $firstStatusId")

            // 오늘 수신 건수
            val todayCount = messageDao.getCountSinceOnce(todayStart)

            // 미처리 건수 (첫 번째 상태인 메시지)
            val pendingCount = if (firstStatusId != null) {
                messageDao.getCountByStatusOnce(firstStatusId)
            } else {
                0
            }

            // 긴급 건수 (24시간 이상 경과 + 첫 번째 상태)
            val urgentCount = if (firstStatusId != null) {
                messageDao.getUrgentCountOnce(firstStatusId, urgentThreshold)
            } else {
                0
            }

            Log.d(TAG, "Widget data: today=$todayCount, pending=$pendingCount, urgent=$urgentCount")

            WidgetData(
                todayCount = todayCount,
                pendingCount = pendingCount,
                urgentCount = urgentCount,
                lastUpdated = System.currentTimeMillis()
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get widget data", e)
            WidgetData(
                todayCount = 0,
                pendingCount = 0,
                urgentCount = 0,
                lastUpdated = System.currentTimeMillis(),
                error = e.message
            )
        }
    }
}

data class WidgetData(
    val todayCount: Int,
    val pendingCount: Int,
    val urgentCount: Int,
    val lastUpdated: Long,
    val error: String? = null
)
