package com.hart.notimgmt.data.supabase

import android.util.Log
import com.hart.notimgmt.data.db.entity.*
import com.hart.notimgmt.data.model.ConditionType
import com.hart.notimgmt.data.model.KeywordItem
import com.hart.notimgmt.data.model.KeywordMatchType
import com.hart.notimgmt.data.model.SenderMatchType
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.exception.PostgrestRestException
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SupabaseDataSource @Inject constructor(
    private val postgrest: Postgrest,
    private val auth: Auth
) {
    companion object {
        private const val TAG = "SupabaseDataSource"
        const val MESSAGES_TABLE = "captured_messages"
        const val CATEGORIES_TABLE = "categories"
        const val FILTER_RULES_TABLE = "filter_rules"
        const val STATUS_STEPS_TABLE = "status_steps"
        const val APP_FILTERS_TABLE = "app_filters"
        const val PLANS_TABLE = "plans"
        const val DAY_CATEGORIES_TABLE = "day_categories"
        const val MOBILE_DEVICES_TABLE = "mobile_devices"
    }

    private val json = Json { prettyPrint = true }

    private val userId: String?
        get() = auth.currentUserOrNull()?.id

    // ========== Messages ==========

    suspend fun upsertMessage(message: CapturedMessageEntity, deviceId: String? = null) {
        val currentUserId = userId ?: return
        try {
            val dto = message.toSupabaseDto(currentUserId, deviceId)
            Log.d(TAG, "Upserting message: ${json.encodeToString(dto)}")
            postgrest.from(MESSAGES_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "Message upserted: ${message.id}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting message: ${message.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert message: ${message.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getMessages(): List<MessageDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting messages for user: $currentUserId")
        val result = postgrest.from(MESSAGES_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<MessageDto>()
        Log.d(TAG, "Got ${result.size} messages from Supabase")
        return result
    }

    suspend fun deleteMessages(ids: List<String>) {
        val currentUserId = userId ?: return
        try {
            Log.d(TAG, "Deleting messages from Supabase: $ids")
            postgrest.from(MESSAGES_TABLE).delete {
                filter {
                    isIn("id", ids)
                    eq("user_id", currentUserId)
                }
            }
            Log.d(TAG, "Messages deleted from Supabase: ${ids.size} items")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error deleting messages: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete messages: ${e.message}", e)
            throw e
        }
    }

    // ========== Categories ==========

    // ========== Categories ==========

    suspend fun upsertCategory(category: CategoryEntity) {
        val currentUserId = userId ?: return
        try {
            val dto = category.toSupabaseDto(currentUserId)
            Log.d(TAG, "Upserting category: ${json.encodeToString(dto)}")
            postgrest.from(CATEGORIES_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "Category upserted: ${category.id}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting category: ${category.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert category: ${category.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getCategories(): List<CategoryDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting categories for user: $currentUserId")
        val result = postgrest.from(CATEGORIES_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<CategoryDto>()
        Log.d(TAG, "Got ${result.size} categories from Supabase")
        return result
    }

    // ========== Filter Rules ==========

    suspend fun upsertFilterRule(rule: FilterRuleEntity) {
        val currentUserId = userId ?: return
        try {
            val dto = rule.toSupabaseDto(currentUserId)
            Log.d(TAG, "Upserting filter rule: ${json.encodeToString(dto)}")
            postgrest.from(FILTER_RULES_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "FilterRule upserted: ${rule.id}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting filter rule: ${rule.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert filter rule: ${rule.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getFilterRules(): List<FilterRuleDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting filter rules for user: $currentUserId")
        val result = postgrest.from(FILTER_RULES_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<FilterRuleDto>()
        Log.d(TAG, "Got ${result.size} filter rules from Supabase")
        return result
    }

    // ========== Status Steps ==========

    suspend fun upsertStatusStep(step: StatusStepEntity) {
        val currentUserId = userId ?: return
        try {
            val dto = step.toSupabaseDto(currentUserId)
            Log.d(TAG, "Upserting status step: ${json.encodeToString(dto)}")
            postgrest.from(STATUS_STEPS_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "StatusStep upserted: ${step.id}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting status step: ${step.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert status step: ${step.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getStatusSteps(): List<StatusStepDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting status steps for user: $currentUserId")
        val result = postgrest.from(STATUS_STEPS_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<StatusStepDto>()
        Log.d(TAG, "Got ${result.size} status steps from Supabase")
        return result
    }

    // ========== App Filters ==========

    suspend fun upsertAppFilter(filter: AppFilterEntity) {
        val currentUserId = userId ?: return
        try {
            val dto = filter.toSupabaseDto(currentUserId)
            Log.d(TAG, "Upserting app filter: ${json.encodeToString(dto)}")
            postgrest.from(APP_FILTERS_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "AppFilter upserted: ${filter.packageName}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting app filter: ${filter.packageName}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert app filter: ${filter.packageName}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getAppFilters(): List<AppFilterDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting app filters for user: $currentUserId")
        val result = postgrest.from(APP_FILTERS_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<AppFilterDto>()
        Log.d(TAG, "Got ${result.size} app filters from Supabase")
        return result
    }

    // ========== Plans ==========

    suspend fun upsertPlan(plan: PlanEntity) {
        val currentUserId = userId ?: return
        try {
            val dto = plan.toSupabaseDto(currentUserId)
            Log.d(TAG, "Upserting plan: ${json.encodeToString(dto)}")
            postgrest.from(PLANS_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "Plan upserted: ${plan.id}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting plan: ${plan.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert plan: ${plan.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getPlans(): List<PlanDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting plans for user: $currentUserId")
        val result = postgrest.from(PLANS_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<PlanDto>()
        Log.d(TAG, "Got ${result.size} plans from Supabase")
        return result
    }

    // ========== Day Categories ==========

    suspend fun upsertDayCategory(entity: DayCategoryEntity) {
        val currentUserId = userId ?: return
        try {
            val dto = entity.toSupabaseDto(currentUserId)
            Log.d(TAG, "Upserting day category: ${json.encodeToString(dto)}")
            postgrest.from(DAY_CATEGORIES_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "DayCategory upserted: ${entity.id}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting day category: ${entity.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert day category: ${entity.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun getDayCategories(): List<DayCategoryDto> {
        val currentUserId = userId ?: return emptyList()
        Log.d(TAG, "Getting day categories for user: $currentUserId")
        val result = postgrest.from(DAY_CATEGORIES_TABLE)
            .select { filter { eq("user_id", currentUserId) } }
            .decodeList<DayCategoryDto>()
        Log.d(TAG, "Got ${result.size} day categories from Supabase")
        return result
    }

    suspend fun deleteDayCategory(id: String) {
        val currentUserId = userId ?: return
        try {
            Log.d(TAG, "Deleting day category: $id")
            postgrest.from(DAY_CATEGORIES_TABLE).delete {
                filter {
                    eq("id", id)
                    eq("user_id", currentUserId)
                }
            }
            Log.d(TAG, "DayCategory deleted: $id")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error deleting day category: $id, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete day category: $id, message: ${e.message}", e)
            throw e
        }
    }

    // ========== Mobile Device Registration ==========

    suspend fun upsertMobileDevice(dto: MobileDeviceDto) {
        try {
            Log.d(TAG, "Upserting mobile device: ${dto.id}")
            postgrest.from(MOBILE_DEVICES_TABLE).upsert(dto) {
                onConflict = "id"
            }
            Log.d(TAG, "Mobile device upserted: ${dto.device_name}")
        } catch (e: PostgrestRestException) {
            Log.e(TAG, "Postgrest error upserting mobile device: ${dto.id}, error: ${e.error}, message: ${e.message}", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert mobile device: ${dto.id}, message: ${e.message}", e)
            throw e
        }
    }

    suspend fun clearSyncRequest(deviceId: String) {
        try {
            postgrest.from(MOBILE_DEVICES_TABLE).update({
                set("sync_requested_at", null as String?)
            }) {
                filter { eq("id", deviceId) }
            }
            Log.d(TAG, "Cleared sync_requested_at for device: $deviceId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear sync_requested_at: ${e.message}", e)
            throw e
        }
    }

    suspend fun updateLastSyncAt(deviceId: String, timestamp: String) {
        try {
            postgrest.from(MOBILE_DEVICES_TABLE).update({
                set("last_sync_at", timestamp)
            }) {
                filter { eq("id", deviceId) }
            }
            Log.d(TAG, "Updated last_sync_at for device: $deviceId to $timestamp")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update last_sync_at: ${e.message}", e)
            throw e
        }
    }
}

// ========== DTOs for Supabase ==========

@Serializable
data class MessageDto(
    val id: String,
    val user_id: String,
    val device_id: String? = null,
    val category_id: String? = null,
    val matched_rule_id: String? = null,
    val source: String,
    val app_name: String,
    val sender: String,
    val content: String,
    val status_id: String? = null,
    val comment: String? = null,
    val sender_icon: String? = null,
    val attached_image: String? = null,
    val is_archived: Boolean = false,
    val is_deleted: Boolean = false,
    val received_at: Long,
    val updated_at: Long,
    val status_changed_at: Long? = null,
    val status_history: String? = null,
    val is_pinned: Boolean = false,
    val snooze_at: Long? = null,
    val original_content: String? = null,
    val room_name: String? = null,
    val is_read: Boolean = false
) {
    fun toEntity() = CapturedMessageEntity(
        id = id,
        deviceId = device_id,
        categoryId = category_id,
        matchedRuleId = matched_rule_id,
        source = source,
        appName = app_name,
        sender = sender,
        content = content,
        statusId = status_id,
        comment = comment,
        senderIcon = sender_icon,
        attachedImage = attached_image,
        isArchived = is_archived,
        isDeleted = is_deleted,
        receivedAt = received_at,
        updatedAt = updated_at,
        statusChangedAt = status_changed_at,
        statusHistory = status_history,
        isPinned = is_pinned,
        snoozeAt = snooze_at,
        originalContent = original_content,
        roomName = room_name,
        isRead = is_read
    )
}

@Serializable
data class CategoryDto(
    val id: String,
    val user_id: String,
    val name: String,
    val color: Int,
    val order_index: Int = 0,
    val is_active: Boolean = true,
    val is_deleted: Boolean = false,
    val created_at: Long,
    val updated_at: Long
) {
    fun toEntity() = CategoryEntity(
        id = id,
        name = name,
        color = color,
        orderIndex = order_index,
        isActive = is_active,
        isDeleted = is_deleted,
        createdAt = created_at,
        updatedAt = updated_at
    )
}

@Serializable
data class FilterRuleDto(
    val id: String,
    val user_id: String,
    val category_id: String,
    val sender_keywords: List<String> = emptyList(),
    val sender_match_type: String = "CONTAINS",
    val sms_phone_number: String? = null,
    val include_words: List<String> = emptyList(),
    val exclude_words: List<String> = emptyList(),
    val include_match_type: String = "OR",
    val condition_type: String = "AND",
    val target_app_packages: List<String> = emptyList(),
    val is_active: Boolean = true,
    val is_deleted: Boolean = false,
    val created_at: Long,
    val updated_at: Long
) {
    fun toEntity() = FilterRuleEntity(
        id = id,
        categoryId = category_id,
        senderKeywords = sender_keywords.map { KeywordItem(keyword = it, isEnabled = true) },
        includeWords = include_words.map { KeywordItem(keyword = it, isEnabled = true) },
        conditionType = try { ConditionType.valueOf(condition_type) } catch (e: Exception) { ConditionType.AND },
        targetAppPackages = target_app_packages,
        senderMatchType = try { SenderMatchType.valueOf(sender_match_type) } catch (e: Exception) { SenderMatchType.CONTAINS },
        smsPhoneNumber = sms_phone_number,
        excludeWords = exclude_words,
        includeMatchType = try { KeywordMatchType.valueOf(include_match_type) } catch (e: Exception) { KeywordMatchType.OR },
        isActive = is_active,
        isDeleted = is_deleted,
        createdAt = created_at,
        updatedAt = updated_at
    )
}

@Serializable
data class StatusStepDto(
    val id: String,
    val user_id: String,
    val name: String,
    val order_index: Int,
    val color: Int,
    val is_deleted: Boolean = false,
    val created_at: Long,
    val updated_at: Long
) {
    fun toEntity() = StatusStepEntity(
        id = id,
        name = name,
        orderIndex = order_index,
        color = color,
        isDeleted = is_deleted,
        createdAt = created_at,
        updatedAt = updated_at
    )
}

@Serializable
data class AppFilterDto(
    val id: String,
    val user_id: String,
    val package_name: String,
    val app_name: String,
    val is_allowed: Boolean = true,
    val is_deleted: Boolean = false,
    val updated_at: Long
) {
    fun toEntity() = AppFilterEntity(
        packageName = package_name,
        appName = app_name,
        isAllowed = is_allowed,
        isDeleted = is_deleted,
        updatedAt = updated_at
    )
}

// ========== Entity to DTO extensions ==========

private fun CapturedMessageEntity.toSupabaseDto(userId: String, deviceId: String?) = MessageDto(
    id = id,
    user_id = userId,
    device_id = deviceId ?: this.deviceId,
    category_id = categoryId,
    matched_rule_id = matchedRuleId,
    source = source,
    app_name = appName,
    sender = sender,
    content = content,
    status_id = statusId,
    comment = comment,
    sender_icon = senderIcon,
    attached_image = attachedImage,
    is_archived = isArchived,
    is_deleted = isDeleted,
    received_at = receivedAt,
    updated_at = updatedAt,
    status_changed_at = statusChangedAt,
    status_history = statusHistory,
    is_pinned = isPinned,
    snooze_at = snoozeAt,
    original_content = originalContent,
    room_name = roomName,
    is_read = isRead
)

private fun CategoryEntity.toSupabaseDto(userId: String) = CategoryDto(
    id = id,
    user_id = userId,
    name = name,
    color = color,
    order_index = orderIndex,
    is_active = isActive,
    is_deleted = isDeleted,
    created_at = createdAt,
    updated_at = updatedAt
)

@Suppress("DEPRECATION")
private fun FilterRuleEntity.toSupabaseDto(userId: String) = FilterRuleDto(
    id = id,
    user_id = userId,
    category_id = categoryId,
    sender_keywords = senderKeywords.map { it.keyword },
    sender_match_type = senderMatchType.name,
    sms_phone_number = smsPhoneNumber,
    include_words = includeWords.map { it.keyword },
    exclude_words = excludeWords,
    include_match_type = includeMatchType.name,
    condition_type = conditionType.name,
    target_app_packages = targetAppPackages,
    is_active = isActive,
    is_deleted = isDeleted,
    created_at = createdAt,
    updated_at = updatedAt
)

private fun StatusStepEntity.toSupabaseDto(userId: String) = StatusStepDto(
    id = id,
    user_id = userId,
    name = name,
    order_index = orderIndex,
    color = color,
    is_deleted = isDeleted,
    created_at = createdAt,
    updated_at = updatedAt
)

private fun AppFilterEntity.toSupabaseDto(userId: String) = AppFilterDto(
    id = "${userId}_${packageName}",
    user_id = userId,
    package_name = packageName,
    app_name = appName,
    is_allowed = isAllowed,
    is_deleted = isDeleted,
    updated_at = updatedAt
)

@Serializable
data class PlanDto(
    val id: String,
    val user_id: String,
    val category_id: String? = null,
    val date: Long,
    val title: String,
    val is_completed: Boolean = false,
    val linked_message_id: String? = null,
    val order_number: String? = null,
    val order_index: Int = 0,
    val is_deleted: Boolean = false,
    val created_at: Long,
    val updated_at: Long
) {
    fun toEntity() = PlanEntity(
        id = id,
        categoryId = category_id,
        date = date,
        title = title,
        isCompleted = is_completed,
        linkedMessageId = linked_message_id,
        orderNumber = order_number,
        orderIndex = order_index,
        isDeleted = is_deleted,
        createdAt = created_at,
        updatedAt = updated_at
    )
}

private fun PlanEntity.toSupabaseDto(userId: String) = PlanDto(
    id = id,
    user_id = userId,
    category_id = categoryId,
    date = date,
    title = title,
    is_completed = isCompleted,
    linked_message_id = linkedMessageId,
    order_number = orderNumber,
    order_index = orderIndex,
    is_deleted = isDeleted,
    created_at = createdAt,
    updated_at = updatedAt
)

@Serializable
data class DayCategoryDto(
    val id: String,
    val user_id: String,
    val date: Long,
    val category_id: String,
    val created_at: Long,
    val updated_at: Long
) {
    fun toEntity() = DayCategoryEntity(
        id = id,
        date = date,
        categoryId = category_id,
        createdAt = created_at,
        updatedAt = updated_at
    )
}

private fun DayCategoryEntity.toSupabaseDto(userId: String) = DayCategoryDto(
    id = id,
    user_id = userId,
    date = date,
    category_id = categoryId,
    created_at = createdAt,
    updated_at = updatedAt
)

@Serializable
data class MobileDeviceDto(
    val id: String,
    val user_id: String,
    val device_name: String,
    val device_model: String? = null,
    val app_version: String,
    val os_version: String,
    val platform: String = "android",
    val fcm_token: String? = null,
    val last_sync_at: String? = null,
    val sync_requested_at: String? = null
)
