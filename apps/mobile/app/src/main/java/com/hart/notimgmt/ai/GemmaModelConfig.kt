package com.hart.notimgmt.ai

enum class GemmaModelSize(
    val displayName: String,
    val modelId: String,
    val fileName: String,
    val sizeBytes: Long,
    val displaySize: String
) {
    E2B(
        displayName = "Gemma 3n E2B",
        modelId = "google/gemma-3n-E2B-it-litert-preview",
        fileName = "gemma-3n-E2B-it-int4.task",
        sizeBytes = 3_136_226_711L,
        displaySize = "3.1 GB"
    ),
    E4B(
        displayName = "Gemma 3n E4B",
        modelId = "google/gemma-3n-E4B-it-litert-preview",
        fileName = "gemma-3n-E4B-it-int4.task",
        sizeBytes = 4_405_655_031L,
        displaySize = "4.4 GB"
    );

    val downloadUrl: String
        get() = "https://huggingface.co/$modelId/resolve/main/$fileName"
}
