package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.FilterRuleDao
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FilterRuleRepository @Inject constructor(
    private val filterRuleDao: FilterRuleDao,
    private val syncManager: SyncManager
) {
    fun getByCategoryId(categoryId: String): Flow<List<FilterRuleEntity>> =
        filterRuleDao.getByCategoryId(categoryId)

    suspend fun getByCategoryIdOnce(categoryId: String): List<FilterRuleEntity> =
        filterRuleDao.getByCategoryIdOnce(categoryId)

    suspend fun getActiveRules(): List<FilterRuleEntity> = filterRuleDao.getActiveRules()

    suspend fun getById(id: String): FilterRuleEntity? = filterRuleDao.getById(id)

    suspend fun insert(rule: FilterRuleEntity): String {
        val entity = rule.copy(updatedAt = System.currentTimeMillis())
        filterRuleDao.upsert(entity)
        syncManager.syncFilterRule(entity)
        return entity.id
    }

    suspend fun update(rule: FilterRuleEntity) {
        val entity = rule.copy(updatedAt = System.currentTimeMillis())
        filterRuleDao.update(entity)
        syncManager.syncFilterRule(entity)
    }

    suspend fun delete(rule: FilterRuleEntity) {
        val entity = rule.copy(isDeleted = true, updatedAt = System.currentTimeMillis())
        filterRuleDao.update(entity)
        syncManager.syncFilterRule(entity)
    }
}
