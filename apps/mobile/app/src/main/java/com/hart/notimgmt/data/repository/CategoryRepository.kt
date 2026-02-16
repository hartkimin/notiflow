package com.hart.notimgmt.data.repository

import com.hart.notimgmt.data.db.dao.CategoryDao
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CategoryRepository @Inject constructor(
    private val categoryDao: CategoryDao,
    private val syncManager: SyncManager
) {
    fun getAll(): Flow<List<CategoryEntity>> = categoryDao.getAll()

    suspend fun getById(id: String): CategoryEntity? = categoryDao.getById(id)

    suspend fun insert(category: CategoryEntity): String {
        val entity = category.copy(updatedAt = System.currentTimeMillis())
        categoryDao.upsert(entity)
        syncManager.syncCategory(entity)
        return entity.id
    }

    suspend fun update(category: CategoryEntity) {
        val entity = category.copy(updatedAt = System.currentTimeMillis())
        categoryDao.update(entity)
        syncManager.syncCategory(entity)
    }

    suspend fun delete(category: CategoryEntity) {
        val entity = category.copy(isDeleted = true, updatedAt = System.currentTimeMillis())
        categoryDao.update(entity)
        syncManager.syncCategory(entity)
    }

    suspend fun setActive(id: String, isActive: Boolean) {
        categoryDao.setActive(id, isActive)
        categoryDao.getById(id)?.let { syncManager.syncCategory(it) }
    }

    suspend fun reorderCategories(categories: List<CategoryEntity>) {
        val updated = categories.map { it.copy(updatedAt = System.currentTimeMillis()) }
        categoryDao.updateAll(updated)
        updated.forEach { syncManager.syncCategory(it) }
    }

    suspend fun getActiveCategoryIds(): List<String> = categoryDao.getActiveCategoryIds()

    suspend fun getActiveCategoryIdsOrdered(): List<String> = categoryDao.getActiveCategoryIdsOrdered()

    suspend fun getAllActiveOnce(): List<CategoryEntity> =
        categoryDao.getAllOnce().filter { !it.isDeleted && it.isActive }
}
