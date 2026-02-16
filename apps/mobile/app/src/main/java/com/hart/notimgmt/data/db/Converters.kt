package com.hart.notimgmt.data.db

import androidx.room.TypeConverter
import com.hart.notimgmt.data.model.ConditionType
import com.hart.notimgmt.data.model.KeywordItem
import com.hart.notimgmt.data.model.KeywordMatchType
import com.hart.notimgmt.data.model.SenderMatchType
import org.json.JSONArray
import org.json.JSONObject

class Converters {
    @TypeConverter
    fun fromStringList(value: List<String>): String {
        val jsonArray = JSONArray()
        value.forEach { jsonArray.put(it) }
        return jsonArray.toString()
    }

    @TypeConverter
    fun toStringList(value: String): List<String> {
        if (value.isEmpty() || value == "[]") return emptyList()
        return try {
            val jsonArray = JSONArray(value)
            (0 until jsonArray.length()).map { jsonArray.getString(it) }
        } catch (e: Exception) {
            if (value.contains("|||")) {
                value.split("|||")
            } else if (!value.startsWith("[")) {
                listOf(value)
            } else {
                emptyList()
            }
        }
    }

    @TypeConverter
    fun fromKeywordItemList(value: List<KeywordItem>): String {
        val jsonArray = JSONArray()
        value.forEach { item ->
            val obj = JSONObject().apply {
                put("keyword", item.keyword)
                put("isEnabled", item.isEnabled)
            }
            jsonArray.put(obj)
        }
        return jsonArray.toString()
    }

    @TypeConverter
    fun toKeywordItemList(value: String): List<KeywordItem> {
        if (value.isEmpty() || value == "[]") return emptyList()
        return try {
            val jsonArray = JSONArray(value)
            (0 until jsonArray.length()).map { index ->
                val item = jsonArray.get(index)
                when (item) {
                    is JSONObject -> KeywordItem(
                        keyword = item.getString("keyword"),
                        isEnabled = item.optBoolean("isEnabled", true)
                    )
                    is String -> KeywordItem(keyword = item, isEnabled = true)
                    else -> KeywordItem(keyword = item.toString(), isEnabled = true)
                }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    @TypeConverter
    fun fromSenderMatchType(value: SenderMatchType): String = value.name

    @TypeConverter
    fun toSenderMatchType(value: String): SenderMatchType = try {
        SenderMatchType.valueOf(value)
    } catch (e: IllegalArgumentException) {
        SenderMatchType.CONTAINS
    }

    @TypeConverter
    fun fromKeywordMatchType(value: KeywordMatchType): String = value.name

    @TypeConverter
    fun toKeywordMatchType(value: String): KeywordMatchType = try {
        KeywordMatchType.valueOf(value)
    } catch (e: IllegalArgumentException) {
        KeywordMatchType.OR
    }

    @TypeConverter
    fun fromConditionType(value: ConditionType): String = value.name

    @TypeConverter
    fun toConditionType(value: String): ConditionType = try {
        ConditionType.valueOf(value)
    } catch (e: IllegalArgumentException) {
        ConditionType.AND
    }
}
