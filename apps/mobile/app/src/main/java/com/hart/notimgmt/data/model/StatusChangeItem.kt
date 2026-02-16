package com.hart.notimgmt.data.model

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class StatusChangeItem(
    val id: String = UUID.randomUUID().toString(),
    val fromStatusId: String?,
    val fromStatusName: String?,
    val toStatusId: String,
    val toStatusName: String,
    val changedAt: Long = System.currentTimeMillis()
)

fun parseStatusHistory(json: String?): List<StatusChangeItem> {
    if (json.isNullOrBlank()) return emptyList()
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            StatusChangeItem(
                id = obj.optString("id", UUID.randomUUID().toString()),
                fromStatusId = if (obj.isNull("fromStatusId")) null else obj.optString("fromStatusId"),
                fromStatusName = if (obj.isNull("fromStatusName")) null else obj.optString("fromStatusName"),
                toStatusId = obj.getString("toStatusId"),
                toStatusName = obj.optString("toStatusName", ""),
                changedAt = obj.optLong("changedAt", System.currentTimeMillis())
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

fun serializeStatusHistory(items: List<StatusChangeItem>): String? {
    if (items.isEmpty()) return null
    val array = JSONArray()
    items.forEach { item ->
        val obj = JSONObject().apply {
            put("id", item.id)
            put("fromStatusId", item.fromStatusId ?: JSONObject.NULL)
            put("fromStatusName", item.fromStatusName ?: JSONObject.NULL)
            put("toStatusId", item.toStatusId)
            put("toStatusName", item.toStatusName)
            put("changedAt", item.changedAt)
        }
        array.put(obj)
    }
    return array.toString()
}
