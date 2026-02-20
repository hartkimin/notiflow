package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.CapturedMessageDao
import com.hart.notimgmt.data.db.dao.CategorySummaryRow
import com.hart.notimgmt.data.db.dao.DayCategory
import com.hart.notimgmt.data.db.dao.StatusCount
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MessageRepository @Inject constructor(
    private val messageDao: CapturedMessageDao,
    private val syncManager: SyncManager
) {
    fun getAll(): Flow<List<CapturedMessageEntity>> = messageDao.getAll()

    fun getAllActiveFlow(): Flow<List<CapturedMessageEntity>> = messageDao.getAllActiveFlow()

    fun getMessagesBySenderFlow(source: String, sender: String): Flow<List<CapturedMessageEntity>> =
        messageDao.getMessagesBySenderFlow(source, sender)

    suspend fun getAllOnce(): List<CapturedMessageEntity> = messageDao.getAllOnce()

    fun getByCategoryId(categoryId: String): Flow<List<CapturedMessageEntity>> =
        messageDao.getByCategoryId(categoryId)

    fun getUncategorized(): Flow<List<CapturedMessageEntity>> =
        messageDao.getUncategorized()

    fun getByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<CapturedMessageEntity>> =
        messageDao.getByDateRange(startOfDay, endOfDay)

    fun getStatusCountsByDateRange(startOfDay: Long, endOfDay: Long): Flow<List<StatusCount>> =
        messageDao.getStatusCountsByDateRange(startOfDay, endOfDay)

    fun getMessageDaysInMonth(monthStart: Long, monthEnd: Long): Flow<List<DayCategory>> =
        messageDao.getMessageDaysInMonth(monthStart, monthEnd)

    fun getCountSince(since: Long): Flow<Int> = messageDao.getCountSince(since)
    fun getCountByStatus(statusId: String): Flow<Int> = messageDao.getCountByStatus(statusId)
    fun getCountBetween(start: Long, end: Long): Flow<Int> = messageDao.getCountBetween(start, end)

    fun getCompletedToday(lastStatusId: String, todayStart: Long, limit: Int): Flow<List<CapturedMessageEntity>> =
        messageDao.getCompletedToday(lastStatusId, todayStart, limit)

    fun getCompletedTodayCount(lastStatusId: String, todayStart: Long): Flow<Int> =
        messageDao.getCompletedTodayCount(lastStatusId, todayStart)

    fun getMessagesByStatusWithLimit(statusId: String, limit: Int): Flow<List<CapturedMessageEntity>> =
        messageDao.getMessagesByStatusWithLimit(statusId, limit)

    fun getCategorySummaries(firstStatusId: String, urgentThreshold: Long): Flow<List<CategorySummaryRow>> =
        messageDao.getCategorySummaries(firstStatusId, urgentThreshold)

    suspend fun getById(id: String): CapturedMessageEntity? = messageDao.getById(id)

    fun getByIdFlow(id: String): Flow<CapturedMessageEntity?> = messageDao.getByIdFlow(id)

    suspend fun insert(message: CapturedMessageEntity): String {
        val entity = message.copy(updatedAt = System.currentTimeMillis(), needsSync = true)
        messageDao.upsert(entity)
        syncManager.syncMessage(entity)
        return entity.id
    }

    suspend fun update(message: CapturedMessageEntity) {
        val entity = message.copy(updatedAt = System.currentTimeMillis(), needsSync = true)
        messageDao.update(entity)
        syncManager.syncMessage(entity)
    }

    suspend fun delete(message: CapturedMessageEntity) {
        val entity = message.copy(isDeleted = true, updatedAt = System.currentTimeMillis(), needsSync = true)
        messageDao.update(entity)
        syncManager.syncMessage(entity)
    }

    suspend fun updateStatus(messageId: String, statusId: String) {
        messageDao.updateStatus(messageId, statusId)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun updateStatusWithHistory(messageId: String, statusId: String, statusHistory: String?) {
        messageDao.updateStatusWithHistory(messageId, statusId, statusHistory)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun updateComment(messageId: String, comment: String?) {
        messageDao.updateComment(messageId, comment)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun updateContent(messageId: String, newContent: String) {
        val message = messageDao.getById(messageId) ?: return
        // 최초 수정 시에만 원문 보존 (이미 수정된 적 있으면 originalContent 유지)
        val originalContent = message.originalContent ?: message.content
        messageDao.updateContent(messageId, newContent, originalContent)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun softDeleteByIds(ids: List<String>) {
        messageDao.softDeleteByIds(ids)
        // Sync each deleted message
        ids.forEach { id ->
            messageDao.getById(id)?.let { syncManager.syncMessage(it) }
        }
    }

    suspend fun updateStatusByIds(ids: List<String>, statusId: String) {
        messageDao.updateStatusByIds(ids, statusId)
        // Sync each updated message
        ids.forEach { id ->
            messageDao.getById(id)?.let { syncManager.syncMessage(it) }
        }
    }

    suspend fun updateCategory(messageId: String, categoryId: String) {
        messageDao.updateCategory(messageId, categoryId)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun updateCategoryByIds(ids: List<String>, categoryId: String) {
        messageDao.updateCategoryByIds(ids, categoryId)
        ids.forEach { id ->
            messageDao.getById(id)?.let { syncManager.syncMessage(it) }
        }
    }

    fun getArchived(): Flow<List<CapturedMessageEntity>> = messageDao.getArchived()

    suspend fun setArchived(messageId: String, archived: Boolean) {
        messageDao.setArchived(messageId, archived)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun setPinned(messageId: String, isPinned: Boolean) {
        messageDao.setPinned(messageId, isPinned)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun setSnooze(messageId: String, snoozeAt: Long?) {
        messageDao.updateSnooze(messageId, snoozeAt)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun clearSnooze(messageId: String) {
        messageDao.updateSnooze(messageId, null)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun getActiveSnoozesOnce(): List<CapturedMessageEntity> =
        messageDao.getActiveSnoozesOnce()

    suspend fun softDeleteOlderThan(beforeTimestamp: Long) {
        messageDao.softDeleteOlderThan(beforeTimestamp)
    }

    // ── 휴지통 (Trash) ──

    fun getDeleted(): Flow<List<CapturedMessageEntity>> = messageDao.getDeleted()

    fun getDeletedCount(): Flow<Int> = messageDao.getDeletedCount()

    suspend fun restore(messageId: String) {
        messageDao.restoreById(messageId)
        messageDao.getById(messageId)?.let { syncManager.syncMessage(it) }
    }

    suspend fun restoreByIds(ids: List<String>) {
        messageDao.restoreByIds(ids)
        ids.forEach { id ->
            messageDao.getById(id)?.let { syncManager.syncMessage(it) }
        }
    }

    /**
     * 영구 삭제.
     * 로컬에서는 pendingPermanentDelete 플래그를 설정하여 UI에서 즉시 숨기고,
     * 서버와의 동기화가 성공하면 로컬 DB에서도 최종 제거한다.
     */
    suspend fun permanentDeleteByIds(ids: List<String>) {
        // 1. UI에서 즉시 숨기기 위해 플래그 설정
        messageDao.markPendingPermanentDelete(ids)
        
        // 2. 서버에서 삭제 시도 및 최종 로컬 삭제 처리
        syncManager.syncPendingDeletions()
    }

    suspend fun emptyTrash() {
        val deleted = messageDao.getDeletedOnce()
        if (deleted.isNotEmpty()) {
            val ids = deleted.map { it.id }
            // 1. 플래그 설정
            messageDao.markPendingPermanentDelete(ids)
            // 2. 동기화 실행
            syncManager.syncPendingDeletions()
        }
    }

    suspend fun findDuplicate(source: String, sender: String, content: String, timeThreshold: Long): CapturedMessageEntity? {
        return messageDao.findDuplicate(source, sender, content, timeThreshold)
    }
}
