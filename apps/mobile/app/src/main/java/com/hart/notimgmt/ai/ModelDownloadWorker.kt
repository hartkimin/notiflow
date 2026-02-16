package com.hart.notimgmt.ai

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.hart.notimgmt.R
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class ModelDownloadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        const val KEY_DOWNLOAD_URL = "download_url"
        const val KEY_FILE_NAME = "file_name"
        const val KEY_TOTAL_BYTES = "total_bytes"
        const val KEY_AUTH_TOKEN = "auth_token"
        const val PROGRESS_BYTES_DOWNLOADED = "bytes_downloaded"
        const val PROGRESS_TOTAL_BYTES = "progress_total_bytes"
        private const val CHANNEL_ID = "ai_model_download"
        private const val NOTIFICATION_ID = 9001
        private const val TAG = "ModelDownloadWorker"
        private const val BUFFER_SIZE = 8192
    }

    override suspend fun doWork(): Result {
        val downloadUrl = inputData.getString(KEY_DOWNLOAD_URL) ?: return Result.failure()
        val fileName = inputData.getString(KEY_FILE_NAME) ?: return Result.failure()
        val expectedTotalBytes = inputData.getLong(KEY_TOTAL_BYTES, 0L)
        val authToken = inputData.getString(KEY_AUTH_TOKEN)

        val modelsDir = applicationContext.getExternalFilesDir("ai_models") ?: return Result.failure()
        modelsDir.mkdirs()

        val partFile = File(modelsDir, "$fileName.part")
        val finalFile = File(modelsDir, fileName)

        createNotificationChannel()
        setForeground(createForegroundInfo(0, expectedTotalBytes))

        try {
            val existingBytes = if (partFile.exists()) partFile.length() else 0L

            val connection = (URL(downloadUrl).openConnection() as HttpURLConnection).apply {
                connectTimeout = 30_000
                readTimeout = 30_000
                if (!authToken.isNullOrBlank()) {
                    setRequestProperty("Authorization", "Bearer $authToken")
                }
                if (existingBytes > 0) {
                    setRequestProperty("Range", "bytes=$existingBytes-")
                }
            }

            val responseCode = connection.responseCode

            if (responseCode == 401 || responseCode == 403) {
                Log.e(TAG, "Authentication failed: $responseCode")
                connection.disconnect()
                return Result.failure(workDataOf("error_type" to "auth"))
            }

            val totalBytes: Long
            val startOffset: Long

            // Use header field for Content-Length to avoid int overflow on >2GB files
            val contentLengthHeader = connection.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L

            if (responseCode == 206) {
                // Partial content - resume supported
                val chunkSize = if (contentLengthHeader > 0) contentLengthHeader else expectedTotalBytes - existingBytes
                totalBytes = existingBytes + chunkSize
                startOffset = existingBytes
            } else if (responseCode == 200) {
                // Full content - start from scratch
                totalBytes = if (contentLengthHeader > 0) contentLengthHeader else expectedTotalBytes
                startOffset = 0L
                if (partFile.exists()) partFile.delete()
            } else {
                Log.e(TAG, "Unexpected response code: $responseCode")
                connection.disconnect()
                return Result.failure(workDataOf("error_type" to "network"))
            }

            connection.inputStream.use { input ->
                FileOutputStream(partFile, startOffset > 0).use { output ->
                    val buffer = ByteArray(BUFFER_SIZE)
                    var bytesRead: Int
                    var downloaded = startOffset

                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        if (isStopped) {
                            Log.d(TAG, "Download cancelled")
                            return Result.failure()
                        }

                        output.write(buffer, 0, bytesRead)
                        downloaded += bytesRead

                        // Update progress every 100KB
                        if (downloaded % (100 * 1024) < BUFFER_SIZE) {
                            setProgress(workDataOf(
                                PROGRESS_BYTES_DOWNLOADED to downloaded,
                                PROGRESS_TOTAL_BYTES to totalBytes
                            ))
                            setForeground(createForegroundInfo(downloaded, totalBytes))
                        }
                    }
                }
            }

            // Rename .part to final file
            partFile.renameTo(finalFile)

            Log.d(TAG, "Download completed: ${finalFile.absolutePath}")
            return Result.success()

        } catch (e: java.net.UnknownHostException) {
            Log.e(TAG, "No internet connection", e)
            return Result.failure(workDataOf("error_type" to "network"))
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "Connection timed out", e)
            return Result.failure(workDataOf("error_type" to "network"))
        } catch (e: Exception) {
            Log.e(TAG, "Download failed", e)
            return Result.failure(workDataOf("error_type" to "unknown"))
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AI 모델 다운로드",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "AI 분류 모델 다운로드 진행률"
        }
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun createForegroundInfo(downloaded: Long, total: Long): ForegroundInfo {
        val progress = if (total > 0) ((downloaded * 100) / total).toInt() else 0
        val downloadedMB = downloaded / (1024 * 1024)
        val totalMB = total / (1024 * 1024)

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("AI 모델 다운로드 중")
            .setContentText("${downloadedMB}MB / ${totalMB}MB ($progress%)")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setProgress(100, progress, total <= 0)
            .setOngoing(true)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }
}
