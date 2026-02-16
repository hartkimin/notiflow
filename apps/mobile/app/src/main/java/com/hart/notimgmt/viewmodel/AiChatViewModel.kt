package com.hart.notimgmt.viewmodel

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.hart.notimgmt.ai.AiMessageClassifier
import com.hart.notimgmt.ai.AiModelManager
import com.hart.notimgmt.ai.DownloadProgress
import com.hart.notimgmt.ai.GemmaModelSize
import com.hart.notimgmt.ai.ModelDownloadWorker
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.data.repository.CategoryRepository
import com.hart.notimgmt.data.repository.MessageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import android.graphics.Bitmap
import kotlinx.coroutines.Job
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import javax.inject.Inject

data class PromptPreset(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val content: String
)

private const val TAG = "AiChatViewModel"

enum class ChatRole { USER, AI }

data class AttachedMessage(
    val id: String,
    val sender: String,
    val appName: String,
    val content: String,
    val receivedAt: Long,
    val categoryName: String = ""
)

data class ChatItem(
    val id: String = UUID.randomUUID().toString(),
    val role: ChatRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val imageBitmap: Bitmap? = null,
    val attachedMessages: List<AttachedMessage> = emptyList()
)

@HiltViewModel
class AiChatViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appPreferences: AppPreferences,
    private val modelManager: AiModelManager,
    private val classifier: AiMessageClassifier,
    private val workManager: WorkManager,
    private val messageRepository: MessageRepository,
    private val categoryRepository: CategoryRepository
) : ViewModel() {

    companion object {
        private const val DOWNLOAD_WORK_NAME = "ai_model_download"
        private const val MAX_CHAT_HISTORY = 50
    }

    // ===== Message Picker State =====
    private val _pickerMessages = MutableStateFlow<List<AttachedMessage>>(emptyList())
    val pickerMessages: StateFlow<List<AttachedMessage>> = _pickerMessages

    // Category list for picker filters
    private val _pickerCategories = MutableStateFlow<List<String>>(emptyList())
    val pickerCategories: StateFlow<List<String>> = _pickerCategories

    fun loadPickerMessages() {
        viewModelScope.launch {
            val categories = categoryRepository.getAllActiveOnce()
            val categoryMap = categories.associate { it.id to it.name }
            _pickerCategories.value = categories.map { it.name }.sorted()

            val all = messageRepository.getAllOnce()
            _pickerMessages.value = all
                .filter { !it.isDeleted && it.categoryId != null }
                .sortedByDescending { it.receivedAt }
                .take(200)
                .map {
                    AttachedMessage(
                        id = it.id,
                        sender = it.sender,
                        appName = it.appName,
                        content = it.content,
                        receivedAt = it.receivedAt,
                        categoryName = categoryMap[it.categoryId] ?: ""
                    )
                }
        }
    }

    // ===== Prompt Presets State =====
    private val _presets = MutableStateFlow<List<PromptPreset>>(emptyList())
    val presets: StateFlow<List<PromptPreset>> = _presets

    private val _selectedPresetId = MutableStateFlow("")
    val selectedPresetId: StateFlow<String> = _selectedPresetId

    fun addPreset(name: String, content: String) {
        val preset = PromptPreset(name = name, content = content)
        _presets.value = _presets.value + preset
        savePresets()
    }

    fun updatePreset(id: String, name: String, content: String) {
        _presets.value = _presets.value.map {
            if (it.id == id) it.copy(name = name, content = content) else it
        }
        savePresets()
    }

    fun deletePreset(id: String) {
        _presets.value = _presets.value.filter { it.id != id }
        savePresets()
        if (_selectedPresetId.value == id) {
            _selectedPresetId.value = ""
            appPreferences.aiSelectedPresetId = ""
        }
    }

    fun selectPreset(id: String) {
        val newId = if (_selectedPresetId.value == id) "" else id
        _selectedPresetId.value = newId
        appPreferences.aiSelectedPresetId = newId
    }

    private fun savePresets() {
        appPreferences.aiPromptPresets = serializePresets(_presets.value)
    }

    private fun parsePresets(json: String): List<PromptPreset> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                PromptPreset(
                    id = obj.getString("id"),
                    name = obj.getString("name"),
                    content = obj.getString("content")
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun serializePresets(presets: List<PromptPreset>): String {
        val arr = JSONArray()
        presets.forEach { p ->
            arr.put(JSONObject().apply {
                put("id", p.id)
                put("name", p.name)
                put("content", p.content)
            })
        }
        return arr.toString()
    }

    // ===== Chat State =====
    private val _messages = MutableStateFlow<List<ChatItem>>(emptyList())
    val messages: StateFlow<List<ChatItem>> = _messages

    private val _isGenerating = MutableStateFlow(false)
    val isGenerating: StateFlow<Boolean> = _isGenerating

    private val _streamingText = MutableStateFlow("")
    val streamingText: StateFlow<String> = _streamingText

    private var generationJob: Job? = null

    // ===== Model Management State =====
    private val _modelSize = MutableStateFlow(appPreferences.aiModelSize)
    val modelSize: StateFlow<GemmaModelSize> = _modelSize

    private val _isModelDownloaded = MutableStateFlow(false)
    val isModelDownloaded: StateFlow<Boolean> = _isModelDownloaded

    private val _downloadedFileSize = MutableStateFlow(0L)
    val downloadedFileSize: StateFlow<Long> = _downloadedFileSize

    val downloadProgress: StateFlow<DownloadProgress> = modelManager.downloadProgress

    private val _downloadError = MutableStateFlow<String?>(null)
    val downloadError: StateFlow<String?> = _downloadError

    // HuggingFace token state
    var curAccessToken: String = ""
        private set

    private val _isLoggedIn = MutableStateFlow(appPreferences.hasHfToken())
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn

    private val _tokenValidating = MutableStateFlow(false)
    val tokenValidating: StateFlow<Boolean> = _tokenValidating

    private val _tokenError = MutableStateFlow<String?>(null)
    val tokenError: StateFlow<String?> = _tokenError

    init {
        _presets.value = parsePresets(appPreferences.aiPromptPresets)
        _selectedPresetId.value = appPreferences.aiSelectedPresetId
        refreshModelState()
        resumeDownloadObservation()
        val stored = appPreferences.readHfAccessToken()
        if (stored != null) {
            curAccessToken = stored
        } else {
            val defaultToken = "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"
            appPreferences.saveHfTokenData(
                accessToken = defaultToken,
                refreshToken = "",
                expiresAt = System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000
            )
            curAccessToken = defaultToken
            _isLoggedIn.value = true
        }
    }

    override fun onCleared() {
        super.onCleared()
        _messages.value.forEach { it.imageBitmap?.recycle() }
        classifier.unload()
    }

    // ===== Chat Functions =====

    fun sendMessage(text: String, image: Bitmap? = null, attachedMessages: List<AttachedMessage> = emptyList()) {
        if ((text.isBlank() && attachedMessages.isEmpty()) || _isGenerating.value) return

        val userMessage = ChatItem(
            role = ChatRole.USER,
            content = text.trim(),
            imageBitmap = image,
            attachedMessages = attachedMessages
        )
        appendAndTrim(userMessage)
        _isGenerating.value = true
        _streamingText.value = ""

        generationJob = viewModelScope.launch {
            try {
                val prompt = buildChatPrompt(text.trim(), attachedMessages)
                val result = classifier.generate(
                    modelSize = _modelSize.value,
                    prompt = prompt,
                    image = image,
                    onPartialResult = { chunk ->
                        _streamingText.update { it + chunk }
                    }
                )

                val aiContent = result?.trim() ?: "응답을 생성하지 못했습니다."
                val aiMessage = ChatItem(role = ChatRole.AI, content = aiContent)
                appendAndTrim(aiMessage)
            } catch (e: Exception) {
                Log.e(TAG, "Generation error", e)
                val errorMessage = ChatItem(role = ChatRole.AI, content = "오류가 발생했습니다: ${e.message}")
                appendAndTrim(errorMessage)
            } finally {
                _isGenerating.value = false
                _streamingText.value = ""
            }
        }
    }

    private fun appendAndTrim(item: ChatItem) {
        _messages.update { current ->
            val newList = current + item
            if (newList.size > MAX_CHAT_HISTORY) {
                val kept = newList.takeLast(MAX_CHAT_HISTORY)
                val evicted = newList.take(newList.size - MAX_CHAT_HISTORY)
                evicted.forEach { it.imageBitmap?.recycle() }
                kept
            } else {
                newList
            }
        }
    }

    private fun buildChatPrompt(userMessage: String, attachedMessages: List<AttachedMessage> = emptyList()): String {
        val sb = StringBuilder()
        // Prepend active preset instruction if selected
        val activeContent = _presets.value
            .firstOrNull { it.id == _selectedPresetId.value }
            ?.content?.trim() ?: ""
        if (activeContent.isNotEmpty()) {
            sb.append("<start_of_turn>user\n[지침] $activeContent<end_of_turn>\n")
            sb.append("<start_of_turn>model\n알겠습니다.<end_of_turn>\n")
        }
        // Include recent chat history for context (last 6 messages, excluding the just-added user msg)
        val history = _messages.value.dropLast(1).takeLast(6)
        for (msg in history) {
            when (msg.role) {
                ChatRole.USER -> sb.append("<start_of_turn>user\n${msg.content}<end_of_turn>\n")
                ChatRole.AI -> sb.append("<start_of_turn>model\n${msg.content}<end_of_turn>\n")
            }
        }
        sb.append("<start_of_turn>user\n")
        if (attachedMessages.isNotEmpty()) {
            sb.append("[첨부된 메시지]\n")
            val dateFormat = java.text.SimpleDateFormat("M/d HH:mm", java.util.Locale.getDefault())
            attachedMessages.forEachIndexed { index, msg ->
                val truncatedContent = if (msg.content.length > 200) msg.content.take(200) + "..." else msg.content
                val time = dateFormat.format(java.util.Date(msg.receivedAt))
                sb.append("${index + 1}. [${msg.appName}] ${msg.sender}: $truncatedContent ($time)\n")
            }
            sb.append("\n")
        }
        sb.append("$userMessage<end_of_turn>\n")
        sb.append("<start_of_turn>model\n")
        return sb.toString()
    }

    fun clearChat() {
        generationJob?.cancel()
        generationJob = null
        _isGenerating.value = false
        _messages.value.forEach { it.imageBitmap?.recycle() }
        _messages.value = emptyList()
        _streamingText.value = ""
    }

    // ===== Model Management =====

    fun selectModel(size: GemmaModelSize) {
        if (size != _modelSize.value) {
            classifier.unload()
        }
        appPreferences.aiModelSize = size
        _modelSize.value = size
        refreshModelState()
    }

    fun clearDownloadError() { _downloadError.value = null }
    fun clearTokenError() { _tokenError.value = null }

    fun validateAndSaveToken(token: String) {
        viewModelScope.launch {
            _tokenValidating.value = true
            _tokenError.value = null
            try {
                val valid = withContext(Dispatchers.IO) { verifyHfToken(token) }
                if (valid) {
                    appPreferences.saveHfTokenData(
                        accessToken = token,
                        refreshToken = "",
                        expiresAt = System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000
                    )
                    curAccessToken = token
                    _isLoggedIn.value = true
                } else {
                    _tokenError.value = "유효하지 않은 토큰입니다."
                }
            } catch (e: Exception) {
                _tokenError.value = e.message ?: "토큰 검증 실패"
            } finally {
                _tokenValidating.value = false
            }
        }
    }

    private fun verifyHfToken(token: String): Boolean {
        val url = URL("https://huggingface.co/api/whoami-v2")
        val connection = url.openConnection() as HttpURLConnection
        return try {
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.connect()
            connection.responseCode == HttpURLConnection.HTTP_OK
        } finally {
            connection.disconnect()
        }
    }

    fun logoutHf() {
        appPreferences.clearHfTokenData()
        curAccessToken = ""
        _isLoggedIn.value = false
    }

    fun getModelUrlResponse(accessToken: String? = null): Int {
        val downloadUrl = _modelSize.value.downloadUrl
        val connection = URL(downloadUrl).openConnection() as HttpURLConnection
        return try {
            if (accessToken != null) {
                connection.setRequestProperty("Authorization", "Bearer $accessToken")
            }
            connection.connect()
            connection.responseCode
        } catch (e: Exception) {
            Log.e(TAG, "getModelUrlResponse error: $e")
            -1
        } finally {
            connection.disconnect()
        }
    }

    fun setDownloadError(message: String) {
        _downloadError.value = message
    }

    fun startDownloadWithToken(accessToken: String?) {
        val size = _modelSize.value

        modelManager.updateProgress(DownloadProgress(
            isDownloading = true,
            bytesDownloaded = 0L,
            totalBytes = size.sizeBytes,
            modelSize = size
        ))
        _downloadError.value = null

        val request = OneTimeWorkRequestBuilder<ModelDownloadWorker>()
            .setInputData(workDataOf(
                ModelDownloadWorker.KEY_DOWNLOAD_URL to size.downloadUrl,
                ModelDownloadWorker.KEY_FILE_NAME to size.fileName,
                ModelDownloadWorker.KEY_TOTAL_BYTES to size.sizeBytes,
                ModelDownloadWorker.KEY_AUTH_TOKEN to (accessToken ?: "")
            ))
            .build()

        workManager.enqueueUniqueWork(
            DOWNLOAD_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            request
        )

        observeDownload(size)
    }

    private fun resumeDownloadObservation() {
        observeDownload(_modelSize.value)
    }

    private fun observeDownload(size: GemmaModelSize) {
        viewModelScope.launch {
            workManager.getWorkInfosForUniqueWorkFlow(DOWNLOAD_WORK_NAME)
                .collect { workInfos ->
                    val workInfo = workInfos.firstOrNull() ?: return@collect
                    when (workInfo.state) {
                        WorkInfo.State.ENQUEUED -> {
                            modelManager.updateProgress(DownloadProgress(
                                isDownloading = true,
                                bytesDownloaded = 0L,
                                totalBytes = size.sizeBytes,
                                modelSize = size
                            ))
                        }
                        WorkInfo.State.RUNNING -> {
                            val downloaded = workInfo.progress.getLong(
                                ModelDownloadWorker.PROGRESS_BYTES_DOWNLOADED, 0L
                            )
                            val total = workInfo.progress.getLong(
                                ModelDownloadWorker.PROGRESS_TOTAL_BYTES, size.sizeBytes
                            )
                            modelManager.updateProgress(DownloadProgress(
                                isDownloading = true,
                                bytesDownloaded = downloaded,
                                totalBytes = total,
                                modelSize = size
                            ))
                        }
                        WorkInfo.State.SUCCEEDED -> {
                            modelManager.clearProgress()
                            refreshModelState()
                        }
                        WorkInfo.State.FAILED -> {
                            modelManager.clearProgress()
                            val errorType = workInfo.outputData.getString("error_type")
                            _downloadError.value = when (errorType) {
                                "auth" -> "인증 실패. 토큰을 확인하거나 다시 로그인하세요."
                                "network" -> "네트워크 연결을 확인하고 다시 시도하세요."
                                else -> "다운로드 실패. 다시 시도하세요."
                            }
                        }
                        WorkInfo.State.CANCELLED -> {
                            modelManager.clearProgress()
                        }
                        else -> {}
                    }
                }
        }
    }

    fun cancelDownload() {
        workManager.cancelUniqueWork(DOWNLOAD_WORK_NAME)
        modelManager.clearProgress()
    }

    fun deleteModel() {
        classifier.unload()
        val size = _modelSize.value
        modelManager.deleteModel(size)
        refreshModelState()
    }

    fun refreshModelState() {
        viewModelScope.launch {
            val size = _modelSize.value
            val downloaded = withContext(Dispatchers.IO) { modelManager.isModelDownloaded(size) }
            val fileSize = withContext(Dispatchers.IO) { modelManager.getDownloadedSize(size) }
            _isModelDownloaded.value = downloaded
            _downloadedFileSize.value = fileSize
        }
    }
}
