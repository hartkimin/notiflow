package com.hart.notimgmt.data.notiflow

import android.os.Build
import android.util.Log
import com.hart.notimgmt.data.db.entity.CapturedMessageEntity
import com.hart.notimgmt.data.preferences.AppPreferences
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class NotiFlowMessageBody(
    val source_app: String,
    val sender: String,
    val content: String,
    val received_at: String,
    val device_id: String
)

@Singleton
class NotiFlowApiClient @Inject constructor(
    private val httpClient: HttpClient,
    private val appPreferences: AppPreferences
) {
    companion object {
        private const val TAG = "NotiFlowApiClient"
    }

    private val json = Json { encodeDefaults = true }

    val isEnabled: Boolean get() = appPreferences.notiFlowEnabled

    suspend fun sendMessage(message: CapturedMessageEntity) {
        if (!isEnabled) return

        val apiUrl = appPreferences.notiFlowApiUrl
        val apiKey = appPreferences.notiFlowApiKey
        if (apiUrl.isBlank()) return

        val body = NotiFlowMessageBody(
            source_app = mapSourceApp(message.source),
            sender = message.sender,
            content = message.content,
            received_at = epochToIso8601(message.receivedAt),
            device_id = Build.MODEL
        )

        val jsonBody = json.encodeToString(NotiFlowMessageBody.serializer(), body)
        Log.d(TAG, "Sending to NotiFlow: $jsonBody")

        val response = httpClient.post("$apiUrl/api/v1/messages") {
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Authorization, "Bearer $apiKey")
            setBody(jsonBody)
        }

        Log.d(TAG, "NotiFlow response: ${response.status} - ${response.bodyAsText()}")
    }

    /**
     * Test connection to the NotiFlow API Gateway.
     * Returns a pair of (success, message).
     */
    suspend fun testConnection(): Pair<Boolean, String> {
        val apiUrl = appPreferences.notiFlowApiUrl
        val apiKey = appPreferences.notiFlowApiKey
        if (apiUrl.isBlank()) return Pair(false, "API URL이 비어있습니다")

        return try {
            val response = httpClient.post("$apiUrl/api/v1/messages") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $apiKey")
                setBody("""{"source_app":"other","sender":"test","content":"NotiFlow 연결 테스트","received_at":"${epochToIso8601(System.currentTimeMillis())}","device_id":"${Build.MODEL}"}""")
            }
            val statusCode = response.status.value
            if (statusCode in 200..299) {
                Pair(true, "연결 성공 ($statusCode)")
            } else {
                Pair(false, "서버 응답: $statusCode - ${response.bodyAsText().take(100)}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Connection test failed", e)
            Pair(false, "연결 실패: ${e.message?.take(100)}")
        }
    }

    private fun mapSourceApp(packageName: String): String = when {
        packageName.contains("kakao") -> "kakaotalk"
        packageName.contains("mms") || packageName.contains("sms") || packageName.contains("messaging") -> "sms"
        packageName.contains("telegram") -> "telegram"
        else -> "other"
    }

    private fun epochToIso8601(epochMs: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(epochMs))
    }
}
