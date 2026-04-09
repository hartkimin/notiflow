package com.hart.notimgmt.data.backup

import com.hart.notimgmt.data.db.AppDatabase
import com.hart.notimgmt.data.db.entity.AppFilterEntity
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.db.entity.CategoryEntity
import com.hart.notimgmt.data.db.entity.DayCategoryEntity
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.data.db.entity.PlanEntity
import com.hart.notimgmt.data.db.entity.StatusStepEntity
import com.hart.notimgmt.data.model.ConditionType
import com.hart.notimgmt.data.model.KeywordItem
import org.json.JSONArray
import org.json.JSONObject
import androidx.room.withTransaction
import javax.inject.Inject
import javax.inject.Singleton

data class BackupSummary(
    val formatVersion: Int,
    val dbVersion: Int,
    val exportedAt: Long,
    val categoryCount: Int,
    val statusStepCount: Int,
    val filterRuleCount: Int,
    val messageCount: Int,
    val appFilterCount: Int,
    val planCount: Int,
    val dayCategoryCount: Int
) {
    val totalCount: Int
        get() = categoryCount + statusStepCount + filterRuleCount +
                messageCount + appFilterCount + planCount + dayCategoryCount
}

data class DataSummary(
    val categoryCount: Int,
    val statusStepCount: Int,
    val filterRuleCount: Int,
    val messageCount: Int,
    val appFilterCount: Int,
    val planCount: Int,
    val dayCategoryCount: Int
) {
    val totalCount: Int
        get() = categoryCount + statusStepCount + filterRuleCount +
                messageCount + appFilterCount + planCount + dayCategoryCount
}

data class RestoreOptions(
    val categories: Boolean = true,    // 카테고리 + 필터 규칙 (FK로 그룹)
    val statusSteps: Boolean = true,   // 상태 단계
    val messages: Boolean = true,      // 메시지
    val appFilters: Boolean = true,    // 앱 필터
    val plans: Boolean = true,         // 스케줄
    val dayCategories: Boolean = true  // 요일 카테고리
)

data class ExportOptions(
    val categories: Boolean = true,    // 카테고리 + 필터 규칙 (FK로 그룹)
    val statusSteps: Boolean = true,   // 상태 단계
    val messages: Boolean = true,      // 메시지
    val appFilters: Boolean = true,    // 앱 필터
    val plans: Boolean = true,         // 스케줄
    val dayCategories: Boolean = true, // 요일 카테고리
    val includeImages: Boolean = false // 이미지 포함 (Base64, 메모리 주의)
)

