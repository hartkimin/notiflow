package com.hart.notimgmt.data.db.dao

import androidx.room.*
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CapturedMessageDao {
    @Query("SELECT * FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY isPinned DESC, receivedAt DESC")
    fun getAll(): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getAllActiveFlow(): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE source = :source AND sender = :sender AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getMessagesBySenderFlow(source: String, sender: String): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE source = :source AND (roomName = :roomId OR (roomName IS NULL AND sender = :roomId)) AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getMessagesByRoomFlow(source: String, roomId: String): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE source = :source AND (roomName = :roomId OR (roomName IS NULL AND sender = :roomId)) AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt ASC")
    fun getMessagesByRoomAscFlow(source: String, roomId: String): Flow<List<CapturedMessageEntity>>

    @Query("SELECT id FROM captured_messages WHERE source = :source AND (roomName = :roomId OR (roomName IS NULL AND sender = :roomId)) AND isDeleted = 0 AND pendingPermanentDelete = 0")
    suspend fun getRoomMessageIds(source: String, roomId: String): List<String>

    @Query("SELECT * FROM captured_messages ORDER BY receivedAt DESC")
    suspend fun getAllOnce(): List<CapturedMessageEntity>

    @Query("SELECT * FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 1 AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getArchived(): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE categoryId = :categoryId AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getByCategoryId(categoryId: String): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE categoryId IS NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getUncategorized(): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE categoryId IS NOT NULL AND receivedAt BETWEEN :startOfDay AND :endOfDay AND isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    fun getByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<CapturedMessageEntity>>

    @Query("SELECT * FROM captured_messages WHERE id = :id")
    suspend fun getById(id: String): CapturedMessageEntity?

    @Query("SELECT * FROM captured_messages WHERE id = :id")
    fun getByIdFlow(id: String): Flow<CapturedMessageEntity?>

    @Query("""
        SELECT statusId, COUNT(*) as count
        FROM captured_messages
        WHERE categoryId IS NOT NULL AND receivedAt BETWEEN :startOfDay AND :endOfDay AND isDeleted = 0 AND pendingPermanentDelete = 0
        GROUP BY statusId
    """)
    fun getStatusCountsByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<StatusCount>>

    @Query("""
        SELECT receivedAt, categoryId
        FROM captured_messages
        WHERE categoryId IS NOT NULL AND receivedAt BETWEEN :monthStart AND :monthEnd AND isDeleted = 0 AND pendingPermanentDelete = 0
    """)
    fun getMessageDaysInMonth(monthStart: Long, monthEnd: Long): Flow<List<DayCategory>>

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND receivedAt >= :since")
    fun getCountSince(since: Long): Flow<Int>

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND receivedAt >= :since")
    suspend fun getCountSinceOnce(since: Long): Int

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :statusId")
    fun getCountByStatus(statusId: String): Flow<Int>

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :statusId")
    suspend fun getCountByStatusOnce(statusId: String): Int

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :statusId AND receivedAt < :urgentThreshold")
    suspend fun getUrgentCountOnce(statusId: String, urgentThreshold: Long): Int

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND receivedAt >= :start AND receivedAt < :end")
    fun getCountBetween(start: Long, end: Long): Flow<Int>

    @Query("""
        SELECT * FROM captured_messages
        WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :lastStatusId AND statusChangedAt >= :todayStart
        ORDER BY statusChangedAt DESC
        LIMIT :limit
    """)
    fun getCompletedToday(lastStatusId: String, todayStart: Long, limit: Int): Flow<List<CapturedMessageEntity>>

    @Query("SELECT COUNT(*) FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :lastStatusId AND statusChangedAt >= :todayStart")
    fun getCompletedTodayCount(lastStatusId: String, todayStart: Long): Flow<Int>

    @Query("SELECT * FROM captured_messages WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :statusId ORDER BY receivedAt ASC LIMIT :limit")
    fun getMessagesByStatusWithLimit(statusId: String, limit: Int): Flow<List<CapturedMessageEntity>>

    @Query("""
        SELECT categoryId, COUNT(*) as pendingCount,
        SUM(CASE WHEN receivedAt < :urgentThreshold THEN 1 ELSE 0 END) as urgentCount
        FROM captured_messages
        WHERE categoryId IS NOT NULL AND isArchived = 0 AND isDeleted = 0 AND pendingPermanentDelete = 0 AND statusId = :firstStatusId
        GROUP BY categoryId
    """)
    fun getCategorySummaries(firstStatusId: String, urgentThreshold: Long): Flow<List<CategorySummaryRow>>

    @Query("SELECT * FROM captured_messages WHERE needsSync = 1")
    suspend fun getPendingSync(): List<CapturedMessageEntity>

    @Query("UPDATE captured_messages SET needsSync = 0 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("UPDATE captured_messages SET needsSync = 1 WHERE id = :id")
    suspend fun markNeedsSync(id: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(message: CapturedMessageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(messages: List<CapturedMessageEntity>)

    @Update
    suspend fun update(message: CapturedMessageEntity)

    @Query("UPDATE captured_messages SET isDeleted = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDelete(id: String, updatedAt: Long = System.currentTimeMillis())

    @Delete
    suspend fun delete(message: CapturedMessageEntity)

    @Query("DELETE FROM captured_messages WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("UPDATE captured_messages SET statusId = :statusId, statusChangedAt = :statusChangedAt, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun updateStatus(messageId: String, statusId: String, statusChangedAt: Long = System.currentTimeMillis(), updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET statusId = :statusId, statusHistory = :statusHistory, statusChangedAt = :statusChangedAt, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun updateStatusWithHistory(messageId: String, statusId: String, statusHistory: String?, statusChangedAt: Long = System.currentTimeMillis(), updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET comment = :comment, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun updateComment(messageId: String, comment: String?, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET content = :content, originalContent = :originalContent, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun updateContent(messageId: String, content: String, originalContent: String?, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET isDeleted = 1, updatedAt = :updatedAt WHERE id IN (:ids)")
    suspend fun softDeleteByIds(ids: List<String>, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET statusId = :statusId, updatedAt = :updatedAt WHERE id IN (:ids)")
    suspend fun updateStatusByIds(ids: List<String>, statusId: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET categoryId = :categoryId, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun updateCategory(messageId: String, categoryId: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET categoryId = :categoryId, updatedAt = :updatedAt WHERE id IN (:ids)")
    suspend fun updateCategoryByIds(ids: List<String>, categoryId: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET isArchived = :archived, updatedAt = :updatedAt WHERE id = :messageId")
    suspend fun setArchived(messageId: String, archived: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET isPinned = :isPinned, updatedAt = :updatedAt WHERE id = :id")
    suspend fun setPinned(id: String, isPinned: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET snoozeAt = :snoozeAt, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateSnooze(id: String, snoozeAt: Long?, updatedAt: Long = System.currentTimeMillis())

    @Query("SELECT * FROM captured_messages WHERE snoozeAt IS NOT NULL AND snoozeAt > :now AND isDeleted = 0 AND pendingPermanentDelete = 0")
    suspend fun getActiveSnoozesOnce(now: Long = System.currentTimeMillis()): List<CapturedMessageEntity>

    // Insight queries
    @Query("""
        SELECT sender, COUNT(*) as count FROM captured_messages
        WHERE receivedAt >= :since AND isDeleted = 0 AND categoryId IS NOT NULL AND pendingPermanentDelete = 0
        GROUP BY sender ORDER BY count DESC LIMIT :limit
    """)
    suspend fun getTopSenders(since: Long, limit: Int): List<SenderCount>

    @Query("""
        SELECT categoryId, COUNT(*) as count FROM captured_messages
        WHERE receivedAt >= :since AND isDeleted = 0 AND categoryId IS NOT NULL AND pendingPermanentDelete = 0
        GROUP BY categoryId ORDER BY count DESC
    """)
    suspend fun getCategoryBreakdown(since: Long): List<CategoryCount>

    @Query("SELECT COUNT(*) FROM captured_messages WHERE receivedAt >= :since AND isDeleted = 0 AND categoryId IS NOT NULL AND statusId = :lastStatusId AND pendingPermanentDelete = 0")
    suspend fun getCompletedCountSince(since: Long, lastStatusId: String): Int

    @Query("SELECT COUNT(*) FROM captured_messages WHERE receivedAt >= :since AND isDeleted = 0 AND categoryId IS NOT NULL AND pendingPermanentDelete = 0")
    suspend fun getTotalCountSince(since: Long): Int

    @Query("UPDATE captured_messages SET isDeleted = 1, updatedAt = :updatedAt WHERE isArchived = 0 AND receivedAt < :beforeTimestamp AND pendingPermanentDelete = 0")
    suspend fun softDeleteOlderThan(beforeTimestamp: Long, updatedAt: Long = System.currentTimeMillis())

    /**
     * 동기화가 완료된 항목들에 대해서만 물리적 삭제 수행
     */
    @Query("DELETE FROM captured_messages WHERE isDeleted = 1 AND needsSync = 0 AND pendingPermanentDelete = 0 AND updatedAt < :beforeTimestamp")
    suspend fun cleanupDeleted(beforeTimestamp: Long)

    // ── 휴지통 (Trash) ──

    @Query("SELECT * FROM captured_messages WHERE isDeleted = 1 AND pendingPermanentDelete = 0 ORDER BY updatedAt DESC")
    fun getDeleted(): Flow<List<CapturedMessageEntity>>

    @Query("SELECT COUNT(*) FROM captured_messages WHERE isDeleted = 1 AND pendingPermanentDelete = 0")
    fun getDeletedCount(): Flow<Int>

    @Query("SELECT * FROM captured_messages WHERE isDeleted = 1 AND pendingPermanentDelete = 0")
    suspend fun getDeletedOnce(): List<CapturedMessageEntity>

    @Query("UPDATE captured_messages SET isDeleted = 0, updatedAt = :updatedAt WHERE id = :id")
    suspend fun restoreById(id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE captured_messages SET isDeleted = 0, updatedAt = :updatedAt WHERE id IN (:ids)")
    suspend fun restoreByIds(ids: List<String>, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM captured_messages WHERE id IN (:ids)")
    suspend fun permanentDeleteByIds(ids: List<String>)

    @Query("SELECT * FROM captured_messages WHERE isDeleted = 0 AND pendingPermanentDelete = 0 ORDER BY receivedAt DESC")
    suspend fun getAllActiveOnce(): List<CapturedMessageEntity>

    @Query("SELECT * FROM captured_messages WHERE pendingPermanentDelete = 1")
    suspend fun getPendingPermanentDeletions(): List<CapturedMessageEntity>

    @Query("UPDATE captured_messages SET pendingPermanentDelete = 1, needsSync = 1, updatedAt = :updatedAt WHERE id IN (:ids)")
    suspend fun markPendingPermanentDelete(ids: List<String>, updatedAt: Long = System.currentTimeMillis())

    @Query("""
        SELECT * FROM captured_messages
        WHERE source = :source
        AND sender = :sender
        AND content = :content
        AND receivedAt >= :timeThreshold
        AND isDeleted = 0
        LIMIT 1
    """)
    suspend fun findDuplicate(source: String, sender: String, content: String, timeThreshold: Long): CapturedMessageEntity?

    @Query("""
        SELECT * FROM captured_messages
        WHERE isDeleted = 0 AND pendingPermanentDelete = 0
        AND (content LIKE '%' || :query || '%' OR sender LIKE '%' || :query || '%')
        ORDER BY receivedAt DESC
    """)
    fun searchMessages(query: String): Flow<List<CapturedMessageEntity>>

    @Query("DELETE FROM captured_messages")
    suspend fun deleteAll()
}

data class StatusCount(val statusId: String?, val count: Int)
data class DayCategory(val receivedAt: Long, val categoryId: String?)
data class CategorySummaryRow(val categoryId: String?, val pendingCount: Int, val urgentCount: Int)
data class SenderCount(val sender: String, val count: Int)
data class CategoryCount(val categoryId: String?, val count: Int)
