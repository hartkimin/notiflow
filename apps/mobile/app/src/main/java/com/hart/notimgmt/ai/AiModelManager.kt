package com.hart.notimgmt.ai

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

data class DownloadProgress(
    val isDownloading: Boolean = false,
    val bytesDownloaded: Long = 0L,
    val totalBytes: Long = 0L,
    val modelSize: GemmaModelSize? = null
) {
    val progress: Float
        get() = if (totalBytes > 0) bytesDownloaded.toFloat() / totalBytes else 0f
}

@Singleton
class AiModelManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val modelsDir: File
        get() = File(context.getExternalFilesDir("ai_models")?.absolutePath ?: "")

    private val _downloadProgress = MutableStateFlow(DownloadProgress())
    val downloadProgress: StateFlow<DownloadProgress> = _downloadProgress

    fun getModelPath(size: GemmaModelSize): String? {
        val file = File(modelsDir, size.fileName)
        return if (file.exists() && file.length() > 0) file.absolutePath else null
    }

    fun isModelDownloaded(size: GemmaModelSize): Boolean {
        val file = File(modelsDir, size.fileName)
        return file.exists() && file.length() > 0
    }

    fun getDownloadedSize(size: GemmaModelSize): Long {
        val file = File(modelsDir, size.fileName)
        return if (file.exists()) file.length() else 0L
    }

    fun deleteModel(size: GemmaModelSize): Boolean {
        val file = File(modelsDir, size.fileName)
        val partFile = File(modelsDir, "${size.fileName}.part")
        partFile.delete()
        return file.delete()
    }

    fun getPartialFile(size: GemmaModelSize): File {
        modelsDir.mkdirs()
        return File(modelsDir, "${size.fileName}.part")
    }

    fun getFinalFile(size: GemmaModelSize): File {
        modelsDir.mkdirs()
        return File(modelsDir, size.fileName)
    }

    fun updateProgress(progress: DownloadProgress) {
        _downloadProgress.value = progress
    }

    fun clearProgress() {
        _downloadProgress.value = DownloadProgress()
    }
}
