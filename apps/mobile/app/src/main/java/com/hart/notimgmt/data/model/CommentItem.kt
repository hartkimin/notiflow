package com.hart.notimgmt.data.model

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class CommentItem(
    val id: String = UUID.randomUUID().toString(),
    val content: String,
    val createdAt: Long = System.currentTimeMillis()
)

fun parseComments(json: String?): List<CommentItem> {
    if (json.isNullOrBlank()) return emptyList()
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            CommentItem(
                id = obj.optString("id", UUID.randomUUID().toString()),
                content = obj.getString("content"),
                createdAt = obj.optLong("createdAt", System.currentTimeMillis())
            )
        }
    } catch (e: Exception) {
        // Legacy: plain text comment -> convert to single CommentItem
        listOf(CommentItem(content = json, createdAt = 0L))
    }
}

fun serializeComments(comments: List<CommentItem>): String? {
    if (comments.isEmpty()) return null
    val array = JSONArray()
    comments.forEach { item ->
        val obj = JSONObject().apply {
            put("id", item.id)
            put("content", item.content)
            put("createdAt", item.createdAt)
        }
        array.put(obj)
    }
    return array.toString()
}
