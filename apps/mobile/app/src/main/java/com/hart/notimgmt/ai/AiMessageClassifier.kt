package com.hart.notimgmt.ai

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

@Singleton
class AiMessageClassifier @Inject constructor(
    @ApplicationContext private val context: Context,
    private val modelManager: AiModelManager
) {
    companion object {
        private const val TAG = "AiMessageClassifier"
        private const val IDLE_TIMEOUT_MS = 120_000L
        private const val INFERENCE_TIMEOUT_MS = 60_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private var engine: LlmInference? = null
    private var idleJob: Job? = null

    private suspend fun getOrCreateEngine(modelPath: String): LlmInference? {
        engine?.let { return it }

        return try {
            Log.d(TAG, "Loading model: $modelPath")
            val options = LlmInference.LlmInferenceOptions.builder()
                .setModelPath(modelPath)
                .setMaxTokens(1024)
                .setPreferredBackend(LlmInference.Backend.GPU)
                .setMaxNumImages(1)
                .build()

            val inference = LlmInference.createFromOptions(context, options)
            engine = inference
            Log.d(TAG, "Model loaded successfully")
            inference
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load model, trying CPU fallback", e)
            try {
                val cpuOptions = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelPath)
                    .setMaxTokens(1024)
                    .setPreferredBackend(LlmInference.Backend.CPU)
                    .setMaxNumImages(1)
                    .build()
                val inference = LlmInference.createFromOptions(context, cpuOptions)
                engine = inference
                Log.d(TAG, "Model loaded with CPU fallback")
                inference
            } catch (cpuError: Exception) {
                Log.e(TAG, "CPU fallback also failed", cpuError)
                null
            }
        }
    }

    suspend fun generate(
        modelSize: GemmaModelSize,
        prompt: String,
        image: Bitmap? = null,
        temperature: Float = 0.7f,
        topK: Int = 40,
        onPartialResult: ((String) -> Unit)? = null
    ): String? = mutex.withLock {
        withContext(Dispatchers.IO) {
            val modelPath = modelManager.getModelPath(modelSize) ?: run {
                Log.w(TAG, "Model not downloaded: ${modelSize.displayName}")
                return@withContext null
            }

            val inference = getOrCreateEngine(modelPath) ?: return@withContext null

            resetIdleTimer()

            withTimeoutOrNull(INFERENCE_TIMEOUT_MS) {
                var session: LlmInferenceSession? = null
                try {
                    val sessionOptionsBuilder = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                        .setTopK(topK)
                        .setTopP(0.95f)
                        .setTemperature(temperature)

                    // Only enable vision modality when image is provided
                    if (image != null) {
                        sessionOptionsBuilder.setGraphOptions(
                            GraphOptions.builder()
                                .setEnableVisionModality(true)
                                .build()
                        )
                    }

                    session = LlmInferenceSession.createFromOptions(
                        inference,
                        sessionOptionsBuilder.build()
                    )

                    val result = suspendCancellableCoroutine { continuation ->
                        val sb = StringBuilder()

                        continuation.invokeOnCancellation {
                            try {
                                session?.close()
                                session = null
                            } catch (e: Exception) {
                                Log.w(TAG, "Session close on cancellation", e)
                            }
                        }

                        session!!.addQueryChunk(prompt)
                        if (image != null) {
                            val mpImage = BitmapImageBuilder(image).build()
                            try {
                                session!!.addImage(mpImage)
                            } finally {
                                mpImage.close()
                            }
                        }
                        session!!.generateResponseAsync { partialResult, done ->
                            sb.append(partialResult)
                            onPartialResult?.invoke(partialResult)
                            if (done && continuation.isActive) {
                                continuation.resume(sb.toString())
                            }
                        }
                    }

                    Log.d(TAG, "Generation complete (${result.length} chars)")
                    result
                } catch (e: Exception) {
                    Log.e(TAG, "Generation failed", e)
                    // Clear engine on error to prevent reusing corrupted state
                    try { engine?.close() } catch (_: Exception) {}
                    engine = null
                    idleJob?.cancel()
                    idleJob = null
                    null
                } finally {
                    try { session?.close() } catch (_: Exception) {}
                }
            }
        }
    }

    private fun resetIdleTimer() {
        idleJob?.cancel()
        idleJob = scope.launch {
            delay(IDLE_TIMEOUT_MS)
            safeUnload()
        }
    }

    private suspend fun safeUnload() = mutex.withLock {
        performUnload()
    }

    fun unload() {
        scope.launch { safeUnload() }
    }

    private fun performUnload() {
        try {
            engine?.close()
            Log.d(TAG, "Model unloaded")
        } catch (e: Exception) {
            Log.e(TAG, "Error unloading model", e)
        }
        engine = null
        idleJob?.cancel()
        idleJob = null
    }
}
