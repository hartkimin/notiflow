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
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BackupManager @Inject constructor(
    private val db: AppDatabase
) {
    companion object {
        private const val BACKUP_FORMAT_VERSION = 7
        private const val DB_VERSION = 18
    }

    suspend fun exportToJson(): String {
        val root = JSONObject()
        root.put("version", BACKUP_FORMAT_VERSION)
        root.put("dbVersion", DB_VERSION)
        root.put("exportedAt", System.currentTimeMillis())

        // Categories — getAllOnce() includes soft-deleted records (FK integrity)
        val categories = db.categoryDao().getAllOnce()
        root.put("categories", JSONArray().apply {
            categories.forEach { c ->
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

        // Status steps — getAllOnce() includes soft-deleted records (FK integrity)
        val steps = db.statusStepDao().getAllOnce()
        root.put("statusSteps", JSONArray().apply {
            steps.forEach { s ->
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

        // Filter rules — getAllOnce() includes soft-deleted records (FK integrity)
        val rules = db.filterRuleDao().getAllOnce()
        root.put("filterRules", JSONArray().apply {
            rules.forEach { r ->
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

        // Messages — getAllOnce() includes soft-deleted and all states (FK integrity)
        val allMessages = db.capturedMessageDao().getAllOnce()
        root.put("messages", JSONArray().apply {
            allMessages.forEach { m ->
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
                    put("senderIcon", m.senderIcon ?: JSONObject.NULL)
                    put("isArchived", m.isArchived)
                    put("isDeleted", m.isDeleted)
                    put("receivedAt", m.receivedAt)
                    put("updatedAt", m.updatedAt)
                    put("statusChangedAt", m.statusChangedAt ?: JSONObject.NULL)
                    put("statusHistory", m.statusHistory ?: JSONObject.NULL)
                    put("isPinned", m.isPinned)
                    put("snoozeAt", m.snoozeAt ?: JSONObject.NULL)
                    put("originalContent", m.originalContent ?: JSONObject.NULL)
                })
            }
        })

        // App filters — getAllOnce() includes soft-deleted records
        val appFilters = db.appFilterDao().getAllOnce()
        root.put("appFilters", JSONArray().apply {
            appFilters.forEach { a ->
                put(JSONObject().apply {
                    put("packageName", a.packageName)
                    put("appName", a.appName)
                    put("isAllowed", a.isAllowed)
                    put("isDeleted", a.isDeleted)
                    put("updatedAt", a.updatedAt)
                })
            }
        })

        // Plans — getAllOnce() includes soft-deleted records
        val plans = db.planDao().getAllOnce()
        root.put("plans", JSONArray().apply {
            plans.forEach { p ->
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

        // Day categories
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

        return root.toString(2)
    }

    suspend fun importFromJson(json: String, overwrite: Boolean) {
        val root = JSONObject(json)

        if (overwrite) {
            db.clearAllTables()
        }

        // Collect valid parent IDs to validate FK references
        val validCategoryIds = mutableSetOf<String>()
        val validStatusStepIds = mutableSetOf<String>()
        val validFilterRuleIds = mutableSetOf<String>()

        // Categories (must be imported before filter rules due to FK)
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

        // Status steps (must be imported before messages due to FK)
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

        // Filter rules
        val rules = root.optJSONArray("filterRules")
        if (rules != null) {
            for (i in 0 until rules.length()) {
                val r = rules.getJSONObject(i)
                val id = r.optString("id", java.util.UUID.randomUUID().toString())
                val categoryId = r.getString("categoryId")
                // Skip rule if its category doesn't exist (FK would fail)
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

        // Messages — nullify FK references that point to non-existent parents
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
                        originalContent = if (m.has("originalContent") && !m.isNull("originalContent")) m.getString("originalContent") else null
                    )
                )
            }
        }

        // App filters
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

        // Plans
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

        // Day categories
        val dayCategories = root.optJSONArray("dayCategories")
        if (dayCategories != null) {
            for (i in 0 until dayCategories.length()) {
                val dc = dayCategories.getJSONObject(i)
                val categoryId = dc.getString("categoryId")
                // Skip if category doesn't exist (FK would fail)
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

    suspend fun resetAllData() {
        db.clearAllTables()
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