@Singleton
class BackupManager @Inject constructor(
    private val db: AppDatabase
) {
    companion object {
        private const val BACKUP_FORMAT_VERSION = 8
        private const val DB_VERSION = 27
    }

    suspend fun getDataSummary(): DataSummary {
        val messages = db.capturedMessageDao().getAllOnce()
        return DataSummary(
            categoryCount = db.categoryDao().getAllOnce().count { !it.isDeleted },
            statusStepCount = db.statusStepDao().getAllOnce().count { !it.isDeleted },
            filterRuleCount = db.filterRuleDao().getAllOnce().count { !it.isDeleted },
            messageCount = messages.count { !it.isDeleted && !it.pendingPermanentDelete },
            appFilterCount = db.appFilterDao().getAllOnce().count { !it.isDeleted },
            planCount = db.planDao().getAllOnce().count { !it.isDeleted },
            dayCategoryCount = db.dayCategoryDao().getAllOnce().size
        )
    }

    fun parseBackupSummary(json: String): BackupSummary {
        val root = JSONObject(json)
        return BackupSummary(
            formatVersion = root.optInt("version", 0),
            dbVersion = root.optInt("dbVersion", 0),
            exportedAt = root.optLong("exportedAt", 0),
            categoryCount = root.optJSONArray("categories")?.length() ?: 0,
            statusStepCount = root.optJSONArray("statusSteps")?.length() ?: 0,
            filterRuleCount = root.optJSONArray("filterRules")?.length() ?: 0,
            messageCount = root.optJSONArray("messages")?.length() ?: 0,
            appFilterCount = root.optJSONArray("appFilters")?.length() ?: 0,
            planCount = root.optJSONArray("plans")?.length() ?: 0,
            dayCategoryCount = root.optJSONArray("dayCategories")?.length() ?: 0
        )
    }

    suspend fun exportToJson(options: ExportOptions = ExportOptions()): String {
        val root = JSONObject()
        root.put("version", BACKUP_FORMAT_VERSION)
        root.put("dbVersion", DB_VERSION)
        root.put("exportedAt", System.currentTimeMillis())

        // Categories + Filter rules (FK로 그룹)
        if (options.categories) {
            val categories = db.categoryDao().getAllOnce()
            root.put("categories", JSONArray().apply {
                categories.forEach { c ->
                    if (c.isDeleted) return@forEach
                    put(JSONObject().apply {
                        put("id", c.id)
                        put("name", c.name)
                        put("color", c.color)
                        put("orderIndex", c.orderIndex)
                        put("isActive", c.isActive)
                        put("isDeleted", c.isDeleted)
                        put("createdAt", c.createdAt)
                        put("updatedAt", c.updatedAt)
                    })
                }
            })

            val rules = db.filterRuleDao().getAllOnce()
            root.put("filterRules", JSONArray().apply {
                rules.forEach { r ->
                    if (r.isDeleted) return@forEach
                    put(JSONObject().apply {
                        put("id", r.id)
                        put("categoryId", r.categoryId)
                        put("senderKeywords", JSONArray().apply {
                            r.senderKeywords.forEach { item ->
                                put(JSONObject().apply {
                                    put("keyword", item.keyword)
                                    put("isEnabled", item.isEnabled)
                                })
                            }
                        })
                        put("includeWords", JSONArray().apply {
                            r.includeWords.forEach { item ->
                                put(JSONObject().apply {
                                    put("keyword", item.keyword)
                                    put("isEnabled", item.isEnabled)
                                })
                            }
                        })
                        put("conditionType", r.conditionType.name)
                        put("targetAppPackages", JSONArray().apply {
                            r.targetAppPackages.forEach { put(it) }
                        })
                        put("isActive", r.isActive)
                        put("isDeleted", r.isDeleted)
                        put("createdAt", r.createdAt)
                        put("updatedAt", r.updatedAt)
                    })
                }
            })
        } else {
            root.put("categories", JSONArray())
            root.put("filterRules", JSONArray())
        }

        // Status steps
        if (options.statusSteps) {
            val steps = db.statusStepDao().getAllOnce()
            root.put("statusSteps", JSONArray().apply {
                steps.forEach { s ->
                    if (s.isDeleted) return@forEach
                    put(JSONObject().apply {
                        put("id", s.id)
                        put("name", s.name)
                        put("orderIndex", s.orderIndex)
                        put("color", s.color)
                        put("isDeleted", s.isDeleted)
                        put("createdAt", s.createdAt)
                        put("updatedAt", s.updatedAt)
                    })
                }
            })
        } else {
            root.put("statusSteps", JSONArray())
        }

        // Messages
        if (options.messages) {
            val allMessages = db.capturedMessageDao().getAllOnce()
            root.put("messages", JSONArray().apply {
                allMessages.forEach { m ->
                    if (m.pendingPermanentDelete) return@forEach
                    put(JSONObject().apply {
                        put("id", m.id)
                        put("categoryId", m.categoryId ?: JSONObject.NULL)
                        put("matchedRuleId", m.matchedRuleId ?: JSONObject.NULL)
                        put("source", m.source)
                        put("appName", m.appName)
                        put("sender", m.sender)
                        put("content", m.content)
                        put("statusId", m.statusId ?: JSONObject.NULL)
                        put("comment", m.comment ?: JSONObject.NULL)
                        put("senderIcon", if (options.includeImages) (m.senderIcon ?: JSONObject.NULL) else JSONObject.NULL)
                        put("isArchived", m.isArchived)
                        put("isDeleted", m.isDeleted)
                        put("receivedAt", m.receivedAt)
                        put("updatedAt", m.updatedAt)
                        put("statusChangedAt", m.statusChangedAt ?: JSONObject.NULL)
                        put("statusHistory", m.statusHistory ?: JSONObject.NULL)
                        put("isPinned", m.isPinned)
                        put("snoozeAt", m.snoozeAt ?: JSONObject.NULL)
                        put("originalContent", m.originalContent ?: JSONObject.NULL)
                        put("attachedImage", if (options.includeImages) (m.attachedImage ?: JSONObject.NULL) else JSONObject.NULL)
                        put("roomName", m.roomName ?: JSONObject.NULL)
                        put("isRead", m.isRead)
                        put("deviceId", m.deviceId ?: JSONObject.NULL)
                        put("needsSync", m.needsSync)
                    })
                }
            })
        } else {
            root.put("messages", JSONArray())
        }

        // App filters
        if (options.appFilters) {
            val appFilters = db.appFilterDao().getAllOnce()
            root.put("appFilters", JSONArray().apply {
                appFilters.forEach { a ->
                    if (a.isDeleted) return@forEach
                    put(JSONObject().apply {
                        put("packageName", a.packageName)
                        put("appName", a.appName)
                        put("isAllowed", a.isAllowed)
                        put("isDeleted", a.isDeleted)
                        put("updatedAt", a.updatedAt)
                    })
                }
            })
        } else {
            root.put("appFilters", JSONArray())
        }

        // Plans
        if (options.plans) {
            val plans = db.planDao().getAllOnce()
            root.put("plans", JSONArray().apply {
                plans.forEach { p ->
                    if (p.isDeleted) return@forEach
                    put(JSONObject().apply {
                        put("id", p.id)
                        put("categoryId", p.categoryId ?: JSONObject.NULL)
                        put("date", p.date)
                        put("title", p.title)
                        put("isCompleted", p.isCompleted)
                        put("linkedMessageId", p.linkedMessageId ?: JSONObject.NULL)
                        put("orderNumber", p.orderNumber ?: JSONObject.NULL)
                        put("orderIndex", p.orderIndex)
                        put("isDeleted", p.isDeleted)
                        put("createdAt", p.createdAt)
                        put("updatedAt", p.updatedAt)
                    })
                }
            })
        } else {
            root.put("plans", JSONArray())
        }

        // Day categories
        if (options.dayCategories) {
            val dayCategories = db.dayCategoryDao().getAllOnce()
            root.put("dayCategories", JSONArray().apply {
                dayCategories.forEach { dc ->
                    put(JSONObject().apply {
                        put("id", dc.id)
                        put("date", dc.date)
                        put("categoryId", dc.categoryId)
                        put("createdAt", dc.createdAt)
                        put("updatedAt", dc.updatedAt)
                    })
                }
            })
        } else {
            root.put("dayCategories", JSONArray())
        }

        return root.toString(2)
    }

    suspend fun importFromJson(
        json: String,
        overwrite: Boolean,
        options: RestoreOptions = RestoreOptions()
    ) {
        val root = JSONObject(json)

        val formatVersion = root.optInt("version", 0)
        if (formatVersion > BACKUP_FORMAT_VERSION) {
            throw IllegalArgumentException("백업 파일이 현재 앱 버전보다 새롭습니다 (파일: v$formatVersion, 앱: v$BACKUP_FORMAT_VERSION). 앱을 업데이트해 주세요.")
        }

        db.withTransaction {
        // 선택된 테이블만 클리어 (FK 순서 준수)
        if (overwrite) {
            if (options.categories) {
                db.filterRuleDao().deleteAll()   // FK → categories
                db.dayCategoryDao().deleteAll()   // FK → categories
                db.categoryDao().deleteAll()
            }
            if (options.statusSteps) db.statusStepDao().deleteAll()
            if (options.messages) db.capturedMessageDao().deleteAll()
            if (options.appFilters) db.appFilterDao().deleteAll()
            if (options.plans) db.planDao().deleteAll()
            if (options.dayCategories && !options.categories) {
                // 카테고리 선택 시 이미 삭제됨
                db.dayCategoryDao().deleteAll()
            }
        }

        // Collect valid parent IDs to validate FK references
        val validCategoryIds = mutableSetOf<String>()
        val validStatusStepIds = mutableSetOf<String>()
        val validFilterRuleIds = mutableSetOf<String>()

        // 카테고리 미선택 시 기존 DB에서 유효 ID 수집 (메시지/플랜 FK 검증용)
        if (!options.categories) {
            db.categoryDao().getAllOnce().forEach { validCategoryIds.add(it.id) }
            db.filterRuleDao().getAllOnce().forEach { validFilterRuleIds.add(it.id) }
        }
        // 상태 단계 미선택 시 기존 DB에서 유효 ID 수집
        if (!options.statusSteps) {
            db.statusStepDao().getAllOnce().forEach { validStatusStepIds.add(it.id) }
        }

        // Categories (must be imported before filter rules due to FK)
        if (options.categories) {
            val categories = root.optJSONArray("categories")
            if (categories != null) {
                for (i in 0 until categories.length()) {
                    val c = categories.getJSONObject(i)
                    val id = c.optString("id", java.util.UUID.randomUUID().toString())
                    validCategoryIds.add(id)
                    db.categoryDao().upsert(
                        CategoryEntity(
                            id = id,
                            name = c.getString("name"),
                            color = c.getInt("color"),
                            orderIndex = c.optInt("orderIndex", i),
                            isActive = c.optBoolean("isActive", true),
                            isDeleted = c.optBoolean("isDeleted", false),
                            createdAt = c.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = c.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }

            // Also collect existing category IDs for merge mode
            if (!overwrite) {
                db.categoryDao().getAllOnce().forEach { validCategoryIds.add(it.id) }
            }

            // Filter rules (grouped with categories)
            val rules = root.optJSONArray("filterRules")
            if (rules != null) {
                for (i in 0 until rules.length()) {
                    val r = rules.getJSONObject(i)
                    val id = r.optString("id", java.util.UUID.randomUUID().toString())
                    val categoryId = r.getString("categoryId")
                    if (categoryId !in validCategoryIds) continue
                    validFilterRuleIds.add(id)
                    val senderKeywords = parseKeywordItems(r.optJSONArray("senderKeywords"))
                    val includeWords = parseKeywordItems(r.optJSONArray("includeWords"))
                    val conditionType = try {
                        ConditionType.valueOf(r.optString("conditionType", "AND"))
                    } catch (e: Exception) {
                        ConditionType.AND
                    }
                    val targetAppPackages = mutableListOf<String>().apply {
                        val arr = r.optJSONArray("targetAppPackages")
                        if (arr != null) {
                            for (j in 0 until arr.length()) {
                                add(arr.getString(j))
                            }
                        }
                    }
                    db.filterRuleDao().upsert(
                        FilterRuleEntity(
                            id = id,
                            categoryId = categoryId,
                            senderKeywords = senderKeywords,
                            includeWords = includeWords,
                            conditionType = conditionType,
                            targetAppPackages = targetAppPackages,
                            isActive = r.optBoolean("isActive", true),
                            isDeleted = r.optBoolean("isDeleted", false),
                            createdAt = r.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = r.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }

            // Also collect existing filter rule IDs for merge mode
            if (!overwrite) {
                db.filterRuleDao().getAllOnce().forEach { validFilterRuleIds.add(it.id) }
            }
        }

        // Status steps (must be imported before messages due to FK)
        if (options.statusSteps) {
            val steps = root.optJSONArray("statusSteps")
            if (steps != null) {
                for (i in 0 until steps.length()) {
                    val s = steps.getJSONObject(i)
                    val id = s.optString("id", java.util.UUID.randomUUID().toString())
                    validStatusStepIds.add(id)
                    db.statusStepDao().upsert(
                        StatusStepEntity(
                            id = id,
                            name = s.getString("name"),
                            orderIndex = s.getInt("orderIndex"),
                            color = s.getInt("color"),
                            isDeleted = s.optBoolean("isDeleted", false),
                            createdAt = s.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = s.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }

            // Also collect existing status step IDs for merge mode
            if (!overwrite) {
                db.statusStepDao().getAllOnce().forEach { validStatusStepIds.add(it.id) }
            }
        }

        // Messages — nullify FK references that point to non-existent parents
        if (options.messages) {
            val messages = root.optJSONArray("messages")
            if (messages != null) {
                for (i in 0 until messages.length()) {
                    val m = messages.getJSONObject(i)
                    val categoryId = if (m.isNull("categoryId")) null else m.getString("categoryId")
                    val matchedRuleId = if (m.isNull("matchedRuleId")) null else m.getString("matchedRuleId")
                    val statusId = if (m.isNull("statusId")) null else m.getString("statusId")
                    db.capturedMessageDao().upsert(
                        CapturedMessageEntity(
                            id = m.optString("id", java.util.UUID.randomUUID().toString()),
                            categoryId = if (categoryId != null && categoryId in validCategoryIds) categoryId else null,
                            matchedRuleId = if (matchedRuleId != null && matchedRuleId in validFilterRuleIds) matchedRuleId else null,
                            source = m.getString("source"),
                            appName = m.getString("appName"),
                            sender = m.getString("sender"),
                            content = m.getString("content"),
                            statusId = if (statusId != null && statusId in validStatusStepIds) statusId else null,
                            comment = if (m.isNull("comment")) null else m.getString("comment"),
                            senderIcon = if (m.has("senderIcon") && !m.isNull("senderIcon")) m.getString("senderIcon") else null,
                            isArchived = m.optBoolean("isArchived", false),
                            isDeleted = m.optBoolean("isDeleted", false),
                            receivedAt = m.getLong("receivedAt"),
                            updatedAt = m.optLong("updatedAt", System.currentTimeMillis()),
                            statusChangedAt = if (m.has("statusChangedAt") && !m.isNull("statusChangedAt")) m.getLong("statusChangedAt") else null,
                            statusHistory = if (m.has("statusHistory") && !m.isNull("statusHistory")) m.getString("statusHistory") else null,
                            isPinned = m.optBoolean("isPinned", false),
                            snoozeAt = if (m.has("snoozeAt") && !m.isNull("snoozeAt")) m.getLong("snoozeAt") else null,
                            originalContent = if (m.has("originalContent") && !m.isNull("originalContent")) m.getString("originalContent") else null,
                            attachedImage = if (m.has("attachedImage") && !m.isNull("attachedImage")) m.getString("attachedImage") else null,
                            roomName = if (m.has("roomName") && !m.isNull("roomName")) m.getString("roomName") else null,
                            isRead = m.optBoolean("isRead", false),
                            deviceId = if (m.has("deviceId") && !m.isNull("deviceId")) m.getString("deviceId") else null,
                            needsSync = m.optBoolean("needsSync", false)
                        )
                    )
                }
            }
        }

        // App filters
        if (options.appFilters) {
            val appFilters = root.optJSONArray("appFilters")
            if (appFilters != null) {
                for (i in 0 until appFilters.length()) {
                    val a = appFilters.getJSONObject(i)
                    db.appFilterDao().upsert(
                        AppFilterEntity(
                            packageName = a.getString("packageName"),
                            appName = a.getString("appName"),
                            isAllowed = a.optBoolean("isAllowed", true),
                            isDeleted = a.optBoolean("isDeleted", false),
                            updatedAt = a.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }
        }

        // Plans
        if (options.plans) {
            val plans = root.optJSONArray("plans")
            if (plans != null) {
                for (i in 0 until plans.length()) {
                    val p = plans.getJSONObject(i)
                    val categoryId = if (p.isNull("categoryId")) null else p.getString("categoryId")
                    db.planDao().upsert(
                        PlanEntity(
                            id = p.optString("id", java.util.UUID.randomUUID().toString()),
                            categoryId = if (categoryId != null && categoryId in validCategoryIds) categoryId else null,
                            date = p.getLong("date"),
                            title = p.getString("title"),
                            isCompleted = p.optBoolean("isCompleted", false),
                            linkedMessageId = if (p.has("linkedMessageId") && !p.isNull("linkedMessageId")) p.getString("linkedMessageId") else null,
                            orderNumber = if (p.has("orderNumber") && !p.isNull("orderNumber")) p.getString("orderNumber") else null,
                            orderIndex = p.optInt("orderIndex", 0),
                            isDeleted = p.optBoolean("isDeleted", false),
                            createdAt = p.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = p.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }
        }

        // Day categories
        if (options.dayCategories) {
            val dayCategories = root.optJSONArray("dayCategories")
            if (dayCategories != null) {
                for (i in 0 until dayCategories.length()) {
                    val dc = dayCategories.getJSONObject(i)
                    val categoryId = dc.getString("categoryId")
                    if (categoryId !in validCategoryIds) continue
                    db.dayCategoryDao().upsert(
                        DayCategoryEntity(
                            id = dc.optString("id", java.util.UUID.randomUUID().toString()),
                            date = dc.getLong("date"),
                            categoryId = categoryId,
                            createdAt = dc.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = dc.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }
        }
        } // db.withTransaction
    }

    /**
     * 모든 로컬 데이터를 삭제합니다.
     * @param isCloudMode 클라우드 모드 여부. true이면 서버 데이터가 다음 동기화 시 복원될 수 있음을 경고합니다.
     * @return 클라우드 모드일 경우 경고 메시지, 아니면 null
     */
    suspend fun resetAllData(isCloudMode: Boolean = false): String? {
        db.clearAllTables()
        return if (isCloudMode) {
            "⚠️ 로컬 데이터만 삭제되었습니다. 서버 데이터는 다음 동기화 시 다시 복원됩니다."
        } else null
    }

    private fun parseKeywordItems(arr: JSONArray?): List<KeywordItem> {
        if (arr == null) return emptyList()
        val result = mutableListOf<KeywordItem>()
        for (j in 0 until arr.length()) {
            val item = arr.get(j)
            when (item) {
                is JSONObject -> result.add(
                    KeywordItem(
                        keyword = item.getString("keyword"),
                        isEnabled = item.optBoolean("isEnabled", true)
                    )
                )
                is String -> result.add(KeywordItem(keyword = item, isEnabled = true))
                else -> result.add(KeywordItem(keyword = item.toString(), isEnabled = true))
            }
        }
        return result
    }
}
